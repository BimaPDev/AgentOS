import { NextResponse } from "next/server";
import { deleteNode, updateNode } from "@/lib/db/queries/nodes";

interface RouteParams {
  params: Promise<{ graphId: string; nodeId: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { nodeId } = await params;
  const body = await request.json();
  const node = updateNode(nodeId, body);
  if (!node) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(node);
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { nodeId } = await params;
  const ok = deleteNode(nodeId);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
