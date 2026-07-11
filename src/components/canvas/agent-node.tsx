"use client";

import { useRouter } from "next/navigation";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { AgentNodeData, CanvasNode } from "@/lib/stores/canvas-store";

const SOCKET = "#6366f1";

const STATUS_DOT: Record<string, string> = {
  running: "bg-amber-300 animate-pulse",
  success: "bg-emerald-300",
  error: "bg-red-400",
};

export function AgentNode({ data, selected }: NodeProps<CanvasNode>) {
  const router = useRouter();
  const { agent, status } = data as AgentNodeData;

  return (
    <div
      onDoubleClick={() => agent && router.push(`/agents/${agent.id}/pipeline`)}
      className={clsx(
        "w-56 overflow-hidden rounded-lg border bg-white shadow-md dark:bg-zinc-900",
        selected ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-zinc-300 dark:border-zinc-700",
      )}
      title="Double-click to open this agent's step pipeline"
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: SOCKET, width: 11, height: 11, border: "2px solid #fff" }}
      />

      <div className="flex items-center gap-1.5 bg-indigo-600 px-2.5 py-1.5 text-white">
        <span className="text-xs">🤖</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{agent?.name ?? "Unnamed agent"}</span>
        {status && status !== "idle" && (
          <span className={clsx("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[status])} title={status} />
        )}
      </div>

      <div className="px-2.5 py-2">
        <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">{agent?.role || "No role"}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {agent?.connectorType ?? "mock"} · double-click to open pipeline
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: SOCKET, width: 11, height: 11, border: "2px solid #fff" }}
      />
    </div>
  );
}
