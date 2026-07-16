import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  AppointmentForm,
  AppointmentStatusSelect,
} from "@/components/leads/appointment-form";
import { AssignSelect } from "@/components/leads/assign-select";
import { DealSection } from "@/components/leads/deal-section";
import { NoteEditor } from "@/components/leads/note-editor";
import { StageSelect } from "@/components/leads/stage-select";
import { STAGE_LABEL } from "@/lib/lead-labels";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "รายละเอียด Lead — PropOS" };
export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  CHAT: "แชท LINE",
  WEBSITE_FORM: "ฟอร์มเว็บ",
  MANUAL: "เพิ่มเอง",
};

type TimelineItem = { at: Date; icon: string; text: string };

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/admin/leads/${params.id}`);

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      contact: { include: { conversations: { orderBy: { updatedAt: "desc" }, take: 1 } } },
      appointments: { orderBy: { datetime: "desc" } },
      deal: { include: { documents: { orderBy: { createdAt: "desc" } } } },
    },
  });
  if (!lead) notFound();
  if (session.user.role !== "ADMIN" && lead.assignedTo !== session.user.id) {
    return <p className="text-sm text-muted-foreground">Lead นี้ไม่ได้มอบหมายให้คุณ</p>;
  }

  const property = lead.propertyId
    ? await prisma.property.findUnique({ where: { id: lead.propertyId } })
    : null;

  const apptProperties = await prisma.property.findMany({
    where: { id: { in: Array.from(new Set(lead.appointments.map((a) => a.propertyId))) } },
    select: { id: true, refCode: true },
  });
  const apptRef = new Map(apptProperties.map((p) => [p.id, p.refCode]));

  // timeline: lead created + appointments + recent chat messages
  const conversation = lead.contact.conversations[0] ?? null;
  const messages = conversation
    ? await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  const timeline: TimelineItem[] = [
    { at: lead.createdAt, icon: "⭐", text: `สร้าง Lead (${SOURCE_LABEL[lead.source]})` },
    ...lead.appointments.map((a) => ({
      at: a.datetime,
      icon: "📅",
      text: `นัดชม ${apptRef.get(a.propertyId) ?? ""} — ${a.status === "SCHEDULED" ? "นัดแล้ว" : a.status === "DONE" ? "ชมแล้ว" : a.status === "CANCELLED" ? "ยกเลิก" : "ไม่มา"}${a.note ? ` (${a.note})` : ""}`,
    })),
    ...messages.map((m) => ({
      at: m.createdAt,
      icon: m.sender === "CUSTOMER" ? "💬" : m.sender === "AI" ? "🤖" : "🧑‍💼",
      text: m.content.slice(0, 120),
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  function thb(n: unknown) {
    return Number(n).toLocaleString("th-TH");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/leads" className="text-xs text-muted-foreground hover:underline">
            ← ลูกค้ามุ่งหวัง
          </Link>
          <h1 className="text-lg font-semibold">{lead.contact.name ?? "ไม่ระบุชื่อ"}</h1>
          <p className="text-sm text-muted-foreground">
            {lead.contact.phone ?? "—"} · {SOURCE_LABEL[lead.source]}
            {lead.interest && ` · ${lead.interest === "SALE" ? "ซื้อ" : "เช่า"}`}
            {(lead.budgetMin != null || lead.budgetMax != null) &&
              ` · งบ ${lead.budgetMin != null ? thb(lead.budgetMin) : ""}${lead.budgetMin != null && lead.budgetMax != null ? "–" : ""}${lead.budgetMax != null ? thb(lead.budgetMax) : ""} บ.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageSelect leadId={lead.id} stage={lead.stage} />
          <AssignSelect leadId={lead.id} assignedTo={lead.assignedTo} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          {/* property of interest */}
          {property && (
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">ทรัพย์ที่สนใจ</p>
              <Link href={`/admin/properties/${property.id}`} className="text-sm hover:underline">
                {property.refCode} — {(property.title as { th?: string })?.th}
              </Link>
            </div>
          )}

          {/* conversation link */}
          {conversation && (
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">บทสนทนา</p>
              <Link href={`/admin/inbox?c=${conversation.id}`} className="text-sm text-amber-700 hover:underline">
                เปิดแชทในกล่องข้อความ →
              </Link>
            </div>
          )}

          {/* note */}
          <div className="rounded-lg border p-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">โน้ต</p>
            <NoteEditor leadId={lead.id} note={lead.note} />
          </div>

          {/* appointments */}
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">นัดชม</p>
              <AppointmentForm leadId={lead.id} />
            </div>
            {lead.appointments.length === 0 && (
              <p className="text-xs text-muted-foreground">ยังไม่มีนัด</p>
            )}
            {lead.appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">
                    {a.datetime.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {apptRef.get(a.propertyId) ?? "—"}
                    {a.note && ` · ${a.note}`}
                  </div>
                </div>
                <AppointmentStatusSelect appointmentId={a.id} status={a.status} />
              </div>
            ))}
          </div>

          {/* deal */}
          <div className="rounded-lg border p-3">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Deal</p>
            <DealSection
              leadId={lead.id}
              propertyId={lead.propertyId ?? property?.id ?? null}
              defaultDealType={lead.interest === "RENT" ? "RENT" : "SALE"}
              deal={
                lead.deal
                  ? {
                      id: lead.deal.id,
                      dealType: lead.deal.dealType === "RENT" ? "RENT" : "SALE",
                      amount: lead.deal.amount.toString(),
                      status: lead.deal.status,
                      contractStart: lead.deal.contractStart?.toISOString() ?? null,
                      contractEnd: lead.deal.contractEnd?.toISOString() ?? null,
                      documents: lead.deal.documents.map((d) => ({
                        id: d.id,
                        name: d.name,
                        url: d.url,
                      })),
                    }
                  : null
              }
            />
          </div>
        </div>

        {/* timeline */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            ไทม์ไลน์ · สถานะปัจจุบัน: {STAGE_LABEL[lead.stage]}
          </p>
          <div className="space-y-2.5">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span>{item.icon}</span>
                <div className="min-w-0">
                  <p className="break-words">{item.text}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.at.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
