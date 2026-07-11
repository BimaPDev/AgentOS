import { NextResponse } from "next/server";
import { createEdge, listEdges } from "@/lib/db/queries/edges";

interface RouteParams {
  params: Promise<{ graphId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { graphId } = await params;
  return NextResponse.json(listEdges(graphId));
}

export async function POST(request: Request, { params }: RouteParams) {
  const { graphId } = await params;
  const body = await request.json();
  if (!body?.sourceNodeId || !body?.targetNodeId) {
    return NextResponse.json({ error: "sourceNodeId and targetNodeId are required" }, { status: 400 });
  }
  const edge = createEdge({
    graphId,
    sourceNodeId: body.sourceNodeId,
    targetNodeId: body.targetNodeId,
    sourceHandle: body.sourceHandle ?? null,
    targetHandle: body.targetHandle ?? null,
    label: body.label ?? null,
  });
  return NextResponse.json(edge, { status: 201 });
}
