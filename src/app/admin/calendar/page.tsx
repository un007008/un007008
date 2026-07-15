import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "ปฏิทินนัดชม — PropOS" };
export const dynamic = "force-dynamic";

const APPT_BADGE: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  SCHEDULED: { label: "นัดแล้ว", variant: "warning" },
  DONE: { label: "ชมแล้ว", variant: "success" },
  CANCELLED: { label: "ยกเลิก", variant: "secondary" },
  NO_SHOW: { label: "ไม่มา", variant: "destructive" },
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DOW = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/calendar");

  // month from ?m=YYYY-MM, default current
  const now = new Date();
  const [yearStr, monthStr] = (searchParams.m ?? "").split("-");
  const year = Number(yearStr) || now.getFullYear();
  const month = (Number(monthStr) || now.getMonth() + 1) - 1; // 0-based

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      datetime: { gte: monthStart, lt: monthEnd },
      ...(session.user.role === "ADMIN" ? {} : { lead: { assignedTo: session.user.id } }),
    },
    include: { lead: { include: { contact: true } } },
    orderBy: { datetime: "asc" },
  });

  const propertyIds = Array.from(new Set(appointments.map((a) => a.propertyId)));
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, refCode: true },
      })
    : [];
  const propertyRef = new Map(properties.map((p) => [p.id, p.refCode]));

  // group by day
  const byDay = new Map<number, typeof appointments>();
  for (const a of appointments) {
    const day = a.datetime.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (monthStart.getDay() + 6) % 7; // Monday = 0
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const today =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          ปฏิทินนัดชม — {THAI_MONTHS[month]} {year + 543}
        </h1>
        <div className="flex gap-1">
          <Link href={`/admin/calendar?m=${fmt(prev)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            ←
          </Link>
          <Link href="/admin/calendar" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            วันนี้
          </Link>
          <Link href={`/admin/calendar?m=${fmt(next)}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            →
          </Link>
        </div>
      </div>

      {/* month grid — desktop */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {THAI_DOW.map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`min-h-20 rounded-md border p-1 text-xs ${day === today ? "border-primary bg-amber-50" : ""} ${day == null ? "border-transparent" : ""}`}
            >
              {day && (
                <>
                  <div className="font-medium">{day}</div>
                  {(byDay.get(day) ?? []).map((a) => (
                    <Link
                      key={a.id}
                      href={`/admin/leads/${a.leadId}`}
                      className={`mt-0.5 block truncate rounded px-1 py-0.5 ${a.status === "CANCELLED" || a.status === "NO_SHOW" ? "bg-zinc-100 text-zinc-500 line-through" : a.status === "DONE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
                    >
                      {a.datetime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}{" "}
                      {a.lead.contact.name ?? "ลูกค้า"}
                    </Link>
                  ))}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* list — mobile + detail */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground md:hidden">รายการนัดเดือนนี้</p>
        {appointments.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ไม่มีนัดในเดือนนี้
          </p>
        )}
        {appointments.map((a) => {
          const badge = APPT_BADGE[a.status] ?? APPT_BADGE.SCHEDULED;
          return (
            <Link
              key={a.id}
              href={`/admin/leads/${a.leadId}`}
              className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {a.datetime.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.lead.contact.name ?? "ลูกค้า"} · {propertyRef.get(a.propertyId) ?? "—"}
                  {a.note && ` · ${a.note}`}
                </p>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
