import { NextResponse } from "next/server";
import { deleteAgent, getAgent, updateAgent } from "@/lib/db/queries/agents";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { agentId } = await params;
  const body = await request.json();
  const agent = updateAgent(agentId, body);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { agentId } = await params;
  const ok = deleteAgent(agentId);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
