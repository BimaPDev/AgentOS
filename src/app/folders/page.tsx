import { listWorkspaceFolders } from "@/lib/hermes-admin";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { FoldersClient } from "@/components/folders/folders-client";

export const dynamic = "force-dynamic";

export default async function FoldersPage() {
  const initial = await listWorkspaceFolders();
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Folders" }]} />}>
      <FoldersClient initial={initial} />
    </AppShell>
  );
}
