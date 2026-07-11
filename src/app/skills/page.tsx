import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { StubPage } from "@/components/layout/stub-page";

export default function SkillsPage() {
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Skills" }]} />}>
      <StubPage
        title="Skills"
        description="Coming soon — installable tool/skill packages for agents will appear here."
      />
    </AppShell>
  );
}
