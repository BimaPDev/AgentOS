import { NextResponse } from "next/server";
import { getHermesChatSession } from "@/lib/hermes-chat";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getHermesChatSession(id);
  if (result.error) {
    return NextResponse.json(result, { status: 502 });
  }
  if (!result.session) {
    return NextResponse.json({ error: "Session not found.", ...result }, { status: 404 });
  }
  return NextResponse.json(result);
}
