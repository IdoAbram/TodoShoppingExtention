// Supermarket sections. The order here is the default walking order of a
// typical Israeli supermarket; each household can reorder them in the app.
// `hint` is English guidance for the LLM classifier only (never shown).

export const CATEGORIES = [
  { id: "produce", name: "פירות וירקות", emoji: "🥬", hint: "fresh fruit, vegetables, fresh herbs, mushrooms, salad greens" },
  { id: "bakery", name: "לחם ומאפים", emoji: "🍞", hint: "bread, pita, rolls, challah, buns, fresh cakes, pastries, rugelach" },
  { id: "dairy", name: "מוצרי חלב וביצים", emoji: "🥛", hint: "milk, chocolate milk (שוקו), yogurt, cottage, white cheese, packaged yellow cheese, butter, cream, eggs, puddings, milk desserts" },
  { id: "deli", name: "מעדנייה וסלטים", emoji: "🧀", hint: "deli counter, salami, pastrami, sausages, hot dogs, smoked fish, refrigerated salads, hummus spread, tahini salad, olives, pickles" },
  { id: "meat", name: "בשר, עוף ודגים", emoji: "🥩", hint: "fresh or frozen raw meat, chicken, turkey, minced meat, fish fillets, salmon" },
  { id: "frozen", name: "קפואים", emoji: "🧊", hint: "frozen vegetables, frozen ready meals, schnitzels, burekas, pizza, ice cream, frozen dough" },
  { id: "pantry", name: "יבשים ושימורים", emoji: "🥫", hint: "pasta, rice, couscous, legumes, flour, sugar, baking goods, canned vegetables, tuna cans, corn, soups, noodles" },
  { id: "spices", name: "תבלינים, שמנים ורטבים", emoji: "🧂", hint: "spices, salt, pepper, oil, olive oil, vinegar, ketchup, mayonnaise, mustard, soy sauce, raw tahini, sauces, stock powder" },
  { id: "breakfast", name: "דגני בוקר, קפה וממרחים", emoji: "🥣", hint: "breakfast cereals, granola, oats, coffee, tea, honey, jam, chocolate spread, peanut butter, halva" },
  { id: "snacks", name: "חטיפים ומתוקים", emoji: "🍫", hint: "chips, bamba, bissli, crackers, cookies, biscuits, chocolate, candy, gum, nuts, seeds, dried fruit" },
  { id: "drinks", name: "משקאות", emoji: "🥤", hint: "water, soda, cola, juice, syrup (petel), beer, wine, alcohol, energy drinks" },
  { id: "cleaning", name: "ניקיון וחד״פ", emoji: "🧽", hint: "detergents, laundry, dish soap, bleach, sponges, trash bags, toilet paper, paper towels, napkins, aluminium foil, disposable plates and cups" },
  { id: "personal", name: "טואלטיקה ופארם", emoji: "🧴", hint: "shampoo, soap, body wash, toothpaste, toothbrush, deodorant, razors, cosmetics, pharmacy, medicine, vitamins, cotton pads" },
  { id: "baby", name: "תינוקות", emoji: "👶", hint: "diapers, baby formula (מטרנה), baby food, baby wet wipes, pacifiers" },
  { id: "other", name: "אחר", emoji: "📦", hint: "anything that fits no other section: pet food, batteries, light bulbs, kitchen tools, non-grocery items" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];
export const DEFAULT_ORDER: CategoryId[] = [...CATEGORY_IDS];
export const FALLBACK_CATEGORY: CategoryId = "other";

const byId = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]));

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && byId.has(value);
}

export function getCategory(id: CategoryId): Category {
  return byId.get(id) ?? byId.get(FALLBACK_CATEGORY)!;
}

/**
 * Turns a stored order (which may be stale: missing new sections or
 * containing removed ones) into a complete, valid order.
 */
export function sanitizeOrder(order: unknown): CategoryId[] {
  const seen = new Set<CategoryId>();
  const result: CategoryId[] = [];
  if (Array.isArray(order)) {
    for (const id of order) {
      if (isCategoryId(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}
