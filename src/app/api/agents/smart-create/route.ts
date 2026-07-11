import { NextResponse } from "next/server";
import { listAgents } from "@/lib/db/queries/agents";
import { smartCreateAgent } from "@/lib/smart-agent-maker";
import type { ConnectorType } from "@/lib/types/domain";

export const runtime = "nodejs";
/** Hermes chat design calls can take well over the default serverless limit. */
export const maxDuration = 300;

const CONNECTORS: ConnectorType[] = ["mock", "hermes", "9router"];

export async function POST(request: Request) {
  let body: {
    prompt?: unknown;
    connectorType?: unknown;
    workspaceFolder?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const connectorType =
    typeof body.connectorType === "string" && CONNECTORS.includes(body.connectorType as ConnectorType)
      ? (body.connectorType as ConnectorType)
      : "hermes";

  // Only lock the folder when the user picked one; omit so Hermes can choose.
  const workspaceFolder =
    typeof body.workspaceFolder === "string" && body.workspaceFolder.trim()
      ? body.workspaceFolder.trim()
      : undefined;

  try {
    const result = await smartCreateAgent({
      prompt: body.prompt,
      connectorType,
      workspaceFolder,
      rootIndex: listAgents().length,
    });
    return NextResponse.json(
      { agent: result.agent, nodes: result.nodes, edges: result.edges },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /Hermes|JSON|Describe/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
