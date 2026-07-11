import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function McpPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "MCP" }]} />}>
      <StubPage title="MCP" description="Coming soon — connected MCP servers and their tools will appear here." />
    </AppShell>
  );
}
