import { Suspense } from "react";
import { listHermesChatSessions } from "@/lib/hermes-chat";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ChatClient } from "@/components/chat/chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const initialSessions = await listHermesChatSessions({ limit: 50 });
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Hermes" }, { label: "Chat" }]} />}>
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-zinc-400">Loading chat…</div>}>
        <ChatClient initialSessions={initialSessions} />
      </Suspense>
    </AppShell>
  );
}
