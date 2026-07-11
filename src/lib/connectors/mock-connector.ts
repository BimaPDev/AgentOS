import { v4 as randomUUID } from "uuid";
import type {
  AgentConnector,
  ConnectorAgentDescriptor,
  SendPromptOptions,
  StreamChunk,
} from "@/lib/connectors/types";

export interface MockConnectorOptions {
  seed?: number;
  errorRate?: number;
  minTokenDelayMs?: number;
  maxTokenDelayMs?: number;
  minThinkDelayMs?: number;
  maxThinkDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function fabricateResponse(options: SendPromptOptions): { text: string; toolCall?: { toolName: string; toolArgs: Record<string, unknown> } } {
  const nodeType = (options.context?.nodeType as string) ?? "prompt";
  const prompt = options.prompt || "(empty prompt)";

  switch (nodeType) {
    case "tool-call": {
      const toolName = (options.context?.toolName as string) || "lookup_tool";
      return {
        text: `Called ${toolName} with the upstream input and got back a plausible mocked result for: "${prompt}".`,
        toolCall: { toolName, toolArgs: (options.context?.toolArgs as Record<string, unknown>) ?? {} },
      };
    }
    case "condition": {
      const truthy = prompt.length % 2 === 0;
      return { text: `Evaluated condition on "${prompt}" -> ${truthy ? "true" : "false"}.` };
    }
    case "output": {
      return { text: `Final output: ${prompt}` };
    }
    default: {
      return {
        text: `Here is a simulated response to "${prompt}". This mock connector stands in for a real agent backend (like Hermes) until one is wired up.`,
      };
    }
  }
}

export class MockConnector implements AgentConnector {
  private pending = new Map<string, SendPromptOptions>();
  private errorRate: number;
  private minTokenDelayMs: number;
  private maxTokenDelayMs: number;
  private minThinkDelayMs: number;
  private maxThinkDelayMs: number;

  constructor(options: MockConnectorOptions = {}) {
    this.errorRate = options.errorRate ?? 0.05;
    this.minTokenDelayMs = options.minTokenDelayMs ?? 20;
    this.maxTokenDelayMs = options.maxTokenDelayMs ?? 60;
    this.minThinkDelayMs = options.minThinkDelayMs ?? 300;
    this.maxThinkDelayMs = options.maxThinkDelayMs ?? 800;
  }

  async connect(): Promise<void> {
    await sleep(randomBetween(100, 300));
  }

  async disconnect(): Promise<void> {
    await sleep(randomBetween(50, 150));
  }

  async listAgents(): Promise<ConnectorAgentDescriptor[]> {
    return [];
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

    await sleep(randomBetween(this.minThinkDelayMs, this.maxThinkDelayMs));

    if (options.signal?.aborted) {
      yield { type: "error", error: "aborted" };
      return;
    }

    if (Math.random() < this.errorRate) {
      yield { type: "error", error: "Simulated connector error (mock, randomized for testing)" };
      return;
    }

    const { text, toolCall } = fabricateResponse(options);

    if (toolCall) {
      yield { type: "tool-call", toolName: toolCall.toolName, toolArgs: toolCall.toolArgs };
      await sleep(randomBetween(this.minTokenDelayMs, this.maxTokenDelayMs));
    }

    const words = text.split(" ");
    for (const word of words) {
      if (options.signal?.aborted) {
        yield { type: "error", error: "aborted" };
        return;
      }
      yield { type: "token", content: word + " " };
      await sleep(randomBetween(this.minTokenDelayMs, this.maxTokenDelayMs));
    }

    yield { type: "done" };
  }
}
