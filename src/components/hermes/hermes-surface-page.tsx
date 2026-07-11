import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HermesSurfaceClient } from "@/components/hermes/hermes-surface-client";
import { getHermesSurface, getSurfaceMeta, type HermesSurfaceId } from "@/lib/hermes-surfaces";

export const dynamic = "force-dynamic";

export async function HermesSurfacePage({
  surfaceId,
}: {
  surfaceId: HermesSurfaceId;
}) {
  const meta = getSurfaceMeta(surfaceId)!;
  const initial = await getHermesSurface(surfaceId, surfaceId === "logs" ? { lines: 150 } : undefined);
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: meta.title }]} />}>
      <HermesSurfaceClient surfaceId={surfaceId} initial={initial} />
    </AppShell>
  );
}
