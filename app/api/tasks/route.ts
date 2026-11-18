import { z } from "zod";
import { getOrder, json, route, selectedListId, toItems, todoClient } from "@/lib/api";
import { getPrefs, requireSession } from "@/lib/session";
import type { TasksResponse } from "@/lib/types";

export const GET = route(async () => {
  const session = await requireSession();
  const listId = await selectedListId(session);
  const client = todoClient(session);
  const [{ open, completed }, order, prefs] = await Promise.all([
    client.listTasks(listId),
    getOrder(),
    getPrefs(session.userId),
  ]);
  const items = await toItems([...open, ...completed]);
  const body: TasksResponse = {
    list: { id: listId, name: prefs?.listName ?? "" },
    open: items.filter((i) => !i.done),
    completed: items.filter((i) => i.done),
    order,
  };
  return json(body);
});

const PostBody = z.object({
  titles: z.array(z.string().trim().min(1).max(255)).min(1).max(100),
});

/** Adds one or more items (one per line when the user pastes a list). */
export const POST = route(async (req: Request) => {
  const session = await requireSession();
  const listId = await selectedListId(session);
  const { titles } = PostBody.parse(await req.json());
  const client = todoClient(session);
  // Sequential keeps the order the user typed and stays well under Graph throttling limits.
  const created = [];
  for (const title of titles) created.push(await client.createTask(listId, title));
  return json({ items: await toItems(created) });
});
