"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { useCanvasStore, type CanvasNode, type StepNodeData } from "@/lib/stores/canvas-store";
import type {
  ConditionStepConfig,
  NodeType,
  OutputStepConfig,
  PromptStepConfig,
  ToolCallStepConfig,
} from "@/lib/types/domain";

type StepType = Exclude<NodeType, "agent">;

const TYPE_STYLES: Record<StepType, { title: string; socket: string; icon: string; name: string }> = {
  prompt: { title: "bg-indigo-500", socket: "#6366f1", icon: "💬", name: "Prompt" },
  "tool-call": { title: "bg-amber-500", socket: "#f59e0b", icon: "🔧", name: "Tool call" },
  condition: { title: "bg-purple-500", socket: "#a855f7", icon: "⑂", name: "Condition" },
  output: { title: "bg-emerald-600", socket: "#10b981", icon: "⏹", name: "Output" },
};

const STATUS_DOT: Record<string, string> = {
  running: "bg-amber-300 animate-pulse",
  success: "bg-emerald-300",
  error: "bg-red-400",
};

const fieldClass =
  "nodrag nowheel w-full rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

export function StepNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { graphNode, status } = data as StepNodeData;
  const type = graphNode.type as StepType;
  const style = TYPE_STYLES[type];
  const setNodeConfig = useCanvasStore((s) => s.setNodeConfig);
  const setNodeLabel = useCanvasStore((s) => s.setNodeLabel);

  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  const commitLabel = () => {
    setEditingLabel(false);
    const next = labelDraft.trim();
    if (next && next !== graphNode.label) setNodeLabel(id, next);
  };

  return (
    <div
      className={clsx(
        "w-64 overflow-hidden rounded-lg border bg-white shadow-md dark:bg-zinc-900",
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-300 dark:border-zinc-700",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: style.socket, width: 11, height: 11, border: "2px solid #fff" }}
      />

      {/* title bar */}
      <div className={clsx("flex items-center gap-1.5 px-2.5 py-1.5 text-white", style.title)}>
        <span className="text-xs">{style.icon}</span>
        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              if (e.key === "Escape") setEditingLabel(false);
            }}
            className="nodrag min-w-0 flex-1 rounded bg-white/20 px-1 text-sm font-semibold text-white placeholder-white/60 focus:outline-none"
          />
        ) : (
          <span
            className="min-w-0 flex-1 cursor-text truncate text-sm font-semibold"
            title="Double-click to rename"
            onDoubleClick={() => {
              setLabelDraft(graphNode.label ?? style.name);
              setEditingLabel(true);
            }}
          >
            {graphNode.label || style.name}
          </span>
        )}
        {status && status !== "idle" && (
          <span className={clsx("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status])} title={status} />
        )}
      </div>

      {/* body: inline widgets */}
      <div className="space-y-2 px-2.5 py-2">
        {type === "prompt" && <PromptWidgets id={id} config={graphNode.config as PromptStepConfig} onChange={setNodeConfig} />}
        {type === "tool-call" && (
          <ToolCallWidgets id={id} config={graphNode.config as ToolCallStepConfig} onChange={setNodeConfig} />
        )}
        {type === "condition" && (
          <ConditionWidgets id={id} config={graphNode.config as ConditionStepConfig} onChange={setNodeConfig} />
        )}
        {type === "output" && (
          <OutputWidgets id={id} config={graphNode.config as OutputStepConfig} onChange={setNodeConfig} />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: style.socket, width: 11, height: 11, border: "2px solid #fff" }}
      />
    </div>
  );
}

function PromptWidgets({
  id,
  config,
  onChange,
}: {
  id: string;
  config: PromptStepConfig;
  onChange: (id: string, config: PromptStepConfig) => void;
}) {
  return (
    <>
      <div>
        <label className={labelClass}>Prompt</label>
        <textarea
          rows={3}
          className={fieldClass}
          value={config.prompt ?? ""}
          placeholder="Ask the agent…"
          onChange={(e) => onChange(id, { ...config, prompt: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Temperature</label>
        <input
          type="number"
          step={0.1}
          min={0}
          max={2}
          className={fieldClass}
          value={config.temperature ?? 0.7}
          onChange={(e) => onChange(id, { ...config, temperature: Number(e.target.value) })}
        />
      </div>
    </>
  );
}

function ToolCallWidgets({
  id,
  config,
  onChange,
}: {
  id: string;
  config: ToolCallStepConfig;
  onChange: (id: string, config: ToolCallStepConfig) => void;
}) {
  const [argsText, setArgsText] = useState(() => JSON.stringify(config.toolArgs ?? {}, null, 2));
  const [argsError, setArgsError] = useState(false);
  return (
    <>
      <div>
        <label className={labelClass}>Tool name</label>
        <input
          className={fieldClass}
          value={config.toolName ?? ""}
          placeholder="e.g. web_search"
          onChange={(e) => onChange(id, { ...config, toolName: e.target.value })}
        />
      </div>
      <div>
        <label className={labelClass}>Arguments (JSON)</label>
        <textarea
          rows={3}
          className={clsx(fieldClass, "font-mono", argsError && "border-red-500")}
          value={argsText}
          onChange={(e) => {
            setArgsText(e.target.value);
            try {
              const parsed = JSON.parse(e.target.value || "{}");
              setArgsError(false);
              onChange(id, { ...config, toolArgs: parsed });
            } catch {
              setArgsError(true);
            }
          }}
        />
      </div>
    </>
  );
}

function ConditionWidgets({
  id,
  config,
  onChange,
}: {
  id: string;
  config: ConditionStepConfig;
  onChange: (id: string, config: ConditionStepConfig) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Condition</label>
      <input
        className={fieldClass}
        value={config.expression ?? ""}
        placeholder="e.g. contains(output, 'yes')"
        onChange={(e) => onChange(id, { ...config, expression: e.target.value })}
      />
    </div>
  );
}

function OutputWidgets({
  id,
  config,
  onChange,
}: {
  id: string;
  config: OutputStepConfig;
  onChange: (id: string, config: OutputStepConfig) => void;
}) {
  return (
    <div>
      <label className={labelClass}>Format</label>
      <select
        className={fieldClass}
        value={config.format ?? "text"}
        onChange={(e) => onChange(id, { ...config, format: e.target.value as OutputStepConfig["format"] })}
      >
        <option value="text">Text</option>
        <option value="json">JSON</option>
      </select>
    </div>
  );
}
