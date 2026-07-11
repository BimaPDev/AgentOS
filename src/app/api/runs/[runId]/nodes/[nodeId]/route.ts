import { NextResponse } from "next/server";
import { updateRunNodeState } from "@/lib/db/queries/runs";

interface RouteParams {
  params: Promise<{ runId: string; nodeId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { runId, nodeId } = await params;
  const body = await request.json();
  const state = updateRunNodeState(runId, nodeId, body);
  if (!state) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(state);
}
