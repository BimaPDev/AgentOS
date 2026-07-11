"use client";

import { useState } from "react";
import type { CanvasNode } from "@/lib/stores/canvas-store";
import type { NodeConfig, NodeType } from "@/lib/types/domain";
import { PromptConfigForm } from "@/components/inspector/prompt-config-form";

interface AgentSavePatch {
  name?: string;
  role?: string | null;
  description?: string | null;
}

interface NodeInspectorPanelProps {
  node: CanvasNode;
  onSaveAgent?: (agentId: string, patch: AgentSavePatch) => Promise<void>;
  onSaveStep?: (nodeId: string, patch: { label?: string | null; config: NodeConfig }) => Promise<void>;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";

/**
 * Assumes the parent renders this with `key={node.id}` so a new node
 * selection fully remounts the form instead of needing an effect to
 * re-sync local state.
 */
export function NodeInspectorPanel({ node, onSaveAgent, onSaveStep, onClose }: NodeInspectorPanelProps) {
  const isAgent = node.data.kind === "agent";

  const [name, setName] = useState(() => (node.data.kind === "agent" ? (node.data.agent?.name ?? "") : ""));
  const [role, setRole] = useState(() => (node.data.kind === "agent" ? (node.data.agent?.role ?? "") : ""));
  const [description, setDescription] = useState(() =>
    node.data.kind === "agent" ? (node.data.agent?.description ?? "") : "",
  );
  const [label, setLabel] = useState(() => (node.data.kind === "step" ? (node.data.graphNode.label ?? "") : ""));
  const [config, setConfig] = useState<NodeConfig>(() =>
    node.data.kind === "step" ? node.data.graphNode.config : {},
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isAgent && node.data.kind === "agent" && node.data.agent && onSaveAgent) {
        await onSaveAgent(node.data.agent.id, { name, role: role || null, description: description || null });
      } else if (!isAgent && onSaveStep) {
        await onSaveStep(node.id, { label: label || null, config });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col gap-4 overflow-y-auto border-l border-zinc-300 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {isAgent ? "Agent settings" : "Step settings"}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      {isAgent ? (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <input className={inputClass} value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={inputClass}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Label</label>
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <PromptConfigForm
            type={node.data.graphNode.type as Exclude<NodeType, "agent">}
            config={config}
            onChange={setConfig}
          />
        </div>
      )}

      <button
        onClick={() => {
          handleSave().catch((err) => console.error("Failed to save node", err));
        }}
        disabled={saving}
        className="mt-auto rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </aside>
  );
}
