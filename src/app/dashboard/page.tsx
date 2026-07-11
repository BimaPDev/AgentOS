import { getDashboardData } from "@/lib/dashboard";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const data = getDashboardData();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Dashboard" }]} />}>
      <DashboardClient initialData={data} />
    </AppShell>
  );
}
