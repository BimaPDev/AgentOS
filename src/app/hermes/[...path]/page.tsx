import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HermesEmbed } from "@/components/hermes/hermes-embed";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  files: "Files",
  logs: "Logs",
  cron: "Cron",
  plugins: "Plugins",
  channels: "Channels",
  webhooks: "Webhooks",
  pairing: "Pairing",
  profiles: "Profiles",
  config: "Config",
  keys: "Keys",
  system: "System",
  documentation: "Documentation",
  docs: "Documentation",
};

export default async function HermesEmbedPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path: segments } = await params;
  const path = `/${segments.join("/")}`;
  const key = segments[0] ?? "";
  const title = TITLES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
  const dashboardUrl = process.env.HERMES_DASHBOARD_URL ?? "http://192.168.50.86:9119";

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: title }]} />}>
      <HermesEmbed path={path} title={title} dashboardUrl={dashboardUrl} />
    </AppShell>
  );
}
