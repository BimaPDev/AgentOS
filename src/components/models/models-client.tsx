"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { HermesStatus } from "@/lib/hermes-admin";

interface Router9Model {
  id: string;
  ownedBy: string;
}

export function ModelsClient({
  initialStatus,
}: {
  initialStatus: HermesStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [models, setModels] = useState<Router9Model[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextModels] = await Promise.all([
        apiFetch<HermesStatus>("/api/hermes/status"),
        apiFetch<{ models: Router9Model[] }>("/api/router9/models"),
      ]);
      setStatus(nextStatus);
      setModels(nextModels.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...(models ?? [])].sort((a, b) => {
    if (a.id === status.defaultModel) return -1;
    if (b.id === status.defaultModel) return 1;
    if (a.id === "Free_Homelab") return -1;
    if (b.id === "Free_Homelab") return 1;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Models</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Hermes default from config; catalog from 9Router (including combos).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Hermes default</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
            {status.defaultModel ?? "—"}
          </span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              status.live
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
            }`}
          >
            {status.live ? "live" : "offline"}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Provider: <span className="font-mono">{status.provider ?? "—"}</span>
          {status.latencyMs != null && <> · {status.latencyMs}ms</>}
        </p>
        {status.error && <p className="mt-2 text-xs text-red-500">{status.error}</p>}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Available via 9Router</h2>
      {models === null ? (
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 size={14} className="animate-spin" /> Loading models…
        </p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">No models returned from 9Router.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {sorted.map((m) => {
            const isDefault = m.id === status.defaultModel;
            return (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-zinc-800 dark:text-zinc-200">{m.id}</div>
                  <div className="text-[11px] text-zinc-400">{m.ownedBy || "unknown"}</div>
                </div>
                {isDefault && (
                  <span className="shrink-0 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    Hermes default
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
