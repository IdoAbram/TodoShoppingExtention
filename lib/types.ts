// Types shared by the API routes and the client UI (no server-only imports here).
import type { CategoryId } from "./categories";
import type { CategorySource } from "./classify";

export type ShoppingItem = {
  id: string;
  title: string;
  done: boolean;
  important: boolean;
  category: CategoryId;
  source: CategorySource;
};

export type TasksResponse = {
  list: { id: string; name: string };
  open: ShoppingItem[];
  completed: ShoppingItem[];
  order: CategoryId[];
};

export type ListSummary = { id: string; name: string; isShared: boolean; isOwner: boolean };

export type ListsResponse = { lists: ListSummary[]; selectedId: string | null };

export type ApiError = { error: string; message?: string };
