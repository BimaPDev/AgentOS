import { NextResponse } from "next/server";
import { getSkillsList } from "@/lib/hermes-admin";

export const runtime = "nodejs";

export async function GET() {
  const result = await getSkillsList();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
