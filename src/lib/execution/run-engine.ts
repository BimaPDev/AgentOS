import type { StreamChunk } from "@/lib/connectors/types";
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
  /** Absolute path on the Hermes box to run this node from (see /folders). Ignored by other connectors. */
  workspaceFolder?: string | null;
  /** Model id to use for this node's connector (9router model id, or a Hermes -m value). */
  model?: string | null;
}

export interface RunEngineEdge {
  source: string;
  target: string;
}

export interface RunEngineCallbacks {
  onNodeStatus: (nodeId: string, status: RunStatus) => void;
  onToken: (nodeId: string, token: string) => void;
  onLog: (message: string, level?: "info" | "debug" | "error", nodeId?: string | null) => void;
  /** Fired once the DB run row exists so the UI can correlate Stop with this run. */
  onRunCreated?: (runId: string) => void;
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
  /** When aborted, the current connector request is cancelled and the run finishes as error. */
  signal?: AbortSignal;
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

/**
 * Runs a node's prompt via `/api/connectors/execute` (server-side — real
 * connectors hold credentials/native bindings that must never reach the
 * browser bundle) and yields the newline-delimited `StreamChunk`s as they
 * arrive.
 */
async function* executeNode(params: {
  connectorType: ConnectorType;
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const response = await fetch("/api/connectors/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      connectorType: params.connectorType,
      agentId: params.agentId,
      prompt: params.prompt,
      context: params.context,
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    yield { type: "error", error: `Connector request failed (HTTP ${response.status})` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim()) yield JSON.parse(line) as StreamChunk;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StreamChunk;
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

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

async function haltRunAsCancelled(params: {
  runId: string;
  nodeId: string | null;
  callbacks: RunEngineCallbacks;
  log: (message: string, level?: "info" | "debug" | "error", nodeId?: string | null) => void;
}): Promise<RunGraphResult> {
  const { runId, nodeId, callbacks, log } = params;
  if (nodeId) {
    callbacks.onNodeStatus(nodeId, "error");
    persistNodeState(runId, nodeId, {
      status: "error",
      errorText: "Cancelled by user",
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
  }
  log("Run cancelled by user.", "error", nodeId);
  await apiFetch(`/api/runs/${runId}`, { method: "PATCH", body: JSON.stringify({ status: "error" }) }).catch(
    () => {},
  );
  return { runId, status: "error" };
}

export async function runGraph({
  graphId,
  nodes,
  edges,
  callbacks,
  signal,
}: RunGraphParams): Promise<RunGraphResult> {
  const nodeIds = nodes.map((n) => n.id);
  const { order, cycle } = topoSort(nodeIds, edges);
  if (cycle) throw new GraphCycleError();

  const run = await apiFetch<Run>("/api/runs", {
    method: "POST",
    body: JSON.stringify({ graphId }),
  });
  callbacks.onRunCreated?.(run.id);

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const outputs = new Map<string, string>();
  const log = (message: string, level: "info" | "debug" | "error" = "info", nodeId: string | null = null) => {
    callbacks.onLog(message, level, nodeId);
    persistLog(run.id, message, level, nodeId).catch(() => {});
  };

  log(`Run started for graph "${graphId}" (${order.length} node${order.length === 1 ? "" : "s"}).`);

  /** Shared Hermes chat session for this run — later nodes resume it for context. */
  let hermesSessionId: string | null = null;

  for (const nodeId of order) {
    if (signal?.aborted) {
      return haltRunAsCancelled({ runId: run.id, nodeId: null, callbacks, log });
    }

    const node = nodesById.get(nodeId);
    if (!node) continue;

    const predecessorIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    const upstreamText = predecessorIds
      .map((id) => outputs.get(id))
      .filter((v): v is string => !!v)
      .join("\n");

    // Hermes: each node sends its own instruction; prior turns live in the resumed session.
    // Other connectors: fold upstream output into the prompt so they still get prior context.
    const inputText =
      node.connectorType === "hermes"
        ? node.seedPrompt
        : upstreamText
          ? `${node.seedPrompt}\n\n---\nContext from upstream nodes:\n${upstreamText}`
          : node.seedPrompt;

    callbacks.onNodeStatus(nodeId, "running");
    persistNodeState(run.id, nodeId, {
      status: "running",
      inputText,
      startedAt: new Date().toISOString(),
    }).catch(() => {});
    log(
      hermesSessionId && node.connectorType === "hermes"
        ? `Running node (resuming Hermes session ${hermesSessionId})…`
        : `Running node…`,
      "info",
      nodeId,
    );

    let fullText = "";
    let errorMessage: string | null = null;
    try {
      for await (const chunk of executeNode({
        connectorType: node.connectorType,
        agentId: nodeId,
        prompt: inputText,
        context: {
          nodeType: node.nodeType,
          toolName: node.toolName,
          toolArgs: node.toolArgs,
          workspaceFolder: node.workspaceFolder,
          model: node.model,
          ...(node.connectorType === "hermes" && hermesSessionId
            ? { sessionId: hermesSessionId }
            : {}),
        },
        signal,
      })) {
        if (chunk.type === "token") {
          fullText += chunk.content;
          callbacks.onToken(nodeId, chunk.content);
        } else if (chunk.type === "tool-call") {
          log(`Tool call: ${chunk.toolName}(${JSON.stringify(chunk.toolArgs)})`, "debug", nodeId);
        } else if (chunk.type === "meta" && chunk.sessionId) {
          if (!hermesSessionId) {
            hermesSessionId = chunk.sessionId;
            log(`Hermes session ${hermesSessionId} — later nodes will reuse this chat.`, "info", nodeId);
          } else {
            hermesSessionId = chunk.sessionId;
          }
        } else if (chunk.type === "error") {
          errorMessage = chunk.error;
        }
      }
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) {
        return haltRunAsCancelled({ runId: run.id, nodeId, callbacks, log });
      }
      throw err;
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
