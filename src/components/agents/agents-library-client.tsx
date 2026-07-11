"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Clock3,
  Download,
  ExternalLink,
  FolderGit2,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
  Sparkles,
  Upload,
  Workflow,
  Zap,
} from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import { downloadJson, parseAgent, serializeAgent } from "@/lib/config-io";
import { runGraph, type RunEngineNode } from "@/lib/execution/run-engine";
import { useRunStore } from "@/lib/stores/run-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { RunConsolePanel } from "@/components/run/run-console-panel";
import { CreateAgentModal, type CreateAgentValues } from "@/components/agents/create-agent-modal";
import {
  SmartAgentMakerModal,
  type SmartCreateValues,
} from "@/components/agents/smart-agent-maker-modal";
import type {
  Agent,
  ConditionStepConfig,
  GraphEdge,
  GraphNode,
  OutputStepConfig,
  PromptStepConfig,
  ToolCallStepConfig,
} from "@/lib/types/domain";
import { ROOT_GRAPH_ID } from "@/lib/types/domain";

export interface AgentPreview {
  agent: Agent;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface AgentsLibraryClientProps {
  initialPreviews: AgentPreview[];
}

function seedPrompt(node: GraphNode): string {
  switch (node.type) {
    case "prompt":
      return (node.config as PromptStepConfig).prompt || "(no prompt configured)";
    case "tool-call": {
      const config = node.config as ToolCallStepConfig;
      return config.toolName ? `Call tool ${config.toolName}` : "(no tool configured)";
    }
    case "condition":
      return (node.config as ConditionStepConfig).expression || "(no condition configured)";
    case "output":
      return `Format output as ${(node.config as OutputStepConfig).format ?? "text"}`;
    default:
      return "";
  }
}

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "agent";
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  danger = false,
  suffix,
}: {
  icon: typeof Play;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        disabled
          ? "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
          : danger
            ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon size={15} />
      <span className="flex-1">{children}</span>
      {suffix}
    </button>
  );
}

