import { z } from "zod";
import { json, route, saveOrder } from "@/lib/api";
import { requireSession } from "@/lib/session";

const PutBody = z.object({ order: z.array(z.string()).max(50) });

/** Saves the household's section order (the path you walk through the store). */
export const PUT = route(async (req: Request) => {
  await requireSession();
  const { order } = PutBody.parse(await req.json());
  return json({ order: await saveOrder(order) });
});
