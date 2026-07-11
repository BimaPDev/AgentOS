import "server-only";
import {
  listDueSchedules,
  recordScheduleResult,
  reserveScheduleSlot,
} from "@/lib/db/queries/schedules";
import { agentHasRunningRun, runAgentPipelineServer } from "@/lib/execution/run-agent-server";

const TICK_MS = 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __agentosScheduleTicker: ReturnType<typeof setInterval> | undefined;
  // eslint-disable-next-line no-var
  var __agentosScheduleTickRunning: boolean | undefined;
}

export async function processDueSchedules(): Promise<{
  checked: number;
  started: number;
  skipped: number;
  errors: string[];
}> {
  if (globalThis.__agentosScheduleTickRunning) {
    return { checked: 0, started: 0, skipped: 0, errors: ["tick already in progress"] };
  }
  globalThis.__agentosScheduleTickRunning = true;

  const due = listDueSchedules();
  let started = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    for (const schedule of due) {
      if (agentHasRunningRun(schedule.agentId)) {
        skipped += 1;
        reserveScheduleSlot(schedule.id, schedule.intervalMinutes);
        continue;
      }

      try {
        reserveScheduleSlot(schedule.id, schedule.intervalMinutes);
        void runAgentPipelineServer({ agentId: schedule.agentId, triggeredBy: "schedule" })
          .then((result) => {
            recordScheduleResult(schedule.id, result.runId);
          })
          .catch((err) => {
            console.error("[schedules] run failed", schedule.agentId, err);
            recordScheduleResult(schedule.id, "error");
          });
        started += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
        reserveScheduleSlot(schedule.id, schedule.intervalMinutes);
      }
    }
  } finally {
    globalThis.__agentosScheduleTickRunning = false;
  }

  return { checked: due.length, started, skipped, errors };
}

export function startScheduleTicker() {
  if (globalThis.__agentosScheduleTicker) return;
  setTimeout(() => {
    void processDueSchedules().catch((err) => console.error("[schedules] boot tick failed", err));
  }, 5_000);
  globalThis.__agentosScheduleTicker = setInterval(() => {
    void processDueSchedules().catch((err) => console.error("[schedules] tick failed", err));
  }, TICK_MS);
  globalThis.__agentosScheduleTicker.unref?.();
}
