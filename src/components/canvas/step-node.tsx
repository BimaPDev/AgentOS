"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { CanvasNode, StepNodeData } from "@/lib/stores/canvas-store";
import { NodeStatusBadge } from "@/components/canvas/node-status-badge";
import type { NodeType } from "@/lib/types/domain";

const TYPE_STYLES: Record<Exclude<NodeType, "agent">, { accent: string; icon: string }> = {
  prompt: { accent: "border-l-indigo-500", icon: "💬" },
  "tool-call": { accent: "border-l-amber-500", icon: "🔧" },
  condition: { accent: "border-l-purple-500", icon: "⑂" },
  output: { accent: "border-l-emerald-500", icon: "⏹" },
};

export function StepNode({ data, selected }: NodeProps<CanvasNode>) {
  const { graphNode, status } = data as StepNodeData;
  const type = graphNode.type as Exclude<NodeType, "agent">;
  const style = TYPE_STYLES[type];

  return (
    <div
      className={clsx(
        "min-w-52 rounded-lg border border-l-4 bg-white px-4 py-3 shadow-sm dark:bg-zinc-900",
        style.accent,
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-300 dark:border-zinc-700",
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <span>{style.icon}</span>
          {graphNode.label || type}
        </span>
        {status && <NodeStatusBadge status={status} />}
      </div>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {type.replace("-", " ")}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
}
