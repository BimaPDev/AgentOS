import { NextResponse } from "next/server";
import { deleteSchedule, getSchedule, updateSchedule } from "@/lib/db/queries/schedules";

interface RouteParams {
  params: Promise<{ scheduleId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { scheduleId } = await params;
  const body = await request.json();
  const existing = getSchedule(scheduleId);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const patch: { intervalMinutes?: number; enabled?: boolean; nextRunAt?: string } = {};
  if (typeof body.intervalMinutes === "number") patch.intervalMinutes = body.intervalMinutes;
  if (typeof body.enabled === "boolean") {
    patch.enabled = body.enabled;
    if (body.enabled) {
      const minutes = patch.intervalMinutes ?? existing.intervalMinutes;
      patch.nextRunAt = new Date(Date.now() + minutes * 60_000).toISOString();
    }
  }

  const updated = updateSchedule(scheduleId, patch);
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { scheduleId } = await params;
  if (!deleteSchedule(scheduleId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
