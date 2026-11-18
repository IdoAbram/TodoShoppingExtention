import { OAuth2RequestError } from "arctic";
import { ZodError } from "zod";
import { sanitizeOrder, type CategoryId } from "./categories";
import { classifyTitles } from "./classify";
import { DemoTodoClient, isDemoMode } from "./demo";
import { GraphError, TodoClient, type TodoApi, type TodoTask } from "./graph";
import { getKV } from "./redis";
import { NotSignedInError, destroySession, getAccessToken, getPrefs, type Session } from "./session";
import type { ShoppingItem } from "./types";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export { json };

async function errorResponse(err: unknown): Promise<Response> {
  if (err instanceof NotSignedInError) return json({ error: "unauthenticated" }, 401);
  if (err instanceof OAuth2RequestError) {
    // The refresh token was revoked or expired: sign the user out cleanly.
    console.warn("[auth] token refresh failed:", err.code);
    await destroySession().catch(() => {});
    return json({ error: "unauthenticated" }, 401);
  }
  if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status);
  if (err instanceof ZodError) return json({ error: "bad_request", message: err.message }, 400);
  if (err instanceof GraphError) {
    console.error("[graph]", err.message);
    if (err.status === 401) return json({ error: "unauthenticated" }, 401);
    if (err.status === 403) return json({ error: "forbidden", message: err.message }, 403);
    if (err.status === 404) return json({ error: "not_found", message: err.message }, 404);
    if (err.status === 429) return json({ error: "throttled", message: err.message }, 429);
    return json({ error: "graph_error", message: err.message }, 502);
  }
  console.error("[api] unexpected error:", err);
  return json({ error: "server_error", message: err instanceof Error ? err.message : String(err) }, 500);
}

/** Wraps a Route Handler so any thrown error becomes a JSON error response. */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function todoClient(session: Session): TodoApi {
  if (isDemoMode()) return new DemoTodoClient();
  return new TodoClient((force) => getAccessToken(session, force));
}

export async function selectedListId(session: Session): Promise<string> {
  const prefs = await getPrefs(session.userId);
  if (!prefs?.listId) throw new HttpError(409, "no_list", "No shopping list selected");
  return prefs.listId;
}

// ---------------------------------------------------------- section order --

const ORDER_KEY = "order";

export async function getOrder(): Promise<CategoryId[]> {
  const raw = await getKV().get(ORDER_KEY);
  try {
    return sanitizeOrder(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeOrder(null);
  }
}

export async function saveOrder(order: unknown): Promise<CategoryId[]> {
  const clean = sanitizeOrder(order);
  await getKV().set(ORDER_KEY, JSON.stringify(clean));
  return clean;
}

// ------------------------------------------------------------------ items --

export async function toItems(tasks: TodoTask[]): Promise<ShoppingItem[]> {
  const classes = await classifyTitles(tasks.map((t) => t.title));
  return tasks.map((t, i) => ({
    id: t.id,
    title: t.title,
    done: t.status === "completed",
    important: t.importance === "high",
    category: classes[i].category,
    source: classes[i].source,
  }));
}
