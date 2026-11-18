import { z } from "zod";
import { CATEGORIES, FALLBACK_CATEGORY, isCategoryId, type CategoryId } from "./categories";
import { normalizeTitle } from "./normalize";
import { getKV, type KV } from "./redis";

/** Redis hash: normalized title → "<categoryId>|llm" or "<categoryId>|user". */
export const CATEGORY_HASH = "cats";
const BATCH_SIZE = 50;

export type CategorySource = "llm" | "user" | "fallback";
export type Classification = { category: CategoryId; source: CategorySource };

/** Classifies a batch of titles; returns one category per title (same order), or throws. */
export type LlmClassifier = (titles: string[]) => Promise<CategoryId[]>;

function parseStored(value: string | null): Classification | null {
  if (!value) return null;
  const [category, source] = value.split("|");
  if (!isCategoryId(category)) return null;
  return { category, source: source === "user" ? "user" : "llm" };
}

/**
 * Returns a category for every title (aligned with the input array).
 * Cached answers (and user corrections) come from Redis; the rest go to the LLM
 * in batches and are cached. If the LLM fails, those items fall back to "other"
 * without being cached, so they are retried on the next request.
 */
export async function classifyTitles(
  titles: string[],
  opts: { kv?: KV; llm?: LlmClassifier | null; quiet?: boolean } = {},
): Promise<Classification[]> {
  if (titles.length === 0) return [];
  const kv = opts.kv ?? getKV();
  const llm = opts.llm === undefined ? defaultLlm() : opts.llm;

  const keys = titles.map(normalizeTitle);
  const uniqueKeys = [...new Set(keys)];
  const stored = await kv.hgetMany(CATEGORY_HASH, uniqueKeys);

  const result = new Map<string, Classification>();
  const misses: { key: string; title: string }[] = [];
  uniqueKeys.forEach((key, i) => {
    const hit = parseStored(stored[i]);
    if (hit) result.set(key, hit);
    else misses.push({ key, title: titles[keys.indexOf(key)].trim() });
  });

  if (misses.length > 0 && !opts.quiet) {
    console.info(
      `[classify] ${uniqueKeys.length} distinct items: ${uniqueKeys.length - misses.length} from DB, ${misses.length} new → ${llm ? "Groq" : "no LLM configured"}`,
    );
  }

  if (misses.length > 0 && llm) {
    const answers = await classifyMisses(misses, llm, kv);
    for (const [key, category] of answers) result.set(key, { category, source: "llm" });
  }

  return keys.map((key) => result.get(key) ?? { category: FALLBACK_CATEGORY, source: "fallback" });
}

// Requests for the same item names that arrive at the same time (two phones
// polling, focus + visibility events) share one LLM call instead of each
// spending the Groq per-minute token budget.
const inFlight = new Map<string, Promise<CategoryId | null>>();

async function classifyMisses(
  misses: { key: string; title: string }[],
  llm: LlmClassifier,
  kv: KV,
): Promise<Map<string, CategoryId>> {
  const waiting: Promise<void>[] = [];
  const answers = new Map<string, CategoryId>();
  const mine = misses.filter((m) => {
    const pending = inFlight.get(m.key);
    if (!pending) return true;
    waiting.push(pending.then((c) => void (c && answers.set(m.key, c))));
    return false;
  });

  // Register our keys before the first await so concurrent callers can join them.
  const settle = new Map<string, (c: CategoryId | null) => void>();
  for (const m of mine) {
    inFlight.set(m.key, new Promise((resolve) => settle.set(m.key, resolve)));
  }

  try {
    // Batches run one after another to stay within the provider's tokens-per-minute limit.
    for (let i = 0; i < mine.length; i += BATCH_SIZE) {
      const batch = mine.slice(i, i + BATCH_SIZE);
      const toCache: Record<string, string> = {};
      try {
        const categories = await llm(batch.map((m) => m.title));
        batch.forEach((m, j) => {
          const category = categories[j];
          if (!isCategoryId(category)) return;
          answers.set(m.key, category);
          toCache[m.key] = `${category}|llm`;
        });
        await kv.hsetMany(CATEGORY_HASH, toCache);
      } catch (err) {
        console.error("[classify] LLM batch failed:", err instanceof Error ? err.message : err);
      }
      for (const m of batch) settle.get(m.key)?.(answers.get(m.key) ?? null);
    }
  } finally {
    for (const m of mine) {
      settle.get(m.key)?.(answers.get(m.key) ?? null);
      inFlight.delete(m.key);
    }
  }

  await Promise.all(waiting);
  return answers;
}

