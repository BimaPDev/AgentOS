export interface TopoEdge {
  source: string;
  target: string;
}

export interface TopoSortResult {
  order: string[];
  cycle: boolean;
}

/** Kahn's algorithm. Nodes with no incoming edges are visited first. */
export function topoSort(nodeIds: string[], edges: TopoEdge[]): TopoSortResult {
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !inDegree.has(edge.target)) continue;
    adjacency.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const neighbor of adjacency.get(id) ?? []) {
      const remaining = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, remaining);
      if (remaining === 0) queue.push(neighbor);
    }
  }

  return { order, cycle: order.length !== nodeIds.length };
}
