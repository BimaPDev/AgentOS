"use client";

import clsx from "clsx";

interface RunButtonProps {
  onRun: () => void;
  onStop?: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export function RunButton({ onRun, onStop, isRunning, disabled }: RunButtonProps) {
  if (isRunning) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
      >
        Stop
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className={clsx(
        "rounded-md px-3 py-1.5 text-sm font-medium",
        disabled
          ? "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500"
          : "bg-emerald-600 text-white hover:bg-emerald-500",
      )}
    >
      Run
    </button>
  );
}
