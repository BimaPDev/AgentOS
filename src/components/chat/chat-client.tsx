"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Square,
} from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type {
  HermesChatMessage,
  HermesChatSession,
  HermesChatSessionDetail,
  HermesChatSessionsResult,
} from "@/lib/hermes-chat";
import type { StreamChunk } from "@/lib/connectors/types";

interface ChatClientProps {
  initialSessions: HermesChatSessionsResult;
}

interface Router9Model {
  id: string;
  ownedBy: string;
}

interface UiMessage {
  key: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  pending?: boolean;
}

function formatWhen(ts: number | null): string {
  if (!ts) return "";
  // Hermes stores unix seconds (float); tolerate ms.
  const ms = ts > 1e12 ? ts : ts * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sessionLabel(session: HermesChatSession): string {
  if (session.title?.trim()) return session.title.trim();
  if (session.preview?.trim()) return session.preview.trim();
  return session.id;
}

function toUiMessages(messages: HermesChatMessage[]): UiMessage[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "system" || m.role === "tool")
    .map((m) => ({
      key: String(m.id),
      role: m.role as UiMessage["role"],
      content: m.content || (m.toolName ? `[tool: ${m.toolName}]` : ""),
    }))
    .filter((m) => m.content.trim().length > 0);
}

async function* readNdjson(response: Response): AsyncGenerator<StreamChunk> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.trim()) yield JSON.parse(line) as StreamChunk;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StreamChunk;
}

export function ChatClient({ initialSessions }: ChatClientProps) {
  const [sessions, setSessions] = useState(initialSessions.sessions);
  const [sessionsError, setSessionsError] = useState(initialSessions.error ?? null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<Router9Model[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ models: Router9Model[] }>("/api/router9/models")
      .then((res) => {
        if (cancelled) return;
        setModels(res.models);
        setModel((current) => current || res.models[0]?.id || "");
      })
      .catch(() => !cancelled && setModels([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const result = await apiFetch<HermesChatSessionsResult>("/api/hermes/sessions");
      setSessions(result.sessions);
      setSessionsError(result.error ?? null);
    } catch (err) {
      setSessionsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const openSession = useCallback(async (id: string) => {
    setActiveId(id);
    setLoadingThread(true);
    setThreadError(null);
    try {
      const detail = await apiFetch<HermesChatSessionDetail>(`/api/hermes/sessions/${id}`);
      setMessages(toUiMessages(detail.messages));
      if (detail.session?.model) setModel(detail.session.model);
    } catch (err) {
      setMessages([]);
      setThreadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const startNewChat = () => {
    abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setThreadError(null);
    setDraft("");
    textareaRef.current?.focus();
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
  };

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || sending) return;

    const userKey = `local-user-${Date.now()}`;
    const assistantKey = `local-assistant-${Date.now()}`;
    setDraft("");
    setSending(true);
    setThreadError(null);
    setMessages((current) => [
      ...current,
      { key: userKey, role: "user", content: prompt },
      { key: assistantKey, role: "assistant", content: "", pending: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    let resolvedSessionId = activeId;

    try {
      const response = await fetch("/api/hermes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          sessionId: activeId,
          model: model || null,
        }),
        signal: controller.signal,
      });

      if (!response.ok && !response.body) {
        throw new Error(`Chat request failed (HTTP ${response.status})`);
      }

      let gotError: string | null = null;
      for await (const chunk of readNdjson(response)) {
        if (chunk.type === "meta" && chunk.sessionId) {
          resolvedSessionId = chunk.sessionId;
          setActiveId(chunk.sessionId);
        } else if (chunk.type === "token") {
          setMessages((current) =>
            current.map((m) =>
              m.key === assistantKey ? { ...m, content: m.content + chunk.content, pending: true } : m,
            ),
          );
        } else if (chunk.type === "error") {
          gotError = chunk.error;
        } else if (chunk.type === "done") {
          setMessages((current) =>
            current.map((m) => (m.key === assistantKey ? { ...m, pending: false } : m)),
          );
        }
      }

      if (gotError) {
        setThreadError(gotError);
        setMessages((current) =>
          current.map((m) =>
            m.key === assistantKey
              ? { ...m, content: m.content || `Error: ${gotError}`, pending: false }
              : m,
          ),
        );
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setMessages((current) =>
          current.map((m) =>
            m.key === assistantKey
              ? { ...m, content: m.content || "(stopped)", pending: false }
              : m,
          ),
        );
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setThreadError(message);
        setMessages((current) =>
          current.map((m) =>
            m.key === assistantKey ? { ...m, content: m.content || `Error: ${message}`, pending: false } : m,
          ),
        );
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      await refreshSessions();
      if (resolvedSessionId) await openSession(resolvedSessionId);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Session list — history from Hermes state.db */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2.5 text-xs font-medium text-white hover:bg-indigo-500"
          >
            <Plus size={14} />
            New chat
          </button>
          <button
            type="button"
            onClick={() => void refreshSessions()}
            disabled={loadingSessions}
            aria-label="Refresh sessions"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {loadingSessions ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {sessionsError && (
            <p className="mb-2 rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {sessionsError}
            </p>
          )}
          {sessions.length === 0 && !sessionsError && (
            <div className="px-2 py-8 text-center text-xs text-zinc-400">
              No Hermes sessions yet. Start a new chat.
            </div>
          )}
          <ul className="space-y-0.5">
            {sessions.map((session) => {
              const active = activeId === session.id;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => void openSession(session.id)}
                    className={`w-full rounded-md px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
                    }`}
                  >
                    <div className="truncate text-sm font-medium">{sessionLabel(session)}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span>{formatWhen(session.endedAt ?? session.startedAt)}</span>
                      <span>·</span>
                      <span>{session.source}</span>
                      <span>·</span>
                      <span>
                        {session.messageCount} msg{session.messageCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Thread */}
      <section className="flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {activeId
                ? sessionLabel(sessions.find((s) => s.id === activeId) ?? {
                    id: activeId,
                    title: null,
                    source: "agentos",
                    model: null,
                    messageCount: 0,
                    startedAt: null,
                    endedAt: null,
                    cwd: null,
                    preview: null,
                  })
                : "New chat"}
            </h1>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {activeId
                ? `Hermes session ${activeId}`
                : "Talk directly to Hermes. History is loaded from Hermes itself."}
            </p>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={sending || models === null}
            className="max-w-[18rem] rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
            title="Model for this chat (passed to Hermes as -m)"
            aria-label="Model"
          >
            <option value="">Hermes default</option>
            {(models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingThread && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 size={14} className="animate-spin" /> Loading session from Hermes…
            </div>
          )}

          {!loadingThread && messages.length === 0 && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <MessageSquare size={22} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Chat with Hermes
              </h2>
              <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
                Messages and sessions live on the Hermes box. Pick a past session on the left or start a new one.
              </p>
            </div>
          )}

          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isTool = message.role === "tool";
              return (
                <div
                  key={message.key}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-indigo-600 text-white"
                        : isTool
                          ? "border border-dashed border-zinc-300 bg-zinc-100 font-mono text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                          : "border border-zinc-200 bg-white text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    {message.content}
                    {message.pending && (
                      <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle opacity-60" />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {threadError && (
            <p className="mx-auto mt-3 max-w-3xl rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
              {threadError}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={textareaRef}
              rows={2}
              value={draft}
              disabled={sending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message Hermes… (Enter to send, Shift+Enter for newline)"
              className="max-h-40 min-h-[2.75rem] flex-1 resize-y rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            />
            {sending ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-zinc-300 px-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Square size={14} />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send size={14} />
                Send
              </button>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
