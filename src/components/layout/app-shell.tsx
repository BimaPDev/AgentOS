import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ breadcrumb, children }: { breadcrumb: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
          {breadcrumb}
        </header>
        <div className="relative flex flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
