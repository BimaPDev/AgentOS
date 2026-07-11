import { listHermesDirectory } from "@/lib/hermes-files";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FilesClient } from "@/components/files/files-client";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const initial = await listHermesDirectory();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: "Files" }]} />}>
      <FilesClient initial={initial} />
    </AppShell>
  );
}
