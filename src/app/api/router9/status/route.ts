import { NextResponse } from "next/server";
import { getRouter9Status } from "@/lib/router9-admin";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getRouter9Status());
}
