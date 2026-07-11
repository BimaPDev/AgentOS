"use client";

import clsx from "clsx";

interface RunButtonProps {
  onRun: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export function RunButton({ onRun, isRunning, disabled }: RunButtonProps) {
  return (
    <button
      onClick={onRun}
      disabled={isRunning || disabled}
      className={clsx(
        "rounded-md px-3 py-1.5 text-sm font-medium",
        isRunning || disabled
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
          : "bg-emerald-600 text-white hover:bg-emerald-500",
      )}
    >
      {isRunning ? "Running…" : "Run"}
    </button>
  );
}
