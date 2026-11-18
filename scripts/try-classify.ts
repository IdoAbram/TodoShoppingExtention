// Classifies a sample Hebrew shopping list with the real Groq model and prints the grouping.
// Usage: npx tsx --env-file=.env scripts/try-classify.ts [item ...]
import { CATEGORIES } from "../lib/categories";
import { DEFAULT_GROQ_MODEL, classifyTitles, groqClassifier } from "../lib/classify";
import { memoryKV } from "../lib/redis";

const SAMPLE = [
  "עגבניות", "מלפפונים", "2 בצל", "תפוחי אדמה 1 ק\"ג", "בננות", "כוסברה", "אבוקדו",
  "חלב 3%", "קוטג' 5%", "ביצים L", "יוגורט", "שוקו", "גבינה צהובה", "שמנת מתוקה",
  "פיתות", "לחם אחיד", "חלה",
  "חזה עוף", "בשר טחון", "פילה סלמון",
  "שניצל תירס", "גלידה", "אפונה וגזר קפואים",
  "פסטה", "אורז בסמטי", "טונה x4", "קמח", "רסק עגבניות",
  "שמן קנולה", "פפריקה", "קטשופ", "טחינה",
  "קורנפלקס", "קפה נמס", "דבש",
  "במבה", "ביסלי", "שוקולד פרה", "בייגלה",
  "קולה זירו 1.5 ליטר", "מים מינרלים x6", "מיץ תפוזים",
  "נייר טואלט", "סבון כלים", "שקיות זבל", "נייר כסף",
  "שמפו", "משחת שיניים", "דאודורנט",
  "טיטולים", "מגבונים",
  "חומוס", "נקניקיות", "זיתים",
  "אוכל לכלב", "סוללות AA", "milk", "bananas",
];

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing (run with --env-file=.env)");
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const titles = process.argv.slice(2).length ? process.argv.slice(2) : SAMPLE;

  const started = Date.now();
  const results = await classifyTitles(titles, { kv: memoryKV(), llm: groqClassifier(key, model) });
  console.log(`model=${model}  items=${titles.length}  ${Date.now() - started}ms\n`);

  for (const c of CATEGORIES) {
    const items = titles.filter((_, i) => results[i].category === c.id);
    if (items.length) console.log(`${c.emoji} ${c.name}: ${items.join(" · ")}`);
  }
  const fallback = titles.filter((_, i) => results[i].source === "fallback");
  if (fallback.length) console.log(`\n⚠ not classified (LLM failed): ${fallback.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
