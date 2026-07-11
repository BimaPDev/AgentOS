import { NextResponse } from "next/server";
import { getHermesStatus } from "@/lib/hermes-admin";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getHermesStatus());
}
