"use client";

import clsx from "clsx";
import { useRunStore } from "@/lib/stores/run-store";

const LEVEL_COLOR: Record<string, string> = {
  info: "text-zinc-300",
  debug: "text-sky-400",
  error: "text-red-400",
};

interface RunConsolePanelProps {
  nodeLabelById: Record<string, string>;
  onClose: () => void;
}

export function RunConsolePanel({ nodeLabelById, onClose }: RunConsolePanelProps) {
  const status = useRunStore((s) => s.status);
  const logLines = useRunStore((s) => s.logLines);
  const nodeOutputs = useRunStore((s) => s.nodeOutputs);
  const nodeStatuses = useRunStore((s) => s.nodeStatuses);

  const nodeIdsWithOutput = Object.keys(nodeOutputs);

  return (
    <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-10 flex h-64 flex-col rounded-lg border border-zinc-700 bg-zinc-950 shadow-lg">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Run console — <span className={clsx(status === "error" && "text-red-400", status === "success" && "text-emerald-400", status === "running" && "text-amber-400")}>{status}</span>
        </span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Close console">
          ✕
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
          {logLines.length === 0 && <p className="text-zinc-600">No log output yet.</p>}
          {logLines.map((line) => (
            <div key={line.id} className={clsx("whitespace-pre-wrap", LEVEL_COLOR[line.level])}>
              <span className="text-zinc-600">{new Date(line.ts).toLocaleTimeString()} </span>
              {line.nodeId && <span className="text-zinc-500">[{nodeLabelById[line.nodeId] ?? line.nodeId}] </span>}
              {line.message}
            </div>
          ))}
        </div>
        {nodeIdsWithOutput.length > 0 && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 px-3 py-2">
            {nodeIdsWithOutput.map((nodeId) => (
              <div key={nodeId} className="mb-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {nodeLabelById[nodeId] ?? nodeId}
                  <span
                    className={clsx(
                      "rounded-full px-1.5 text-[9px]",
                      nodeStatuses[nodeId] === "success" && "bg-emerald-900 text-emerald-300",
                      nodeStatuses[nodeId] === "running" && "bg-amber-900 text-amber-300",
                      nodeStatuses[nodeId] === "error" && "bg-red-900 text-red-300",
                    )}
                  >
                    {nodeStatuses[nodeId]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-zinc-200">
                  {nodeOutputs[nodeId]}
                  {nodeStatuses[nodeId] === "running" && <span className="animate-pulse">▍</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
