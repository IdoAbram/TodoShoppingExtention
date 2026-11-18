"use client";

import { useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { PlusIcon } from "./icons";

/** Splits pasted text (e.g. a list copied from WhatsApp) into item titles. */
export function splitItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•·▪◦–]|\[\s?[xX]?\]|☐|☑|✓|✔)\s*/, "") // bullets and checkboxes
        .replace(/^\s*\d+[.)]\s+/, "") // "1. " numbering (but keep "2 חלב")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 100);
}

export function AddItemBar({ onAdd }: { onAdd: (titles: string[]) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const titles = splitItems(value);
    if (titles.length === 0) return;
    onAdd(titles);
    setValue("");
    inputRef.current?.focus(); // keep the keyboard open for the next item
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/\r?\n/.test(text.trim())) return; // single line: normal paste
    e.preventDefault();
    const titles = splitItems(`${value}\n${text}`);
    if (titles.length) onAdd(titles);
    setValue("");
  };

  return (
    <form
      onSubmit={submit}
      className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-bg via-bg/95 to-bg/0 px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <label className="mx-auto flex h-[52px] max-w-2xl items-center gap-3 rounded-md bg-card px-4 shadow-card focus-within:outline-2 focus-within:outline-accent">
        <PlusIcon className="shrink-0 text-accent" width={22} height={22} />
        <span className="sr-only">הוספת פריט</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPaste={onPaste}
          placeholder="הוספת פריט"
          enterKeyHint="send"
          autoComplete="off"
          maxLength={255}
          className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-accent"
        />
        {value.trim() && (
          <button type="submit" className="shrink-0 rounded-md px-2 py-1 font-medium text-accent hover:bg-accent-soft">
            הוספה
          </button>
        )}
      </label>
    </form>
  );
}
