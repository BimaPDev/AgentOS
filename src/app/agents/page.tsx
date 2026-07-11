import { listAgents } from "@/lib/db/queries/agents";
import { listNodes } from "@/lib/db/queries/nodes";
import { listEdges } from "@/lib/db/queries/edges";
import { ROOT_GRAPH_ID } from "@/lib/types/domain";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AgentsGraphClient } from "@/components/canvas/agents-graph-client";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = listAgents();
  const nodes = listNodes(ROOT_GRAPH_ID);
  const edges = listEdges(ROOT_GRAPH_ID);

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Agents" }]} />}>
      <AgentsGraphClient initialAgents={agents} initialNodes={nodes} initialEdges={edges} />
    </AppShell>
  );
}
