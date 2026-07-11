"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { WorkspaceFoldersResult } from "@/lib/hermes-admin";
import type { ConnectorType } from "@/lib/types/domain";

export interface CreateAgentValues {
  name: string;
  connectorType: ConnectorType;
  workspaceFolder: string | null;
  model: string | null;
}

interface CreateAgentModalProps {
  onClose: () => void;
  onCreate: (values: CreateAgentValues) => Promise<void>;
  defaultName: string;
}

export function CreateAgentModal({ onClose, onCreate, defaultName }: CreateAgentModalProps) {
  const [name, setName] = useState(defaultName);
  const [connectorType, setConnectorType] = useState<ConnectorType>("mock");
  const [workspaceFolder, setWorkspaceFolder] = useState<string>("");
  const [folders, setFolders] = useState<WorkspaceFoldersResult["folders"] | null>(null);
  const [model, setModel] = useState<string>("");
  const [router9Models, setRouter9Models] = useState<{ id: string; ownedBy: string }[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const foldersLoading = connectorType === "hermes" && folders === null;
  const modelsLoading = connectorType === "9router" && router9Models === null;

  useEffect(() => {
    if (connectorType !== "hermes" || folders !== null) return;
    let cancelled = false;
    apiFetch<WorkspaceFoldersResult>("/api/hermes/folders")
      .then((res) => !cancelled && setFolders(res.folders))
      .catch(() => !cancelled && setFolders([]));
    return () => {
      cancelled = true;
    };
  }, [connectorType, folders]);

  useEffect(() => {
    if (connectorType !== "9router" || router9Models !== null) return;
    let cancelled = false;
    apiFetch<{ models: { id: string; ownedBy: string }[] }>("/api/router9/models")
      .then((res) => !cancelled && setRouter9Models(res.models))
      .catch(() => !cancelled && setRouter9Models([]));
    return () => {
      cancelled = true;
    };
  }, [connectorType, router9Models]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        connectorType,
        workspaceFolder: connectorType === "hermes" && workspaceFolder ? workspaceFolder : null,
        model: model.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New agent</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">Connector</label>
            <select
              value={connectorType}
              onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="mock">Mock</option>
              <option value="hermes">Hermes</option>
              <option value="9router">9Router</option>
            </select>
          </div>

          {connectorType === "9router" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Model (optional — uses the server default if unset)
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={modelsLoading}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">Default</option>
                {(router9Models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                  </option>
                ))}
              </select>
              {modelsLoading && (
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                  <Loader2 size={11} className="animate-spin" /> Loading models…
                </p>
              )}
              {!modelsLoading && (router9Models?.length ?? 0) === 0 && (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  Couldn&rsquo;t reach 9Router — check Config for connection status.
                </p>
              )}
            </div>
          )}

          {connectorType === "hermes" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Model (optional — passed as `hermes chat -m`)
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. anthropic/claude-sonnet-4"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>
          )}

          {connectorType === "hermes" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Workspace folder (optional)
              </label>
              <select
                value={workspaceFolder}
                onChange={(e) => setWorkspaceFolder(e.target.value)}
                disabled={foldersLoading}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">None — runs from the Hermes home directory</option>
                {(folders ?? []).map((f) => (
                  <option key={f.name} value={f.path}>
                    {f.name}
                  </option>
                ))}
              </select>
              {foldersLoading && (
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
                  <Loader2 size={11} className="animate-spin" /> Loading folders…
                </p>
              )}
              {!foldersLoading && (folders?.length ?? 0) === 0 && (
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  No folders installed yet — add one from the Folders page first.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
