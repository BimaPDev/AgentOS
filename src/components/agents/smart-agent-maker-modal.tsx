"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { WorkspaceFoldersResult } from "@/lib/hermes-admin";
import type { ConnectorType } from "@/lib/types/domain";

export interface SmartCreateValues {
  prompt: string;
  connectorType: ConnectorType;
  workspaceFolder: string | null;
}

interface SmartAgentMakerModalProps {
  onClose: () => void;
  onCreate: (values: SmartCreateValues) => Promise<void>;
}

export function SmartAgentMakerModal({ onClose, onCreate }: SmartAgentMakerModalProps) {
  const [prompt, setPrompt] = useState("");
  const [connectorType, setConnectorType] = useState<ConnectorType>("hermes");
  const [workspaceFolder, setWorkspaceFolder] = useState("");
  const [folders, setFolders] = useState<WorkspaceFoldersResult["folders"] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const foldersLoading = connectorType === "hermes" && folders === null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        prompt: prompt.trim(),
        connectorType,
        workspaceFolder: connectorType === "hermes" && workspaceFolder ? workspaceFolder : null,
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
        className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Sparkles size={16} />
            </span>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart Agent Maker</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 ml-10 text-xs text-zinc-500 dark:text-zinc-400">
          Describe what you want. Hermes designs a pipeline from your skills, MCP servers, and folders.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              What should this agent do?
            </label>
            <textarea
              autoFocus
              rows={5}
              value={prompt}
              disabled={submitting}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Research open roles matching my resume in a cloned job-search folder, then summarize the top matches as JSON."
              className="w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Run with connector
            </label>
            <select
              value={connectorType}
              disabled={submitting}
              onChange={(e) => setConnectorType(e.target.value as ConnectorType)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="hermes">Hermes</option>
              <option value="9router">9Router</option>
              <option value="mock">Mock</option>
            </select>
          </div>

          {connectorType === "hermes" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Prefer workspace folder (optional)
              </label>
              <select
                value={workspaceFolder}
                onChange={(e) => setWorkspaceFolder(e.target.value)}
                disabled={foldersLoading || submitting}
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">Let Hermes choose (or none)</option>
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
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {submitting && (
            <p className="flex items-center gap-2 rounded-md bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Loader2 size={13} className="animate-spin" />
              Asking Hermes to design your pipeline… this can take a minute.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !prompt.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Generate agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
