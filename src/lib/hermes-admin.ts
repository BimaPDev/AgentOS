import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import { shellQuote, type HermesConnectionInfo } from "@/lib/connectors/hermes-connector";
import { parseRichTable, richRowsToObjects } from "@/lib/utils/rich-table";

/** Non-chat `hermes` admin queries (status/mcp/skills) — shared by API routes and server-rendered pages. */

export interface HermesStatus {
  ok: boolean;
  latencyMs: number;
  version?: string;
  error?: string;
  connection: HermesConnectionInfo;
  /** Live model/provider from Hermes config.yaml (source of truth). */
  defaultModel?: string | null;
  provider?: string | null;
  /** True when Hermes CLI answers and (if checkable) the inference endpoint looks up. */
  live?: boolean;
}

export async function getHermesStatus(): Promise<HermesStatus> {
  const connector = getHermesConnector();
  const info = connector.getConnectionInfo();
  const startedAt = Date.now();
  try {
    const [versionResult, modelInfo] = await Promise.all([
      connector.runCommand(["version"]),
      getHermesModelConfig().catch(() => null),
    ]);
    const latencyMs = Date.now() - startedAt;
    if (versionResult.code !== 0) {
      return {
        ok: false,
        connection: info,
        latencyMs,
        error:
          versionResult.stderr.trim() ||
          versionResult.stdout.trim() ||
          `hermes exited with code ${versionResult.code}`,
        defaultModel: modelInfo?.defaultModel ?? null,
        provider: modelInfo?.provider ?? null,
        live: false,
      };
    }
    return {
      ok: true,
      connection: info,
      latencyMs,
      version: versionResult.stdout.trim(),
      defaultModel: modelInfo?.defaultModel ?? null,
      provider: modelInfo?.provider ?? null,
      live: true,
    };
  } catch (err) {
    return {
      ok: false,
      connection: info,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
      live: false,
    };
  }
}

export interface HermesModelConfig {
  defaultModel: string | null;
  provider: string | null;
  baseUrl: string | null;
}

/** Reads `model.*` from Hermes `~/.hermes/config.yaml` over SSH. */
export async function getHermesModelConfig(): Promise<HermesModelConfig> {
  const connector = getHermesConnector();
  const py = `
import json
try:
    import yaml
except ImportError:
    import sys
    sys.path.insert(0, "/home/hermes/.hermes/hermes-agent/venv/lib/python3.11/site-packages")
    import yaml
cfg = yaml.safe_load(open("/home/hermes/.hermes/config.yaml")) or {}
model = cfg.get("model") or {}
print(json.dumps({
    "defaultModel": model.get("default"),
    "provider": model.get("provider"),
    "baseUrl": model.get("base_url"),
}))
`.trim();
  const result = await connector.runShell(
    `/home/hermes/.hermes/hermes-agent/venv/bin/python3 -c ${shellQuote(py)}`,
  );
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `exited with code ${result.code}`);
  }
  const parsed = JSON.parse(result.stdout.trim()) as {
    defaultModel?: string | null;
    provider?: string | null;
    baseUrl?: string | null;
  };
  return {
    defaultModel: typeof parsed.defaultModel === "string" ? parsed.defaultModel : null,
    provider: typeof parsed.provider === "string" ? parsed.provider : null,
    baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : null,
  };
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

/**
 * "Folder control" — full git repos/projects cloned onto the Hermes box that
 * an agent can be pointed at (e.g. https://github.com/MadsLorentzen/ai-job-search).
 * Distinct from `getSkillsList` above: Hermes skills are single SKILL.md
 * packages from its own registry, these are arbitrary multi-file workspaces
 * that become the agent's cwd (see HermesConnector's `workspaceFolder`
 * context — `cd <folder> && hermes chat ...`).
 */
const WORKSPACES_DIR = process.env.HERMES_WORKSPACES_DIR ?? "/home/hermes/workspaces";
const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const GIT_URL_RE = /^(https?:\/\/\S+|git@\S+:\S+|ssh:\/\/\S+)$/;

export interface WorkspaceFolder {
  name: string;
  path: string;
  remoteUrl: string | null;
  size: string | null;
}

function deriveSlugFromUrl(url: string): string {
  const last =
    url
      .replace(/\.git$/, "")
      .split(/[/:]/)
      .filter(Boolean)
      .pop() ?? "repo";
  return last.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
}

export interface WorkspaceFoldersResult {
  folders: WorkspaceFolder[];
  error?: string;
}

export async function listWorkspaceFolders(): Promise<WorkspaceFoldersResult> {
  const connector = getHermesConnector();
  try {
    const command = [
      `mkdir -p ${shellQuote(WORKSPACES_DIR)} &&`,
      `find ${shellQuote(WORKSPACES_DIR)} -mindepth 1 -maxdepth 1 -type d | while read -r d; do`,
      `name=$(basename "$d");`,
      `url=$(git -C "$d" remote get-url origin 2>/dev/null || true);`,
      `size=$(du -sh "$d" 2>/dev/null | cut -f1);`,
      `printf '%s\\t%s\\t%s\\n' "$name" "$url" "$size";`,
      `done`,
    ].join(" ");
    const result = await connector.runShell(command);
    if (result.code !== 0) {
      return { folders: [], error: result.stderr.trim() || `exited with code ${result.code}` };
    }
    const folders = result.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, remoteUrl, size] = line.split("\t");
        return { name, path: `${WORKSPACES_DIR}/${name}`, remoteUrl: remoteUrl || null, size: size || null };
      });
    return { folders };
  } catch (err) {
    return { folders: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export interface InstallWorkspaceFolderResult {
  folder?: WorkspaceFolder;
  error?: string;
}

export async function installWorkspaceFolder(url: string, name?: string): Promise<InstallWorkspaceFolderResult> {
  if (!GIT_URL_RE.test(url.trim())) {
    return { error: "Not a recognizable git URL — use https://... or git@host:path." };
  }
  const slug = (name && name.trim()) || deriveSlugFromUrl(url);
  if (!SLUG_RE.test(slug)) {
    return { error: "Folder name must be letters, numbers, hyphens, or underscores only." };
  }

  const connector = getHermesConnector();
  const targetPath = `${WORKSPACES_DIR}/${slug}`;
  try {
    const command = `mkdir -p ${shellQuote(WORKSPACES_DIR)} && git clone --depth 1 ${shellQuote(url.trim())} ${shellQuote(targetPath)}`;
    const result = await connector.runShell(command);
    if (result.code !== 0) {
      return { error: result.stderr.trim() || result.stdout.trim() || `git clone exited with code ${result.code}` };
    }
    return { folder: { name: slug, path: targetPath, remoteUrl: url.trim(), size: null } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteWorkspaceFolder(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!SLUG_RE.test(name)) {
    return { ok: false, error: "Invalid folder name." };
  }
  const connector = getHermesConnector();
  const targetPath = `${WORKSPACES_DIR}/${name}`;
  try {
    const result = await connector.runShell(`rm -rf ${shellQuote(targetPath)}`);
    if (result.code !== 0) {
      return { ok: false, error: result.stderr.trim() || `exited with code ${result.code}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
