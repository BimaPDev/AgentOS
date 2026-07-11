import { getConnector } from "@/lib/connectors";
import { apiFetch } from "@/lib/utils/fetcher";
import { topoSort } from "@/lib/execution/topo-sort";
import type { ConnectorType, NodeType, Run, RunStatus } from "@/lib/types/domain";

export interface RunEngineNode {
  id: string;
  connectorType: ConnectorType;
  nodeType: NodeType;
  /** The prompt/instruction to run when this node has no upstream input. */
  seedPrompt: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface RunEngineEdge {
  source: string;
  target: string;
}

export interface RunEngineCallbacks {
  onNodeStatus: (nodeId: string, status: RunStatus) => void;
  onToken: (nodeId: string, token: string) => void;
  onLog: (message: string, level?: "info" | "debug" | "error", nodeId?: string | null) => void;
}

export class GraphCycleError extends Error {
  constructor() {
    super("This graph has a cycle and cannot be run — pipelines must be a DAG.");
  }
}

export interface RunGraphParams {
  graphId: string;
  nodes: RunEngineNode[];
  edges: RunEngineEdge[];
  callbacks: RunEngineCallbacks;
}

export interface RunGraphResult {
  runId: string;
  status: Extract<RunStatus, "success" | "error">;
}

async function persistLog(runId: string, message: string, level: "info" | "debug" | "error", nodeId: string | null) {
  await apiFetch(`/api/runs/${runId}/logs`, {
    method: "POST",
    body: JSON.stringify({ message, level, nodeId }),
  }).catch(() => {
    // Best-effort: log persistence failures shouldn't abort the run.
  });
}

async function persistNodeState(
  runId: string,
  nodeId: string,
  patch: Record<string, unknown>,
) {
  await apiFetch(`/api/runs/${runId}/nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).catch(() => {
    // Best-effort: node-state persistence failures shouldn't abort the run.
  });
}

export async function runGraph({ graphId, nodes, edges, callbacks }: RunGraphParams): Promise<RunGraphResult> {
  const nodeIds = nodes.map((n) => n.id);
  const { order, cycle } = topoSort(nodeIds, edges);
  if (cycle) throw new GraphCycleError();

  const run = await apiFetch<Run>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ graphId }),
  });

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const outputs = new Map<string, string>();
  const log = (message: string, level: "info" | "debug" | "error" = "info", nodeId: string | null = null) => {
    callbacks.onLog(message, level, nodeId);
    persistLog(run.id, message, level, nodeId).catch(() => {});
  };

  log(`Run started for graph "${graphId}" (${order.length} node${order.length === 1 ? "" : "s"}).`);

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;

    const predecessorIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    const inputText =
      predecessorIds.length > 0
        ? predecessorIds
            .map((id) => outputs.get(id))
            .filter((v): v is string => !!v)
            .join("\n")
        : node.seedPrompt;

    callbacks.onNodeStatus(nodeId, "running");
    persistNodeState(run.id, nodeId, {
      status: "running",
      inputText,
      startedAt: new Date().toISOString(),
    }).catch(() => {});
    log(`Running node…`, "info", nodeId);

    let connector;
    try {
      connector = getConnector(node.connectorType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      callbacks.onNodeStatus(nodeId, "error");
      log(message, "error", nodeId);
      persistNodeState(run.id, nodeId, { status: "error", errorText: message, finishedAt: new Date().toISOString() }).catch(
        () => {},
      );
      await apiFetch(`/api/runs/${run.id}`, { method: "PATCH", body: JSON.stringify({ status: "error" }) }).catch(
        () => {},
      );
      return { runId: run.id, status: "error" };
    }

    await connector.connect();
    const { requestId } = await connector.sendPrompt({
      agentId: nodeId,
      prompt: inputText,
      context: { nodeType: node.nodeType, toolName: node.toolName, toolArgs: node.toolArgs },
    });

    let fullText = "";
    let errorMessage: string | null = null;
    for await (const chunk of connector.streamResponse(requestId)) {
      if (chunk.type === "token") {
        fullText += chunk.content;
        callbacks.onToken(nodeId, chunk.content);
      } else if (chunk.type === "tool-call") {
        log(`Tool call: ${chunk.toolName}(${JSON.stringify(chunk.toolArgs)})`, "debug", nodeId);
      } else if (chunk.type === "error") {
        errorMessage = chunk.error;
      }
    }

    if (errorMessage) {
      callbacks.onNodeStatus(nodeId, "error");
      log(errorMessage, "error", nodeId);
      persistNodeState(run.id, nodeId, {
        status: "error",
        errorText: errorMessage,
        finishedAt: new Date().toISOString(),
      }).catch(() => {});
      await apiFetch(`/api/runs/${run.id}`, { method: "PATCH", body: JSON.stringify({ status: "error" }) }).catch(
        () => {},
      );
      log("Run halted due to node error.", "error");
      return { runId: run.id, status: "error" };
    }

    outputs.set(nodeId, fullText.trim());
    callbacks.onNodeStatus(nodeId, "success");
    persistNodeState(run.id, nodeId, {
      status: "success",
      outputText: fullText.trim(),
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
    log(`Node completed.`, "info", nodeId);
  }

  await apiFetch(`/api/runs/${run.id}`, { method: "PATCH", body: JSON.stringify({ status: "success" }) }).catch(
    () => {},
  );
  log("Run completed successfully.");
  return { runId: run.id, status: "success" };
}
