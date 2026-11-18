import { z } from "zod";
import { json, route } from "@/lib/api";
import { isCategoryId, type CategoryId } from "@/lib/categories";
import { setCategoryOverride } from "@/lib/classify";
import { requireSession } from "@/lib/session";

const PutBody = z.object({
  title: z.string().trim().min(1).max(255),
  category: z.custom<CategoryId>(isCategoryId, "Unknown category"),
});

/** "Move to section": remembers the correction for this item name, for the whole family. */
export const PUT = route(async (req: Request) => {
  await requireSession();
  const { title, category } = PutBody.parse(await req.json());
  await setCategoryOverride(title, category);
  return json({ ok: true });
});
