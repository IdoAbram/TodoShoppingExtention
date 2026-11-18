"use client";

import type { ReactNode } from "react";
import { CheckIcon, Spinner, StarIcon } from "./icons";

type Props = {
  title: string;
  checked: boolean;
  important?: boolean;
  pending?: boolean;
  trailing?: ReactNode;
  onToggle?: () => void;
  onOpen?: () => void;
};

/** One row, styled like a Microsoft To Do task: round checkbox, title, optional star. */
export function TaskItem({ title, checked, important, pending, trailing, onToggle, onOpen }: Props) {
  return (
    <li className="group flex min-h-[52px] items-center rounded-md bg-card shadow-card transition-colors hover:bg-card-hover">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `ביטול סימון: ${title}` : `סימון כנקנה: ${title}`}
        disabled={pending || !onToggle}
        onClick={onToggle}
        className="flex size-[52px] shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-accent"
      >
        {pending ? (
          <Spinner className="text-subtle" width={18} height={18} />
        ) : (
          <span
            className={
              checked
                ? "animate-check-pop flex size-[22px] items-center justify-center rounded-full border-2 border-accent bg-accent text-on-accent"
                : "flex size-[22px] items-center justify-center rounded-full border-2 border-subtle text-transparent transition-colors group-hover:border-accent group-hover:text-accent"
            }
          >
            <CheckIcon width={13} height={13} strokeWidth={3.2} />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        disabled={pending || !onOpen}
        className="flex min-h-[52px] min-w-0 flex-1 items-center py-2 pe-3 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span
          className={`min-w-0 flex-1 break-words text-[15px] leading-snug ${
            checked ? "text-subtle line-through" : pending ? "text-muted" : "text-text"
          }`}
        >
          {title}
        </span>
        {trailing}
        {important && !checked && <StarIcon className="ms-2 shrink-0 text-star" width={16} height={16} aria-label="חשוב" />}
      </button>
    </li>
  );
}
