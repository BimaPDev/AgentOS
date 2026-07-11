import { NextResponse } from "next/server";
import { listNodes } from "@/lib/db/queries/nodes";
import { createRun } from "@/lib/db/queries/runs";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.graphId || typeof body.graphId !== "string") {
    return NextResponse.json({ error: "graphId is required" }, { status: 400 });
  }
  const nodeIds = listNodes(body.graphId).map((n) => n.id);
  if (nodeIds.length === 0) {
    return NextResponse.json({ error: "graph has no nodes" }, { status: 400 });
  }
  const run = createRun(body.graphId, nodeIds, body.triggeredBy ?? "user");
  return NextResponse.json(run, { status: 201 });
}
