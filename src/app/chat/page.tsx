import { listHermesChatSessions } from "@/lib/hermes-chat";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ChatClient } from "@/components/chat/chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const initialSessions = await listHermesChatSessions({ limit: 50 });
  return (
    <AppShell breadcrumb={<Breadcrumbs items={[{ label: "Chat" }]} />}>
      <ChatClient initialSessions={initialSessions} />
    </AppShell>
  );
}
