import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureMigrated } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { toAgent } from "@/lib/db/mappers";
import { deleteGraph, deleteNodesByRefAgent } from "@/lib/db/queries/nodes";
import type { Agent, ConnectorType } from "@/lib/types/domain";

export interface CreateAgentInput {
  name: string;
  role?: string | null;
  description?: string | null;
  connectorType?: ConnectorType;
  positionX?: number;
  positionY?: number;
  color?: string | null;
}

export interface UpdateAgentInput {
  name?: string;
  role?: string | null;
  description?: string | null;
  connectorType?: ConnectorType;
  positionX?: number;
  positionY?: number;
  color?: string | null;
}

export function listAgents(): Agent[] {
  ensureMigrated();
  return db.select().from(agents).all().map(toAgent);
}

export function getAgent(id: string): Agent | null {
  ensureMigrated();
  const row = db.select().from(agents).where(eq(agents.id, id)).get();
  return row ? toAgent(row) : null;
}

export function createAgent(input: CreateAgentInput): Agent {
  ensureMigrated();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    name: input.name,
    role: input.role ?? null,
    description: input.description ?? null,
    connectorType: input.connectorType ?? "mock",
    positionX: input.positionX ?? 0,
    positionY: input.positionY ?? 0,
    color: input.color ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(agents).values(row).run();
  return toAgent(row);
}

export function updateAgent(id: string, input: UpdateAgentInput): Agent | null {
  ensureMigrated();
  const existing = db.select().from(agents).where(eq(agents.id, id)).get();
  if (!existing) return null;
  const updated = {
    ...existing,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  db.update(agents).set(updated).where(eq(agents.id, id)).run();
  return toAgent(updated);
}

/** Deletes an agent, its root-graph node, and its entire nested step pipeline. */
export function deleteAgent(id: string): boolean {
  ensureMigrated();
  deleteGraph(id);
  deleteNodesByRefAgent(id);
  const result = db.delete(agents).where(eq(agents.id, id)).run();
  return result.changes > 0;
}
