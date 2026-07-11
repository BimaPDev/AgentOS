"use client";

import { useState } from "react";
import clsx from "clsx";
import { FolderGit2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { WorkspaceFoldersResult } from "@/lib/hermes-admin";

export function FoldersClient({ initial }: { initial: WorkspaceFoldersResult }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    apiFetch<WorkspaceFoldersResult>("/api/hermes/folders")
      .then(setData)
      .finally(() => setLoading(false));
  };

  const install = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setInstalling(true);
    setInstallError(null);
    try {
      await apiFetch("/api/hermes/folders", {
        method: "POST",
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      });
      setUrl("");
      setName("");
      refresh();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstalling(false);
    }
  };

  const remove = async (folderName: string) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete folder "${folderName}"? This cannot be undone.`)) {
      return;
    }
    setDeletingName(folderName);
    try {
      await apiFetch(`/api/hermes/folders/${encodeURIComponent(folderName)}`, { method: "DELETE" });
      setData((d) => ({ ...d, folders: d.folders.filter((f) => f.name !== folderName) }));
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Folders</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Full git repos cloned onto the Hermes box (e.g. a job-search or research project). Pick one from an
            agent&rsquo;s creation form to run that agent with the folder as its working directory.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      <form
        onSubmit={install}
        className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="min-w-[16rem] flex-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Git URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
        </div>
        <div className="w-48">
          <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Folder name (optional)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="derived from URL"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
        </div>
        <button
          type="submit"
          disabled={installing || !url.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {installing ? <Loader2 size={14} className="animate-spin" /> : <FolderGit2 size={14} />}
          Install
        </button>
        {installError && <p className="w-full text-xs text-red-500">{installError}</p>}
      </form>

      {data.error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {data.error}
        </div>
      )}

      {!data.error && data.folders.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
          <FolderGit2 size={22} className="text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No folders installed yet.</p>
        </div>
      )}

      {!data.error && data.folders.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {data.folders.map((folder) => (
            <div
              key={folder.name}
              className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 last:border-b-0 dark:border-zinc-800"
            >
              <FolderGit2 size={15} className="shrink-0 text-zinc-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{folder.name}</div>
                <div className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                  {folder.remoteUrl ?? folder.path}
                </div>
              </div>
              {folder.size && (
                <span className="shrink-0 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">{folder.size}</span>
              )}
              <button
                onClick={() => remove(folder.name)}
                disabled={deletingName === folder.name}
                aria-label={`Delete ${folder.name}`}
                className={clsx(
                  "shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:hover:bg-red-950 dark:hover:text-red-400",
                )}
              >
                {deletingName === folder.name ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
