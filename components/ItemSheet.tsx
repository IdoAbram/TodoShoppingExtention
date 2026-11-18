"use client";

import { useState, type FormEvent } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/categories";
import type { ShoppingItem } from "@/lib/types";
import { BottomSheet } from "./BottomSheet";
import { CheckIcon, TrashIcon } from "./icons";

type Props = {
  item: ShoppingItem;
  onClose: () => void;
  onRename: (title: string) => void;
  onMove: (category: CategoryId) => void;
  onToggle: () => void;
  onDelete: () => void;
};

export function ItemSheet({ item, onClose, onRename, onMove, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState(item.title);
  const changed = title.trim() !== "" && title.trim() !== item.title;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (changed) onRename(title.trim());
  };

  return (
    <BottomSheet onClose={onClose}>
      <form onSubmit={save} className="mb-4 flex items-center gap-2">
        <label className="sr-only" htmlFor="item-title">
          שם הפריט
        </label>
        <input
          id="item-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-lg font-semibold text-text outline-none focus:border-accent"
        />
        {changed && (
          <button type="submit" className="h-11 shrink-0 rounded-md bg-accent px-4 font-medium text-on-accent hover:bg-accent-strong">
            שמירה
          </button>
        )}
      </form>

      <h3 className="mb-2 text-sm font-medium text-muted">העברה למחלקה</h3>
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => {
          const active = c.id === item.category;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() => onMove(c.id)}
              className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors ${
                active
                  ? "border-accent bg-accent-soft font-semibold text-accent"
                  : "border-border text-text hover:bg-card-hover"
              }`}
            >
              <span aria-hidden>{c.emoji}</span>
              <span className="min-w-0 flex-1">{c.name}</span>
              {active && <CheckIcon width={16} height={16} className="shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-subtle">
        {item.source === "user"
          ? "המחלקה נקבעה ידנית ונשמרה לכל המשפחה."
          : "התיקון נשמר לכל המשפחה, ו“" + item.title + "” יופיע במחלקה הזו גם בפעמים הבאות."}
      </p>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border font-medium text-text hover:bg-card-hover"
        >
          <CheckIcon width={18} height={18} />
          {item.done ? "החזרה לרשימה" : "סימון כנקנה"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-danger-soft px-4 font-medium text-danger"
        >
          <TrashIcon width={18} height={18} />
          מחיקה
        </button>
      </div>
    </BottomSheet>
  );
}
