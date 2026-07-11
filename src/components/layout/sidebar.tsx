"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  PlayCircle,
  ScrollText,
  Wrench,
  Plug,
  Settings,
  Server,
  FolderGit2,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { useRunStore } from "@/lib/stores/run-store";
import { NodeStatusBadge } from "@/components/canvas/node-status-badge";

const COLLAPSE_STORAGE_KEY = "agentos.sidebar.collapsed";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Runs", href: "/runs", icon: PlayCircle },
  { label: "Logs", href: "/logs", icon: ScrollText },
  { label: "Skills", href: "/skills", icon: Wrench },
  { label: "Folders", href: "/folders", icon: FolderGit2 },
  { label: "MCP", href: "/mcp", icon: Plug },
  { label: "Config", href: "/config", icon: Settings },
  { label: "System", href: "/system", icon: Server },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const runStatus = useRunStore((s) => s.status);

  // Read persisted state from localStorage after mount. Kept in an effect
  // (rather than a lazy useState initializer) so server and client render the
  // same default and avoid a hydration mismatch; localStorage is client-only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  return (
    <nav
      className={clsx(
        "flex h-full shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] dark:border-zinc-800 dark:bg-zinc-900",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800">
        {!collapsed && (
          <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            AgentOS
          </span>
        )}
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={clsx(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium uppercase tracking-wide transition-colors",
                  isActive
                    ? "bg-zinc-100 text-indigo-600 dark:bg-zinc-800 dark:text-indigo-400"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate text-xs">{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {collapsed ? (
          <div title={`Connector: Mock · Run: ${runStatus}`} className="flex justify-center">
            <NodeStatusBadge status={runStatus} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>Connector</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Mock</span>
            </div>
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>Run</span>
              <NodeStatusBadge status={runStatus} />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
