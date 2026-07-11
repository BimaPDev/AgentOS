import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import { shellQuote } from "@/lib/connectors/hermes-connector";
import { parseRichTable, richRowsToObjects } from "@/lib/utils/rich-table";

/** Strip Rich/ANSI styling so CLI dumps render cleanly in AgentOS. */
export function stripAnsi(text: string): string {
  return text
    .replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\u001b\][^\u0007]*\u0007/g, "")
    .replace(/\r/g, "");
}

async function runHermes(args: string[]): Promise<{ ok: boolean; text: string; code: number }> {
  const connector = getHermesConnector();
  const result = await connector.runCommand(args);
  const text = stripAnsi((result.stdout || result.stderr || "").trim());
  return { ok: result.code === 0, text, code: result.code };
}

export type HermesSurfaceId =
  | "logs"
  | "cron"
  | "plugins"
  | "channels"
  | "webhooks"
  | "pairing"
  | "profiles"
  | "hermes-config"
  | "keys"
  | "hermes-system"
  | "docs";

export interface HermesSurfaceMeta {
  id: HermesSurfaceId;
  title: string;
  subtitle: string;
  href: string;
}

export const HERMES_SURFACES: HermesSurfaceMeta[] = [
  { id: "logs", title: "Logs", subtitle: "Live Hermes agent / gateway / error logs.", href: "/agent-logs" },
  { id: "cron", title: "Cron", subtitle: "Scheduled jobs and scheduler status from Hermes.", href: "/cron" },
  { id: "plugins", title: "Plugins", subtitle: "Bundled and installed Hermes plugins.", href: "/plugins" },
  {
    id: "channels",
    title: "Channels",
    subtitle: "Messaging platforms and gateway status from Hermes.",
    href: "/channels",
  },
  { id: "webhooks", title: "Webhooks", subtitle: "Dynamic webhook subscriptions on Hermes.", href: "/webhooks" },
  { id: "pairing", title: "Pairing", subtitle: "DM pairing codes and pending authorizations.", href: "/pairing" },
  { id: "profiles", title: "Profiles", subtitle: "Isolated Hermes profile instances.", href: "/profiles" },
  {
    id: "hermes-config",
    title: "Config",
    subtitle: "Live Hermes configuration (paths, model, display, terminal).",
    href: "/hermes-config",
  },
  { id: "keys", title: "Keys", subtitle: "Configured secret names and provider key status (values redacted).", href: "/keys" },
  {
    id: "hermes-system",
    title: "System",
    subtitle: "Hermes doctor checks and component status.",
    href: "/hermes-system",
  },
  {
    id: "docs",
    title: "Docs",
    subtitle: "Hermes local docs and upstream references.",
    href: "/docs",
  },
];

export function getSurfaceMeta(id: string): HermesSurfaceMeta | undefined {
  return HERMES_SURFACES.find((s) => s.id === id);
}

export interface HermesSurfaceResult {
  id: HermesSurfaceId;
  title: string;
  subtitle: string;
  kind: "text" | "table" | "logs" | "keys" | "docs";
  text?: string;
  rows?: Record<string, string>[];
  logName?: string;
  logFiles?: { name: string; detail: string }[];
  keys?: { name: string; present: boolean; detail?: string }[];
  docs?: { title: string; body?: string; href?: string }[];
  error?: string;
}

function parseStatusSection(statusText: string, heading: string): { name: string; detail: string }[] {
  const lines = statusText.split("\n");
  const start = lines.findIndex((l) => l.includes(`◆ ${heading}`) || l.trim() === `◆ ${heading}`);
  if (start < 0) return [];
  const items: { name: string; detail: string }[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trimStart().startsWith("◆")) break;
    const m = line.match(/^\s+(.+?)\s{2,}(.+)\s*$/);
    if (m) items.push({ name: m[1]!.trim(), detail: m[2]!.trim() });
  }
  return items;
}

