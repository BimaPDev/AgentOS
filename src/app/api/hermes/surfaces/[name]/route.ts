import { NextResponse } from "next/server";
import {
  getHermesSurface,
  getSurfaceMeta,
  type HermesSurfaceId,
} from "@/lib/hermes-surfaces";

export const runtime = "nodejs";

const IDS = new Set([
  "logs",
  "cron",
  "plugins",
  "channels",
  "webhooks",
  "pairing",
  "profiles",
  "hermes-config",
  "keys",
  "hermes-system",
  "docs",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  if (!IDS.has(name) || !getSurfaceMeta(name)) {
    return NextResponse.json({ error: "Unknown Hermes surface" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const result = await getHermesSurface(name as HermesSurfaceId, {
    logName: searchParams.get("log") ?? undefined,
    lines: searchParams.get("lines") ? Number(searchParams.get("lines")) : undefined,
  });
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
