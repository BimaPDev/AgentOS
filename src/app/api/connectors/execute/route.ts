import { getConnector } from "@/lib/connectors";
import type { StreamChunk } from "@/lib/connectors/types";
import type { ConnectorType } from "@/lib/types/domain";

/**
 * Runs a single node's prompt against a connector and streams the result back
 * as newline-delimited JSON `StreamChunk`s. This must stay server-side: real
 * connectors (Hermes) hold SSH credentials and native bindings (`ssh2`) that
 * can't and shouldn't ship to the browser. `run-engine.ts` (client-side)
 * calls this route instead of talking to connectors directly.
 */
export const runtime = "nodejs";

interface ExecuteRequestBody {
  connectorType: ConnectorType;
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ExecuteRequestBody;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: StreamChunk) => controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      try {
        const connector = getConnector(body.connectorType);
        await connector.connect();
        const { requestId } = await connector.sendPrompt({
          agentId: body.agentId,
          prompt: body.prompt,
          context: body.context,
          signal: request.signal,
        });
        for await (const chunk of connector.streamResponse(requestId)) {
          write(chunk);
        }
      } catch (err) {
        write({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
