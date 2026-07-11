import { NextResponse } from "next/server";
import { deleteWorkspaceFolder } from "@/lib/hermes-admin";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ name: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { name } = await params;
  const result = await deleteWorkspaceFolder(name);
  return NextResponse.json(result, { status: result.error ? 400 : 200 });
}
