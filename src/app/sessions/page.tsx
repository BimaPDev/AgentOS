import { listHermesChatSessions } from "@/lib/hermes-chat";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { SessionsClient } from "@/components/sessions/sessions-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const initial = await listHermesChatSessions({ limit: 100 });
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: "Sessions" }]} />}>
      <SessionsClient initial={initial} />
    </AppShell>
  );
}
