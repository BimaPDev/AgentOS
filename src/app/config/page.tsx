import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function ConfigPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Config" }]} />}>
      <StubPage
        title="Config"
        description="Coming soon — connector settings (including Hermes, once wired up) will appear here."
      />
    </AppShell>
  );
}
