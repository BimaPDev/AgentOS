import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function LogsPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Logs" }]} />}>
      <StubPage title="Logs" description="Coming soon — a searchable history of run logs will appear here." />
    </AppShell>
  );
}
