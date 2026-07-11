"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
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

export function SessionsClient({ initial }: { initial: HermesChatSessionsResult }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initial.sessions);
  const [error, setError] = useState(initial.error ?? null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<HermesChatSessionsResult>("/api/hermes/sessions?limit=100");
      setSessions(result.sessions);
      setError(result.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => void refresh(), 15000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Sessions</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Live from Hermes SQLite — includes AgentOS and TUI sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            <MessageSquarePlus size={13} />
            New chat
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      {sessions.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          No Hermes sessions yet.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => router.push(`/chat?session=${encodeURIComponent(session.id)}`)}
                className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {sessionLabel(session)}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                    <span>{formatWhen(session.endedAt ?? session.startedAt)}</span>
                    <span>·</span>
                    <span>
                      {session.messageCount} msg{session.messageCount === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {session.source}
                    </span>
                    {session.model && (
                      <>
                        <span>·</span>
                        <span className="truncate font-mono">{session.model}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
