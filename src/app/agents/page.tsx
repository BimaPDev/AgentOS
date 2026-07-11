import { listAgents } from "@/lib/db/queries/agents";
import { listNodes } from "@/lib/db/queries/nodes";
import { listEdges } from "@/lib/db/queries/edges";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AgentsLibraryClient } from "@/components/agents/agents-library-client";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = listAgents();
  const previews = agents.map((agent) => ({
    agent,
    nodes: listNodes(agent.id),
    edges: listEdges(agent.id),
  }));

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Agents" }]} />}>
      <AgentsLibraryClient initialPreviews={previews} />
    </AppShell>
  );
}
