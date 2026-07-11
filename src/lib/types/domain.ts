export type ConnectorType = "mock" | "hermes" | "9router";

export type RunStatus = "idle" | "running" | "success" | "error";

export type NodeType = "agent" | "prompt" | "tool-call" | "condition" | "output";

export interface Agent {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  connectorType: ConnectorType;
  /** Absolute path on the Hermes box to `cd` into before running this agent (see /folders). Hermes-only. */
  workspaceFolder: string | null;
  positionX: number;
  positionY: number;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentNodeConfig {
  agentId: string;
}

export interface PromptStepConfig {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
}

export interface ToolCallStepConfig {
  toolName: string;
  toolArgs: Record<string, unknown>;
}

export interface ConditionStepConfig {
  expression: string;
}

export interface OutputStepConfig {
  format: "text" | "json";
}

export type NodeConfig =
  | AgentNodeConfig
  | PromptStepConfig
  | ToolCallStepConfig
  | ConditionStepConfig
  | OutputStepConfig
  | Record<string, never>;

export interface GraphNode {
  id: string;
  graphId: string;
  type: NodeType;
  refAgentId: string | null;
  label: string | null;
  positionX: number;
  positionY: number;
  config: NodeConfig;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  createdAt: string;
}

export interface Run {
  id: string;
  graphId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string;
}

export interface RunNodeState {
  id: string;
  runId: string;
  nodeId: string;
  status: RunStatus;
  inputText: string | null;
  outputText: string | null;
  errorText: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunLog {
  id: number;
  runId: string;
  nodeId: string | null;
  ts: string;
  level: "info" | "debug" | "error";
  message: string;
}

/** The root (top-level) orchestration graph always uses this graph id. */
export const ROOT_GRAPH_ID = "root";
