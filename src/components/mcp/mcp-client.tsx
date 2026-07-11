"use client";

import { useState } from "react";
import { Loader2, Plug, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { McpServersResult } from "@/lib/hermes-admin";

export function McpClient({ initial }: { initial: McpServersResult }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    apiFetch<McpServersResult>("/api/hermes/mcp")
      .then(setData)
      .finally(() => setLoading(false));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">MCP</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            MCP servers configured on the Hermes agent (<code className="font-mono">hermes mcp list</code>).
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
      </div>

      {data.error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {data.error}
        </div>
      )}

      {!data.error && data.servers.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
          <Plug size={22} className="text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No MCP servers configured on Hermes yet.</p>
          <p className="max-w-sm text-xs text-zinc-400 dark:text-zinc-500">
            Add one from the Hermes CLI: <code className="font-mono">hermes mcp add &lt;name&gt; --url &lt;endpoint&gt;</code>
          </p>
        </div>
      )}

      {!data.error && data.servers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400">
              <tr>
                {Object.keys(data.servers[0]).map((key) => (
                  <th key={key} className="px-4 py-2 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.servers.map((server, i) => (
                <tr key={i}>
                  {Object.values(server).map((value, j) => (
                    <td key={j} className="px-4 py-2 text-zinc-700 dark:text-zinc-300">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
