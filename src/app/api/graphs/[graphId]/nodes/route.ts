import { NextResponse } from "next/server";
import { createNode, listNodes } from "@/lib/db/queries/nodes";
import type { NodeType } from "@/lib/types/domain";

interface RouteParams {
  params: Promise<{ graphId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { graphId } = await params;
  return NextResponse.json(listNodes(graphId));
}

export async function POST(request: Request, { params }: RouteParams) {
  const { graphId } = await params;
  const body = await request.json();
  if (!body?.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  const node = createNode({
    graphId,
    type: body.type as NodeType,
    refAgentId: body.refAgentId ?? null,
    label: body.label ?? null,
    positionX: body.positionX ?? 0,
    positionY: body.positionY ?? 0,
    config: body.config ?? {},
  });
  return NextResponse.json(node, { status: 201 });
}
