import { NextResponse } from "next/server";
import { installWorkspaceFolder, listWorkspaceFolders } from "@/lib/hermes-admin";

export const runtime = "nodejs";

export async function GET() {
  const result = await listWorkspaceFolders();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.url || typeof body.url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  const result = await installWorkspaceFolder(body.url, typeof body.name === "string" ? body.name : undefined);
  return NextResponse.json(result, { status: result.error ? 400 : 201 });
}
