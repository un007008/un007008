import Link from "next/link";

import { LeadsTrendChart, StageChart } from "@/components/dashboard/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/lead-labels";

export const dynamic = "force-dynamic";

function thb(n: number) {
  return n.toLocaleString("th-TH");
}

export default async function AdminDashboardPage() {
  const session = await auth();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [saleDeals, rentDeals, newLeadsThisMonth, stageCounts, recentLeads] =
    await Promise.all([
      prisma.deal.aggregate({
        _sum: { amount: true },
        where: { dealType: "SALE", status: "COMPLETED", createdAt: { gte: monthStart } },
      }),
      prisma.deal.aggregate({
        _sum: { amount: true },
        where: { dealType: "RENT", status: { in: ["SIGNED", "COMPLETED"] }, createdAt: { gte: monthStart } },
      }),
      prisma.lead.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.lead.groupBy({ by: ["stage"], _count: true }),
      prisma.lead.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        select: { createdAt: true },
      }),
    ]);

  // leads per day, last 30 days
  const trend: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000);
    const key = day.toISOString().slice(0, 10);
    trend.push({
      date: `${day.getDate()}/${day.getMonth() + 1}`,
      count: recentLeads.filter((l) => l.createdAt.toISOString().slice(0, 10) === key).length,
    });
  }

  const stageData = Object.entries(STAGE_LABEL).map(([stage, label]) => ({
    stage: label,
    count: stageCounts.find((s) => s.stage === stage)?._count ?? 0,
  }));

  // alerts: expiring rental contracts (30d) + stale leads (7d)
  const now = new Date();
  const [expiring, staleLeads, topViewed] = await Promise.all([
    prisma.deal.findMany({
      where: {
        dealType: "RENT",
        status: { in: ["SIGNED", "COMPLETED"] },
        contractEnd: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) },
      },
      include: { lead: { include: { contact: true } } },
      orderBy: { contractEnd: "asc" },
      take: 10,
    }),
    prisma.lead.findMany({
      where: {
        updatedAt: { lt: new Date(Date.now() - 7 * 86400000) },
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
      include: { contact: true },
      orderBy: { updatedAt: "asc" },
      take: 10,
    }),
    prisma.appointment.groupBy({
      by: ["propertyId"],
      _count: true,
      orderBy: { _count: { propertyId: "desc" } },
      take: 5,
    }),
  ]);

  const topProps = topViewed.length
    ? await prisma.property.findMany({
        where: { id: { in: topViewed.map((t) => t.propertyId) } },
        select: { id: true, refCode: true, title: true },
      })
    : [];
  const propInfo = new Map(topProps.map((p) => [p.id, p]));

  const stats = [
    { label: "ยอดขายเดือนนี้ (จบดีล)", value: `${thb(Number(saleDeals._sum.amount ?? 0))} บ.` },
    { label: "ค่าเช่าเดือนนี้ (เซ็นแล้ว)", value: `${thb(Number(rentDeals._sum.amount ?? 0))} บ.` },
    { label: "Lead ใหม่เดือนนี้", value: String(newLeadsThisMonth) },
    {
      label: "Lead ที่ยังเปิดอยู่",
      value: String(
        stageCounts
          .filter((s) => !["CLOSED_WON", "CLOSED_LOST"].includes(s.stage))
          .reduce((sum, s) => sum + s._count, 0)
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">สวัสดี {session?.user.name} 👋</h1>
          <p className="text-sm text-muted-foreground">ภาพรวมธุรกิจ ณ ตอนนี้</p>
        </div>
        {session?.user.role === "ADMIN" && (
          <div className="flex gap-2 text-sm">
            <a href="/api/admin/export/leads" className="rounded-md border px-3 py-1.5 hover:bg-accent">
              ⬇ Leads CSV
            </a>
            <a href="/api/admin/export/deals" className="rounded-md border px-3 py-1.5 hover:bg-accent">
              ⬇ Deals CSV
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs">{s.label}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CardTitle className="text-xl">{s.value}</CardTitle>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Lead ตามขั้นตอน (conversion)</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <StageChart data={stageData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Lead ใหม่ 30 วันล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <LeadsTrendChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">⏰ สัญญาเช่าใกล้หมด (30 วัน)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
            {expiring.length === 0 && <p className="text-xs text-muted-foreground">ไม่มี</p>}
            {expiring.map((d) => {
              const days = Math.ceil((d.contractEnd!.getTime() - now.getTime()) / 86400000);
              return (
                <Link key={d.id} href={`/admin/leads/${d.leadId}`} className="block hover:underline">
                  {days <= 7 ? "🔴" : "🟡"} {d.lead.contact.name ?? "ไม่ระบุ"} — อีก {days} วัน
                </Link>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">💤 Lead เงียบเกิน 7 วัน</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
            {staleLeads.length === 0 && <p className="text-xs text-muted-foreground">ไม่มี</p>}
            {staleLeads.map((l) => (
              <Link key={l.id} href={`/admin/leads/${l.id}`} className="block hover:underline">
                • {l.contact.name ?? "ไม่ระบุ"} ({STAGE_LABEL[l.stage]}) —{" "}
                {Math.floor((Date.now() - l.updatedAt.getTime()) / 86400000)} วัน
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">🏆 ทรัพย์ที่ถูกนัดชมมากสุด</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 p-4 pt-0 text-sm">
            {topViewed.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีนัดชม</p>}
            {topViewed.map((t) => {
              const p = propInfo.get(t.propertyId);
              return (
                <Link key={t.propertyId} href={p ? `/admin/properties/${p.id}` : "#"} className="block hover:underline">
                  {p?.refCode ?? "?"} — {t._count} นัด
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
