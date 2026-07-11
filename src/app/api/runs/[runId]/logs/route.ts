import { NextResponse } from "next/server";
import { appendRunLog } from "@/lib/db/queries/runs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { runId } = await params;
  const body = await request.json();
  if (!body?.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  appendRunLog(runId, body.message, body.level ?? "info", body.nodeId ?? null);
  return NextResponse.json({ ok: true }, { status: 201 });
}
