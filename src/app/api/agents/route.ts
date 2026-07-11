import { NextResponse } from "next/server";
import { createAgent, listAgents } from "@/lib/db/queries/agents";

export async function GET() {
  return NextResponse.json(listAgents());
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const agent = createAgent({
    name: body.name,
    role: body.role ?? null,
    description: body.description ?? null,
    connectorType: body.connectorType ?? "mock",
    workspaceFolder: body.workspaceFolder ?? null,
    model: body.model ?? null,
    positionX: body.positionX ?? 0,
    positionY: body.positionY ?? 0,
    color: body.color ?? null,
  });
  return NextResponse.json(agent, { status: 201 });
}
