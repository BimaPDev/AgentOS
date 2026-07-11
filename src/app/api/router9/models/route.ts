import { NextResponse } from "next/server";
import { getRouter9Connector } from "@/lib/connectors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await getRouter9Connector().listModels();
    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
