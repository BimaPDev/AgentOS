"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { apiFetch } from "@/lib/utils/fetcher";
import {
  ActivityFeed,
  AgentStatusGrid,
  Panel,
  RunStatusBar,
  ScheduledTasksPanel,
  StatTile,
} from "@/components/dashboard/dashboard-panels";
import { HermesOverviewPanel } from "@/components/dashboard/hermes-overview-panel";

const POLL_INTERVAL_MS = 5000;

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  // Lazy init so server and client agree on first paint; the visible text is
  // marked suppressHydrationWarning since wall-clock differs by render moment.
  const [clock, setClock] = useState<Date>(() => new Date());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      setClock(new Date());
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(() => {
      apiFetch<DashboardData>("/api/dashboard")
        .then((fresh) => {
          if (!cancelled) setData(fresh);
        })
        .catch(() => {
          // transient fetch failures are fine; next tick retries
        });
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  const { stats, agents, activity } = data;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header: greeting + system line + live clock */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100" suppressHydrationWarning>
            {greeting(clock.getHours())}.
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span
              className={
                stats.activeRuns > 0
                  ? "inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500"
                  : "inline-block h-2 w-2 rounded-full bg-emerald-500"
              }
            />
            {stats.activeRuns > 0
              ? `${stats.activeRuns} run${stats.activeRuns === 1 ? "" : "s"} in progress`
              : "All systems nominal"}
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            Layer above Hermes
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
            suppressHydrationWarning
          >
            {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="text-xs text-zinc-400 dark:text-zinc-500" suppressHydrationWarning>
            {clock.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Agents" value={stats.agentCount} hint="registered" accent="indigo" />
        <StatTile label="Total runs" value={stats.totalRuns} hint="all time" />
        <StatTile
          label="Success rate"
          value={stats.successRate === null ? "—" : `${stats.successRate}%`}
          hint="of finished runs"
          accent="emerald"
        />
        <StatTile
          label="Active now"
          value={stats.activeRuns}
          hint={stats.activeRuns > 0 ? "running" : "idle"}
          accent={stats.activeRuns > 0 ? "amber" : undefined}
        />
      </div>

      <div className="mb-6">
        <HermesOverviewPanel />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Agents" className="max-h-[22rem]">
          <AgentStatusGrid agents={agents} now={nowMs} />
        </Panel>
        <Panel title="Recent activity" className="max-h-[22rem]">
          <ActivityFeed activity={activity} now={nowMs} />
        </Panel>
        <Panel title="Run history">
          <RunStatusBar statusCounts={stats.statusCounts} />
        </Panel>
        <Panel title="Scheduled tasks">
          <ScheduledTasksPanel />
        </Panel>
      </div>
    </div>
  );
}
