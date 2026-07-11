import { NextResponse } from "next/server";
import { listAgents } from "@/lib/db/queries/agents";
import { listNodes } from "@/lib/db/queries/nodes";
import { createRun, listRuns } from "@/lib/db/queries/runs";
import { labelForGraph } from "@/lib/dashboard";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
  const runs = listRuns(limit);
  const agentNameById = new Map(listAgents().map((a) => [a.id, a.name]));
  return NextResponse.json(
    runs.map((run) => ({ ...run, label: labelForGraph(run.graphId, agentNameById) })),
  );
}

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
