/**
 * The connector interface is the seam where a real backend (e.g. "Hermes",
 * a service running in the user's homelab) will eventually plug in. Every
 * part of the UI — the canvas, the inspector, the run engine, the console
 * panel — only ever talks to this interface via `getConnector()`. Adding a
 * real connector later means writing one new file that implements this
 * interface and registering it in `index.ts`; no UI code should need to
 * change.
 */

export interface ConnectorAgentDescriptor {
  id: string;
  name: string;
  role?: string;
  capabilities?: string[];
}

export interface SendPromptOptions {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  signal?: AbortSignal;
}

export type StreamChunk =
  | { type: "token"; content: string }
  | { type: "tool-call"; toolName: string; toolArgs: Record<string, unknown> }
  | { type: "meta"; sessionId?: string }
  | { type: "error"; error: string }
  | { type: "done" };

export interface AgentConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listAgents(): Promise<ConnectorAgentDescriptor[]>;
  sendPrompt(options: SendPromptOptions): Promise<{ requestId: string }>;
  streamResponse(requestId: string): AsyncIterable<StreamChunk>;
}
