import clsx from "clsx";
import type { RunStatus } from "@/lib/types/domain";

const STYLES: Record<RunStatus, string> = {
  idle: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  running: "bg-amber-200 text-amber-800 animate-pulse dark:bg-amber-900 dark:text-amber-200",
  success: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  error: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function NodeStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
