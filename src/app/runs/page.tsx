import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function RunsPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Runs" }]} />}>
      <StubPage title="Runs" description="Coming soon — run history across agents will appear here." />
    </AppShell>
  );
}
