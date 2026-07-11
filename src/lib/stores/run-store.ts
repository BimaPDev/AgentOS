import { create } from "zustand";
import type { RunStatus } from "@/lib/types/domain";

export interface RunLogLine {
  id: number;
  nodeId: string | null;
  level: "info" | "debug" | "error";
  message: string;
  ts: string;
}

interface RunState {
  runId: string | null;
  graphId: string | null;
  status: RunStatus;
  nodeStatuses: Record<string, RunStatus>;
  nodeOutputs: Record<string, string>;
  logLines: RunLogLine[];
  nextLogId: number;
  abortController: AbortController | null;

  startRun: (params: { runId: string; graphId: string; nodeIds: string[]; abortController?: AbortController }) => void;
  setRunId: (runId: string) => void;
  setNodeStatus: (nodeId: string, status: RunStatus) => void;
  appendNodeToken: (nodeId: string, token: string) => void;
  addLog: (message: string, level?: RunLogLine["level"], nodeId?: string | null) => void;
  finishRun: (status: Extract<RunStatus, "success" | "error">) => void;
  /** Abort the in-browser connector fetch for the live run (if any). */
  requestStop: () => void;
  reset: () => void;
}

export const useRunStore = create<RunState>((set, get) => ({
  runId: null,
  graphId: null,
  status: "idle",
  nodeStatuses: {},
  nodeOutputs: {},
  logLines: [],
  nextLogId: 1,
  abortController: null,

  startRun: ({ runId, graphId, nodeIds, abortController = null }) =>
    set({
      runId,
      graphId,
      status: "running",
      nodeStatuses: Object.fromEntries(nodeIds.map((id) => [id, "idle" as RunStatus])),
      nodeOutputs: {},
      logLines: [],
      nextLogId: 1,
      abortController,
    }),

  setRunId: (runId) => set({ runId }),

  setNodeStatus: (nodeId, status) =>
    set({ nodeStatuses: { ...get().nodeStatuses, [nodeId]: status } }),

  appendNodeToken: (nodeId, token) =>
    set({
      nodeOutputs: { ...get().nodeOutputs, [nodeId]: (get().nodeOutputs[nodeId] ?? "") + token },
    }),

  addLog: (message, level = "info", nodeId = null) =>
    set((state) => ({
      logLines: [
        ...state.logLines,
        { id: state.nextLogId, nodeId, level, message, ts: new Date().toISOString() },
      ],
      nextLogId: state.nextLogId + 1,
    })),

  finishRun: (status) => set({ status, abortController: null }),

  requestStop: () => {
    const controller = get().abortController;
    controller?.abort();
    set({ abortController: null });
  },

  reset: () =>
    set({
      runId: null,
      graphId: null,
      status: "idle",
      nodeStatuses: {},
      nodeOutputs: {},
      logLines: [],
      nextLogId: 1,
      abortController: null,
    }),
}));
