import { getSkillsList } from "@/lib/hermes-admin";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SkillsClient } from "@/components/skills/skills-client";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const initial = await getSkillsList();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Skills" }]} />}>
      <SkillsClient initial={initial} />
    </AppShell>
  );
}
