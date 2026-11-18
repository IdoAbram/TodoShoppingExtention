// Turns a shopping item title into a stable cache key, so that
// "2 חלב 3%", "חלב" and "חלב  x2" all share one category entry.

const QUOTES = /["'`״׳”“‘’]/g;
const PUNCTUATION = /[()[\]{},.;:!?\-–—_/\\+*•·]/g;

// Unit / packaging words, written without quotes (ק"ג → קג).
const UNITS = new Set([
  "קג", "קילו", "קילוגרם", "גרם", "גר", "ג", "ליטר", "ליטרים", "ל", "מל",
  "יח", "יחידה", "יחידות", "חב", "חבילה", "חבילות", "בקבוק", "בקבוקים",
  "שקית", "שקיות", "קופסה", "קופסאות", "מארז", "מארזים", "זוג", "זוגות",
  "kg", "g", "gr", "gram", "grams", "l", "lt", "liter", "liters", "ml",
  "pc", "pcs", "pack", "packs", "x", "×",
]);

// A token that is only a quantity: 2, 1.5, 3%, x2, 2x, ×3, possibly glued to a unit (2ק"ג, 500g).
const QUANTITY = /^[x×]?(\d+(?:[.,]\d+)?)%?[x×]?(.*)$/;

function isQuantityToken(token: string): boolean {
  if (UNITS.has(token)) return true;
  const m = token.match(QUANTITY);
  if (!m) return false;
  const rest = m[2];
  return rest === "" || UNITS.has(rest);
}

export function normalizeTitle(title: string): string {
  const base = title.normalize("NFKC").toLowerCase().replace(QUOTES, "").trim();
  // Join decimals before stripping punctuation ("1.5" → "15"), so they stay one numeric token.
  const spaced = base.replace(/(\d)[.,](\d)/g, "$1$2").replace(PUNCTUATION, " ");
  const tokens = spaced.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !isQuantityToken(t));
  const key = kept.join(" ").trim();
  return key || base.replace(/\s+/g, " ");
}
