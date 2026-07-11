import type { Edge } from "@xyflow/react";
import type { CanvasNode } from "@/lib/stores/canvas-store";
import type {
  Agent,
  ConnectorType,
  GraphEdge,
  GraphNode,
  NodeConfig,
  NodeType,
} from "@/lib/types/domain";

const STEP_TYPES: NodeType[] = ["prompt", "tool-call", "condition", "output"];

export interface SerializedNode {
  key: string;
  type: NodeType;
  label: string | null;
  position: { x: number; y: number };
  config: NodeConfig;
}

export interface SerializedEdge {
  source: string;
  target: string;
}

export interface SerializedWorkflow {
  app: "agentos";
  version: 1;
  kind: "pipeline";
  exportedAt: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

export interface SerializedAgent {
  app: "agentos";
  version: 1;
  kind: "agent";
  exportedAt: string;
  agent: {
    name: string;
    role: string | null;
    description: string | null;
    connectorType: ConnectorType;
    workspaceFolder: string | null;
    model: string | null;
    color: string | null;
  };
  pipeline: {
    nodes: SerializedNode[];
    edges: SerializedEdge[];
  };
}

/** Serialize the current pipeline canvas (step nodes + edges) into a portable config. */
export function serializeWorkflow(nodes: CanvasNode[], edges: Edge[]): SerializedWorkflow {
  return {
    app: "agentos",
    version: 1,
    kind: "pipeline",
    exportedAt: new Date().toISOString(),
    nodes: nodes.map((n) => {
      const g = n.data.graphNode;
      return {
        key: n.id,
        type: g.type,
        label: g.label,
        position: { x: n.position.x, y: n.position.y },
        config: g.config,
      };
    }),
    edges: edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

/** Parse + validate an imported config file. Throws with a friendly message on bad input. */
export function parseWorkflow(text: string): SerializedWorkflow {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file.");
  }
  if (typeof raw !== "object" || raw === null) throw new Error("Config file is empty or malformed.");
  const obj = raw as Record<string, unknown>;
  if (obj.app !== "agentos" || obj.kind !== "pipeline") {
    throw new Error("This file is not an AgentOS pipeline config.");
  }
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new Error("Config file is missing nodes or edges.");
  }
  const nodes: SerializedNode[] = obj.nodes.map((n, i) => {
    const node = n as Record<string, unknown>;
    if (typeof node.key !== "string" || !STEP_TYPES.includes(node.type as NodeType)) {
      throw new Error(`Node #${i + 1} is invalid.`);
    }
    const pos = (node.position ?? {}) as Record<string, unknown>;
    return {
      key: node.key,
      type: node.type as NodeType,
      label: typeof node.label === "string" ? node.label : null,
      position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
      config: (node.config ?? {}) as NodeConfig,
    };
  });
  const edges: SerializedEdge[] = obj.edges.map((e) => {
    const edge = e as Record<string, unknown>;
    return { source: String(edge.source), target: String(edge.target) };
  });
  return { app: "agentos", version: 1, kind: "pipeline", exportedAt: String(obj.exportedAt ?? ""), nodes, edges };
}

/** Serialize an agent and its pipeline into one portable JSON document. */
export function serializeAgent(agent: Agent, nodes: GraphNode[], edges: GraphEdge[]): SerializedAgent {
  return {
    app: "agentos",
    version: 1,
    kind: "agent",
    exportedAt: new Date().toISOString(),
    agent: {
      name: agent.name,
      role: agent.role,
      description: agent.description,
      connectorType: agent.connectorType,
      workspaceFolder: agent.workspaceFolder,
      model: agent.model,
      color: agent.color,
    },
    pipeline: {
      nodes: nodes.map((node) => ({
        key: node.id,
        type: node.type,
        label: node.label,
        position: { x: node.positionX, y: node.positionY },
        config: node.config,
      })),
      edges: edges.map((edge) => ({ source: edge.sourceNodeId, target: edge.targetNodeId })),
    },
  };
}

/** Parse a full-agent export, or wrap a legacy pipeline export as a new agent. */
export function parseAgent(text: string, fallbackName = "Imported agent"): SerializedAgent {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Not a valid JSON file.");
  }
  if (typeof raw !== "object" || raw === null) throw new Error("Agent file is empty or malformed.");
  const obj = raw as Record<string, unknown>;

  if (obj.kind === "pipeline") {
    const pipeline = parseWorkflow(text);
    return {
      app: "agentos",
      version: 1,
      kind: "agent",
      exportedAt: pipeline.exportedAt,
      agent: {
        name: fallbackName,
        role: null,
        description: null,
        connectorType: "mock",
        workspaceFolder: null,
        model: null,
        color: null,
      },
      pipeline: { nodes: pipeline.nodes, edges: pipeline.edges },
    };
  }

  if (obj.app !== "agentos" || obj.kind !== "agent") {
    throw new Error("This file is not an AgentOS agent export.");
  }
  const metadata = obj.agent as Record<string, unknown> | undefined;
  const pipeline = obj.pipeline as Record<string, unknown> | undefined;
  if (!metadata || typeof metadata.name !== "string" || !pipeline) {
    throw new Error("Agent export is missing metadata or pipeline data.");
  }

  const workflow = parseWorkflow(
    JSON.stringify({
      app: "agentos",
      version: 1,
      kind: "pipeline",
      exportedAt: obj.exportedAt,
      nodes: pipeline.nodes,
      edges: pipeline.edges,
    }),
  );
  return {
    app: "agentos",
    version: 1,
    kind: "agent",
    exportedAt: String(obj.exportedAt ?? ""),
    agent: {
      name: metadata.name,
      role: typeof metadata.role === "string" ? metadata.role : null,
      description: typeof metadata.description === "string" ? metadata.description : null,
      connectorType: parseConnectorType(metadata.connectorType),
      workspaceFolder: typeof metadata.workspaceFolder === "string" ? metadata.workspaceFolder : null,
      model: typeof metadata.model === "string" ? metadata.model : null,
      color: typeof metadata.color === "string" ? metadata.color : null,
    },
    pipeline: { nodes: workflow.nodes, edges: workflow.edges },
  };
}

/** Same validation as `parseAgent`, but for an already-parsed object (e.g. Smart Maker output). */
export function parseAgentObject(raw: unknown, fallbackName = "Imported agent"): SerializedAgent {
  return parseAgent(JSON.stringify(raw), fallbackName);
}

function parseConnectorType(value: unknown): ConnectorType {
  if (value === "hermes" || value === "9router" || value === "mock") return value;
  return "mock";
}

/** Trigger a browser download of `data` as a pretty-printed JSON file. */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
