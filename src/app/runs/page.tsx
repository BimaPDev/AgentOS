import { listAgents } from "@/lib/db/queries/agents";
import { listRuns } from "@/lib/db/queries/runs";
import { labelForGraph } from "@/lib/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { RunsClient } from "@/components/runs/runs-client";

export const dynamic = "force-dynamic";

export default function RunsPage() {
  const runs = listRuns(200);
  const agentNameById = new Map(listAgents().map((a) => [a.id, a.name]));
  const initialRuns = runs.map((run) => ({ ...run, label: labelForGraph(run.graphId, agentNameById) }));

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Runs" }]} />}>
      <RunsClient initialRuns={initialRuns} />
    </AppShell>
  );
}
