import { NextResponse } from "next/server";
import { processDueSchedules } from "@/lib/schedules/ticker";

/** Manual/ops trigger for due schedules (also runs automatically via instrumentation ticker). */
export async function POST() {
  const result = await processDueSchedules();
  return NextResponse.json(result);
}
