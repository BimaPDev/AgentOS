import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface HermesEmbedProps {
  /** Path on the Hermes dashboard, e.g. "/sessions" or "cron". */
  path: string;
  title: string;
  dashboardUrl: string;
}

/** Full-height iframe of the official Hermes dashboard for pages not yet native in AgentOS. */
export function HermesEmbed({ path, title, dashboardUrl }: HermesEmbedProps) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const src = `${dashboardUrl.replace(/\/$/, "")}${normalized}`;

  if (!dashboardUrl) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Set <code className="font-mono text-xs">HERMES_DASHBOARD_URL</code> (e.g.{" "}
            <code className="font-mono text-xs">http://192.168.50.86:9119</code>) so AgentOS can embed
            the Hermes UI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Live from Hermes dashboard</p>
        </div>
        <Link
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ExternalLink size={13} />
          Open in Hermes
        </Link>
      </div>
      <iframe
        title={title}
        src={src}
        className="min-h-0 w-full flex-1 border-0 bg-zinc-950"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
