import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { Agent, GraphNode, NodeConfig, RunStatus } from "@/lib/types/domain";

/** Persists an inline node edit to the backend. Registered by the active canvas client. */
export type NodePersister = (nodeId: string, patch: { config?: NodeConfig; label?: string | null }) => void;

export interface AgentNodeData extends Record<string, unknown> {
  kind: "agent";
  graphNode: GraphNode;
  agent: Agent | null;
  status?: RunStatus;
}

export interface StepNodeData extends Record<string, unknown> {
  kind: "step";
  graphNode: GraphNode;
  status?: RunStatus;
}

export type CanvasNodeData = AgentNodeData | StepNodeData;
export type CanvasNode = Node<CanvasNodeData>;

interface CanvasState {
  graphId: string | null;
  nodes: CanvasNode[];
  edges: Edge[];
  selectedNodeId: string | null;

  initGraph: (params: { graphId: string; nodes: CanvasNode[]; edges: Edge[] }) => void;
  reset: () => void;

  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;

  addNode: (node: CanvasNode) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;

  selectNode: (id: string | null) => void;
  updateNodeData: (id: string, patch: Partial<AgentNodeData> | Partial<StepNodeData>) => void;
  setNodeStatus: (id: string, status: RunStatus) => void;
  resetAllStatuses: () => void;

  /** Inline editing: mutate a node's config/label and persist via the registered persister. */
  persistNode: NodePersister | undefined;
  setPersistNode: (fn: NodePersister | undefined) => void;
  setNodeConfig: (id: string, config: NodeConfig) => void;
  setNodeLabel: (id: string, label: string) => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  graphId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,

  initGraph: ({ graphId, nodes, edges }) =>
    set({ graphId, nodes, edges, selectedNodeId: null }),

  reset: () => set({ graphId: null, nodes: [], edges: [], selectedNodeId: null }),

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  addNode: (node) => set({ nodes: [...get().nodes, node] }),
  removeNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    }),

  addEdge: (edge) => set({ edges: [...get().edges, edge] }),
  removeEdge: (id) => set({ edges: get().edges.filter((e) => e.id !== id) }),

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } as CanvasNodeData } : n,
      ),
    }),

  setNodeStatus: (id, status) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, status } } : n)),
    }),

  resetAllStatuses: () =>
    set({
      nodes: get().nodes.map((n) => ({ ...n, data: { ...n.data, status: "idle" as RunStatus } })),
    }),

  persistNode: undefined,
  setPersistNode: (fn) => set({ persistNode: fn }),

  setNodeConfig: (id, config) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, graphNode: { ...n.data.graphNode, config } } as CanvasNodeData }
          : n,
      ),
    });
    get().persistNode?.(id, { config });
  },

  setNodeLabel: (id, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, graphNode: { ...n.data.graphNode, label } } as CanvasNodeData }
          : n,
      ),
    });
    get().persistNode?.(id, { label });
  },
}));
