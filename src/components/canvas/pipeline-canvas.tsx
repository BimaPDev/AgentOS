"use client";

import "@xyflow/react/dist/style.css";
import { useState } from "react";
import {
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import { useCanvasStore, type CanvasNode } from "@/lib/stores/canvas-store";

interface PipelineCanvasProps {
  nodeTypes: NodeTypes;
  onConnect: (connection: Connection) => void;
  onNodeDragStop?: (node: CanvasNode) => void;
  onNodeClick?: (node: CanvasNode) => void;
  onPaneClick?: () => void;
  onNodesDelete?: (nodes: CanvasNode[]) => void;
  onEdgesDelete?: (edges: Edge[]) => void;
  /** sessionStorage key used to remember pan/zoom across reloads; omit to always fit-view on load. */
  viewportStorageKey?: string;
}

function readStoredViewport(key: string | undefined): Viewport | undefined {
  if (!key || typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Viewport) : undefined;
  } catch {
    return undefined;
  }
}

function PipelineCanvasInner(props: PipelineCanvasProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const [initialViewport] = useState(() => readStoredViewport(props.viewportStorageKey));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={props.nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={props.onConnect}
      onNodeDragStop={(_evt, node) => props.onNodeDragStop?.(node as CanvasNode)}
      onNodeClick={(_evt, node) => props.onNodeClick?.(node as CanvasNode)}
      onPaneClick={() => props.onPaneClick?.()}
      onNodesDelete={(deleted) => props.onNodesDelete?.(deleted as CanvasNode[])}
      onEdgesDelete={(deleted) => props.onEdgesDelete?.(deleted)}
      onBeforeDelete={async () =>
        typeof window === "undefined" || window.confirm("Delete the selected item(s)? This cannot be undone.")
      }
      onMoveEnd={(_evt, viewport) => {
        if (props.viewportStorageKey && typeof window !== "undefined") {
          window.sessionStorage.setItem(props.viewportStorageKey, JSON.stringify(viewport));
        }
      }}
      defaultViewport={initialViewport}
      fitView={!initialViewport}
      className="bg-zinc-50 dark:bg-zinc-950"
    >
      <Background gap={16} />
      <MiniMap pannable zoomable className="!bg-white dark:!bg-zinc-900" />
    </ReactFlow>
  );
}

export function PipelineCanvas(props: PipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
