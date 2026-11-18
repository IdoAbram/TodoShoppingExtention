import { z } from "zod";
import { json, route, todoClient } from "@/lib/api";
import { getPrefs, requireSession, setPrefs } from "@/lib/session";
import type { ListsResponse } from "@/lib/types";

export const GET = route(async () => {
  const session = await requireSession();
  const [lists, prefs] = await Promise.all([todoClient(session).listLists(), getPrefs(session.userId)]);
  const body: ListsResponse = {
    lists: lists.map((l) => ({ id: l.id, name: l.displayName, isShared: l.isShared, isOwner: l.isOwner })),
    selectedId: prefs?.listId ?? null,
  };
  return json(body);
});

const PutBody = z.object({ listId: z.string().min(1) });

export const PUT = route(async (req: Request) => {
  const session = await requireSession();
  const { listId } = PutBody.parse(await req.json());
  const list = await todoClient(session).getList(listId); // also verifies access
  await setPrefs(session.userId, { listId: list.id, listName: list.displayName });
  return json({ ok: true, list: { id: list.id, name: list.displayName } });
});