export function AgentsLibraryClient({ initialPreviews }: AgentsLibraryClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState(initialPreviews);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [showConsole, setShowConsole] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [consoleLabels, setConsoleLabels] = useState<Record<string, string>>({});
  const pushToast = useToastStore((state) => state.push);
  const runStatus = useRunStore((state) => state.status);
  const startRun = useRunStore((state) => state.startRun);
  const setNodeStatus = useRunStore((state) => state.setNodeStatus);
  const appendNodeToken = useRunStore((state) => state.appendNodeToken);
  const addLog = useRunStore((state) => state.addLog);
  const finishRun = useRunStore((state) => state.finishRun);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  const createRootNode = useCallback(async (agent: Agent, index: number) => {
    await apiFetch<GraphNode>(`/api/graphs/${ROOT_GRAPH_ID}/nodes`, {
      method: "POST",
      body: JSON.stringify({
        type: "agent",
        refAgentId: agent.id,
        label: agent.name,
        positionX: 80 + (index % 4) * 300,
        positionY: 100 + Math.floor(index / 4) * 200,
      }),
    });
  }, []);

  const handleCreate = useCallback(
    async (values: CreateAgentValues) => {
      const agent = await apiFetch<Agent>("/api/agents", {
        method: "POST",
        body: JSON.stringify(values),
      });
      await createRootNode(agent, previews.length);
      setPreviews((current) => [...current, { agent, nodes: [], edges: [] }]);
      setShowCreateModal(false);
      router.push(`/agents/${agent.id}/pipeline`);
    },
    [createRootNode, previews.length, router],
  );

  const handleSmartCreate = useCallback(
    async (values: SmartCreateValues) => {
      const result = await apiFetch<AgentPreview>("/api/agents/smart-create", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setPreviews((current) => [...current, result]);
      setShowSmartModal(false);
      pushToast(`${result.agent.name} created by Hermes.`, "info");
      router.push(`/agents/${result.agent.id}/pipeline`);
    },
    [pushToast, router],
  );

  const handleImport = useCallback(
    async (file: File) => {
      setIsImporting(true);
      let createdAgent: Agent | null = null;
      try {
        const fallbackName = file.name.replace(/\.json$/i, "").replace(/[-_]+/g, " ").trim() || "Imported agent";
        const imported = parseAgent(await file.text(), fallbackName);
        createdAgent = await apiFetch<Agent>("/api/agents", {
          method: "POST",
          body: JSON.stringify(imported.agent),
        });
        await createRootNode(createdAgent, previews.length);

        const idMap = new Map<string, string>();
        const nodes: GraphNode[] = [];
        for (const node of imported.pipeline.nodes) {
          const created = await apiFetch<GraphNode>(`/api/graphs/${createdAgent.id}/nodes`, {
            method: "POST",
            body: JSON.stringify({
              type: node.type,
              label: node.label,
              positionX: node.position.x,
              positionY: node.position.y,
              config: node.config,
            }),
          });
          idMap.set(node.key, created.id);
          nodes.push(created);
        }

        const edges: GraphEdge[] = [];
        for (const edge of imported.pipeline.edges) {
          const sourceNodeId = idMap.get(edge.source);
          const targetNodeId = idMap.get(edge.target);
          if (!sourceNodeId || !targetNodeId) continue;
          edges.push(
            await apiFetch<GraphEdge>(`/api/graphs/${createdAgent.id}/edges`, {
              method: "POST",
              body: JSON.stringify({ sourceNodeId, targetNodeId }),
            }),
          );
        }

        setPreviews((current) => [...current, { agent: createdAgent as Agent, nodes, edges }]);
        pushToast(`${createdAgent.name} imported.`, "info");
      } catch (error) {
        if (createdAgent) {
          await apiFetch(`/api/agents/${createdAgent.id}`, { method: "DELETE" }).catch(() => {});
        }
        console.error("Failed to import agent", error);
        pushToast(error instanceof Error ? error.message : "Failed to import agent.");
      } finally {
        setIsImporting(false);
      }
    },
    [createRootNode, previews.length, pushToast],
  );

  const handleExport = useCallback((preview: AgentPreview) => {
    downloadJson(
      serializeAgent(preview.agent, preview.nodes, preview.edges),
      `agentos-${safeFilename(preview.agent.name)}.json`,
    );
    setOpenMenuId(null);
  }, []);

  const handleDelete = useCallback(
    async (preview: AgentPreview) => {
      setOpenMenuId(null);
      if (!window.confirm(`Delete "${preview.agent.name}" and its pipeline? This cannot be undone.`)) return;
      try {
        await apiFetch(`/api/agents/${preview.agent.id}`, { method: "DELETE" });
        setPreviews((current) => current.filter((item) => item.agent.id !== preview.agent.id));
        pushToast(`${preview.agent.name} deleted.`, "info");
      } catch (error) {
        console.error("Failed to delete agent", error);
        pushToast("Failed to delete agent.");
      }
    },
    [pushToast],
  );

  const handleRun = useCallback(
    async (preview: AgentPreview) => {
      setOpenMenuId(null);
      if (preview.nodes.length === 0) {
        pushToast("Add at least one pipeline step before running this agent.");
        return;
      }
      if (runStatus === "running") return;

      const labels = Object.fromEntries(preview.nodes.map((node) => [node.id, node.label ?? node.type]));
      setConsoleLabels(labels);
      setShowConsole(true);
      setRunningAgentId(preview.agent.id);
      startRun({
        runId: "pending",
        graphId: preview.agent.id,
        nodeIds: preview.nodes.map((node) => node.id),
      });

      const nodes: RunEngineNode[] = preview.nodes.map((node) => {
        const toolConfig = node.type === "tool-call" ? (node.config as ToolCallStepConfig) : null;
        return {
          id: node.id,
          connectorType: preview.agent.connectorType,
          workspaceFolder: preview.agent.workspaceFolder,
          nodeType: node.type,
          seedPrompt: seedPrompt(node),
          toolName: toolConfig?.toolName,
          toolArgs: toolConfig?.toolArgs,
        };
      });

      try {
        const result = await runGraph({
          graphId: preview.agent.id,
          nodes,
          edges: preview.edges.map((edge) => ({
            source: edge.sourceNodeId,
            target: edge.targetNodeId,
          })),
          callbacks: {
            onNodeStatus: setNodeStatus,
            onToken: appendNodeToken,
            onLog: addLog,
          },
        });
        finishRun(result.status);
      } catch (error) {
        addLog(error instanceof Error ? error.message : String(error), "error");
        finishRun("error");
      } finally {
        setRunningAgentId(null);
      }
    },
    [addLog, appendNodeToken, finishRun, pushToast, runStatus, setNodeStatus, startRun],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Your agents</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            {previews.length} {previews.length === 1 ? "agent" : "agents"} ready to configure and run
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Import JSON
          </button>
          <button
            type="button"
            onClick={() => setShowSmartModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          >
            <Sparkles size={16} />
            Smart Maker
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus size={16} />
            New agent
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImport(file);
          event.target.value = "";
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {previews.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <Bot size={24} />
            </span>
            <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">No agents yet</h2>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Create a new agent, describe one with Smart Maker, or import an AgentOS JSON file.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Import JSON
              </button>
              <button
                type="button"
                onClick={() => setShowSmartModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
              >
                <Sparkles size={15} />
                Smart Maker
              </button>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Create agent
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {previews.map((preview) => {
              const { agent, nodes } = preview;
              const isRunning = runningAgentId === agent.id;
              return (
                <article
                  key={agent.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Open ${agent.name} pipeline`}
                  onClick={() => router.push(`/agents/${agent.id}/pipeline`)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      router.push(`/agents/${agent.id}/pipeline`);
                    }
                  }}
                  className="group relative flex min-h-56 cursor-pointer flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus:ring-offset-zinc-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                      style={{ backgroundColor: agent.color || "#4f46e5" }}
                    >
                      <Bot size={20} />
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        aria-label={`Open actions for ${agent.name}`}
                        aria-expanded={openMenuId === agent.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) => (current === agent.id ? null : agent.id));
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                      >
                        <MoreHorizontal size={19} />
                      </button>
                      {openMenuId === agent.id && (
                        <div
                          onClick={(event) => event.stopPropagation()}
                          className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <MenuItem icon={Play} onClick={() => void handleRun(preview)} disabled={runStatus === "running"}>
                            Run now
                          </MenuItem>
                          <MenuItem icon={ExternalLink} onClick={() => router.push(`/agents/${agent.id}/pipeline`)}>
                            Open pipeline
                          </MenuItem>
                          <MenuItem icon={Download} onClick={() => handleExport(preview)}>
                            Export JSON
                          </MenuItem>
                          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                          <MenuItem
                            icon={Zap}
                            disabled
                            suffix={<span className="text-[10px] uppercase tracking-wide">Soon</span>}
                          >
                            Auto-run
                          </MenuItem>
                          <MenuItem
                            icon={Clock3}
                            disabled
                            suffix={<span className="text-[10px] uppercase tracking-wide">Soon</span>}
                          >
                            Schedule run
                          </MenuItem>
                          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
                          <MenuItem icon={Trash2} danger onClick={() => void handleDelete(preview)}>
                            Delete agent
                          </MenuItem>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 min-w-0">
                    <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">{agent.name}</h2>
                    <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {agent.role || "No role assigned"}
                    </p>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                      {agent.description || "No description yet. Open the pipeline to configure this agent."}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Workflow size={14} />
                        {nodes.length} {nodes.length === 1 ? "step" : "steps"}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800">
                        {agent.connectorType}
                      </span>
                      {agent.workspaceFolder && (
                        <span
                          className="inline-flex items-center gap-1 truncate rounded-full bg-zinc-100 px-2 py-0.5 font-medium dark:bg-zinc-800"
                          title={agent.workspaceFolder}
                        >
                          <FolderGit2 size={11} />
                          {agent.workspaceFolder.split("/").pop()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleRun(preview);
                      }}
                      disabled={runStatus === "running" || nodes.length === 0}
                      aria-label={`Run ${agent.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-indigo-950 dark:text-indigo-400 dark:hover:bg-indigo-900"
                    >
                      {isRunning ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="ml-0.5" />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showConsole && <RunConsolePanel nodeLabelById={consoleLabels} onClose={() => setShowConsole(false)} />}

      {showCreateModal && (
        <CreateAgentModal
          defaultName={`Agent ${previews.length + 1}`}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {showSmartModal && (
        <SmartAgentMakerModal onClose={() => setShowSmartModal(false)} onCreate={handleSmartCreate} />
      )}
    </div>
  );
}
