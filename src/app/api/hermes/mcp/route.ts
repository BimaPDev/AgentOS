import { NextResponse } from "next/server";
import { getMcpServers } from "@/lib/hermes-admin";

export const runtime = "nodejs";

export async function GET() {
  const result = await getMcpServers();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
