import { NextResponse } from "next/server";
import { listHermesDirectory } from "@/lib/hermes-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const result = await listHermesDirectory(path);
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
