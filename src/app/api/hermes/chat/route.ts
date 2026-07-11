import { getHermesConnector } from "@/lib/connectors";
import type { StreamChunk } from "@/lib/connectors/types";

/**
 * Chat turn against Hermes with optional session resume.
 * Streams NDJSON `StreamChunk`s (token / meta / error / done), same wire
 * format as `/api/connectors/execute`.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatRequestBody {
  prompt?: string;
  sessionId?: string | null;
  workspaceFolder?: string | null;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ type: "error", error: "Invalid JSON body." }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return new Response(JSON.stringify({ type: "error", error: "prompt is required" }) + "\n", {
      status: 400,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: StreamChunk) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
      try {
        const hermes = getHermesConnector();
        const turn = await hermes.chatTurn({
          prompt,
          sessionId: body.sessionId ?? null,
          workspaceFolder: body.workspaceFolder ?? null,
          source: "agentos",
          signal: request.signal,
        });

        if (turn.sessionId) {
          write({ type: "meta", sessionId: turn.sessionId });
        }

        const words = turn.text.split(/(?<=\s)/);
        for (const word of words) {
          if (request.signal.aborted) {
            write({ type: "error", error: "aborted" });
            return;
          }
          if (word) write({ type: "token", content: word });
        }
        write({ type: "done" });
      } catch (err) {
        write({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
