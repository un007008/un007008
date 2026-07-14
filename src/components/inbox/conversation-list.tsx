"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ConversationSummary, InboxFilter } from "./types";

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "mine", label: "ของฉัน" },
  { key: "unassigned", label: "ยังไม่มอบหมาย" },
  { key: "ai", label: "AI กำลังตอบ" },
];

export const STATUS_BADGE: Record<
  ConversationSummary["status"],
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  AI_HANDLING: { label: "AI ตอบ", variant: "success" },
  HUMAN_HANDLING: { label: "รอเจ้าหน้าที่", variant: "warning" },
  CLOSED: { label: "ปิดแล้ว", variant: "secondary" },
};

export function ConversationList({
  conversations,
  filter,
  selectedId,
  onFilterChange,
  onSelect,
}: {
  conversations: ConversationSummary[];
  filter: InboxFilter;
  selectedId: string | null;
  onFilterChange: (f: InboxFilter) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 overflow-x-auto border-b p-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 text-xs",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            ไม่มีบทสนทนา
          </p>
        )}
        {conversations.map((c) => {
          const badge = STATUS_BADGE[c.status];
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-accent",
                selectedId === c.id && "bg-accent"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {c.contact.name ?? "ลูกค้า LINE"}
                </span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">
                  {c.lastMessage
                    ? `${c.lastMessage.sender === "CUSTOMER" ? "" : c.lastMessage.sender === "AI" ? "AI: " : "ทีม: "}${c.lastMessage.content}`
                    : "—"}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(c.updatedAt).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
