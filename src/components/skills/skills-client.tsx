"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/utils/fetcher";
import type { SkillsListResult } from "@/lib/hermes-admin";

export function SkillsClient({ initial }: { initial: SkillsListResult }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = () => {
    setLoading(true);
    apiFetch<SkillsListResult>("/api/hermes/skills")
      .then(setData)
      .finally(() => setLoading(false));
  };

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.skills.filter(
      (s) => !q || s.Name?.toLowerCase().includes(q) || s.Category?.toLowerCase().includes(q),
    );
    const byCategory = new Map<string, Record<string, string>[]>();
    for (const skill of filtered) {
      const cat = skill.Category || "uncategorized";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(skill);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data.skills, query]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Skills</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Installable tool/skill packages available to the Hermes agent.
            {data.summary && <span className="ml-1 text-zinc-400 dark:text-zinc-500">{data.summary}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter skills…"
              className="w-52 rounded-md border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />
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
      </div>

      {data.error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {data.error}
        </div>
      )}

      {!data.error && grouped.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-4 py-12 text-center dark:border-zinc-800">
          <Sparkles size={22} className="text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {data.skills.length === 0 ? "No skills installed on Hermes." : "No skills match your filter."}
          </p>
        </div>
      )}

      {!data.error && grouped.length > 0 && (
        <div className="space-y-5">
          {grouped.map(([category, skills]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {category} <span className="text-zinc-300 dark:text-zinc-600">· {skills.length}</span>
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {skills.map((skill) => (
                  <div
                    key={skill.Name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <span className="min-w-0 truncate text-sm text-zinc-700 dark:text-zinc-300" title={skill.Name}>
                      {skill.Name}
                    </span>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        skill.Status === "enabled"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {skill.Status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
