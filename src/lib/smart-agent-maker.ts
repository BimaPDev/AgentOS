import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import { parseAgentObject, type SerializedAgent } from "@/lib/config-io";
import {
  getMcpServers,
  getSkillsList,
  HERMES_WORKSPACES_DIR,
  listWorkspaceFolders,
} from "@/lib/hermes-admin";
import { createAgent, deleteAgent } from "@/lib/db/queries/agents";
import { createEdge } from "@/lib/db/queries/edges";
import { createNode } from "@/lib/db/queries/nodes";
import type { Agent, ConnectorType, GraphEdge, GraphNode } from "@/lib/types/domain";
import { ROOT_GRAPH_ID } from "@/lib/types/domain";

export interface SmartCreateInput {
  prompt: string;
  connectorType?: ConnectorType;
  /** When set, force this workspace; when omitted, Hermes may pick from inventory. */
  workspaceFolder?: string | null;
  /** Index used to place the new agent on the root orchestration canvas. */
  rootIndex?: number;
}

export interface SmartCreateResult {
  agent: Agent;
  nodes: GraphNode[];
  edges: GraphEdge[];
  draft: SerializedAgent;
}

const SCHEMA_HINT = `{
  "app": "agentos",
  "version": 1,
  "kind": "agent",
  "exportedAt": "<ISO timestamp>",
  "agent": {
    "name": "short name",
    "role": "one-line role",
    "description": "1-2 sentence description",
    "connectorType": "hermes" | "9router" | "mock",
    "workspaceFolder": "<absolute path or null>",
    "color": "#4f46e5"
  },
  "pipeline": {
    "nodes": [
      {
        "key": "n1",
        "type": "prompt" | "tool-call" | "condition" | "output",
        "label": "Step label",
        "position": { "x": 80, "y": 120 },
        "config": {}
      }
    ],
    "edges": [{ "source": "n1", "target": "n2" }]
  }
}`;

const CONFIG_HINT = `Step configs by type:
- prompt: { "prompt": "…", "systemPrompt": "optional", "temperature": 0.7 }
- tool-call: { "toolName": "name", "toolArgs": {} }
- condition: { "expression": "…boolean-ish expression…" }
- output: { "format": "text" | "json" }`;

