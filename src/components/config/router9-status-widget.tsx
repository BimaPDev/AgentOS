"use client";

import { useState } from "react";
import clsx from "clsx";
import { Loader2, PlugZap } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { Router9Status } from "@/lib/router9-admin";

export function Router9StatusWidget() {
  const [status, setStatus] = useState<Router9Status | null>(null);
  const [loading, setLoading] = useState(false);

  const test = () => {
    setLoading(true);
    apiFetch<Router9Status>("/api/router9/status")
      .then(setStatus)
      .finally(() => setLoading(false));
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">HTTP connection</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Fetches <code className="font-mono">/v1/models</code> — confirms the router is reachable and lists how
            many models it currently knows about.
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
              Connected — {status.modelCount} models known ({status.latencyMs}ms)
            </>
          ) : (
            <>{status.error}</>
          )}
        </div>
      )}
    </div>
  );
}
