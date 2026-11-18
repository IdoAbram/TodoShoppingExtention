// Minimal Microsoft Graph client for Microsoft To Do lists and tasks.
// Docs: https://learn.microsoft.com/graph/api/resources/todo-overview

const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_PAGES = 20;

export class GraphError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type TodoList = {
  id: string;
  displayName: string;
  isOwner: boolean;
  isShared: boolean;
  wellknownListName: string;
};

export type TodoTask = {
  id: string;
  title: string;
  status: "notStarted" | "inProgress" | "completed" | "waitingOnOthers" | "deferred";
  importance: "low" | "normal" | "high";
  createdDateTime: string;
  lastModifiedDateTime: string;
  completedDateTime?: { dateTime: string; timeZone: string } | null;
};

export type GraphUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type Page<T> = { value: T[]; "@odata.nextLink"?: string };

/** `getToken(true)` must force a token refresh; it is called once after a 401. */
export type TokenGetter = (force?: boolean) => Promise<string>;

/** What the API routes need from To Do (implemented by Graph, and by the demo store). */
export interface TodoApi {
  listLists(): Promise<TodoList[]>;
  getList(listId: string): Promise<TodoList>;
  listTasks(listId: string, completedLimit?: number): Promise<{ open: TodoTask[]; completed: TodoTask[] }>;
  createTask(listId: string, title: string): Promise<TodoTask>;
  updateTask(listId: string, taskId: string, patch: Partial<Pick<TodoTask, "title" | "status">>): Promise<TodoTask>;
  deleteTask(listId: string, taskId: string): Promise<void>;
}

export class TodoClient implements TodoApi {
  constructor(private getToken: TokenGetter) {}

  private async request<T>(pathOrUrl: string, init: RequestInit = {}, retried = false): Promise<T> {
    const token = await this.getToken(retried);
    const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH}${pathOrUrl}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 && !retried) return this.request<T>(pathOrUrl, init, true);
    if (!res.ok) {
      let code = "unknown";
      let message = `Graph ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } };
        code = body.error?.code ?? code;
        message = `Graph ${res.status} ${code}: ${body.error?.message ?? ""}`.trim();
      } catch {
        /* no JSON body */
      }
      throw new GraphError(res.status, code, message);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  private async all<T>(path: string, maxPages = MAX_PAGES): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = path;
    for (let page = 0; next && page < maxPages; page++) {
      const data: Page<T> = await this.request<Page<T>>(next);
      items.push(...data.value);
      next = data["@odata.nextLink"];
    }
    return items;
  }

  me(): Promise<GraphUser> {
    return this.request<GraphUser>("/me?$select=id,displayName,mail,userPrincipalName");
  }

  listLists(): Promise<TodoList[]> {
    return this.all<TodoList>("/me/todo/lists");
  }

  getList(listId: string): Promise<TodoList> {
    return this.request<TodoList>(`/me/todo/lists/${encodeURIComponent(listId)}`);
  }

  /** Open tasks plus the most recently completed ones (newest first). */
  async listTasks(listId: string, completedLimit = 30): Promise<{ open: TodoTask[]; completed: TodoTask[] }> {
    const base = `/me/todo/lists/${encodeURIComponent(listId)}/tasks`;
    const q = (params: Record<string, string>) => `${base}?${new URLSearchParams(params).toString()}`;

    let open: TodoTask[];
    let completed: TodoTask[];
    try {
      [open, completed] = await Promise.all([
        this.all<TodoTask>(q({ $filter: "status ne 'completed'", $top: "100" })),
        this.recentCompleted(q, completedLimit),
      ]);
    } catch (err) {
      // Some tenants reject $filter on tasks; fall back to fetching everything.
      if (!(err instanceof GraphError) || err.status !== 400) throw err;
      const everything = await this.all<TodoTask>(q({ $top: "100" }));
      open = everything.filter((t) => t.status !== "completed");
      completed = everything.filter((t) => t.status === "completed");
    }

    const completedAt = (t: TodoTask) => t.completedDateTime?.dateTime ?? t.lastModifiedDateTime;
    completed.sort((a, b) => completedAt(b).localeCompare(completedAt(a)));
    open.sort((a, b) => a.createdDateTime.localeCompare(b.createdDateTime));
    return { open, completed: completed.slice(0, completedLimit) };
  }

  /** One sorted page when Graph supports $orderby here; otherwise up to 500 completed tasks. */
  private async recentCompleted(q: (params: Record<string, string>) => string, limit: number): Promise<TodoTask[]> {
    try {
      const page = await this.request<Page<TodoTask>>(
        q({ $filter: "status eq 'completed'", $orderby: "lastModifiedDateTime desc", $top: String(limit) }),
      );
      return page.value;
    } catch (err) {
      if (!(err instanceof GraphError) || err.status !== 400) throw err;
      return this.all<TodoTask>(q({ $filter: "status eq 'completed'", $top: "100" }), 5);
    }
  }

  createTask(listId: string, title: string): Promise<TodoTask> {
    return this.request<TodoTask>(`/me/todo/lists/${encodeURIComponent(listId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  updateTask(listId: string, taskId: string, patch: Partial<Pick<TodoTask, "title" | "status">>): Promise<TodoTask> {
    return this.request<TodoTask>(
      `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  }

  deleteTask(listId: string, taskId: string): Promise<void> {
    return this.request<void>(
      `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "DELETE" },
    );
  }
}
