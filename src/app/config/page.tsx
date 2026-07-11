import { getHermesConnector, getRouter9Connector } from "@/lib/connectors";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HermesStatusWidget } from "@/components/config/hermes-status-widget";
import { Router9StatusWidget } from "@/components/config/router9-status-widget";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="truncate font-mono text-xs text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

export default function ConfigPage() {
  const hermes = getHermesConnector().getConnectionInfo();
  const router9 = getRouter9Connector().getConnectionInfo();

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Config" }]} />}>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Config</h1>
        <p className="mb-6 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Connector settings. Values come from environment variables (see{" "}
          <code className="font-mono">.env.example</code>) — edit those and restart the server to change them.
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mock connector</h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Always available. Fabricates responses for testing pipelines without any external dependency.
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Hermes connector</h2>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row label="Host" value={hermes.host} />
              <Row label="Port" value={String(hermes.port)} />
              <Row label="User" value={hermes.username} />
              <Row label="Binary" value={hermes.hermesBin} />
              <Row label="Private key" value={hermes.privateKeyPath} />
            </div>
            <div className="mt-4">
              <HermesStatusWidget />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">9Router connector</h2>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <Row label="Base URL" value={router9.baseUrl} />
              <Row label="Default model" value={router9.defaultModel} />
              <Row label="API key" value={router9.hasApiKey ? "configured" : "not set (using open providers)"} />
            </div>
            <div className="mt-4">
              <Router9StatusWidget />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
