"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { ChatWindow } from "./chat-window";
import { ContactPanel } from "./contact-panel";
import { ConversationList } from "./conversation-list";
import type { ChatMessage, ConversationSummary, InboxFilter } from "./types";

export function InboxClient({ initialSelectedId }: { initialSelectedId?: string | null }) {
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showInfoMobile, setShowInfoMobile] = useState(false);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;
  const filterRef = useRef<InboxFilter>(filter);
  filterRef.current = filter;

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/inbox/conversations?filter=${filterRef.current}`);
    if (res.ok) setConversations(await res.json());
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/inbox/conversations/${conversationId}/messages`);
    if (res.ok) setMessages(await res.json());
  }, []);

  // initial + filter change
  useEffect(() => {
    void loadConversations();
  }, [filter, loadConversations]);

  // selected conversation change
  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // SSE realtime
  useEffect(() => {
    const es = new EventSource("/api/inbox/stream");
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as {
          type: string;
          conversationId: string;
        };
        void loadConversations();
        if (event.type === "message" && event.conversationId === selectedRef.current) {
          void loadMessages(event.conversationId);
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => es.close();
  }, [loadConversations, loadMessages]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  async function sendMessage(content: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const { lineDelivered } = (await res.json()) as { lineDelivered: boolean };
      if (!lineDelivered) {
        console.warn("message saved but LINE delivery failed");
      }
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    }
  }

  async function sendProperty(propertyId: string) {
    if (!selectedId) return;
    await fetch(`/api/inbox/conversations/${selectedId}/send-property`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
    });
    await loadMessages(selectedId);
  }

  async function doAction(action: "ai_takeover" | "close" | "assign_me") {
    if (!selectedId) return;
    await fetch(`/api/inbox/conversations/${selectedId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadConversations();
  }

  return (
    <div className="grid h-[calc(100dvh-7.5rem)] grid-cols-1 overflow-hidden rounded-lg border md:grid-cols-[300px_1fr] lg:grid-cols-[300px_1fr_280px]">
      {/* list — hidden on mobile when a conversation is open */}
      <div className={cn("h-full overflow-hidden border-r", selectedId && "hidden md:block")}>
        <ConversationList
          conversations={conversations}
          filter={filter}
          selectedId={selectedId}
          onFilterChange={setFilter}
          onSelect={(id) => {
            setSelectedId(id);
            setShowInfoMobile(false);
          }}
        />
      </div>

      {/* chat */}
      <div className={cn("h-full overflow-hidden", !selectedId && "hidden md:block")}>
        {selected ? (
          showInfoMobile ? (
            <div className="h-full lg:hidden">
              <div className="flex items-center border-b px-3 py-2">
                <button onClick={() => setShowInfoMobile(false)} className="text-sm">
                  ← กลับไปแชท
                </button>
              </div>
              <ContactPanel contact={selected.contact} onSaved={() => void loadConversations()} />
            </div>
          ) : (
            <ChatWindow
              conversation={selected}
              messages={messages}
              onSendMessage={sendMessage}
              onSendProperty={sendProperty}
              onAction={doAction}
              onBack={() => setSelectedId(null)}
              onToggleInfo={() => setShowInfoMobile(true)}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            เลือกบทสนทนาจากรายการ
          </div>
        )}
      </div>

      {/* contact panel — desktop only */}
      <div className="hidden h-full overflow-hidden border-l lg:block">
        {selected ? (
          <ContactPanel contact={selected.contact} onSaved={() => void loadConversations()} />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">—</div>
        )}
      </div>
    </div>
  );
}
