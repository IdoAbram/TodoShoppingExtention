"use client";

import { useState } from "react";
import { DEFAULT_ORDER, getCategory, type CategoryId } from "@/lib/categories";
import { BottomSheet } from "./BottomSheet";
import { ArrowDownIcon, ArrowUpIcon } from "./icons";

type Props = {
  order: CategoryId[];
  onSave: (order: CategoryId[]) => void;
  onClose: () => void;
};

export function SectionOrderEditor({ order, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(order);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };

  return (
    <BottomSheet title="סדר המחלקות" onClose={onClose}>
      <p className="mb-3 text-sm text-muted">סדרו את המחלקות לפי המסלול שלכם בסופר. הסדר משותף לכל המשפחה.</p>
      <ol className="divide-y divide-border">
        {draft.map((id, i) => {
          const c = getCategory(id);
          return (
            <li key={id} className="flex h-12 items-center gap-2">
              <span className="w-6 text-center text-sm text-subtle">{i + 1}</span>
              <span aria-hidden>{c.emoji}</span>
              <span className="min-w-0 flex-1 truncate text-text">{c.name}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`הזזה למעלה: ${c.name}`}
                className="flex size-10 items-center justify-center rounded-md text-accent hover:bg-accent-soft disabled:text-border disabled:hover:bg-transparent"
              >
                <ArrowUpIcon />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === draft.length - 1}
                aria-label={`הזזה למטה: ${c.name}`}
                className="flex size-10 items-center justify-center rounded-md text-accent hover:bg-accent-soft disabled:text-border disabled:hover:bg-transparent"
              >
                <ArrowDownIcon />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setDraft(DEFAULT_ORDER)}
          className="h-11 rounded-md border border-border px-4 font-medium text-text hover:bg-card-hover"
        >
          איפוס
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="h-11 flex-1 rounded-md bg-accent font-medium text-on-accent hover:bg-accent-strong"
        >
          שמירה
        </button>
      </div>
    </BottomSheet>
  );
}
