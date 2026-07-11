import { NextResponse } from "next/server";
import { getAgent, listAgents } from "@/lib/db/queries/agents";
import { deleteSchedule, getScheduleForAgent, listSchedules, upsertSchedule } from "@/lib/db/queries/schedules";

export async function GET() {
  const agents = listAgents();
  const nameById = new Map(agents.map((a) => [a.id, a.name]));
  const schedules = listSchedules().map((schedule) => ({
    ...schedule,
    agentName: nameById.get(schedule.agentId) ?? schedule.agentId,
  }));
  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const body = await request.json();
  const agentId = body?.agentId;
  const intervalMinutes = Number(body?.intervalMinutes);
  if (!agentId || typeof agentId !== "string") {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1) {
    return NextResponse.json({ error: "intervalMinutes must be >= 1" }, { status: 400 });
  }
  if (!getAgent(agentId)) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  const schedule = upsertSchedule({
    agentId,
    intervalMinutes,
    enabled: body.enabled !== false,
  });
  return NextResponse.json(schedule, { status: 201 });
}

export async function DELETE(request: Request) {
  const agentId = new URL(request.url).searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  const existing = getScheduleForAgent(agentId);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  deleteSchedule(existing.id);
  return NextResponse.json({ ok: true });
}
