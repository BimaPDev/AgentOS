import { listAgents } from "@/lib/db/queries/agents";
import { listRecentRunLogs } from "@/lib/db/queries/runs";
import { labelForGraph } from "@/lib/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LogsClient } from "@/components/logs/logs-client";

export const dynamic = "force-dynamic";

export default function LogsPage() {
  const logs = listRecentRunLogs(300);
  const agentNameById = new Map(listAgents().map((a) => [a.id, a.name]));
  const initialLogs = logs.map((log) => ({ ...log, label: labelForGraph(log.graphId, agentNameById) }));

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Logs" }]} />}>
      <LogsClient initialLogs={initialLogs} />
    </AppShell>
  );
}
