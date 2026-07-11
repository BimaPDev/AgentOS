import { and, asc, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, ensureMigrated } from "@/lib/db/client";
import { schedules } from "@/lib/db/schema";
import { toAgentSchedule } from "@/lib/db/mappers";
import type { AgentSchedule } from "@/lib/types/domain";

export function listSchedules(): AgentSchedule[] {
  ensureMigrated();
  return db.select().from(schedules).orderBy(asc(schedules.nextRunAt)).all().map(toAgentSchedule);
}

export function getSchedule(id: string): AgentSchedule | null {
  ensureMigrated();
  const row = db.select().from(schedules).where(eq(schedules.id, id)).get();
  return row ? toAgentSchedule(row) : null;
}

export function getScheduleForAgent(agentId: string): AgentSchedule | null {
  ensureMigrated();
  const row = db.select().from(schedules).where(eq(schedules.agentId, agentId)).get();
  return row ? toAgentSchedule(row) : null;
}

export function listDueSchedules(nowIso = new Date().toISOString()): AgentSchedule[] {
  ensureMigrated();
  return db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, nowIso)))
    .all()
    .map(toAgentSchedule);
}

export function upsertSchedule(input: {
  agentId: string;
  intervalMinutes: number;
  enabled?: boolean;
}): AgentSchedule {
  ensureMigrated();
  const now = new Date();
  const nowIso = now.toISOString();
  const intervalMinutes = Math.max(1, Math.floor(input.intervalMinutes));
  const enabled = input.enabled ?? true;
  const nextRunAt = new Date(now.getTime() + intervalMinutes * 60_000).toISOString();

  const existing = db.select().from(schedules).where(eq(schedules.agentId, input.agentId)).get();
  if (existing) {
    const updated = {
      ...existing,
      intervalMinutes,
      enabled,
      nextRunAt: enabled ? nextRunAt : existing.nextRunAt,
      updatedAt: nowIso,
    };
    db.update(schedules).set(updated).where(eq(schedules.id, existing.id)).run();
    return toAgentSchedule(updated);
  }

  const row = {
    id: randomUUID(),
    agentId: input.agentId,
    intervalMinutes,
    enabled,
    nextRunAt,
    lastRunAt: null as string | null,
    lastRunId: null as string | null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  db.insert(schedules).values(row).run();
  return toAgentSchedule(row);
}

export function updateSchedule(
  id: string,
  patch: Partial<Pick<AgentSchedule, "intervalMinutes" | "enabled" | "nextRunAt" | "lastRunAt" | "lastRunId">>,
): AgentSchedule | null {
  ensureMigrated();
  const existing = db.select().from(schedules).where(eq(schedules.id, id)).get();
  if (!existing) return null;
  const updated = {
    ...existing,
    ...patch,
    intervalMinutes:
      patch.intervalMinutes !== undefined
        ? Math.max(1, Math.floor(patch.intervalMinutes))
        : existing.intervalMinutes,
    updatedAt: new Date().toISOString(),
  };
  db.update(schedules).set(updated).where(eq(schedules.id, id)).run();
  return toAgentSchedule(updated);
}

export function deleteSchedule(id: string): boolean {
  ensureMigrated();
  const result = db.delete(schedules).where(eq(schedules.id, id)).run();
  return result.changes > 0;
}

export function markScheduleRan(id: string, runId: string, intervalMinutes: number): AgentSchedule | null {
  const now = new Date();
  return updateSchedule(id, {
    lastRunAt: now.toISOString(),
    lastRunId: runId,
    nextRunAt: new Date(now.getTime() + Math.max(1, intervalMinutes) * 60_000).toISOString(),
  });
}

/** Advance nextRunAt when starting a run; keep lastRunId until the run finishes. */
export function reserveScheduleSlot(id: string, intervalMinutes: number): AgentSchedule | null {
  const now = new Date();
  return updateSchedule(id, {
    nextRunAt: new Date(now.getTime() + Math.max(1, intervalMinutes) * 60_000).toISOString(),
  });
}

export function recordScheduleResult(id: string, runId: string): AgentSchedule | null {
  return updateSchedule(id, {
    lastRunAt: new Date().toISOString(),
    lastRunId: runId,
  });
}
