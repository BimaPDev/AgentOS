import "server-only";
import { getHermesConnector } from "@/lib/connectors";
import { shellQuote } from "@/lib/connectors/hermes-connector";

/** Hermes SQLite session store — shared with the Hermes CLI / dashboard. */
const STATE_DB = process.env.HERMES_STATE_DB ?? "/home/hermes/.hermes/state.db";

export interface HermesChatSession {
  id: string;
  title: string | null;
  source: string;
  model: string | null;
  messageCount: number;
  startedAt: number | null;
  endedAt: number | null;
  cwd: string | null;
  preview: string | null;
}

export interface HermesChatMessage {
  id: number;
  role: string;
  content: string;
  toolName: string | null;
  timestamp: number;
}

export interface HermesChatSessionsResult {
  sessions: HermesChatSession[];
  error?: string;
}

export interface HermesChatSessionDetail {
  session: HermesChatSession | null;
  messages: HermesChatMessage[];
  error?: string;
}

/**
 * List Hermes chat sessions from its SQLite store (same DB the CLI uses).
 * Pipeline one-shots tagged `--source tool` are hidden by default so Chat
 * only shows real conversations.
 */
export async function listHermesChatSessions(options?: {
  limit?: number;
  includeTool?: boolean;
}): Promise<HermesChatSessionsResult> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const includeTool = options?.includeTool ?? false;
  const connector = getHermesConnector();

  const py = `
import json, sqlite3, sys
db = sqlite3.connect(${JSON.stringify(STATE_DB)})
db.row_factory = sqlite3.Row
include_tool = ${includeTool ? "True" : "False"}
limit = ${limit}
where = "" if include_tool else "WHERE COALESCE(source, '') != 'tool' AND COALESCE(archived, 0) = 0"
sql = f"""
SELECT s.id, s.title, s.source, s.model, s.message_count, s.started_at, s.ended_at, s.cwd,
  (
    SELECT m.content FROM messages m
    WHERE m.session_id = s.id AND m.active = 1 AND m.role = 'user'
    ORDER BY m.timestamp ASC, m.id ASC LIMIT 1
  ) AS preview
FROM sessions s
{where}
ORDER BY COALESCE(s.ended_at, s.started_at) DESC
LIMIT ?
"""
rows = []
for r in db.execute(sql, (limit,)):
    preview = r["preview"]
    if isinstance(preview, str) and len(preview) > 120:
        preview = preview[:117] + "..."
    rows.append({
        "id": r["id"],
        "title": r["title"],
        "source": r["source"],
        "model": r["model"],
        "messageCount": r["message_count"] or 0,
        "startedAt": r["started_at"],
        "endedAt": r["ended_at"],
        "cwd": r["cwd"],
        "preview": preview,
    })
print(json.dumps({"sessions": rows}))
`.trim();

  try {
    const result = await connector.runShell(`python3 -c ${shellQuote(py)}`);
    if (result.code !== 0) {
      return {
        sessions: [],
        error: result.stderr.trim() || result.stdout.trim() || `exited with code ${result.code}`,
      };
    }
    const parsed = JSON.parse(result.stdout.trim()) as { sessions: HermesChatSession[] };
    return { sessions: parsed.sessions ?? [] };
  } catch (err) {
    return { sessions: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Load one Hermes session + its active messages from the same SQLite store. */
export async function getHermesChatSession(sessionId: string): Promise<HermesChatSessionDetail> {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
    return { session: null, messages: [], error: "Invalid session id." };
  }
  const connector = getHermesConnector();

  const py = `
import json, sqlite3
db = sqlite3.connect(${JSON.stringify(STATE_DB)})
db.row_factory = sqlite3.Row
sid = ${JSON.stringify(sessionId)}
s = db.execute(
  "SELECT id, title, source, model, message_count, started_at, ended_at, cwd FROM sessions WHERE id = ?",
  (sid,),
).fetchone()
if not s:
    print(json.dumps({"session": None, "messages": []}))
    raise SystemExit(0)
session = {
    "id": s["id"],
    "title": s["title"],
    "source": s["source"],
    "model": s["model"],
    "messageCount": s["message_count"] or 0,
    "startedAt": s["started_at"],
    "endedAt": s["ended_at"],
    "cwd": s["cwd"],
    "preview": None,
}
messages = []
for m in db.execute(
  """SELECT id, role, content, tool_name, timestamp FROM messages
     WHERE session_id = ? AND active = 1
     ORDER BY timestamp ASC, id ASC""",
  (sid,),
):
    content = m["content"] or ""
    if content and (content.lstrip().startswith("[") or content.lstrip().startswith("{")):
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                parts = []
                for p in parsed:
                    if isinstance(p, dict) and p.get("type") == "text":
                        parts.append(str(p.get("text") or ""))
                    elif isinstance(p, str):
                        parts.append(p)
                if parts:
                    content = "\\n".join(parts)
            elif isinstance(parsed, dict) and "text" in parsed:
                content = str(parsed["text"])
        except Exception:
            pass
    messages.append({
        "id": m["id"],
        "role": m["role"],
        "content": content,
        "toolName": m["tool_name"],
        "timestamp": m["timestamp"],
    })
print(json.dumps({"session": session, "messages": messages}))
`.trim();

  try {
    const result = await connector.runShell(`python3 -c ${shellQuote(py)}`);
    if (result.code !== 0) {
      return {
        session: null,
        messages: [],
        error: result.stderr.trim() || result.stdout.trim() || `exited with code ${result.code}`,
      };
    }
    return JSON.parse(result.stdout.trim()) as HermesChatSessionDetail;
  } catch (err) {
    return { session: null, messages: [], error: err instanceof Error ? err.message : String(err) };
  }
}
