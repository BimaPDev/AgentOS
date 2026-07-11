import { getMcpServers } from "@/lib/hermes-admin";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { McpClient } from "@/components/mcp/mcp-client";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const initial = await getMcpServers();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "MCP" }]} />}>
      <McpClient initial={initial} />
    </AppShell>
  );
}
