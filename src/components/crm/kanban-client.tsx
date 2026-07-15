"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { STAGE_LABEL } from "@/lib/lead-labels";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type KanbanLead = {
  id: string;
  stage: string;
  interest: string | null;
  source: string;
  budgetMax: string | null;
  propertyRef: string | null;
  contactName: string | null;
  contactPhone: string | null;
  assignedName: string | null;
};

const STAGES = Object.keys(STAGE_LABEL);

const STAGE_COLOR: Record<string, string> = {
  NEW: "border-t-blue-400",
  CONTACTED: "border-t-cyan-400",
  QUALIFIED: "border-t-teal-400",
  VIEWING_SCHEDULED: "border-t-amber-400",
  VIEWED: "border-t-orange-400",
  OFFER: "border-t-purple-400",
  CLOSED_WON: "border-t-emerald-500",
  CLOSED_LOST: "border-t-zinc-400",
};

function LeadCard({ lead }: { lead: KanbanLead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "space-y-1 rounded-lg border bg-background p-2.5 shadow-sm",
        isDragging && "z-30 opacity-90 shadow-lg"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/admin/leads/${lead.id}`}
          className="min-w-0 text-sm font-medium hover:underline"
        >
          {lead.contactName ?? "ไม่ระบุชื่อ"}
        </Link>
        <button
          className="shrink-0 cursor-grab touch-none px-1 text-muted-foreground"
          aria-label="ลาก"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {lead.contactPhone ?? "—"}
        {lead.interest && (
          <span
            className={cn(
              "ml-1.5 rounded px-1 py-0.5 text-[10px]",
              lead.interest === "SALE" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
            )}
          >
            {lead.interest === "SALE" ? "ซื้อ" : "เช่า"}
          </span>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {[
          lead.propertyRef,
          lead.budgetMax != null && `≤ ${Number(lead.budgetMax).toLocaleString("th-TH")} บ.`,
          lead.assignedName,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

function Column({ stage, leads }: { stage: string; leads: KanbanLead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/40",
        STAGE_COLOR[stage],
        isOver && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-2">
        <span className="text-xs font-semibold">{STAGE_LABEL[stage]}</span>
        <span className="rounded-full bg-background px-1.5 text-xs text-muted-foreground">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 pt-0">
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} />
        ))}
      </div>
    </div>
  );
}

export function KanbanClient({ initialLeads }: { initialLeads: KanbanLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [q, setQ] = useState("");
  const [interest, setInterest] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (interest && l.interest !== interest) return false;
      if (!query) return true;
      return (
        (l.contactName ?? "").toLowerCase().includes(query) ||
        (l.contactPhone ?? "").includes(query) ||
        (l.propertyRef ?? "").toLowerCase().includes(query)
      );
    });
  }, [leads, q, interest]);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const leadId = String(active.id);
    const newStage = String(over.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === newStage || !STAGES.includes(newStage)) return;

    const prev = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    if (!res.ok) setLeads(prev); // roll back on failure
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ / เบอร์ / รหัสทรัพย์…"
          className="h-9 w-full sm:w-64"
        />
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">ซื้อ/เช่า: ทั้งหมด</option>
          <option value="SALE">ซื้อ</option>
          <option value="RENT">เช่า</option>
        </select>
        <span className="text-xs text-muted-foreground">
          ลากการ์ดเพื่อเปลี่ยนสถานะ (บนมือถือ: เข้าไปเปลี่ยนในการ์ด)
        </span>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex h-[calc(100dvh-14rem)] gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <Column key={stage} stage={stage} leads={filtered.filter((l) => l.stage === stage)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
