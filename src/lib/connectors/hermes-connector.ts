import "server-only";
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { v4 as randomUUID } from "uuid";
import type {
  AgentConnector,
  ConnectorAgentDescriptor,
  SendPromptOptions,
  StreamChunk,
} from "@/lib/connectors/types";

/**
 * Talks to a real Hermes Agent instance over SSH: shells out to
 * `hermes chat -q "<prompt>" -Q --source tool` on the remote box and reports
 * the response as a single "streamed" chunk (Hermes's `-Q` mode returns the
 * full response in one shot to stdout — session id / errors go to stderr, so
 * stdout is always exactly the model's answer, confirmed from cli.py's quiet
 * single-query path). No conversation continuity between runs: each node
 * invocation is a fresh Hermes session, matching how the run engine already
 * has no persistent per-node state.
 */
export interface HermesConnectorOptions {
  host?: string;
  port?: number;
  username?: string;
  privateKeyPath?: string;
  hermesBin?: string;
}

type ResolvedHermesConnectorOptions = Required<HermesConnectorOptions>;

function resolveOptions(options: HermesConnectorOptions): ResolvedHermesConnectorOptions {
  return {
    host: options.host ?? process.env.HERMES_SSH_HOST ?? "192.168.50.86",
    port: options.port ?? Number(process.env.HERMES_SSH_PORT ?? 22),
    username: options.username ?? process.env.HERMES_SSH_USER ?? "hermes",
    privateKeyPath:
      options.privateKeyPath ?? process.env.HERMES_SSH_KEY_PATH ?? "./secrets/agentos_hermes_ed25519",
    hermesBin:
      options.hermesBin ??
      process.env.HERMES_BIN_PATH ??
      "/home/hermes/.hermes/hermes-agent/venv/bin/hermes",
  };
}

/** Single-quote a shell argument, escaping embedded single quotes POSIX-style. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface HermesConnectionInfo {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  hermesBin: string;
}

export class HermesConnector implements AgentConnector {
  private readonly config: ResolvedHermesConnectorOptions;
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private pending = new Map<string, SendPromptOptions>();

  constructor(options: HermesConnectorOptions = {}) {
    this.config = resolveOptions(options);
  }

  async connect(): Promise<void> {
    if (this.client) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      const client = new Client();
      client.on("ready", () => {
        this.client = client;
        this.connecting = null;
        resolve();
      });
      client.on("error", (err) => {
        this.connecting = null;
        this.client = null;
        reject(new Error(`Hermes SSH connection failed: ${err.message}`));
      });
      client.on("close", () => {
        this.client = null;
      });
      client.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        privateKey: readFileSync(this.config.privateKeyPath),
        readyTimeout: 10_000,
      });
    });

    return this.connecting;
  }

  async disconnect(): Promise<void> {
    this.client?.end();
    this.client = null;
  }

  async listAgents(): Promise<ConnectorAgentDescriptor[]> {
    return [
      {
        id: "hermes",
        name: "Hermes Agent",
        role: "Personal AI agent running in the homelab Proxmox",
        capabilities: ["chat", "tool-calling", "skills"],
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

    try {
      await this.connect();
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (options.signal?.aborted) {
      yield { type: "error", error: "aborted" };
      return;
    }

    const prompt = options.prompt || "(empty prompt)";
    const workspaceFolder = options.context?.workspaceFolder;
    const chatCommand = [this.config.hermesBin, "chat", "-q", shellQuote(prompt), "-Q", "--source", "tool"].join(
      " ",
    );
    const command =
      typeof workspaceFolder === "string" && workspaceFolder
        ? `cd ${shellQuote(workspaceFolder)} && ${chatCommand}`
        : chatCommand;

    let result: ExecResult;
    try {
      result = await this.exec(command, options.signal);
    } catch (err) {
      yield { type: "error", error: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (result.code !== 0) {
      const message =
        result.stderr.trim() || result.stdout.trim() || `hermes exited with code ${result.code}`;
      yield { type: "error", error: message };
      return;
    }

    const text = result.stdout.trim();
    const words = text.split(/(?<=\s)/);
    for (const word of words) {
      if (options.signal?.aborted) {
        yield { type: "error", error: "aborted" };
        return;
      }
      yield { type: "token", content: word };
    }

    yield { type: "done" };
  }

  /** Non-secret connection settings, for display on admin/status pages. */
  getConnectionInfo(): HermesConnectionInfo {
    return { ...this.config };
  }

  /**
   * Runs an arbitrary `hermes <args...>` subcommand (e.g. `["mcp", "list"]`)
   * and returns its raw output. For admin/status pages, not the chat path —
   * those commands don't touch the LLM so they work even without a
   * configured provider.
   */
  async runCommand(args: string[], signal?: AbortSignal): Promise<ExecResult> {
    await this.connect();
    const command = [this.config.hermesBin, ...args.map(shellQuote)].join(" ");
    return this.exec(command, signal);
  }

  /**
   * Runs a raw shell command (not a `hermes` subcommand) — used for folder
   * management (git clone/ls/rm under the workspaces dir). Caller is
   * responsible for quoting/escaping any interpolated values via `shellQuote`.
   */
  async runShell(command: string, signal?: AbortSignal): Promise<ExecResult> {
    await this.connect();
    return this.exec(command, signal);
  }

  private exec(command: string, signal?: AbortSignal): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("Hermes SSH client is not connected."));
        return;
      }
      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        let stdout = "";
        let stderr = "";
        const onAbort = () => stream.close();
        signal?.addEventListener("abort", onAbort);
        stream
          .on("close", (code: number | null) => {
            signal?.removeEventListener("abort", onAbort);
            resolve({ stdout, stderr, code: code ?? 0 });
          })
          .on("data", (data: Buffer) => {
            stdout += data.toString("utf8");
          })
          .stderr.on("data", (data: Buffer) => {
            stderr += data.toString("utf8");
          });
      });
    });
  }
}
