import { z } from "zod";
import { json, route, selectedListId, toItems, todoClient } from "@/lib/api";
import { requireSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z
  .object({
    done: z.boolean().optional(),
    title: z.string().trim().min(1).max(255).optional(),
  })
  .refine((b) => b.done !== undefined || b.title !== undefined, "Nothing to update");

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const session = await requireSession();
  const listId = await selectedListId(session);
  const { id } = await ctx.params;
  const body = PatchBody.parse(await req.json());
  const task = await todoClient(session).updateTask(listId, id, {
    ...(body.done !== undefined ? { status: body.done ? "completed" : "notStarted" } : {}),
    ...(body.title !== undefined ? { title: body.title } : {}),
  });
  const [item] = await toItems([task]);
  return json({ item });
});

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const session = await requireSession();
  const listId = await selectedListId(session);
  const { id } = await ctx.params;
  await todoClient(session).deleteTask(listId, id);
  return json({ ok: true });
});
