import { NextResponse } from "next/server";
import { finishRun, getRun, listRunLogs, listRunNodeStates } from "@/lib/db/queries/runs";

interface RouteParams {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { runId } = await params;
  const run = getRun(runId);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    run,
    nodeStates: listRunNodeStates(runId),
    logs: listRunLogs(runId),
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { runId } = await params;
  const body = await request.json();
  if (body.status !== "success" && body.status !== "error") {
    return NextResponse.json({ error: "status must be 'success' or 'error'" }, { status: 400 });
  }
  const run = finishRun(runId, body.status);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(run);
}
