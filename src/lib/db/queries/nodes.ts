import { eq, and, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureMigrated } from "@/lib/db/client";
import { edges, nodes } from "@/lib/db/schema";
import { toGraphNode } from "@/lib/db/mappers";
import type { GraphNode, NodeConfig, NodeType } from "@/lib/types/domain";

export interface CreateNodeInput {
  graphId: string;
  type: NodeType;
  refAgentId?: string | null;
  label?: string | null;
  positionX: number;
  positionY: number;
  config?: NodeConfig;
}

export interface UpdateNodeInput {
  label?: string | null;
  positionX?: number;
  positionY?: number;
  config?: NodeConfig;
}

export function listNodes(graphId: string): GraphNode[] {
  ensureMigrated();
  return db.select().from(nodes).where(eq(nodes.graphId, graphId)).all().map(toGraphNode);
}

export function getNode(id: string): GraphNode | null {
  ensureMigrated();
  const row = db.select().from(nodes).where(eq(nodes.id, id)).get();
  return row ? toGraphNode(row) : null;
}

export function createNode(input: CreateNodeInput): GraphNode {
  ensureMigrated();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    graphId: input.graphId,
    type: input.type,
    refAgentId: input.refAgentId ?? null,
    label: input.label ?? null,
    positionX: input.positionX,
    positionY: input.positionY,
    configJson: JSON.stringify(input.config ?? {}),
    createdAt: now,
    updatedAt: now,
  };
  db.insert(nodes).values(row).run();
  return toGraphNode(row);
}

export function updateNode(id: string, input: UpdateNodeInput): GraphNode | null {
  ensureMigrated();
  const existing = db.select().from(nodes).where(eq(nodes.id, id)).get();
  if (!existing) return null;
  const updated = {
    ...existing,
    label: input.label !== undefined ? input.label : existing.label,
    positionX: input.positionX ?? existing.positionX,
    positionY: input.positionY ?? existing.positionY,
    configJson: input.config !== undefined ? JSON.stringify(input.config) : existing.configJson,
    updatedAt: new Date().toISOString(),
  };
  db.update(nodes).set(updated).where(eq(nodes.id, id)).run();
  return toGraphNode(updated);
}

/** Deletes a node and any edges attached to it (as source or target). */
export function deleteNode(id: string): boolean {
  ensureMigrated();
  db.delete(edges).where(or(eq(edges.sourceNodeId, id), eq(edges.targetNodeId, id))).run();
  const result = db.delete(nodes).where(eq(nodes.id, id)).run();
  return result.changes > 0;
}

/** Deletes every node (and their edges) belonging to a graph, e.g. an agent's nested pipeline. */
export function deleteGraph(graphId: string): void {
  ensureMigrated();
  db.delete(edges).where(eq(edges.graphId, graphId)).run();
  db.delete(nodes).where(eq(nodes.graphId, graphId)).run();
}

/** Deletes root-level nodes that reference a given agent (used when an agent is deleted). */
export function deleteNodesByRefAgent(agentId: string): void {
  ensureMigrated();
  const refNodes = db.select().from(nodes).where(eq(nodes.refAgentId, agentId)).all();
  for (const node of refNodes) {
    deleteNode(node.id);
  }
}

export function nodeExistsInGraph(graphId: string, nodeId: string): boolean {
  ensureMigrated();
  const row = db
    .select()
    .from(nodes)
    .where(and(eq(nodes.graphId, graphId), eq(nodes.id, nodeId)))
    .get();
  return !!row;
}
