"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import { timeAgo } from "@/lib/utils/time";
import { StatusChip } from "@/components/dashboard/dashboard-panels";
import type { Run, RunLog, RunNodeState } from "@/lib/types/domain";

const POLL_INTERVAL_MS = 5000;

type RunWithLabel = Run & { label: string };

interface RunDetail {
  run: Run;
  nodeStates: RunNodeState[];
  logs: RunLog[];
}

function duration(startedAt: string, finishedAt: string | null): string {
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(startedAt).getTime());
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function RunRowDetail({ runId }: { runId: string }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<RunDetail>(`/api/runs/${runId}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (error) return <p className="px-4 py-3 text-xs text-red-500">{error}</p>;
  if (!detail) return <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">Loading…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-3 lg:grid-cols-2">
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Node states
        </h3>
        {detail.nodeStates.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">No nodes recorded.</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.nodeStates.map((ns) => (
              <li key={ns.id} className="rounded-md border border-zinc-100 px-2 py-1.5 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-300">{ns.nodeId}</span>
                  <StatusChip status={ns.status} />
                </div>
                {ns.errorText && <p className="mt-1 line-clamp-2 text-xs text-red-500">{ns.errorText}</p>}
                {!ns.errorText && ns.outputText && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{ns.outputText}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Logs
        </h3>
        {detail.logs.length === 0 ? (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">No log lines.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto rounded-md bg-zinc-950 px-2 py-1.5 font-mono text-[11px]">
            {detail.logs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  "whitespace-pre-wrap",
                  log.level === "error" ? "text-red-400" : log.level === "debug" ? "text-sky-400" : "text-zinc-300",
                )}
              >
                <span className="text-zinc-600">{new Date(log.ts).toLocaleTimeString()} </span>
                {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RunsClient({ initialRuns }: { initialRuns: RunWithLabel[] }) {
  const [runs, setRuns] = useState<RunWithLabel[]>(initialRuns);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(() => {
      apiFetch<RunWithLabel[]>("/api/runs?limit=200")
        .then((fresh) => !cancelled && setRuns(fresh))
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  if (runs.length === 0) {
    return (
      <div className="flex-1 overflow-auto p-8">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Runs</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          No runs yet. Run a pipeline from an agent&rsquo;s canvas to see history here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Runs</h1>
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {runs.map((run) => {
          const isOpen = expanded === run.id;
          return (
            <div key={run.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
              <button
                onClick={() => setExpanded(isOpen ? null : run.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                {isOpen ? (
                  <ChevronDown size={14} className="shrink-0 text-zinc-400" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-zinc-400" />
                )}
                <StatusChip status={run.status} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {run.label}
                </span>
                <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">via {run.triggeredBy}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                  {duration(run.startedAt, run.finishedAt)}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-500">
                  {timeAgo(run.startedAt, nowMs)}
                </span>
              </button>
              {isOpen && <RunRowDetail runId={run.id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
