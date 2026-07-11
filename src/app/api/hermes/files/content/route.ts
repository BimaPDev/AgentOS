import { NextResponse } from "next/server";
import { readHermesTextFile } from "@/lib/hermes-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  const result = await readHermesTextFile(path);
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
