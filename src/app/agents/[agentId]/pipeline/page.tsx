import { notFound } from "next/navigation";
import { getAgent } from "@/lib/db/queries/agents";
import { listNodes } from "@/lib/db/queries/nodes";
import { listEdges } from "@/lib/db/queries/edges";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { AgentPipelineClient } from "@/components/canvas/agent-pipeline-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentPipelinePage({ params }: PageProps) {
  const { agentId } = await params;
  const agent = getAgent(agentId);
  if (!agent) notFound();

  const nodes = listNodes(agentId);
  const edges = listEdges(agentId);

  return (
    <AppShell
      breadcrumb={
        <Breadcrumbs
          items={[{ label: "Agents", href: "/agents" }, { label: agent.name }, { label: "Pipeline" }]}
        />
      }
    >
      <AgentPipelineClient
        agentId={agentId}
        connectorType={agent.connectorType}
        workspaceFolder={agent.workspaceFolder}
        initialNodes={nodes}
        initialEdges={edges}
      />
    </AppShell>
  );
}
