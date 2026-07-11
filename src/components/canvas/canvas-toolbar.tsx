"use client";

import type { ReactNode } from "react";

interface CanvasToolbarProps {
  onDeleteSelected?: () => void;
  hasSelection: boolean;
  /** Page-specific add/action buttons, rendered before the built-in Delete selected button. */
  children: ReactNode;
}

export function CanvasToolbar({ onDeleteSelected, hasSelection, children }: CanvasToolbarProps) {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-300 bg-white/95 p-2 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      {children}
      {hasSelection && onDeleteSelected && (
        <button
          onClick={onDeleteSelected}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Delete selected
        </button>
      )}
    </div>
  );
}

export function ToolbarButton({
  onClick,
  children,
  variant = "primary",
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      onClick={onClick}
      className={
        variant === "primary"
          ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          : "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }
    >
      {children}
    </button>
  );
}
