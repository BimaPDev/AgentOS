import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureMigrated } from "@/lib/db/client";
import { edges } from "@/lib/db/schema";
import { toGraphEdge } from "@/lib/db/mappers";
import type { GraphEdge } from "@/lib/types/domain";

export interface CreateEdgeInput {
  graphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
}

export function listEdges(graphId: string): GraphEdge[] {
  ensureMigrated();
  return db.select().from(edges).where(eq(edges.graphId, graphId)).all().map(toGraphEdge);
}

export function createEdge(input: CreateEdgeInput): GraphEdge {
  ensureMigrated();
  const row = {
    id: randomUUID(),
    graphId: input.graphId,
    sourceNodeId: input.sourceNodeId,
    targetNodeId: input.targetNodeId,
    sourceHandle: input.sourceHandle ?? null,
    targetHandle: input.targetHandle ?? null,
    label: input.label ?? null,
    createdAt: new Date().toISOString(),
  };
  db.insert(edges).values(row).run();
  return toGraphEdge(row);
}

export function deleteEdge(id: string): boolean {
  ensureMigrated();
  const result = db.delete(edges).where(eq(edges.id, id)).run();
  return result.changes > 0;
}
