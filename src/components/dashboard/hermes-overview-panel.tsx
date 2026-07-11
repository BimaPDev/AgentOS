"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageSquarePlus, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { HermesStatus } from "@/lib/hermes-admin";
import type { HermesChatSession, HermesChatSessionsResult } from "@/lib/hermes-chat";

function formatWhen(ts: number | null): string {
  if (!ts) return "";
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sessionLabel(session: HermesChatSession): string {
  if (session.title?.trim()) return session.title.trim();
  if (session.preview?.trim()) return session.preview.trim();
  return session.id;
}

/** Live Hermes model + recent sessions for the AgentOS Overview dashboard. */
export function HermesOverviewPanel() {
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [sessions, setSessions] = useState<HermesChatSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextStatus, nextSessions] = await Promise.all([
        apiFetch<HermesStatus>("/api/hermes/status"),
        apiFetch<HermesChatSessionsResult>("/api/hermes/sessions?limit=8"),
      ]);
      setStatus(nextStatus);
      setSessions(nextSessions.sessions);
      setError(nextStatus.error ?? nextSessions.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Hermes</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Live model and sessions from Hermes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-md border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Refresh Hermes"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            <MessageSquarePlus size={12} />
            New chat
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Model</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {status?.defaultModel ?? (loading ? "…" : "—")}
            </span>
            {status && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  status.live
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                }`}
              >
                {status.live ? "live" : "offline"}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {status?.provider ? `Provider ${status.provider}` : "Provider —"}
          </p>
          <Link href="/models" className="mt-2 inline-block text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            View models →
          </Link>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Sessions</div>
            <Link href="/sessions" className="text-[11px] font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              All sessions →
            </Link>
          </div>
          {error && !sessions.length ? (
            <p className="text-xs text-red-500">{error}</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No sessions yet.</p>
          ) : (
            <ul className="space-y-1">
              {sessions.slice(0, 6).map((session) => (
                <li key={session.id}>
                  <Link
                    href={`/chat?session=${encodeURIComponent(session.id)}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
                  >
                    <span className="min-w-0 truncate text-sm text-zinc-800 dark:text-zinc-200">
                      {sessionLabel(session)}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-zinc-400">
                      <span>{formatWhen(session.endedAt ?? session.startedAt)}</span>
                      <span className="rounded bg-zinc-100 px-1 py-0.5 font-medium dark:bg-zinc-800">
                        {session.source}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
