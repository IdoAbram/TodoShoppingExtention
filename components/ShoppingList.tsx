"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getCategory, type CategoryId } from "@/lib/categories";
import { ApiRequestError, api, errorMessage } from "@/lib/client";
import { normalizeTitle } from "@/lib/normalize";
import type { ShoppingItem, TasksResponse } from "@/lib/types";
import { AddItemBar } from "./AddItemBar";
import { BottomSheet } from "./BottomSheet";
import { CategorySection } from "./CategorySection";
import { ItemSheet } from "./ItemSheet";
import { SectionOrderEditor } from "./SectionOrderEditor";
import { TaskItem } from "./TaskItem";
import { ListIcon, LogoutIcon, MoreIcon, RefreshIcon, SortIcon, Spinner, SunIcon } from "./icons";
import { useWakeLock } from "./useWakeLock";

const POLL_MS = 20_000;
const CHECK_DELAY_MS = 700; // checked items linger briefly before moving to "completed", like To Do
const COMPLETED_KEY = "__completed";

type Pending = { tempId: string; title: string };
type Sheet = { kind: "item"; id: string } | { kind: "menu" } | { kind: "order" } | null;

type Props = {
  list: { id: string; name: string };
  userName: string;
  onSwitchList: () => void;
  onNoList: () => void;
};

// ------------------------------------------------------------ pure helpers --

function moveToCompleted(d: TasksResponse, id: string): TasksResponse {
  const item = d.open.find((i) => i.id === id);
  if (!item) return d;
  return { ...d, open: d.open.filter((i) => i.id !== id), completed: [{ ...item, done: true }, ...d.completed] };
}

function moveToOpen(d: TasksResponse, id: string): TasksResponse {
  const item = d.completed.find((i) => i.id === id);
  if (!item) return d;
  return { ...d, completed: d.completed.filter((i) => i.id !== id), open: [...d.open, { ...item, done: false }] };
}

function mapItems(d: TasksResponse, fn: (i: ShoppingItem) => ShoppingItem): TasksResponse {
  return { ...d, open: d.open.map(fn), completed: d.completed.map(fn) };
}

/** Collapsed sections, remembered per device. "Completed" starts collapsed. */
function readCollapsed(): Set<string> {
  const fallback = new Set([COMPLETED_KEY]);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem("collapsed");
    return raw ? new Set(JSON.parse(raw) as string[]) : fallback;
  } catch {
    return fallback;
  }
}

// --------------------------------------------------------------- component --

