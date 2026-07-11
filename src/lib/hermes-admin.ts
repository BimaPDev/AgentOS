import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import type { HermesConnectionInfo } from "@/lib/connectors/hermes-connector";
import { parseRichTable, richRowsToObjects } from "@/lib/utils/rich-table";

/** Non-chat `hermes` admin queries (status/mcp/skills) — shared by API routes and server-rendered pages. */

export interface HermesStatus {
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
  connection: HermesConnectionInfo;
}

export async function getHermesStatus(): Promise<HermesStatus> {
  const connector = getHermesConnector();
  const info = connector.getConnectionInfo();
  const startedAt = Date.now();
  try {
    const result = await connector.runCommand(["version"]);
    const latencyMs = Date.now() - startedAt;
    if (result.code !== 0) {
      return {
        ok: false,
        connection: info,
        latencyMs,
        error: result.stderr.trim() || result.stdout.trim() || `hermes exited with code ${result.code}`,
      };
    }
    return { ok: true, connection: info, latencyMs, version: result.stdout.trim() };
  } catch (err) {
    return {
      ok: false,
      connection: info,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface McpServersResult {
  servers: Record<string, string>[];
  raw: string;
  error?: string;
}

export async function getMcpServers(): Promise<McpServersResult> {
  const connector = getHermesConnector();
  try {
    const result = await connector.runCommand(["mcp", "list"]);
    if (result.code !== 0) {
      return {
        servers: [],
        raw: "",
        error: result.stderr.trim() || result.stdout.trim() || `hermes exited with code ${result.code}`,
      };
    }
    const { headers, rows } = parseRichTable(result.stdout);
    return { servers: headers.length > 0 ? richRowsToObjects(headers, rows) : [], raw: result.stdout.trim() };
  } catch (err) {
    return { servers: [], raw: "", error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SkillsListResult {
  skills: Record<string, string>[];
  summary: string | null;
  raw: string;
  error?: string;
}

export async function getSkillsList(): Promise<SkillsListResult> {
  const connector = getHermesConnector();
  try {
    const result = await connector.runCommand(["skills", "list"]);
    if (result.code !== 0) {
      return {
        skills: [],
        summary: null,
        raw: "",
        error: result.stderr.trim() || result.stdout.trim() || `hermes exited with code ${result.code}`,
      };
    }
    const { headers, rows } = parseRichTable(result.stdout);
    const summary =
      result.stdout
        .split("\n")
        .map((l) => l.trim())
        .find((l) => /enabled,\s*\d+\s*disabled/.test(l)) ?? null;
    return { skills: headers.length > 0 ? richRowsToObjects(headers, rows) : [], summary, raw: result.stdout.trim() };
  } catch (err) {
    return { skills: [], summary: null, raw: "", error: err instanceof Error ? err.message : String(err) };
  }
}
