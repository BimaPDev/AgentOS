import fs from "node:fs";
import { DB_PATH } from "@/lib/db/client";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HermesStatusWidget } from "@/components/config/hermes-status-widget";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 truncate font-mono text-sm text-zinc-800 dark:text-zinc-200">{value}</div>
    </div>
  );
}

export default function SystemPage() {
  let dbSize = "not created yet";
  try {
    dbSize = formatBytes(fs.statSync(DB_PATH).size);
  } catch {
    // no-op — DB file doesn't exist until first write
  }

  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "System" }]} />}>
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">System</h1>
        <p className="mb-6 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
          Host/runtime status for the AgentOS server process itself.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Node" value={process.version} />
          <Stat label="Platform" value={`${process.platform}/${process.arch}`} />
          <Stat label="Process uptime" value={formatUptime(process.uptime())} />
          <Stat label="SQLite DB" value={dbSize} />
        </div>

        <section className="max-w-xl rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Hermes connector reachability</h2>
          <HermesStatusWidget />
        </section>
      </div>
    </AppShell>
  );
}
