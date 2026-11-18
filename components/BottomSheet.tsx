"use client";

import { useEffect, type ReactNode } from "react";

export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="סגירה"
        tabIndex={-1}
        className="animate-fade-in absolute inset-0 cursor-default bg-overlay"
        onClick={onClose}
      />
      <div className="animate-sheet-up relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        {title && <h2 className="mb-3 text-lg font-semibold text-text">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
