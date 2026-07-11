"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Connection, Edge, NodeTypes } from "@xyflow/react";
import { apiFetch } from "@/lib/utils/fetcher";
import { useCanvasStore, type CanvasNode, type StepNodeData } from "@/lib/stores/canvas-store";
import { useRunStore } from "@/lib/stores/run-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { GraphCycleError, runGraph, type RunEngineNode } from "@/lib/execution/run-engine";
import { downloadJson, parseWorkflow, serializeWorkflow } from "@/lib/config-io";
import { PipelineCanvas } from "@/components/canvas/pipeline-canvas";
import { StepNode } from "@/components/canvas/step-node";
import { CanvasToolbar, ToolbarButton } from "@/components/canvas/canvas-toolbar";
import { RunButton } from "@/components/run/run-controls";
import { RunConsolePanel } from "@/components/run/run-console-panel";
import type {
  ConditionStepConfig,
  ConnectorType,
  GraphEdge,
  GraphNode,
  NodeConfig,
  NodeType,
  OutputStepConfig,
  PromptStepConfig,
  ToolCallStepConfig,
} from "@/lib/types/domain";

const NODE_TYPES: NodeTypes = { step: StepNode };

const STEP_TYPES: Array<{ type: Exclude<NodeType, "agent">; label: string }> = [
  { type: "prompt", label: "+ Prompt" },
  { type: "tool-call", label: "+ Tool call" },
  { type: "condition", label: "+ Condition" },
  { type: "output", label: "+ Output" },
];

function defaultConfigFor(type: Exclude<NodeType, "agent">): NodeConfig {
  switch (type) {
    case "prompt":
      return { prompt: "", temperature: 0.7 };
    case "tool-call":
      return { toolName: "", toolArgs: {} };
    case "condition":
      return { expression: "" };
    case "output":
      return { format: "text" };
  }
}

function resolveSeedPrompt(node: GraphNode): string {
  switch (node.type) {
    case "prompt":
      return (node.config as PromptStepConfig).prompt || "(no prompt configured)";
    case "tool-call": {
      const c = node.config as ToolCallStepConfig;
      return c.toolName ? `Call tool ${c.toolName}` : "(no tool configured)";
    }
    case "condition":
      return (node.config as ConditionStepConfig).expression || "(no condition configured)";
    case "output":
      return `Format output as ${(node.config as OutputStepConfig).format ?? "text"}`;
    default:
      return "";
  }
}

interface AgentPipelineClientProps {
  agentId: string;
  connectorType: ConnectorType;
  workspaceFolder: string | null;
  model: string | null;
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
}

