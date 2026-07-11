import "server-only";
import { getConnector } from "@/lib/connectors";
import type { StreamChunk } from "@/lib/connectors/types";
import { getAgent } from "@/lib/db/queries/agents";
import { listEdges } from "@/lib/db/queries/edges";
import { listNodes } from "@/lib/db/queries/nodes";
import {
  appendRunLog,
  createRun,
  finishRun,
  listRuns,
  updateRunNodeState,
} from "@/lib/db/queries/runs";
import { GraphCycleError, type RunEngineEdge, type RunEngineNode, type RunGraphResult } from "@/lib/execution/run-engine";
import { seedPromptForNode } from "@/lib/execution/seed-prompt";
import { topoSort } from "@/lib/execution/topo-sort";
import type { RunStatus } from "@/lib/types/domain";

async function* executeNodeDirect(params: {
  connectorType: RunEngineNode["connectorType"];
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}): AsyncGenerator<StreamChunk> {
  const connector = getConnector(params.connectorType);
  await connector.connect();
  const { requestId } = await connector.sendPrompt({
    agentId: params.agentId,
    prompt: params.prompt,
    context: params.context,
    signal: params.signal,
  });
  yield* connector.streamResponse(requestId);
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/** True when this agent pipeline already has an in-flight run. */
export function agentHasRunningRun(agentId: string): boolean {
  return listRuns(50).some((run) => run.graphId === agentId && run.status === "running");
}

/**
 * Server-side agent pipeline runner (for schedules / API). Mirrors client
 * `runGraph` but talks to connectors and the DB directly.
 */
export async function runAgentPipelineServer(params: {
  agentId: string;
  triggeredBy?: string;
  signal?: AbortSignal;
}): Promise<RunGraphResult> {
  const agent = getAgent(params.agentId);
  if (!agent) throw new Error("Agent not found");

  const graphNodes = listNodes(agent.id);
  const graphEdges = listEdges(agent.id);
  if (graphNodes.length === 0) throw new Error("Agent has no pipeline steps");

  const nodes: RunEngineNode[] = graphNodes.map((node) => {
    const toolConfig = node.type === "tool-call" ? (node.config as { toolName?: string; toolArgs?: Record<string, unknown> }) : null;
    return {
      id: node.id,
      connectorType: agent.connectorType,
      workspaceFolder: agent.workspaceFolder,
      model: agent.model,
      nodeType: node.type,
      seedPrompt: seedPromptForNode(node),
      toolName: toolConfig?.toolName,
      toolArgs: toolConfig?.toolArgs,
    };
  });
  const edges: RunEngineEdge[] = graphEdges.map((edge) => ({
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
  }));

  const nodeIds = nodes.map((n) => n.id);
  const { order, cycle } = topoSort(nodeIds, edges);
  if (cycle) throw new GraphCycleError();

  const run = createRun(agent.id, nodeIds, params.triggeredBy ?? "schedule");
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const outputs = new Map<string, string>();
  let hermesSessionId: string | null = null;

  const log = (message: string, level: "info" | "debug" | "error" = "info", nodeId: string | null = null) => {
    appendRunLog(run.id, message, level, nodeId);
  };

  log(`Scheduled run started for "${agent.name}" (${order.length} node${order.length === 1 ? "" : "s"}).`);

  for (const nodeId of order) {
    if (params.signal?.aborted) {
      finishRun(run.id, "error");
      log("Run cancelled.", "error", null);
      return { runId: run.id, status: "error" };
    }

    const node = nodesById.get(nodeId);
    if (!node) continue;

    const predecessorIds = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    const upstreamText = predecessorIds
      .map((id) => outputs.get(id))
      .filter((v): v is string => !!v)
      .join("\n");

    const inputText =
      node.connectorType === "hermes"
        ? node.seedPrompt
        : upstreamText
          ? `${node.seedPrompt}\n\n---\nContext from upstream nodes:\n${upstreamText}`
          : node.seedPrompt;

    updateRunNodeState(run.id, nodeId, {
      status: "running",
      inputText,
      startedAt: new Date().toISOString(),
    });
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
      for await (const chunk of executeNodeDirect({
        connectorType: node.connectorType,
        agentId: nodeId,
        prompt: inputText,
        context: {
          nodeType: node.nodeType,
          toolName: node.toolName,
          toolArgs: node.toolArgs,
          workspaceFolder: node.workspaceFolder,
          model: node.model,
          ...(node.connectorType === "hermes" && hermesSessionId ? { sessionId: hermesSessionId } : {}),
        },
        signal: params.signal,
      })) {
        if (chunk.type === "token") {
          fullText += chunk.content;
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
      if (isAbortError(err) || params.signal?.aborted) {
        updateRunNodeState(run.id, nodeId, {
          status: "error",
          errorText: "Cancelled",
          finishedAt: new Date().toISOString(),
        });
        finishRun(run.id, "error");
        log("Run cancelled.", "error", nodeId);
        return { runId: run.id, status: "error" };
      }
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    if (errorMessage) {
      updateRunNodeState(run.id, nodeId, {
        status: "error" as RunStatus,
        errorText: errorMessage,
        finishedAt: new Date().toISOString(),
      });
      log(errorMessage, "error", nodeId);
      finishRun(run.id, "error");
      log("Run halted due to node error.", "error");
      return { runId: run.id, status: "error" };
    }

    outputs.set(nodeId, fullText.trim());
    updateRunNodeState(run.id, nodeId, {
      status: "success",
      outputText: fullText.trim(),
      finishedAt: new Date().toISOString(),
    });
    log("Node completed.", "info", nodeId);
  }

  finishRun(run.id, "success");
  log("Run completed successfully.");
  return { runId: run.id, status: "success" };
}
