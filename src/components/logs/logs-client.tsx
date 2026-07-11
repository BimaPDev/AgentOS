"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { RunLog } from "@/lib/types/domain";

const POLL_INTERVAL_MS = 5000;

type LogWithLabel = RunLog & { graphId: string; label: string };

const LEVELS: Array<RunLog["level"] | "all"> = ["all", "info", "debug", "error"];

const LEVEL_BADGE: Record<RunLog["level"], string> = {
  info: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  debug: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function LogsClient({ initialLogs }: { initialLogs: LogWithLabel[] }) {
  const [logs, setLogs] = useState<LogWithLabel[]>(initialLogs);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");

  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(() => {
      apiFetch<LogWithLabel[]>("/api/logs?limit=300")
        .then((fresh) => !cancelled && setLogs(fresh))
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (level !== "all" && log.level !== level) return false;
      if (!q) return true;
      return log.message.toLowerCase().includes(q) || log.label.toLowerCase().includes(q);
    });
  }, [logs, query, level]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Logs</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search logs…"
              className="w-56 rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
          </div>
          <div className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={clsx(
                  "px-2.5 py-1.5 text-xs font-medium capitalize",
                  level === l
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
          {logs.length === 0 ? "No log lines yet. Run a pipeline to generate some." : "No logs match your filters."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 font-mono text-xs dark:border-zinc-800">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 border-b border-zinc-100 px-3 py-2 last:border-b-0 dark:border-zinc-800"
            >
              <span className="w-20 shrink-0 text-zinc-400 dark:text-zinc-500">
                {new Date(log.ts).toLocaleTimeString()}
              </span>
              <span className={clsx("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", LEVEL_BADGE[log.level])}>
                {log.level}
              </span>
              <span className="w-40 shrink-0 truncate text-zinc-400 dark:text-zinc-500" title={log.label}>
                {log.label}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-zinc-700 dark:text-zinc-300">
                {log.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
