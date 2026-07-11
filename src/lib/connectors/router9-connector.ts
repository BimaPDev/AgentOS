import "server-only";
import { v4 as randomUUID } from "uuid";
import type {
  AgentConnector,
  ConnectorAgentDescriptor,
  SendPromptOptions,
  StreamChunk,
} from "@/lib/connectors/types";

/**
 * Talks to a self-hosted 9Router instance (https://9router.com,
 * decolua/9router) over its OpenAI-compatible HTTP API. Unlike Hermes, this
 * is a real HTTP/SSE chat-completions endpoint — no SSH, no shell-quoting,
 * and genuine token-by-token streaming (confirmed live against the running
 * instance: `data: {"choices":[{"delta":{"content":"..."}}]}` chunks
 * terminated by `data: [DONE]`).
 */
export interface Router9ConnectorOptions {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}

interface ResolvedRouter9ConnectorOptions {
  baseUrl: string;
  apiKey: string | null;
  defaultModel: string;
}

function resolveOptions(options: Router9ConnectorOptions): ResolvedRouter9ConnectorOptions {
  const host = process.env.ROUTER9_HOST ?? "192.168.50.86";
  const port = process.env.ROUTER9_PORT ?? "20128";
  return {
    baseUrl: options.baseUrl ?? process.env.ROUTER9_BASE_URL ?? `http://${host}:${port}`,
    apiKey: options.apiKey ?? process.env.ROUTER9_API_KEY ?? null,
    defaultModel: options.defaultModel ?? process.env.ROUTER9_DEFAULT_MODEL ?? "oc/big-pickle",
  };
}

export interface Router9ConnectionInfo {
  baseUrl: string;
  defaultModel: string;
  hasApiKey: boolean;
}

export class Router9Connector implements AgentConnector {
  private readonly config: ResolvedRouter9ConnectorOptions;
  private pending = new Map<string, SendPromptOptions>();

  constructor(options: Router9ConnectorOptions = {}) {
    this.config = resolveOptions(options);
  }

  async connect(): Promise<void> {
    // Stateless HTTP — nothing to keep open.
  }

  async disconnect(): Promise<void> {
    // No-op.
  }

  getConnectionInfo(): Router9ConnectionInfo {
    return { baseUrl: this.config.baseUrl, defaultModel: this.config.defaultModel, hasApiKey: !!this.config.apiKey };
  }

  async listModels(): Promise<{ id: string; ownedBy: string }[]> {
    const res = await fetch(`${this.config.baseUrl}/v1/models`, { headers: this.headers() });
    if (!res.ok) throw new Error(`9Router /v1/models failed: HTTP ${res.status}`);
    const body = (await res.json()) as { data: { id: string; owned_by: string }[] };
    return body.data.map((m) => ({ id: m.id, ownedBy: m.owned_by }));
  }

  async listAgents(): Promise<ConnectorAgentDescriptor[]> {
    return [
      {
        id: "9router",
        name: "9Router",
        role: "Self-hosted multi-provider AI router",
        capabilities: ["chat", "streaming", `default model: ${this.config.defaultModel}`],
      },
    ];
  }

  async sendPrompt(options: SendPromptOptions): Promise<{ requestId: string }> {
    const requestId = randomUUID();
    this.pending.set(requestId, options);
    return { requestId };
  }

  async *streamResponse(requestId: string): AsyncIterable<StreamChunk> {
    const options = this.pending.get(requestId);
    this.pending.delete(requestId);
    if (!options) {
      yield { type: "error", error: `Unknown requestId: ${requestId}` };
      return;
    }
    if (options.signal?.aborted) {
      yield { type: "error", error: "aborted" };
      return;
    }

    const model = (options.context?.model as string | undefined) ?? this.config.defaultModel;
    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.headers() },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: "user", content: options.prompt || "(empty prompt)" }],
        }),
        signal: options.signal,
      });
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      yield { type: "error", error: parseErrorBody(text) ?? `9Router request failed: HTTP ${response.status}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          for (const line of rawEvent.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const chunk = JSON.parse(data) as {
                choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
                error?: { message?: string };
              };
              if (chunk.error?.message) {
                yield { type: "error", error: chunk.error.message };
                return;
              }
              const content = chunk.choices?.[0]?.delta?.content;
              if (content) yield { type: "token", content };
            } catch {
              // Skip malformed SSE lines rather than aborting the whole stream.
            }
          }
        }
      }
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
      return;
    }

    yield { type: "done" };
  }

  private headers(): Record<string, string> {
    return this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {};
  }
}

function parseErrorBody(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message ?? null;
  } catch {
    return text.trim() || null;
  }
}
