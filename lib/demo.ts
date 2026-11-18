// DEMO_MODE=1: a fake To Do list kept in the KV store, so the app can be tried
// (and developed) before the Microsoft app registration exists. Never enable in production.
import { randomUUID } from "node:crypto";
import { GraphError, type TodoApi, type TodoList, type TodoTask } from "./graph";
import { getKV } from "./redis";
import type { SessionData } from "./session";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true";
}

export const DEMO_SESSION: SessionData = {
  userId: "demo-user",
  name: "משתמש לדוגמה",
  email: "demo@example.com",
  accessToken: "demo",
  accessExpiresAt: Date.UTC(2100, 0, 1),
  refreshToken: "",
};

const LISTS: TodoList[] = [
  { id: "demo-shopping", displayName: "קניות", isOwner: true, isShared: true, wellknownListName: "none" },
  { id: "demo-tasks", displayName: "משימות", isOwner: true, isShared: false, wellknownListName: "defaultList" },
];

const SEED_OPEN = [
  "חלב 3%", "עגבניות", "במבה", "נייר טואלט", "חזה עוף", "פיתות", "קולה זירו 1.5 ליטר", "מלפפונים",
  "קוטג' 5%", "שמפו", "פסטה", "ביצים L", "אבוקדו", "שניצל תירס", "טונה x4", "קפה נמס", "בננות",
  "סבון כלים", "גבינה צהובה", "חומוס", "שמן זית", "טיטולים", "גלידה", "2 בצל", "יוגורט",
];
const SEED_DONE = ["לחם אחיד", "מים מינרלים x6", "תפוחים"];

type Store = Record<string, TodoTask[]>;
const KEY = "demo:todo";

function task(title: string, done: boolean, i: number): TodoTask {
  const t = new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
  return {
    id: randomUUID(),
    title,
    status: done ? "completed" : "notStarted",
    importance: title === "טיטולים" ? "high" : "normal",
    createdDateTime: t,
    lastModifiedDateTime: t,
    completedDateTime: done ? { dateTime: t, timeZone: "UTC" } : null,
  };
}

async function load(): Promise<Store> {
  const raw = await getKV().get(KEY);
  if (raw) return JSON.parse(raw) as Store;
  const store: Store = {
    "demo-shopping": [...SEED_OPEN.map((t, i) => task(t, false, i)), ...SEED_DONE.map((t, i) => task(t, true, 100 + i))],
    "demo-tasks": [task("להתקשר לסבתא", false, 0)],
  };
  await save(store);
  return store;
}

async function save(store: Store) {
  await getKV().set(KEY, JSON.stringify(store));
}

function listOrThrow(store: Store, listId: string): TodoTask[] {
  const tasks = store[listId];
  if (!tasks) throw new GraphError(404, "notFound", "List not found");
  return tasks;
}

export class DemoTodoClient implements TodoApi {
  async listLists() {
    return LISTS;
  }

  async getList(listId: string) {
    const list = LISTS.find((l) => l.id === listId);
    if (!list) throw new GraphError(404, "notFound", "List not found");
    return list;
  }

  async listTasks(listId: string, completedLimit = 30) {
    const tasks = listOrThrow(await load(), listId);
    return {
      open: tasks.filter((t) => t.status !== "completed"),
      completed: tasks
        .filter((t) => t.status === "completed")
        .sort((a, b) => b.lastModifiedDateTime.localeCompare(a.lastModifiedDateTime))
        .slice(0, completedLimit),
    };
  }

  async createTask(listId: string, title: string) {
    const store = await load();
    const t = { ...task(title, false, 0), createdDateTime: new Date().toISOString() };
    listOrThrow(store, listId).push(t);
    await save(store);
    return t;
  }

  async updateTask(listId: string, taskId: string, patch: Partial<Pick<TodoTask, "title" | "status">>) {
    const store = await load();
    const t = listOrThrow(store, listId).find((x) => x.id === taskId);
    if (!t) throw new GraphError(404, "notFound", "Task not found");
    Object.assign(t, patch, { lastModifiedDateTime: new Date().toISOString() });
    await save(store);
    return t;
  }

  async deleteTask(listId: string, taskId: string) {
    const store = await load();
    store[listId] = listOrThrow(store, listId).filter((x) => x.id !== taskId);
    await save(store);
  }
}
