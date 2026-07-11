import { NextResponse } from "next/server";
import { agentHasRunningRun, runAgentPipelineServer } from "@/lib/execution/run-agent-server";
import { GraphCycleError } from "@/lib/execution/run-engine";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { agentId } = await params;
  const body = await request.json().catch(() => ({}));
  if (agentHasRunningRun(agentId) && body.force !== true) {
    return NextResponse.json({ error: "agent already has a running run" }, { status: 409 });
  }

  try {
    const result = await runAgentPipelineServer({
      agentId,
      triggeredBy: typeof body.triggeredBy === "string" ? body.triggeredBy : "api",
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GraphCycleError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "Agent not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
