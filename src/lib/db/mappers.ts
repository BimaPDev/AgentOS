import type { agents, edges, nodes, runLogs, runNodeStates, runs } from "./schema";
import type {
  Agent,
  ConnectorType,
  GraphEdge,
  GraphNode,
  NodeConfig,
  NodeType,
  Run,
  RunLog,
  RunNodeState,
  RunStatus,
} from "@/lib/types/domain";

type AgentRow = typeof agents.$inferSelect;
type NodeRow = typeof nodes.$inferSelect;
type EdgeRow = typeof edges.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type RunNodeStateRow = typeof runNodeStates.$inferSelect;
type RunLogRow = typeof runLogs.$inferSelect;

export function toAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    description: row.description,
    connectorType: row.connectorType as ConnectorType,
    positionX: row.positionX,
    positionY: row.positionY,
    color: row.color,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toGraphNode(row: NodeRow): GraphNode {
  let config: NodeConfig = {};
  try {
    config = JSON.parse(row.configJson) as NodeConfig;
  } catch {
    config = {};
  }
  return {
    id: row.id,
    graphId: row.graphId,
    type: row.type as NodeType,
    refAgentId: row.refAgentId,
    label: row.label,
    positionX: row.positionX,
    positionY: row.positionY,
    config,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toGraphEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    graphId: row.graphId,
    sourceNodeId: row.sourceNodeId,
    targetNodeId: row.targetNodeId,
    sourceHandle: row.sourceHandle,
    targetHandle: row.targetHandle,
    label: row.label,
    createdAt: row.createdAt,
  };
}

export function toRun(row: RunRow): Run {
  return {
    id: row.id,
    graphId: row.graphId,
    status: row.status as RunStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    triggeredBy: row.triggeredBy,
  };
}

export function toRunNodeState(row: RunNodeStateRow): RunNodeState {
  return {
    id: row.id,
    runId: row.runId,
    nodeId: row.nodeId,
    status: row.status as RunStatus,
    inputText: row.inputText,
    outputText: row.outputText,
    errorText: row.errorText,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export function toRunLog(row: RunLogRow): RunLog {
  return {
    id: row.id,
    runId: row.runId,
    nodeId: row.nodeId,
    ts: row.ts,
    level: row.level as RunLog["level"],
    message: row.message,
  };
}
