import { getHermesStatus } from "@/lib/hermes-admin";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ModelsClient } from "@/components/models/models-client";

export const dynamic = "force-dynamic";

export default async function ModelsPage() {
  const initialStatus = await getHermesStatus();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: "Models" }]} />}>
      <ModelsClient initialStatus={initialStatus} />
    </AppShell>
  );
}