export function AgentPipelineClient({
  agentId,
  connectorType,
  workspaceFolder,
  model,
  initialNodes,
  initialEdges,
}: AgentPipelineClientProps) {
  const initGraph = useCanvasStore((s) => s.initGraph);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const addNode = useCanvasStore((s) => s.addNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const setCanvasNodeStatus = useCanvasStore((s) => s.setNodeStatus);
  const resetAllStatuses = useCanvasStore((s) => s.resetAllStatuses);
  const setPersistNode = useCanvasStore((s) => s.setPersistNode);
  const edges = useCanvasStore((s) => s.edges);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const runStatus = useRunStore((s) => s.status);
  const startRunStore = useRunStore((s) => s.startRun);
  const setRunIdStore = useRunStore((s) => s.setRunId);
  const setRunNodeStatus = useRunStore((s) => s.setNodeStatus);
  const appendRunToken = useRunStore((s) => s.appendNodeToken);
  const addRunLog = useRunStore((s) => s.addLog);
  const finishRunStore = useRunStore((s) => s.finishRun);
  const requestStop = useRunStore((s) => s.requestStop);
  const [showConsole, setShowConsole] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    const rfNodes: CanvasNode[] = initialNodes.map((n) => ({
      id: n.id,
      type: "step",
      position: { x: n.positionX, y: n.positionY },
      data: { kind: "step", graphNode: n },
    }));
    const rfEdges: Edge[] = initialEdges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.label ?? undefined,
    }));
    initGraph({ graphId: agentId, nodes: rfNodes, edges: rfEdges });
    return () => useCanvasStore.getState().reset();
  }, [agentId, initialNodes, initialEdges, initGraph]);

  // Register a per-node debounced persister so inline widget edits save to the backend.
  useEffect(() => {
    const timers = persistTimers.current;
    setPersistNode((nodeId, patch) => {
      const prev = timers.get(nodeId);
      if (prev) clearTimeout(prev);
      timers.set(
        nodeId,
        setTimeout(() => {
          timers.delete(nodeId);
          apiFetch(`/api/graphs/${agentId}/nodes/${nodeId}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }).catch((err) => {
            console.error("Failed to save step", err);
            pushToast("Failed to save step.");
          });
        }, 500),
      );
    });
    return () => {
      setPersistNode(undefined);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [agentId, setPersistNode, pushToast]);

  const handleAddStep = useCallback(
    async (type: Exclude<NodeType, "agent">) => {
      try {
        const index = nodes.length;
        const position = { x: 80 + (index % 4) * 320, y: 100 + Math.floor(index / 4) * 280 };
        const config = defaultConfigFor(type);
        const node = await apiFetch<GraphNode>(`/api/graphs/${agentId}/nodes`, {
          method: "POST",
          body: JSON.stringify({
            type,
            positionX: position.x,
            positionY: position.y,
            label: type,
            config,
          }),
        });
        addNode({ id: node.id, type: "step", position, data: { kind: "step", graphNode: node } });
      } catch (err) {
        console.error("Failed to add step", err);
        pushToast("Failed to add step.");
      }
    },
    [agentId, nodes.length, addNode, pushToast],
  );

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        const edge = await apiFetch<GraphEdge>(`/api/graphs/${agentId}/edges`, {
          method: "POST",
          body: JSON.stringify({
            sourceNodeId: connection.source,
            targetNodeId: connection.target,
          }),
        });
        addEdge({ id: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId });
      } catch (err) {
        console.error("Failed to create connection", err);
        pushToast("Failed to create connection.");
      }
    },
    [agentId, addEdge, pushToast],
  );

  const handleNodeDragStop = useCallback(
    (node: CanvasNode) => {
      apiFetch(`/api/graphs/${agentId}/nodes/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
      }).catch((err) => {
        console.error("Failed to persist node position", err);
        pushToast("Failed to save node position.");
      });
    },
    [agentId, pushToast],
  );

  const persistNodeDeletion = useCallback(
    async (node: CanvasNode) => {
      await apiFetch(`/api/graphs/${agentId}/nodes/${node.id}`, { method: "DELETE" });
    },
    [agentId],
  );

  const handleNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      deleted.forEach((n) =>
        persistNodeDeletion(n).catch((err) => {
          console.error("Failed to delete node", err);
          pushToast("Failed to delete step.");
        }),
      );
    },
    [persistNodeDeletion, pushToast],
  );

  const handleEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((e) => {
        apiFetch(`/api/graphs/${agentId}/edges/${e.id}`, { method: "DELETE" }).catch(() => {});
      });
    },
    [agentId],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this step? This cannot be undone.")) return;
    removeNode(selectedNodeId);
    persistNodeDeletion(node).catch((err) => {
      console.error("Failed to delete node", err);
      pushToast("Failed to delete step.");
    });
  }, [selectedNodeId, nodes, removeNode, persistNodeDeletion, pushToast]);

  const handleExport = useCallback(() => {
    const workflow = serializeWorkflow(nodes, edges);
    downloadJson(workflow, `agentos-pipeline-${agentId.slice(0, 8)}.json`);
  }, [nodes, edges, agentId]);

  const handleImportFile = useCallback(
    async (file: File) => {
      let workflow;
      try {
        workflow = parseWorkflow(await file.text());
      } catch (err) {
        pushToast(err instanceof Error ? err.message : "Invalid config file.");
        return;
      }
      if (nodes.length > 0 && typeof window !== "undefined") {
        if (!window.confirm("Replace the current pipeline with the imported config? This cannot be undone.")) {
          return;
        }
      }
      try {
        // Clear existing nodes (edges cascade in the DB).
        for (const n of nodes) {
          await apiFetch(`/api/graphs/${agentId}/nodes/${n.id}`, { method: "DELETE" });
        }
        // Recreate imported nodes, mapping old keys → freshly assigned ids.
        const idMap = new Map<string, string>();
        const newNodes: CanvasNode[] = [];
        for (const sn of workflow.nodes) {
          const created = await apiFetch<GraphNode>(`/api/graphs/${agentId}/nodes`, {
            method: "POST",
            body: JSON.stringify({
              type: sn.type,
              positionX: sn.position.x,
              positionY: sn.position.y,
              label: sn.label,
              config: sn.config,
            }),
          });
          idMap.set(sn.key, created.id);
          newNodes.push({
            id: created.id,
            type: "step",
            position: sn.position,
            data: { kind: "step", graphNode: created },
          });
        }
        const newEdges: Edge[] = [];
        for (const se of workflow.edges) {
          const source = idMap.get(se.source);
          const target = idMap.get(se.target);
          if (!source || !target) continue;
          const created = await apiFetch<GraphEdge>(`/api/graphs/${agentId}/edges`, {
            method: "POST",
            body: JSON.stringify({ sourceNodeId: source, targetNodeId: target }),
          });
          newEdges.push({ id: created.id, source: created.sourceNodeId, target: created.targetNodeId });
        }
        initGraph({ graphId: agentId, nodes: newNodes, edges: newEdges });
        pushToast("Config loaded.", "info");
      } catch (err) {
        console.error("Failed to import config", err);
        pushToast("Failed to load config.");
      }
    },
    [agentId, nodes, initGraph, pushToast],
  );

  const handleStop = useCallback(() => {
    requestStop();
  }, [requestStop]);

  const handleRun = useCallback(async () => {
    if (nodes.length === 0 || runStatus === "running") return;
    resetAllStatuses();
    setShowConsole(true);
    const runEngineNodes: RunEngineNode[] = nodes.map((n) => {
      const data = n.data as StepNodeData;
      return {
        id: n.id,
        connectorType,
        workspaceFolder,
        model,
        nodeType: data.graphNode.type,
        seedPrompt: resolveSeedPrompt(data.graphNode),
        toolName:
          data.graphNode.type === "tool-call" ? (data.graphNode.config as ToolCallStepConfig).toolName : undefined,
        toolArgs:
          data.graphNode.type === "tool-call" ? (data.graphNode.config as ToolCallStepConfig).toolArgs : undefined,
      };
    });
    const runEngineEdges = edges.map((e) => ({ source: e.source, target: e.target }));
    const controller = new AbortController();
    startRunStore({
      runId: "pending",
      graphId: agentId,
      nodeIds: nodes.map((n) => n.id),
      abortController: controller,
    });
    try {
      const result = await runGraph({
        graphId: agentId,
        nodes: runEngineNodes,
        edges: runEngineEdges,
        signal: controller.signal,
        callbacks: {
          onRunCreated: setRunIdStore,
          onNodeStatus: (nodeId, status) => {
            setRunNodeStatus(nodeId, status);
            setCanvasNodeStatus(nodeId, status);
          },
          onToken: appendRunToken,
          onLog: addRunLog,
        },
      });
      finishRunStore(result.status);
    } catch (err) {
      if (err instanceof GraphCycleError) {
        addRunLog(err.message, "error");
      } else {
        addRunLog(err instanceof Error ? err.message : String(err), "error");
      }
      finishRunStore("error");
    }
  }, [
    nodes,
    edges,
    agentId,
    connectorType,
    workspaceFolder,
    model,
    runStatus,
    resetAllStatuses,
    startRunStore,
    setRunIdStore,
    setRunNodeStatus,
    setCanvasNodeStatus,
    appendRunToken,
    addRunLog,
    finishRunStore,
  ]);

  const nodeLabelById = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, (n.data as StepNodeData).graphNode.label ?? n.id])),
    [nodes],
  );

  return (
    <div className="relative flex-1">
      <PipelineCanvas
        nodeTypes={NODE_TYPES}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={(node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        viewportStorageKey={`agentos:viewport:${agentId}`}
      />
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-white/90 px-8 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/90">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This agent has no steps yet. Add one to start building its pipeline.
            </p>
            <ToolbarButton onClick={() => void handleAddStep("prompt")}>Add a prompt step</ToolbarButton>
          </div>
        </div>
      )}
      <CanvasToolbar onDeleteSelected={handleDeleteSelected} hasSelection={!!selectedNodeId}>
        {STEP_TYPES.map(({ type, label }) => (
          <ToolbarButton key={type} variant="secondary" onClick={() => void handleAddStep(type)}>
            {label}
          </ToolbarButton>
        ))}
        <span className="mx-0.5 h-5 w-px bg-zinc-300 dark:bg-zinc-700" />
        <ToolbarButton variant="secondary" onClick={handleExport}>
          Save config
        </ToolbarButton>
        <ToolbarButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Load config
        </ToolbarButton>
        <RunButton
          onRun={() => void handleRun()}
          onStop={handleStop}
          isRunning={runStatus === "running"}
          disabled={nodes.length === 0}
        />
      </CanvasToolbar>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />
      {showConsole && (
        <RunConsolePanel nodeLabelById={nodeLabelById} onClose={() => setShowConsole(false)} onStop={handleStop} />
      )}
    </div>
  );
}
