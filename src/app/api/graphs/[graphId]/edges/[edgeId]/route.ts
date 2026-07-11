import { NextResponse } from "next/server";
import { deleteEdge } from "@/lib/db/queries/edges";

interface RouteParams {
  params: Promise<{ graphId: string; edgeId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { edgeId } = await params;
  const ok = deleteEdge(edgeId);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
