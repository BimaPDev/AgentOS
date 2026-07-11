"use client";

import Link from "next/link";
import clsx from "clsx";
import { CheckCircle2, XCircle, Loader2, Circle, CalendarClock, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ActivityItem, DashboardAgent, DashboardStats } from "@/lib/dashboard";
import type { RunStatus } from "@/lib/types/domain";
import { timeAgo } from "@/lib/utils/time";

/* ---------- shared status vocabulary (reserved status colors + icon + label) ---------- */

const STATUS_META: Record<
  RunStatus,
  { label: string; dot: string; text: string; icon: typeof CheckCircle2 }
> = {
  idle: { label: "Idle", dot: "bg-zinc-400", text: "text-zinc-500 dark:text-zinc-400", icon: Circle },
  running: {
    label: "Running",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-600 dark:text-amber-400",
    icon: Loader2,
  },
  success: {
    label: "Success",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-600 dark:text-red-400", icon: XCircle },
};

function StatusChip({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-medium", meta.text)}>
      <Icon size={13} className={status === "running" ? "animate-spin" : undefined} />
      {meta.label}
    </span>
  );
}

/* ---------- Panel shell ---------- */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

/* ---------- KPI stat tiles ---------- */

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "emerald" | "amber" | "indigo";
}) {
  const accentClass =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : accent === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : accent === "indigo"
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={clsx("mt-1 text-3xl font-semibold tabular-nums", accentClass)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{hint}</div>}
    </div>
  );
}

/* ---------- Run history status bar (part-to-whole over finished + active runs) ---------- */

export function RunStatusBar({ statusCounts }: { statusCounts: DashboardStats["statusCounts"] }) {
  const segments = [
    { key: "success" as const, count: statusCounts.success, color: "bg-emerald-500", label: "Success" },
    { key: "error" as const, count: statusCounts.error, color: "bg-red-500", label: "Error" },
    { key: "running" as const, count: statusCounts.running, color: "bg-amber-500", label: "Running" },
    { key: "idle" as const, count: statusCounts.idle, color: "bg-zinc-300 dark:bg-zinc-600", label: "Idle" },
  ].filter((s) => s.count > 0);
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">No runs yet.</p>;
  }

  return (
    <div className="px-4 py-4">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.key}
            className={clsx(s.color, "h-full")}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className={clsx("h-2 w-2 rounded-full", s.color)} />
            {s.label}
            <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Agent status grid ---------- */

export function AgentStatusGrid({ agents, now }: { agents: DashboardAgent[]; now: number }) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No agents yet.</p>
        <Link href="/agents" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Create your first agent →
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {agents.map((agent) => {
        const meta = STATUS_META[agent.lastRunStatus ?? "idle"];
        return (
          <li key={agent.id}>
            <Link
              href={`/agents/${agent.id}/pipeline`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {agent.name}
                </span>
                <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                  {agent.role || "No role"} · {agent.connectorType}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <StatusChip status={agent.lastRunStatus ?? "idle"} />
                <span className="mt-0.5 block text-[11px] text-zinc-400 dark:text-zinc-500">
                  {agent.lastRunAt ? timeAgo(agent.lastRunAt, now) : "never run"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Activity feed (recent runs + their responses) ---------- */

export function ActivityFeed({ activity, now }: { activity: ActivityItem[]; now: number }) {
  if (activity.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">
        No activity yet. Runs will show up here as agents execute.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {activity.map((item) => (
        <li key={item.runId} className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <StatusChip status={item.status} />
              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{item.label}</span>
            </span>
            <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
              {timeAgo(item.startedAt, now)}
            </span>
          </div>
          {item.responseSnippet && (
            <p className="mt-1.5 line-clamp-2 border-l-2 border-zinc-200 pl-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              {item.responseSnippet}
            </p>
          )}
          <div className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">via {item.triggeredBy}</div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Scheduled tasks (placeholder — no scheduler wired up yet) ---------- */

export function ScheduledTasksPanel() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <CalendarClock size={22} className="text-zinc-300 dark:text-zinc-600" />
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No scheduled tasks yet</p>
      <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
        Recurring agent runs will appear here once the scheduler is wired up.
      </p>
      <Link
        href="/config"
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Configure <ArrowRight size={12} />
      </Link>
    </div>
  );
}
