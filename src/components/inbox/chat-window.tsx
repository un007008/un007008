"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { STATUS_BADGE } from "./conversation-list";
import { PropertyPicker } from "./property-picker";
import type { ChatMessage, ConversationSummary } from "./types";

export function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  onSendProperty,
  onAction,
  onBack,
  onToggleInfo,
}: {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  onSendMessage: (content: string) => Promise<void>;
  onSendProperty: (propertyId: string) => Promise<void>;
  onAction: (action: "ai_takeover" | "close" | "assign_me") => Promise<void>;
  onBack: () => void;
  onToggleInfo: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await onSendMessage(content);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  const badge = STATUS_BADGE[conversation.status];

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button onClick={onBack} className="md:hidden" aria-label="กลับ">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {conversation.contact.name ?? "ลูกค้า LINE"}
            </span>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {conversation.status !== "AI_HANDLING" && conversation.status !== "CLOSED" && (
            <Button size="sm" variant="outline" onClick={() => onAction("ai_takeover")}>
              ให้ AI ตอบต่อ
            </Button>
          )}
          {conversation.status !== "CLOSED" ? (
            <Button size="sm" variant="outline" onClick={() => onAction("close")}>
              ปิดเคส
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onAction("assign_me")}>
              เปิดเคสอีกครั้ง
            </Button>
          )}
          <button
            onClick={onToggleInfo}
            className="rounded-md px-2 py-1 text-sm hover:bg-accent lg:hidden"
            aria-label="ข้อมูลลูกค้า"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
        {messages.map((m) => {
          const mine = m.direction === "OUTBOUND";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                  mine
                    ? m.sender === "AI"
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground"
                    : "bg-background"
                )}
              >
                {m.contentType === "property_card" && <span className="mr-1">🏠</span>}
                <span className="whitespace-pre-wrap break-words">{m.content}</span>
                <div
                  className={cn(
                    "mt-0.5 text-[10px]",
                    mine ? "text-white/70" : "text-muted-foreground"
                  )}
                >
                  {m.sender === "AI" ? "AI · " : m.sender === "STAFF" ? "ทีม · " : ""}
                  {new Date(m.createdAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="relative border-t p-2">
        {showPicker && (
          <PropertyPicker
            onSelect={async (id) => {
              setShowPicker(false);
              await onSendProperty(id);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
        <div className="flex items-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPicker((v) => !v)}
            title="ส่งการ์ดทรัพย์"
          >
            🏠 ส่งทรัพย์
          </Button>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="พิมพ์ข้อความตอบลูกค้า… (Enter เพื่อส่ง)"
            className="min-h-[40px] flex-1 resize-none"
            rows={1}
          />
          <Button onClick={() => void send()} disabled={sending || !draft.trim()}>
            ส่ง
          </Button>
        </div>
      </div>
    </div>
  );
}
