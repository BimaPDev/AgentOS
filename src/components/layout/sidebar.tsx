"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  MessagesSquare,
  PlayCircle,
  ScrollText,
  Wrench,
  Plug,
  Settings,
  Server,
  FolderGit2,
  FolderOpen,
  Cpu,
  Clock3,
  Puzzle,
  Radio,
  Webhook,
  ShieldCheck,
  Users,
  KeyRound,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Hermes",
    items: [
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Sessions", href: "/sessions", icon: MessagesSquare },
      { label: "Files", href: "/files", icon: FolderOpen },
      { label: "Models", href: "/models", icon: Cpu },
      { label: "Logs", href: "/hermes/logs", icon: ScrollText },
      { label: "Cron", href: "/hermes/cron", icon: Clock3 },
      { label: "Skills", href: "/skills", icon: Wrench },
      { label: "Plugins", href: "/hermes/plugins", icon: Puzzle },
      { label: "MCP", href: "/mcp", icon: Plug },
      { label: "Channels", href: "/hermes/channels", icon: Radio },
      { label: "Webhooks", href: "/hermes/webhooks", icon: Webhook },
      { label: "Pairing", href: "/hermes/pairing", icon: ShieldCheck },
      { label: "Profiles", href: "/hermes/profiles", icon: Users },
      { label: "Config", href: "/hermes/config", icon: Settings },
      { label: "Keys", href: "/hermes/keys", icon: KeyRound },
      { label: "System", href: "/hermes/system", icon: Server },
      { label: "Docs", href: "/hermes/documentation", icon: BookOpen },
    ],
  },
  {
    label: "AgentOS",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Agents", href: "/agents", icon: Bot },
      { label: "Runs", href: "/runs", icon: PlayCircle },
      { label: "Activity", href: "/logs", icon: Activity },
      { label: "Folders", href: "/folders", icon: FolderGit2 },
      { label: "Settings", href: "/config", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const runStatus = useRunStore((s) => s.status);

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

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {group.label}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/") ||
                  (item.href === "/hermes/files" && pathname.startsWith("/hermes/files")) ||
                  (item.href.startsWith("/hermes/") && pathname === item.href);
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
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-zinc-800">
        {collapsed ? (
          <div title={`Run: ${runStatus}`} className="flex justify-center">
            <NodeStatusBadge status={runStatus} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 text-xs">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
              <span>Layer</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Hermes</span>
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