export async function getHermesLogs(opts?: {
  logName?: string;
  lines?: number;
}): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("logs")!;
  const logName = opts?.logName || "agent";
  const lines = Math.min(Math.max(opts?.lines ?? 100, 10), 500);
  try {
    const [list, body] = await Promise.all([
      runHermes(["logs", "list"]),
      runHermes(["logs", logName, "-n", String(lines)]),
    ]);
    const logFiles = (list.text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^\S+\.log\b/.test(l) || /^[a-z0-9_-]+\.log\b/i.test(l))
      .map((l) => {
        const parts = l.split(/\s{2,}/);
        return { name: (parts[0] || l).replace(/\.log$/, ""), detail: l };
      });
    // Also accept bare names from list header lines like "agent.log"
    const fromLoose = (list.text || "")
      .split("\n")
      .map((l) => {
        const m = l.match(/\b([a-z0-9_-]+)\.log\b/i);
        return m ? { name: m[1]!, detail: l.trim() } : null;
      })
      .filter(Boolean) as { name: string; detail: string }[];
    const merged = [...logFiles, ...fromLoose].filter(
      (f, i, arr) => arr.findIndex((x) => x.name === f.name) === i,
    );
    return {
      id: "logs",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "logs",
      logName,
      logFiles: merged.length > 0 ? merged : [{ name: "agent", detail: "agent.log" }, { name: "errors", detail: "errors.log" }, { name: "gateway", detail: "gateway.log" }],
      text: body.text || (body.ok ? "" : `hermes logs exited with code ${body.code}`),
      error: body.ok ? undefined : body.text || `exited with code ${body.code}`,
    };
  } catch (err) {
    return {
      id: "logs",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "logs",
      logName,
      logFiles: [],
      text: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function getHermesCron(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("cron")!;
  try {
    const [list, status] = await Promise.all([runHermes(["cron", "list"]), runHermes(["cron", "status"])]);
    return {
      id: "cron",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: [status.text, "", "── Jobs ──", list.text].filter(Boolean).join("\n"),
      error: list.ok || status.ok ? undefined : list.text || status.text,
    };
  } catch (err) {
    return { id: "cron", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesPlugins(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("plugins")!;
  try {
    const jsonAttempt = await runHermes(["plugins", "list", "--json"]);
    if (jsonAttempt.ok) {
      const start = jsonAttempt.text.indexOf("[");
      const end = jsonAttempt.text.lastIndexOf("]");
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(jsonAttempt.text.slice(start, end + 1)) as Array<{
          name?: string;
          status?: string;
          version?: string;
          description?: string;
          source?: string;
        }>;
        return {
          id: "plugins",
          title: meta.title,
          subtitle: meta.subtitle,
          kind: "table",
          rows: parsed.map((p) => ({
            Name: p.name ?? "",
            Status: p.status ?? "",
            Version: p.version ?? "",
            Source: p.source ?? "",
            Description: p.description ?? "",
          })),
        };
      }
    }
    const table = await runHermes(["plugins", "list"]);
    const { headers, rows } = parseRichTable(table.text);
    return {
      id: "plugins",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "table",
      rows: headers.length ? richRowsToObjects(headers, rows) : [],
      text: headers.length ? undefined : table.text,
      error: table.ok ? undefined : table.text,
    };
  } catch (err) {
    return { id: "plugins", title: meta.title, subtitle: meta.subtitle, kind: "table", rows: [], error: String(err) };
  }
}

export async function getHermesChannels(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("channels")!;
  try {
    const status = await runHermes(["status"]);
    const platforms = parseStatusSection(status.text, "Messaging Platforms");
    const gateway = parseStatusSection(status.text, "Gateway Service");
    const rows = [
      ...gateway.map((g) => ({ Kind: "Gateway", Name: g.name, Detail: g.detail })),
      ...platforms.map((p) => ({ Kind: "Platform", Name: p.name, Detail: p.detail })),
    ];
    return {
      id: "channels",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: rows.length ? "table" : "text",
      rows,
      text: rows.length ? undefined : status.text,
      error: status.ok ? undefined : status.text,
    };
  } catch (err) {
    return { id: "channels", title: meta.title, subtitle: meta.subtitle, kind: "table", rows: [], error: String(err) };
  }
}

export async function getHermesWebhooks(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("webhooks")!;
  try {
    const result = await runHermes(["webhook", "list"]);
    const { headers, rows } = parseRichTable(result.text);
    if (headers.length) {
      return {
        id: "webhooks",
        title: meta.title,
        subtitle: meta.subtitle,
        kind: "table",
        rows: richRowsToObjects(headers, rows),
      };
    }
    return {
      id: "webhooks",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: result.text || "No webhook subscriptions.",
    };
  } catch (err) {
    return { id: "webhooks", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesPairing(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("pairing")!;
  try {
    const result = await runHermes(["pairing", "list"]);
    return {
      id: "pairing",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: result.text || "No pairing data.",
    };
  } catch (err) {
    return { id: "pairing", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesProfiles(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("profiles")!;
  try {
    const result = await runHermes(["profile", "list"]);
    const { headers, rows } = parseRichTable(result.text);
    if (headers.length) {
      return {
        id: "profiles",
        title: meta.title,
        subtitle: meta.subtitle,
        kind: "table",
        rows: richRowsToObjects(headers, rows),
      };
    }
    // profile list uses a simpler unicode table — fall back to text
    return {
      id: "profiles",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: result.text,
    };
  } catch (err) {
    return { id: "profiles", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesConfigSurface(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("hermes-config")!;
  try {
    const result = await runHermes(["config", "show"]);
    return {
      id: "hermes-config",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: result.text,
      error: result.ok ? undefined : result.text,
    };
  } catch (err) {
    return { id: "hermes-config", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesKeys(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("keys")!;
  try {
    const [status, envNames] = await Promise.all([
      runHermes(["status"]),
      (async () => {
        const connector = getHermesConnector();
        const r = await connector.runShell(
          `grep -E '^[A-Za-z_][A-Za-z0-9_]*=' ${shellQuote("/home/hermes/.hermes/.env")} 2>/dev/null | cut -d= -f1 || true`,
        );
        return r.stdout
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      })(),
    ]);
    const apiKeys = parseStatusSection(status.text, "API Keys");
    const authProviders = parseStatusSection(status.text, "Auth Providers");
    const keys = [
      ...apiKeys.map((k) => ({
        name: k.name,
        present: /✓/.test(k.detail) || /\bset\b/i.test(k.detail) || (!/✗/.test(k.detail) && !/not set/i.test(k.detail)),
        detail: k.detail.replace(/✓|✗/g, "").trim(),
      })),
      ...authProviders.map((k) => ({
        name: `auth:${k.name}`,
        present: /✓/.test(k.detail) || /logged in/i.test(k.detail),
        detail: k.detail.replace(/✓|✗/g, "").trim(),
      })),
      ...envNames.map((name) => ({
        name: `.env:${name}`,
        present: true,
        detail: "present in ~/.hermes/.env (value hidden)",
      })),
    ];
    return {
      id: "keys",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "keys",
      keys,
      error: status.ok ? undefined : status.text,
    };
  } catch (err) {
    return { id: "keys", title: meta.title, subtitle: meta.subtitle, kind: "keys", keys: [], error: String(err) };
  }
}

export async function getHermesSystemSurface(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("hermes-system")!;
  try {
    const [doctor, status] = await Promise.all([runHermes(["doctor"]), runHermes(["status"])]);
    return {
      id: "hermes-system",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "text",
      text: ["── Doctor ──", doctor.text, "", "── Status ──", status.text].join("\n"),
      error: doctor.ok || status.ok ? undefined : doctor.text || status.text,
    };
  } catch (err) {
    return { id: "hermes-system", title: meta.title, subtitle: meta.subtitle, kind: "text", error: String(err) };
  }
}

export async function getHermesDocs(): Promise<HermesSurfaceResult> {
  const meta = getSurfaceMeta("docs")!;
  try {
    const connector = getHermesConnector();
    const soul = await connector.runShell(
      `head -c 8000 ${shellQuote("/home/hermes/.hermes/SOUL.md")} 2>/dev/null || true`,
    );
    const readme = await connector.runShell(
      `head -c 4000 ${shellQuote("/home/hermes/.hermes/hermes-agent/README.md")} 2>/dev/null || true`,
    );
    return {
      id: "docs",
      title: meta.title,
      subtitle: meta.subtitle,
      kind: "docs",
      docs: [
        {
          title: "Hermes Agent (upstream)",
          href: "https://github.com/NousResearch/hermes-agent",
          body: "Official Hermes Agent repository and documentation.",
        },
        {
          title: "SOUL.md (local)",
          body: stripAnsi(soul.stdout.trim()) || "(empty)",
        },
        {
          title: "README.md (local install)",
          body: stripAnsi(readme.stdout.trim()) || "(not found)",
        },
      ],
    };
  } catch (err) {
    return { id: "docs", title: meta.title, subtitle: meta.subtitle, kind: "docs", docs: [], error: String(err) };
  }
}

export async function getHermesSurface(
  id: HermesSurfaceId,
  opts?: { logName?: string; lines?: number },
): Promise<HermesSurfaceResult> {
  switch (id) {
    case "logs":
      return getHermesLogs(opts);
    case "cron":
      return getHermesCron();
    case "plugins":
      return getHermesPlugins();
    case "channels":
      return getHermesChannels();
    case "webhooks":
      return getHermesWebhooks();
    case "pairing":
      return getHermesPairing();
    case "profiles":
      return getHermesProfiles();
    case "hermes-config":
      return getHermesConfigSurface();
    case "keys":
      return getHermesKeys();
    case "hermes-system":
      return getHermesSystemSurface();
    case "docs":
      return getHermesDocs();
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