/** Saves a manual correction for this item name; it wins over the LLM forever. */
export async function setCategoryOverride(title: string, category: CategoryId, kv: KV = getKV()) {
  await kv.hsetMany(CATEGORY_HASH, { [normalizeTitle(title)]: `${category}|user` });
}

// ---------------------------------------------------------------- Groq ----

export const SYSTEM_PROMPT = `You sort grocery shopping-list items into supermarket sections for an Israeli family.
Items are usually in Hebrew (sometimes English, brand names, typos, or with quantities like "2", "x3", "1 ק\"ג", "3%").
Pick the section where a shopper in an Israeli supermarket (Shufersal, Rami Levy, Victory, Yochananof) would find the item.

Sections (id — Hebrew name — what belongs there):
${CATEGORIES.map((c) => `- ${c.id} — ${c.name} — ${c.hint}`).join("\n")}

Examples: עגבניות→produce, פטרוזיליה→produce, פיתות→bakery, חלה→bakery, חלב 3%→dairy, שוקו→dairy, קוטג'→dairy, ביצים→dairy, גבינה צהובה→dairy, נקניקיות→deli, חומוס→deli, זיתים→deli, חזה עוף→meat, בשר טחון→meat, סלמון→meat, שניצל תירס→frozen, גלידה→frozen, אפונה קפואה→frozen, פסטה→pantry, אורז→pantry, טונה→pantry, קמח→pantry, שמן זית→spices, כמון→spices, טחינה גולמית→spices, קטשופ→spices, קורנפלקס→breakfast, קפה→breakfast, נוטלה→breakfast, במבה→snacks, ביסלי→snacks, שוקולד→snacks, קולה→drinks, מים מינרלים→drinks, יין→drinks, נייר טואלט→cleaning, אבקת כביסה→cleaning, שקיות זבל→cleaning, שמפו→personal, משחת שיניים→personal, טיטולים→baby, מטרנה→baby, אוכל לחתול→other, סוללות→other.

Rules:
- Use only the section ids listed above. If unsure, choose the most likely section; use "other" only for non-grocery items.
- Answer for every item, keeping its index "i".
- Reply with JSON only, exactly in this shape: {"results":[{"i":0,"c":"produce"},{"i":1,"c":"dairy"}]}`;

const ResponseSchema = z.object({
  results: z.array(z.object({ i: z.coerce.number().int(), c: z.string() })),
});

/** Parses the model's JSON reply into one category per input item ("other" for anything missing or invalid). */
export function parseLlmResponse(content: string, count: number): CategoryId[] {
  const parsed = ResponseSchema.parse(JSON.parse(content));
  const out: CategoryId[] = Array.from({ length: count }, () => FALLBACK_CATEGORY);
  for (const { i, c } of parsed.results) {
    const id = c.trim().toLowerCase();
    if (i >= 0 && i < count && isCategoryId(id)) out[i] = id;
  }
  return out;
}

export function groqClassifier(apiKey: string, model: string): LlmClassifier {
  return async (titles) => {
    const items = titles.map((t, i) => ({ i, t }));
    const body = JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      // Groq reserves prompt + max tokens against the per-minute limit, so keep the cap realistic
      // (each answer is ~11 tokens, plus a little reasoning).
      max_completion_tokens: 500 + 25 * titles.length,
      ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Items:\n${JSON.stringify(items)}` },
      ],
    });
    const send = () =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(25_000),
      });

    let res = await send();
    if (res.status === 429) {
      // Rate limited: wait once if Groq says it is only a few seconds.
      const wait = Number(res.headers.get("retry-after"));
      if (Number.isFinite(wait) && wait > 0 && wait <= 8) {
        await new Promise((r) => setTimeout(r, wait * 1000));
        res = await send();
      }
    }
    if (!res.ok) {
      throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Groq returned an empty response");
    return parseLlmResponse(content, titles.length);
  };
}

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

function defaultLlm(): LlmClassifier | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn("[classify] GROQ_API_KEY is not set — new items go to 'other'.");
    return null;
  }
  return groqClassifier(key, process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL);
}
