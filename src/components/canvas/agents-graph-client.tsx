"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connection, Edge, NodeTypes } from "@xyflow/react";
import { apiFetch } from "@/lib/utils/fetcher";
import {
  useCanvasStore,
  type AgentNodeData,
  type CanvasNode,
  type CanvasNodeData,
} from "@/lib/stores/canvas-store";
import { useRunStore } from "@/lib/stores/run-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { GraphCycleError, runGraph, type RunEngineNode } from "@/lib/execution/run-engine";
import { PipelineCanvas } from "@/components/canvas/pipeline-canvas";
import { AgentNode } from "@/components/canvas/agent-node";
import { CanvasToolbar, ToolbarButton } from "@/components/canvas/canvas-toolbar";
import { NodeInspectorPanel } from "@/components/inspector/node-inspector-panel";
import { RunButton } from "@/components/run/run-controls";
import { RunConsolePanel } from "@/components/run/run-console-panel";
import { ROOT_GRAPH_ID, type Agent, type GraphEdge, type GraphNode } from "@/lib/types/domain";

const NODE_TYPES: NodeTypes = { agent: AgentNode };

interface AgentsGraphClientProps {
  initialAgents: Agent[];
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
}

export function AgentsGraphClient({
  initialAgents,
  initialNodes,
  initialEdges,
}: AgentsGraphClientProps) {
  const initGraph = useCanvasStore((s) => s.initGraph);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const selectNode = useCanvasStore((s) => s.selectNode);
  const addNode = useCanvasStore((s) => s.addNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setCanvasNodeStatus = useCanvasStore((s) => s.setNodeStatus);
  const resetAllStatuses = useCanvasStore((s) => s.resetAllStatuses);
  const edges = useCanvasStore((s) => s.edges);

  const runStatus = useRunStore((s) => s.status);
  const startRunStore = useRunStore((s) => s.startRun);
  const setRunNodeStatus = useRunStore((s) => s.setNodeStatus);
  const appendRunToken = useRunStore((s) => s.appendNodeToken);
  const addRunLog = useRunStore((s) => s.addLog);
  const finishRunStore = useRunStore((s) => s.finishRun);
  const [showConsole, setShowConsole] = useState(false);
  const pushToast = useToastStore((s) => s.push);

  useEffect(() => {
    const agentsById = new Map(initialAgents.map((a) => [a.id, a]));
    const rfNodes: CanvasNode[] = initialNodes.map((n) => ({
      id: n.id,
      type: "agent",
      position: { x: n.positionX, y: n.positionY },
      data: {
        kind: "agent",
        graphNode: n,
        agent: n.refAgentId ? (agentsById.get(n.refAgentId) ?? null) : null,
      },
    }));
    const rfEdges: Edge[] = initialEdges.map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.label ?? undefined,
    }));
    initGraph({ graphId: ROOT_GRAPH_ID, nodes: rfNodes, edges: rfEdges });
    return () => useCanvasStore.getState().reset();
  }, [initialAgents, initialNodes, initialEdges, initGraph]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const handleAdd = useCallback(async () => {
    try {
      const index = nodes.length + 1;
      const agent = await apiFetch<Agent>("/api/agents", {
        method: "POST",
        body: JSON.stringify({ name: `Agent ${index}` }),
      });
      const position = { x: 120 + (index % 5) * 220, y: 120 + Math.floor(index / 5) * 160 };
      const node = await apiFetch<GraphNode>(`/api/graphs/${ROOT_GRAPH_ID}/nodes`, {
        method: "POST",
        body: JSON.stringify({
          type: "agent",
          refAgentId: agent.id,
          positionX: position.x,
          positionY: position.y,
          label: agent.name,
        }),
      });
      addNode({
        id: node.id,
        type: "agent",
        position,
        data: { kind: "agent", graphNode: node, agent },
      });
    } catch (err) {
      console.error("Failed to add agent", err);
      pushToast("Failed to add agent.");
    }
  }, [nodes.length, addNode, pushToast]);

  const handleConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      try {
        const edge = await apiFetch<GraphEdge>(`/api/graphs/${ROOT_GRAPH_ID}/edges`, {
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
    [addEdge, pushToast],
  );

  const handleNodeDragStop = useCallback(
    (node: CanvasNode) => {
      apiFetch(`/api/graphs/${ROOT_GRAPH_ID}/nodes/${node.id}`, {
        method: "PATCH",
        body: JSON.stringify({ positionX: node.position.x, positionY: node.position.y }),
      }).catch((err) => {
        console.error("Failed to persist node position", err);
        pushToast("Failed to save node position.");
      });
    },
    [pushToast],
  );

  const persistNodeDeletion = useCallback(async (node: CanvasNode) => {
    const data = node.data as CanvasNodeData;
    if (data.kind === "agent" && data.agent) {
      await apiFetch(`/api/agents/${data.agent.id}`, { method: "DELETE" });
    } else {
      await apiFetch(`/api/graphs/${ROOT_GRAPH_ID}/nodes/${node.id}`, { method: "DELETE" });
    }
  }, []);

  const handleNodesDelete = useCallback(
    (deleted: CanvasNode[]) => {
      deleted.forEach((n) =>
        persistNodeDeletion(n).catch((err) => {
          console.error("Failed to delete node", err);
          pushToast("Failed to delete node.");
        }),
      );
    },
    [persistNodeDeletion, pushToast],
  );

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    deleted.forEach((e) => {
      apiFetch(`/api/graphs/${ROOT_GRAPH_ID}/edges/${e.id}`, { method: "DELETE" }).catch(() => {
        // Edge may already be gone if its node was deleted in the same batch.
      });
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this agent? This cannot be undone.")) return;
    removeNode(selectedNodeId);
    persistNodeDeletion(node).catch((err) => {
      console.error("Failed to delete node", err);
      pushToast("Failed to delete node.");
    });
  }, [selectedNodeId, nodes, removeNode, persistNodeDeletion, pushToast]);

  const handleAgentSave = useCallback(
    async (agentId: string, patch: { name?: string; role?: string | null; description?: string | null }) => {
      try {
        const updated = await apiFetch<Agent>(`/api/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        if (selectedNodeId) {
          updateNodeData(selectedNodeId, { agent: updated } as Partial<AgentNodeData>);
        }
      } catch (err) {
        console.error("Failed to save agent", err);
        pushToast("Failed to save agent.");
      }
    },
    [selectedNodeId, updateNodeData, pushToast],
  );

  const handleRun = useCallback(async () => {
    if (nodes.length === 0) return;
    resetAllStatuses();
    setShowConsole(true);
    const runEngineNodes: RunEngineNode[] = nodes.map((n) => {
      const data = n.data as AgentNodeData;
      const agent = data.agent;
      return {
        id: n.id,
        connectorType: agent?.connectorType ?? "mock",
        nodeType: "agent",
        seedPrompt:
          agent?.description ||
          `You are ${agent?.name ?? "an agent"}${agent?.role ? `, a ${agent.role}` : ""}.`,
      };
    });
    const runEngineEdges = edges.map((e) => ({ source: e.source, target: e.target }));
    startRunStore({ runId: "pending", graphId: ROOT_GRAPH_ID, nodeIds: nodes.map((n) => n.id) });
    try {
      const result = await runGraph({
        graphId: ROOT_GRAPH_ID,
        nodes: runEngineNodes,
        edges: runEngineEdges,
        callbacks: {
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
        finishRunStore("error");
      } else {
        addRunLog(err instanceof Error ? err.message : String(err), "error");
        finishRunStore("error");
      }
    }
  }, [
    nodes,
    edges,
    resetAllStatuses,
    startRunStore,
    setRunNodeStatus,
    setCanvasNodeStatus,
    appendRunToken,
    addRunLog,
    finishRunStore,
  ]);

  const nodeLabelById = useMemo(
    () =>
      Object.fromEntries(
        nodes.map((n) => [n.id, (n.data as AgentNodeData).agent?.name ?? n.id]),
      ),
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
        viewportStorageKey={`agentos:viewport:${ROOT_GRAPH_ID}`}
      />
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-white/90 px-8 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/90">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No agents yet. Create one to start building your orchestration graph.
            </p>
            <ToolbarButton onClick={() => void handleAdd()}>Create your first agent</ToolbarButton>
          </div>
        </div>
      )}
      <CanvasToolbar onDeleteSelected={handleDeleteSelected} hasSelection={!!selectedNodeId}>
        <ToolbarButton onClick={() => void handleAdd()}>Add agent</ToolbarButton>
        <RunButton onRun={() => void handleRun()} isRunning={runStatus === "running"} disabled={nodes.length === 0} />
      </CanvasToolbar>
      {selectedNode && (
        <NodeInspectorPanel
          key={selectedNode.id}
          node={selectedNode}
          onSaveAgent={handleAgentSave}
          onClose={() => selectNode(null)}
        />
      )}
      {showConsole && <RunConsolePanel nodeLabelById={nodeLabelById} onClose={() => setShowConsole(false)} />}
    </div>
  );
}