export function ShoppingList({ list, userName, onSwitchList, onNoList }: Props) {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [checking, setChecking] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0); // bumps to schedule a retry for unsorted items
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const wakeLock = useWakeLock();

  // While a change is being sent, polling must not overwrite the optimistic state.
  const inFlight = useRef(0);
  const generation = useRef(0);
  const loading = useRef(false);
  const reloadWhenIdle = useRef(false);
  const unsortedRetries = useRef(0);
  const checkTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const load = useCallback(
    async (manual = false) => {
      if (inFlight.current > 0) {
        reloadWhenIdle.current = true;
        return;
      }
      if (loading.current) return;
      loading.current = true;
      const gen = generation.current;
      if (manual) setRefreshing(true);
      try {
        const body = await api<TasksResponse>("/api/tasks");
        if (gen !== generation.current || inFlight.current > 0) {
          reloadWhenIdle.current = true; // a change happened meanwhile; fetch again once it settles
          return;
        }
        setData(body);
        setLoadError(null);

        // Items the LLM could not sort yet (e.g. rate limit) sit in "other": retry soon, a few times.
        const unsorted = [...body.open, ...body.completed].some((i) => i.source === "fallback");
        if (unsorted && unsortedRetries.current < 5) {
          unsortedRetries.current++;
          setRetryAt((n) => n + 1);
        } else if (!unsorted) {
          unsortedRetries.current = 0;
        }
      } catch (err) {
        if (err instanceof ApiRequestError && (err.code === "no_list" || err.status === 404)) {
          onNoList();
          return;
        }
        setLoadError(errorMessage(err));
      } finally {
        loading.current = false;
        if (manual) setRefreshing(false);
      }
    },
    [onNoList],
  );
  useEffect(() => {
    if (retryAt === 0) return;
    const t = setTimeout(() => void load(), 8000);
    return () => clearTimeout(t);
  }, [retryAt, load]);

  // Initial load + keep in sync with changes made in To Do (or by family members).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    tick();
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
      window.removeEventListener("online", tick);
    };
  }, [load]);

  useEffect(() => {
    try {
      localStorage.setItem("collapsed", JSON.stringify([...collapsed]));
    } catch {
      /* private mode */
    }
  }, [collapsed]);

  useEffect(() => {
    const timers = checkTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  /** Applies a change on screen at once, sends it, and reloads from the server if it failed. */
  const mutate = useCallback(
    async <T,>(
      apply: ((d: TasksResponse) => TasksResponse) | null,
      request: () => Promise<T>,
      onDone?: (result: T) => void,
    ): Promise<boolean> => {
      if (apply) setData((d) => d && apply(d));
      inFlight.current++;
      generation.current++;
      let ok = true;
      try {
        // Not `onDone?.(await request())`: an optional call skips evaluating its arguments
        // when onDone is undefined, so the request would never be sent.
        const result = await request();
        onDone?.(result);
      } catch (err) {
        ok = false;
        setToast(errorMessage(err));
      } finally {
        inFlight.current--;
        generation.current++;
      }
      if (inFlight.current === 0 && (!ok || reloadWhenIdle.current)) {
        reloadWhenIdle.current = false;
        await load(); // roll back a failed change / pick up a poll we skipped
      }
      return ok;
    },
    [load],
  );

  // ---------------------------------------------------------------- actions --

  const setDone = (item: ShoppingItem, done: boolean) => {
    const request = () => api(`/api/tasks/${encodeURIComponent(item.id)}`, { method: "PATCH", json: { done } });
    const timer = checkTimers.current.get(item.id);

    const stopChecking = () => {
      const t = checkTimers.current.get(item.id);
      if (t) clearTimeout(t);
      checkTimers.current.delete(item.id);
      setChecking((s) => {
        const next = new Set(s);
        next.delete(item.id);
        return next;
      });
    };

    if (done) {
      setChecking((s) => new Set(s).add(item.id));
      checkTimers.current.set(
        item.id,
        setTimeout(() => {
          stopChecking();
          setData((d) => d && moveToCompleted(d, item.id));
        }, CHECK_DELAY_MS),
      );
      void mutate(null, request).then((ok) => {
        if (!ok) stopChecking();
      });
    } else if (timer) {
      // Unchecked again while still lingering in its section.
      stopChecking();
      void mutate(null, request);
    } else {
      void mutate((d) => moveToOpen(d, item.id), request);
    }
  };

  const add = (titles: string[]) => {
    const temps = titles.map((title) => ({ tempId: `tmp-${crypto.randomUUID()}`, title }));
    setPending((p) => [...p, ...temps]);
    void mutate(
      null,
      () => api<{ items: ShoppingItem[] }>("/api/tasks", { method: "POST", json: { titles } }),
      ({ items }) =>
        setData((d) => d && { ...d, open: [...d.open, ...items.filter((n) => !d.open.some((o) => o.id === n.id))] }),
    ).finally(() => setPending((p) => p.filter((x) => !temps.includes(x))));
  };

  const moveTo = (item: ShoppingItem, category: CategoryId) => {
    const key = normalizeTitle(item.title);
    void mutate(
      (d) => mapItems(d, (i) => (normalizeTitle(i.title) === key ? { ...i, category, source: "user" } : i)),
      () => api("/api/categories", { method: "PUT", json: { title: item.title, category } }),
    );
  };

  const rename = (item: ShoppingItem, title: string) => {
    void mutate(
      (d) => mapItems(d, (i) => (i.id === item.id ? { ...i, title } : i)),
      () => api<{ item: ShoppingItem }>(`/api/tasks/${encodeURIComponent(item.id)}`, { method: "PATCH", json: { title } }),
      ({ item: updated }) => setData((d) => d && mapItems(d, (i) => (i.id === updated.id ? updated : i))),
    );
  };

  const remove = (item: ShoppingItem) => {
    setSheet(null);
    void mutate(
      (d) => ({ ...d, open: d.open.filter((i) => i.id !== item.id), completed: d.completed.filter((i) => i.id !== item.id) }),
      () => api(`/api/tasks/${encodeURIComponent(item.id)}`, { method: "DELETE" }),
    );
  };

  const saveOrder = (order: CategoryId[]) => {
    setSheet(null);
    void mutate((d) => ({ ...d, order }), () => api("/api/order", { method: "PUT", json: { order } }));
  };

  const toggleCollapsed = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ----------------------------------------------------------------- render --

  const groups = useMemo(() => {
    if (!data) return [];
    return data.order
      .map((id) => ({ category: getCategory(id), items: data.open.filter((i) => i.category === id) }))
      .filter((g) => g.items.length > 0);
  }, [data]);

  const sheetItem =
    sheet?.kind === "item" && data
      ? (data.open.find((i) => i.id === sheet.id) ?? data.completed.find((i) => i.id === sheet.id))
      : undefined;

  const remaining = data ? data.open.length - checking.size : 0;
  const listName = data?.list.name || list.name;

  return (
    <div className="min-h-dvh pb-32">
      <header className="sticky top-0 z-20 bg-bg/90 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-1">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-accent">{listName}</h1>
            <p className="text-sm text-muted">
              {data ? (remaining === 0 ? "הכול נקנה 🎉" : `${remaining} פריטים לקנייה`) : "טוען…"}
            </p>
          </div>
          {wakeLock.supported && (
            <button
              type="button"
              onClick={wakeLock.toggle}
              aria-pressed={wakeLock.active}
              aria-label="השארת המסך דולק"
              title="השארת המסך דולק בזמן הקנייה"
              className={`flex size-11 items-center justify-center rounded-md ${
                wakeLock.active ? "bg-accent-soft text-accent" : "text-muted hover:bg-card-hover"
              }`}
            >
              <SunIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => load(true)}
            aria-label="רענון"
            className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-card-hover"
          >
            <RefreshIcon className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setSheet({ kind: "menu" })}
            aria-label="תפריט"
            className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-card-hover"
          >
            <MoreIcon />
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-2 px-3">
        {!data && !loadError && <LoadingSkeleton />}

        {!data && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted">{loadError}</p>
            <button type="button" onClick={() => load(true)} className="rounded-md bg-accent px-5 py-2 font-medium text-on-accent">
              ניסיון חוזר
            </button>
          </div>
        )}

        {pending.length > 0 && (
          <CategorySection emoji={<Spinner width={14} height={14} />} name="ממיין…" count={pending.length} collapsed={false} onToggle={() => {}}>
            {pending.map((p) => (
              <TaskItem key={p.tempId} title={p.title} checked={false} pending />
            ))}
          </CategorySection>
        )}

        {groups.map(({ category, items }) => (
          <CategorySection
            key={category.id}
            emoji={category.emoji}
            name={category.name}
            count={items.filter((i) => !checking.has(i.id)).length}
            collapsed={collapsed.has(category.id)}
            onToggle={() => toggleCollapsed(category.id)}
          >
            {items.map((item) => (
              <TaskItem
                key={item.id}
                title={item.title}
                important={item.important}
                checked={checking.has(item.id)}
                onToggle={() => setDone(item, !checking.has(item.id))}
                onOpen={() => setSheet({ kind: "item", id: item.id })}
              />
            ))}
          </CategorySection>
        ))}

        {data && data.open.length === 0 && pending.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="text-5xl" aria-hidden>
              🛒
            </span>
            <p className="font-medium text-text">הרשימה ריקה</p>
            <p className="text-sm text-muted">הוסיפו פריטים כאן למטה או ב-Microsoft To Do</p>
          </div>
        )}

        {data && data.completed.length > 0 && (
          <div className="mt-2">
            <CategorySection
              name="הושלמו"
              count={data.completed.length}
              tone="muted"
              collapsed={collapsed.has(COMPLETED_KEY)}
              onToggle={() => toggleCollapsed(COMPLETED_KEY)}
            >
              {data.completed.map((item) => (
                <TaskItem
                  key={item.id}
                  title={item.title}
                  checked
                  trailing={
                    <span className="ms-2 shrink-0 text-sm opacity-60" aria-hidden>
                      {getCategory(item.category).emoji}
                    </span>
                  }
                  onToggle={() => setDone(item, false)}
                  onOpen={() => setSheet({ kind: "item", id: item.id })}
                />
              ))}
            </CategorySection>
          </div>
        )}
      </main>

      <AddItemBar onAdd={add} />

      {toast && (
        <div
          role="status"
          className="animate-fade-in fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-lg bg-text px-4 py-3 text-sm text-bg shadow-lg"
        >
          {toast}
        </div>
      )}

      {sheetItem && (
        <ItemSheet
          key={sheetItem.id}
          item={sheetItem}
          onClose={() => setSheet(null)}
          onRename={(title) => rename(sheetItem, title)}
          onMove={(category) => {
            moveTo(sheetItem, category);
            setSheet(null);
          }}
          onToggle={() => {
            setDone(sheetItem, !sheetItem.done);
            setSheet(null);
          }}
          onDelete={() => remove(sheetItem)}
        />
      )}

      {sheet?.kind === "order" && data && (
        <SectionOrderEditor order={data.order} onSave={saveOrder} onClose={() => setSheet(null)} />
      )}

      {sheet?.kind === "menu" && (
        <BottomSheet onClose={() => setSheet(null)}>
          <p className="mb-3 text-sm text-muted">
            מחובר/ת בתור <span className="font-medium text-text">{userName}</span>
          </p>
          <div className="flex flex-col">
            <MenuButton
              icon={<ListIcon />}
              label="החלפת רשימה"
              onClick={() => {
                setSheet(null);
                onSwitchList();
              }}
            />
            <MenuButton icon={<SortIcon />} label="סדר המחלקות בסופר" onClick={() => setSheet({ kind: "order" })} />
            <form action="/api/auth/logout" method="post">
              <MenuButton icon={<LogoutIcon />} label="התנתקות" type="submit" danger />
            </form>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
  type = "button",
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  danger?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-3 rounded-md px-2 text-start hover:bg-card-hover ${
        danger ? "text-danger" : "text-text"
      }`}
    >
      <span className={danger ? "" : "text-accent"}>{icon}</span>
      {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy aria-label="טוען">
      {[0, 1].map((s) => (
        <div key={s} className="flex flex-col gap-[3px]">
          <div className="my-2 h-4 w-32 animate-pulse rounded bg-border" />
          {[0, 1, 2].map((r) => (
            <div key={r} className="h-[52px] animate-pulse rounded-md bg-card shadow-card" />
          ))}
        </div>
      ))}
    </div>
  );
}
