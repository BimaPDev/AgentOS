import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import { shellQuote } from "@/lib/connectors/hermes-connector";

const HOME = process.env.HERMES_HOME_DIR ?? "/home/hermes";
const WORKSPACES_DIR = process.env.HERMES_WORKSPACES_DIR ?? `${HOME}/workspaces`;
const HERMES_DIR = process.env.HERMES_CONFIG_DIR ?? `${HOME}/.hermes`;
const MAX_PREVIEW_BYTES = 512 * 1024;

export interface HermesFileRoot {
  id: string;
  label: string;
  path: string;
}

export interface HermesFileEntry {
  name: string;
  path: string;
  type: "dir" | "file" | "other";
  size: number | null;
  mtime: number | null;
}

export interface HermesDirectoryListing {
  path: string;
  parent: string | null;
  entries: HermesFileEntry[];
  roots: HermesFileRoot[];
  error?: string;
}

export interface HermesFileContent {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
  binary: boolean;
  error?: string;
}

export function getHermesFileRoots(): HermesFileRoot[] {
  return [
    { id: "home", label: "Home", path: HOME },
    { id: "workspaces", label: "Workspaces", path: WORKSPACES_DIR },
    { id: "hermes", label: "Hermes", path: HERMES_DIR },
  ];
}

/** Normalize and ensure `path` stays under an allowlisted root. */
export function resolveAllowedPath(rawPath: string | null | undefined): string {
  const roots = getHermesFileRoots().map((r) => r.path.replace(/\/+$/, ""));
  const fallback = roots[0]!;
  const input = (rawPath?.trim() || fallback).replace(/\\/g, "/");
  const collapsed = input.replace(/\/+/g, "/");
  const parts = collapsed.split("/").filter((p) => p && p !== ".");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      if (resolved.length === 0) throw new Error("Path escapes allowed roots.");
      resolved.pop();
      continue;
    }
    resolved.push(part);
  }
  const abs = `/${resolved.join("/")}`;
  const allowed = roots.some((root) => abs === root || abs.startsWith(`${root}/`));
  if (!allowed) {
    throw new Error("Path is outside the allowed Hermes directories.");
  }
  return abs;
}

function parentPath(path: string): string | null {
  const roots = getHermesFileRoots().map((r) => r.path.replace(/\/+$/, ""));
  if (roots.includes(path)) return null;
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return null;
  return path.slice(0, idx) || "/";
}

export async function listHermesDirectory(rawPath?: string | null): Promise<HermesDirectoryListing> {
  const roots = getHermesFileRoots();
  let path: string;
  try {
    path = resolveAllowedPath(rawPath);
  } catch (err) {
    return {
      path: roots[0]!.path,
      parent: null,
      entries: [],
      roots,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const connector = getHermesConnector();
  const py = `
import json, os, sys
path = ${JSON.stringify(path)}
try:
    entries = []
    with os.scandir(path) as it:
        for e in it:
            try:
                st = e.stat(follow_symlinks=False)
                typ = "dir" if e.is_dir(follow_symlinks=False) else ("file" if e.is_file(follow_symlinks=False) else "other")
                entries.append({
                    "name": e.name,
                    "path": os.path.join(path, e.name),
                    "type": typ,
                    "size": None if typ == "dir" else int(st.st_size),
                    "mtime": int(st.st_mtime),
                })
            except OSError:
                entries.append({"name": e.name, "path": os.path.join(path, e.name), "type": "other", "size": None, "mtime": None})
    entries.sort(key=lambda x: (0 if x["type"] == "dir" else 1, x["name"].lower()))
    print(json.dumps({"path": path, "entries": entries}))
except Exception as exc:
    print(json.dumps({"path": path, "entries": [], "error": str(exc)}))
    sys.exit(0)
`.trim();

  try {
    const result = await connector.runShell(
      `/home/hermes/.hermes/hermes-agent/venv/bin/python3 -c ${shellQuote(py)}`,
    );
    if (result.code !== 0) {
      return {
        path,
        parent: parentPath(path),
        entries: [],
        roots,
        error: result.stderr.trim() || `exited with code ${result.code}`,
      };
    }
    const parsed = JSON.parse(result.stdout.trim()) as {
      path?: string;
      entries?: HermesFileEntry[];
      error?: string;
    };
    return {
      path,
      parent: parentPath(path),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      roots,
      error: parsed.error,
    };
  } catch (err) {
    return {
      path,
      parent: parentPath(path),
      entries: [],
      roots,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function readHermesTextFile(rawPath: string): Promise<HermesFileContent> {
  let path: string;
  try {
    path = resolveAllowedPath(rawPath);
  } catch (err) {
    return {
      path: rawPath,
      content: "",
      truncated: false,
      size: 0,
      binary: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const connector = getHermesConnector();
  const py = `
import json, os, sys
path = ${JSON.stringify(path)}
limit = ${MAX_PREVIEW_BYTES}
try:
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        raw = f.read(limit + 1)
    truncated = len(raw) > limit
    raw = raw[:limit]
    binary = b"\\x00" in raw
    if binary:
        content = ""
    else:
        content = raw.decode("utf-8", errors="replace")
    print(json.dumps({"path": path, "content": content, "truncated": truncated, "size": size, "binary": binary}))
except Exception as exc:
    print(json.dumps({"path": path, "content": "", "truncated": False, "size": 0, "binary": False, "error": str(exc)}))
    sys.exit(0)
`.trim();

  try {
    const result = await connector.runShell(
      `/home/hermes/.hermes/hermes-agent/venv/bin/python3 -c ${shellQuote(py)}`,
    );
    if (result.code !== 0) {
      return {
        path,
        content: "",
        truncated: false,
        size: 0,
        binary: false,
        error: result.stderr.trim() || `exited with code ${result.code}`,
      };
    }
    const parsed = JSON.parse(result.stdout.trim()) as HermesFileContent;
    return {
      path,
      content: typeof parsed.content === "string" ? parsed.content : "",
      truncated: Boolean(parsed.truncated),
      size: typeof parsed.size === "number" ? parsed.size : 0,
      binary: Boolean(parsed.binary),
      error: parsed.error,
    };
  } catch (err) {
    return {
      path,
      content: "",
      truncated: false,
      size: 0,
      binary: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
