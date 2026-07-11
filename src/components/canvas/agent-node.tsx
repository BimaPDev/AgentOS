"use client";

import { useRouter } from "next/navigation";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { AgentNodeData, CanvasNode } from "@/lib/stores/canvas-store";
import { NodeStatusBadge } from "@/components/canvas/node-status-badge";

export function AgentNode({ data, selected }: NodeProps<CanvasNode>) {
  const router = useRouter();
  const { agent, status } = data as AgentNodeData;

  return (
    <div
      onDoubleClick={() => agent && router.push(`/agents/${agent.id}/pipeline`)}
      className={clsx(
        "min-w-48 rounded-lg border bg-white px-4 py-3 shadow-sm dark:bg-zinc-900",
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-300 dark:border-zinc-700",
      )}
      title="Double-click to open this agent's step pipeline"
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {agent?.name ?? "Unnamed agent"}
        </span>
        {status && <NodeStatusBadge status={status} />}
      </div>
      {agent?.role && (
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{agent.role}</p>
      )}
      <p className="mt-2 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        double-click to open pipeline
      </p>
      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
}
