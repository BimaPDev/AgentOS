"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2, PlugZap } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";

interface HermesStatus {
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
  connection: { host: string; port: number; username: string; hermesBin: string; privateKeyPath: string };
}

export function HermesStatusWidget() {
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const test = () => {
    setLoading(true);
    apiFetch<HermesStatus>("/api/hermes/status")
      .then(setStatus)
      .finally(() => setLoading(false));
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">SSH connection</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Runs <code className="font-mono">hermes version</code> over SSH — no LLM call, works even without a
            provider configured.
          </p>
        </div>
        <button
          onClick={test}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
          Test connection
        </button>
      </div>

      {status && (
        <div
          className={clsx(
            "mt-3 rounded-md px-3 py-2 text-xs",
            status.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
          )}
        >
          {status.ok ? (
            <>
              Connected — {status.version} ({status.latencyMs}ms)
            </>
          ) : (
            <>{status.error}</>
          )}
        </div>
      )}
    </div>
  );
}
