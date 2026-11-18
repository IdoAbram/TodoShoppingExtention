"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import type { ListSummary, ListsResponse } from "@/lib/types";
import { CheckIcon, ListIcon, PeopleIcon, Spinner } from "./icons";

const SHOPPING_NAME = /קני|סופר|מכול|shop|grocer|market/i;

type Props = {
  currentId?: string;
  onSelected: (list: { id: string; name: string }) => void;
  onCancel?: () => void;
};

export function ListPicker({ currentId, onSelected, onCancel }: Props) {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<ListsResponse>("/api/lists")
      .then((res) => {
        if (!alive) return;
        // Likely shopping lists first, then shared ones.
        const score = (l: ListSummary) => (SHOPPING_NAME.test(l.name) ? 2 : 0) + (l.isShared ? 1 : 0);
        setLists([...res.lists].sort((a, b) => score(b) - score(a)));
      })
      .catch((err) => alive && setError(errorMessage(err)));
    return () => {
      alive = false;
    };
  }, []);

  const select = async (list: ListSummary) => {
    setSaving(list.id);
    setError(null);
    try {
      await api("/api/lists", { method: "PUT", json: { listId: list.id } });
      onSelected({ id: list.id, name: list.name });
    } catch (err) {
      setError(errorMessage(err));
      setSaving(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8">
      <header className="flex items-start gap-2">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-accent">בחירת רשימת קניות</h1>
          <p className="mt-1 text-sm text-muted">
            בחרו את הרשימה מ-Microsoft To Do שבה אתם רושמים את הקניות. אפשר לבחור גם רשימה משותפת של המשפחה.
          </p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft">
            ביטול
          </button>
        )}
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!lists && !error && (
        <div className="flex justify-center py-10 text-accent">
          <Spinner width={28} height={28} />
        </div>
      )}

      {lists && lists.length === 0 && (
        <p className="text-muted">לא נמצאו רשימות ב-To Do. צרו רשימה בשם “קניות” באפליקציית To Do ורעננו.</p>
      )}

      {lists && lists.length > 0 && (
        <ul className="flex flex-col gap-[3px]">
          {lists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => select(l)}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-md bg-card px-4 text-start shadow-card transition-colors hover:bg-card-hover disabled:opacity-70"
              >
                {l.isShared ? (
                  <PeopleIcon className="shrink-0 text-accent" />
                ) : (
                  <ListIcon className="shrink-0 text-accent" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-text">{l.name}</span>
                  {(l.isShared || SHOPPING_NAME.test(l.name)) && (
                    <span className="text-xs text-subtle">
                      {[l.isShared ? "משותפת" : null, SHOPPING_NAME.test(l.name) ? "נראית כמו רשימת קניות" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </span>
                {saving === l.id ? (
                  <Spinner className="shrink-0 text-accent" />
                ) : (
                  l.id === currentId && <CheckIcon className="shrink-0 text-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
