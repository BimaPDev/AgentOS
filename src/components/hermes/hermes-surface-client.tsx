"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { HermesSurfaceId, HermesSurfaceResult } from "@/lib/hermes-surfaces";

export function HermesSurfaceClient({
  surfaceId,
  initial,
}: {
  surfaceId: HermesSurfaceId;
  initial: HermesSurfaceResult;
}) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [logName, setLogName] = useState(initial.logName ?? "agent");

  const refresh = useCallback(
    async (nextLog?: string) => {
      setLoading(true);
      try {
        const log = nextLog ?? logName;
        const qs =
          surfaceId === "logs" ? `?log=${encodeURIComponent(log)}&lines=150` : "";
        const result = await apiFetch<HermesSurfaceResult>(
          `/api/hermes/surfaces/${surfaceId}${qs}`,
        );
        setData(result);
        if (result.logName) setLogName(result.logName);
      } catch (err) {
        setData((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        setLoading(false);
      }
    },
    [logName, surfaceId],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{data.title}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{data.subtitle}</p>
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

        {data.kind === "logs" && data.logFiles && data.logFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.logFiles.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  setLogName(f.name);
                  void refresh(f.name);
                }}
                className={clsx(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  logName === f.name
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {data.error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {data.error}
          </div>
        )}

        {(data.kind === "text" || data.kind === "logs") && (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
            {data.text?.trim() || (data.error ? "" : "No output.")}
          </pre>
        )}

        {data.kind === "table" && (
          <>
            {!data.rows?.length && !data.error ? (
              <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Nothing configured yet.
              </div>
            ) : data.rows && data.rows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
                      <tr>
                        {Object.keys(data.rows[0]!).map((key) => (
                          <th key={key} className="px-4 py-2 font-medium">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {data.rows.map((row, i) => (
                        <tr key={i} className="align-top">
                          {Object.values(row).map((value, j) => (
                            <td
                              key={j}
                              className="max-w-md px-4 py-2 text-zinc-700 dark:text-zinc-300"
                            >
                              <span className="line-clamp-3 whitespace-pre-wrap break-words">
                                {value}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : data.text ? (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900">
                {data.text}
              </pre>
            ) : null}
          </>
        )}

        {data.kind === "keys" && (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {(data.keys ?? []).map((key) => (
              <li key={key.name} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                    {key.name}
                  </div>
                  {key.detail && (
                    <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{key.detail}</div>
                  )}
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    key.present
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                  )}
                >
                  {key.present ? "set" : "missing"}
                </span>
              </li>
            ))}
            {(data.keys ?? []).length === 0 && !data.error && (
              <li className="px-4 py-10 text-center text-sm text-zinc-500">No key metadata found.</li>
            )}
          </ul>
        )}

        {data.kind === "docs" && (
          <div className="space-y-4">
            {(data.docs ?? []).map((doc) => (
              <section
                key={doc.title}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{doc.title}</h2>
                  {doc.href && (
                    <a
                      href={doc.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Open <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {doc.body && (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {doc.body}
                  </pre>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