/** Ask Hermes to design an agent, then persist it (agent + pipeline + root node). */
export async function smartCreateAgent(input: SmartCreateInput): Promise<SmartCreateResult> {
  const goal = input.prompt.trim();
  if (!goal) throw new Error("Describe the agent you want to create.");

  const preferredConnector = input.connectorType ?? "hermes";
  // Smart Maker always runs under the Hermes workspaces root (repos live inside it).
  const preferredFolder =
    preferredConnector === "hermes"
      ? (input.workspaceFolder?.trim() || HERMES_WORKSPACES_DIR)
      : null;

  const [skills, mcp, folders] = await Promise.all([
    getSkillsList(),
    getMcpServers(),
    listWorkspaceFolders(),
  ]);

  const inventory = {
    skills: skills.error
      ? { error: skills.error }
      : {
          summary: skills.summary,
          items: skills.skills.slice(0, 40).map((row) => ({
            name: row.Name ?? row.name ?? row.Skill ?? Object.values(row)[0],
            ...row,
          })),
        },
    mcpServers: mcp.error ? { error: mcp.error } : mcp.servers.slice(0, 30),
    workspaceFolders: folders.error
      ? { error: folders.error }
      : folders.folders.map((f) => ({ name: f.name, path: f.path, remoteUrl: f.remoteUrl })),
  };

  const makerPrompt = [
    "You are AgentOS Smart Agent Maker.",
    "Design one AgentOS agent pipeline from the user's goal and the live Hermes inventory below.",
    "Reply with ONLY a single JSON object — no markdown fences, no commentary.",
    "",
    "JSON schema to match exactly:",
    SCHEMA_HINT,
    "",
    CONFIG_HINT,
    "",
    "Rules:",
    "- Use 2 to 6 pipeline steps connected as a simple left-to-right DAG (no cycles).",
    `- Prefer connectorType "${preferredConnector}".`,
    preferredFolder
      ? `- Always set workspaceFolder to "${preferredFolder}" (the Hermes Workspace root). Subfolders like career-ops are available inside it.`
      : "- Set workspaceFolder to null.",
    "- Space nodes horizontally: x = 80 + index*280, y = 120.",
    "- Node keys must be unique short ids (n1, n2, …). Edges reference those keys.",
    "- For tool-call steps, prefer real skill/MCP names from the inventory when relevant.",
    "- prompt steps should contain concrete, runnable instructions — not placeholders.",
    "- Always end with an output step.",
    "",
    "Live Hermes inventory (use this — do not invent skills/folders that are not listed):",
    JSON.stringify(inventory, null, 2),
    "",
    "User goal:",
    goal,
  ].join("\n");

  const hermes = getHermesConnector();
  let rawText: string;
  try {
    rawText = await hermes.complete(makerPrompt);
  } catch (err) {
    throw new Error(
      `Hermes could not design the agent: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const draft = parseGeneratedAgent(rawText, goal);
  // Honor explicit UI / Smart Maker defaults over whatever Hermes guessed.
  if (input.connectorType) draft.agent.connectorType = input.connectorType;
  draft.agent.workspaceFolder = preferredFolder;
  if (!draft.agent.description) draft.agent.description = goal.slice(0, 240);

  return persistSerializedAgent(draft, input.rootIndex ?? 0);
}

function parseGeneratedAgent(rawText: string, goal: string): SerializedAgent {
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    throw new Error(
      "Hermes did not return valid JSON. Try a shorter description, or check Hermes is reachable.",
    );
  }
  try {
    return parseAgentObject(JSON.parse(jsonText), fallbackNameFromGoal(goal));
  } catch (err) {
    throw new Error(
      `Hermes JSON was invalid: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Pull the first top-level `{…}` from a model reply (tolerates accidental fences). */
export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function fallbackNameFromGoal(goal: string): string {
  const words = goal
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (words.length === 0) return "Smart agent";
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function persistSerializedAgent(draft: SerializedAgent, rootIndex: number): SmartCreateResult {
  const agent = createAgent({
    name: draft.agent.name,
    role: draft.agent.role,
    description: draft.agent.description,
    connectorType: draft.agent.connectorType,
    workspaceFolder: draft.agent.workspaceFolder,
    color: draft.agent.color,
    positionX: 80 + (rootIndex % 4) * 300,
    positionY: 100 + Math.floor(rootIndex / 4) * 200,
  });

  try {
    createNode({
      graphId: ROOT_GRAPH_ID,
      type: "agent",
      refAgentId: agent.id,
      label: agent.name,
      positionX: agent.positionX,
      positionY: agent.positionY,
    });

    const idMap = new Map<string, string>();
    const nodes: GraphNode[] = [];
    draft.pipeline.nodes.forEach((node, index) => {
      const created = createNode({
        graphId: agent.id,
        type: node.type,
        label: node.label,
        positionX: node.position.x || 80 + index * 280,
        positionY: node.position.y || 120,
        config: node.config,
      });
      idMap.set(node.key, created.id);
      nodes.push(created);
    });

    const edges: GraphEdge[] = [];
    for (const edge of draft.pipeline.edges) {
      const sourceNodeId = idMap.get(edge.source);
      const targetNodeId = idMap.get(edge.target);
      if (!sourceNodeId || !targetNodeId) continue;
      edges.push(
        createEdge({
          graphId: agent.id,
          sourceNodeId,
          targetNodeId,
        }),
      );
    }

    if (nodes.length === 0) {
      throw new Error("Hermes returned an agent with no pipeline steps.");
    }

    return { agent, nodes, edges, draft };
  } catch (err) {
    deleteAgent(agent.id);
    throw err;
  }
}
