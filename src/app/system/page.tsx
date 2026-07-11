import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function SystemPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "System" }]} />}>
      <StubPage title="System" description="Coming soon — host/runtime status and diagnostics will appear here." />
    </AppShell>
  );
}
