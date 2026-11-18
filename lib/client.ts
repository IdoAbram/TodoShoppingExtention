// Browser-side fetch helper for our own /api routes.

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<string, string> = {
  unauthenticated: "פג תוקף ההתחברות. מתחברים מחדש…",
  throttled: "Microsoft מגבילה כרגע את קצב הבקשות. נסו שוב בעוד רגע.",
  not_found: "הפריט או הרשימה לא נמצאו (אולי נמחקו ב-To Do).",
  forbidden: "אין הרשאה לרשימה הזו.",
  no_list: "לא נבחרה רשימה.",
  network: "אין חיבור לאינטרנט.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return MESSAGES[err.code] ?? "משהו השתבש. נסו שוב.";
  return MESSAGES.network;
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      // Writes finish even if the page is closed or reloaded right after a tap.
      keepalive: rest.method !== undefined && rest.method !== "GET",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiRequestError(0, "network", "network error");
  }
  if (!res.ok) {
    let code = "server_error";
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      code = body.error ?? code;
      message = body.message ?? message;
    } catch {
      /* not JSON */
    }
    if (res.status === 401) {
      // Session expired or revoked: reload so the server renders the sign-in screen.
      window.location.reload();
    }
    throw new ApiRequestError(res.status, code, message);
  }
  return (await res.json()) as T;
}
