import { NextResponse } from "next/server";
import { listHermesChatSessions } from "@/lib/hermes-chat";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const includeTool = searchParams.get("includeTool") === "1";
  const result = await listHermesChatSessions({
    limit: Number.isFinite(limit) ? limit : 50,
    includeTool,
  });
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
