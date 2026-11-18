"use client";

import type { ReactNode } from "react";
import { ChevronIcon } from "./icons";

type Props = {
  emoji?: ReactNode;
  name: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  tone?: "accent" | "muted";
  children: ReactNode;
};

export function CategorySection({ emoji, name, count, collapsed, onToggle, tone = "accent", children }: Props) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={`flex w-full items-center gap-2 rounded-md px-1 py-2 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
          tone === "accent" ? "text-accent" : "text-muted"
        }`}
      >
        <ChevronIcon
          width={16}
          height={16}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform ${collapsed ? "rotate-90" : ""}`}
        />
        {emoji && <span aria-hidden>{emoji}</span>}
        <span className="truncate">{name}</span>
        <span className="font-normal text-subtle">{count}</span>
      </button>
      {!collapsed && <ul className="flex flex-col gap-[3px]">{children}</ul>}
    </section>
  );
}
