import { describe, expect, it, vi } from "vitest";
import type { CategoryId } from "../lib/categories";
import { CATEGORY_HASH, classifyTitles, parseLlmResponse, setCategoryOverride } from "../lib/classify";
import { memoryKV } from "../lib/redis";

const fakeLlm = (map: Record<string, CategoryId>) =>
  vi.fn(async (titles: string[]) => titles.map((t) => map[t] ?? "other"));

describe("classifyTitles", () => {
  it("asks the LLM only for unknown items and caches the answers", async () => {
    const kv = memoryKV();
    const llm = fakeLlm({ "עגבניות": "produce", "חלב 3%": "dairy" });

    const first = await classifyTitles(["עגבניות", "חלב 3%"], { kv, llm });
    expect(first.map((c) => c.category)).toEqual(["produce", "dairy"]);
    expect(llm).toHaveBeenCalledTimes(1);

    // Same items (and a quantity variant of one) come from the cache.
    const second = await classifyTitles(["2 עגבניות", "חלב"], { kv, llm });
    expect(second.map((c) => c.category)).toEqual(["produce", "dairy"]);
    expect(second.every((c) => c.source === "llm")).toBe(true);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("sends duplicate names to the LLM once", async () => {
    const kv = memoryKV();
    const llm = fakeLlm({ "במבה": "snacks" });
    const res = await classifyTitles(["במבה", "2 במבה", "במבה"], { kv, llm });
    expect(res.map((c) => c.category)).toEqual(["snacks", "snacks", "snacks"]);
    expect(llm.mock.calls[0][0]).toEqual(["במבה"]);
  });

  it("a user correction wins over the LLM and is never overwritten", async () => {
    const kv = memoryKV();
    const llm = fakeLlm({ "חומוס": "deli" });
    await classifyTitles(["חומוס"], { kv, llm });
    await setCategoryOverride("חומוס", "pantry", kv);

    const res = await classifyTitles(["חומוס", "חומוס x2"], { kv, llm });
    expect(res).toEqual([
      { category: "pantry", source: "user" },
      { category: "pantry", source: "user" },
    ]);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  it("falls back to 'other' without caching when the LLM fails", async () => {
    const kv = memoryKV();
    const failing = vi.fn(async () => {
      throw new Error("rate limited");
    });
    const res = await classifyTitles(["קפה"], { kv, llm: failing });
    expect(res).toEqual([{ category: "other", source: "fallback" }]);
    expect(await kv.hgetMany(CATEGORY_HASH, ["קפה"])).toEqual([null]);

    // Next time the LLM works, the item gets classified.
    const res2 = await classifyTitles(["קפה"], { kv, llm: fakeLlm({ "קפה": "breakfast" }) });
    expect(res2[0].category).toBe("breakfast");
  });

  it("works without an LLM configured", async () => {
    const res = await classifyTitles(["משהו"], { kv: memoryKV(), llm: null });
    expect(res).toEqual([{ category: "other", source: "fallback" }]);
  });

  it("splits large lists into batches of 50", async () => {
    const kv = memoryKV();
    const llm = vi.fn(async (titles: string[]) => titles.map(() => "pantry" as CategoryId));
    const titles = Array.from({ length: 120 }, (_, i) => `פריט ${i}a`);
    const res = await classifyTitles(titles, { kv, llm });
    expect(llm).toHaveBeenCalledTimes(3);
    expect(llm.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
    expect(res.every((c) => c.category === "pantry")).toBe(true);
  });

  it("concurrent requests for the same new items share one LLM call", async () => {
    const kv = memoryKV();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const llm = vi.fn(async (titles: string[]) => {
      await gate;
      return titles.map(() => "drinks" as CategoryId);
    });
    const a = classifyTitles(["סודה", "בירה"], { kv, llm, quiet: true });
    const b = classifyTitles(["בירה", "סודה"], { kv, llm, quiet: true });
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(llm).toHaveBeenCalledTimes(1);
    expect([...ra, ...rb].every((c) => c.category === "drinks")).toBe(true);
  });

  it("ignores corrupt cache entries", async () => {
    const kv = memoryKV();
    await kv.hsetMany(CATEGORY_HASH, { "לחם": "not-a-category|llm" });
    const res = await classifyTitles(["לחם"], { kv, llm: fakeLlm({ "לחם": "bakery" }) });
    expect(res[0].category).toBe("bakery");
  });
});

describe("parseLlmResponse", () => {
  it("maps results by index", () => {
    const out = parseLlmResponse('{"results":[{"i":1,"c":"dairy"},{"i":0,"c":"produce"}]}', 2);
    expect(out).toEqual(["produce", "dairy"]);
  });

  it("uses 'other' for unknown ids, missing items and out-of-range indexes", () => {
    const out = parseLlmResponse('{"results":[{"i":0,"c":"vegetables"},{"i":7,"c":"dairy"}]}', 2);
    expect(out).toEqual(["other", "other"]);
  });

  it("tolerates string indexes and casing", () => {
    expect(parseLlmResponse('{"results":[{"i":"0","c":" Dairy "}]}', 1)).toEqual(["dairy"]);
  });

  it("throws on malformed JSON so the batch is retried later", () => {
    expect(() => parseLlmResponse("not json", 1)).toThrow();
    expect(() => parseLlmResponse('{"foo":1}', 1)).toThrow();
  });
});
