import { NextResponse } from "next/server";
import { listAgents } from "@/lib/db/queries/agents";
import { listRecentRunLogs } from "@/lib/db/queries/runs";
import { labelForGraph } from "@/lib/dashboard";

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 300);
  const logs = listRecentRunLogs(limit);
  const agentNameById = new Map(listAgents().map((a) => [a.id, a.name]));
  return NextResponse.json(logs.map((log) => ({ ...log, label: labelForGraph(log.graphId, agentNameById) })));
}
