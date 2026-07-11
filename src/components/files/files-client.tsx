"use client";

import { useCallback, useState } from "react";
import clsx from "clsx";
import {
  ChevronRight,
  File,
  FileWarning,
  Folder,
  Home,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type {
  HermesDirectoryListing,
  HermesFileContent,
  HermesFileEntry,
} from "@/lib/hermes-files";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pathSegments(path: string, roots: { path: string; label: string }[]) {
  const root = roots.find((r) => path === r.path || path.startsWith(`${r.path}/`));
  if (!root) return [{ label: path, path }];
  const rest = path === root.path ? [] : path.slice(root.path.length + 1).split("/").filter(Boolean);
  const crumbs = [{ label: root.label, path: root.path }];
  let cur = root.path;
  for (const seg of rest) {
    cur = `${cur}/${seg}`;
    crumbs.push({ label: seg, path: cur });
  }
  return crumbs;
}

export function FilesClient({ initial }: { initial: HermesDirectoryListing }) {
  const [listing, setListing] = useState(initial);
  const [error, setError] = useState(initial.error ?? null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<HermesFileContent | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadDir = useCallback(async (path?: string) => {
    setLoading(true);
    setPreview(null);
    try {
      const qs = path ? `?path=${encodeURIComponent(path)}` : "";
      const result = await apiFetch<HermesDirectoryListing>(`/api/hermes/files${qs}`);
      setListing(result);
      setError(result.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const openEntry = useCallback(
    async (entry: HermesFileEntry) => {
      if (entry.type === "dir") {
        await loadDir(entry.path);
        return;
      }
      if (entry.type !== "file") return;
      setPreviewLoading(true);
      try {
        const result = await apiFetch<HermesFileContent>(
          `/api/hermes/files/content?path=${encodeURIComponent(entry.path)}`,
        );
        setPreview(result);
        if (result.error) setError(result.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPreviewLoading(false);
      }
    },
    [loadDir],
  );

  const crumbs = pathSegments(listing.path, listing.roots);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Files</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Live from the Hermes host over SSH — home, workspaces, and config.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadDir(listing.path)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {listing.roots.map((root) => {
            const active = listing.path === root.path || listing.path.startsWith(`${root.path}/`);
            return (
              <button
                key={root.id}
                type="button"
                onClick={() => void loadDir(root.path)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                  active
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <Home size={12} />
                {root.label}
              </button>
            );
          })}
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="opacity-50" />}
              <button
                type="button"
                onClick={() => void loadDir(crumb.path)}
                className={clsx(
                  "rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                  i === crumbs.length - 1 && "font-medium text-zinc-800 dark:text-zinc-200",
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {listing.entries.length === 0 && !error ? (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              This directory is empty.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {listing.parent && (
                <li>
                  <button
                    type="button"
                    onClick={() => void loadDir(listing.parent!)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  >
                    <Folder size={16} className="shrink-0 text-amber-500" />
                    ..
                  </button>
                </li>
              )}
              {listing.entries.map((entry) => {
                const selected = preview?.path === entry.path;
                return (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() => void openEntry(entry)}
                      className={clsx(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                        selected && "bg-zinc-50 dark:bg-zinc-800/80",
                      )}
                    >
                      {entry.type === "dir" ? (
                        <Folder size={16} className="shrink-0 text-amber-500" />
                      ) : (
                        <File size={16} className="shrink-0 text-zinc-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {entry.name}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
                          {entry.type === "file" && entry.size != null && (
                            <span>{formatBytes(entry.size)}</span>
                          )}
                          {entry.mtime != null && (
                            <>
                              {entry.type === "file" && entry.size != null && <span>·</span>}
                              <span>{formatWhen(entry.mtime)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {entry.type === "dir" && (
                        <ChevronRight size={14} className="shrink-0 text-zinc-300" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {(preview || previewLoading) && (
          <aside className="flex w-[min(42%,28rem)] shrink-0 flex-col border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0 truncate font-mono text-xs text-zinc-600 dark:text-zinc-300">
                {preview?.path ?? "Loading…"}
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Close preview"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {previewLoading && !preview ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 size={14} className="animate-spin" />
                  Loading…
                </div>
              ) : preview?.binary ? (
                <div className="flex items-start gap-2 text-sm text-zinc-500">
                  <FileWarning size={16} className="mt-0.5 shrink-0" />
                  Binary file — preview unavailable ({formatBytes(preview.size)}).
                </div>
              ) : (
                <>
                  {preview?.truncated && (
                    <p className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
                      Showing first {formatBytes(512 * 1024)} of {formatBytes(preview.size)}.
                    </p>
                  )}
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {preview?.content || "(empty file)"}
                  </pre>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
