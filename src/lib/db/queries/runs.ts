import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureMigrated } from "@/lib/db/client";
import { runLogs, runNodeStates, runs } from "@/lib/db/schema";
import { toRun, toRunLog, toRunNodeState } from "@/lib/db/mappers";
import type { Run, RunLog, RunNodeState, RunStatus } from "@/lib/types/domain";

export function createRun(graphId: string, nodeIds: string[], triggeredBy = "user"): Run {
  ensureMigrated();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    graphId,
    status: "running" as RunStatus,
    startedAt: now,
    finishedAt: null,
    triggeredBy,
  };
  db.insert(runs).values(row).run();
  db.insert(runNodeStates)
    .values(
      nodeIds.map((nodeId) => ({
        id: randomUUID(),
        runId: row.id,
        nodeId,
        status: "idle" as RunStatus,
        inputText: null,
        outputText: null,
        errorText: null,
        startedAt: null,
        finishedAt: null,
      })),
    )
    .run();
  return toRun(row);
}

export function getRun(id: string): Run | null {
  ensureMigrated();
  const row = db.select().from(runs).where(eq(runs.id, id)).get();
  return row ? toRun(row) : null;
}

export function listRuns(limit = 50): Run[] {
  ensureMigrated();
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit).all().map(toRun);
}

export function listAllRuns(): Run[] {
  ensureMigrated();
  return db.select().from(runs).all().map(toRun);
}

export function finishRun(id: string, status: Extract<RunStatus, "success" | "error">): Run | null {
  ensureMigrated();
  const existing = db.select().from(runs).where(eq(runs.id, id)).get();
  if (!existing) return null;
  const updated = { ...existing, status, finishedAt: new Date().toISOString() };
  db.update(runs).set(updated).where(eq(runs.id, id)).run();
  return toRun(updated);
}

export function listRunNodeStates(runId: string): RunNodeState[] {
  ensureMigrated();
  return db
    .select()
    .from(runNodeStates)
    .where(eq(runNodeStates.runId, runId))
    .all()
    .map(toRunNodeState);
}

export function updateRunNodeState(
  runId: string,
  nodeId: string,
  patch: Partial<
    Pick<RunNodeState, "status" | "inputText" | "outputText" | "errorText" | "startedAt" | "finishedAt">
  >,
): RunNodeState | null {
  ensureMigrated();
  const existing = db
    .select()
    .from(runNodeStates)
    .where(eq(runNodeStates.runId, runId))
    .all()
    .find((row) => row.nodeId === nodeId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  db.update(runNodeStates).set(updated).where(eq(runNodeStates.id, existing.id)).run();
  return toRunNodeState(updated);
}

export function listRunLogs(runId: string): RunLog[] {
  ensureMigrated();
  return db.select().from(runLogs).where(eq(runLogs.runId, runId)).all().map(toRunLog);
}

export function appendRunLog(
  runId: string,
  message: string,
  level: RunLog["level"] = "info",
  nodeId: string | null = null,
): void {
  ensureMigrated();
  db.insert(runLogs)
    .values({ runId, nodeId, message, level, ts: new Date().toISOString() })
    .run();
}
