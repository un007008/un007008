import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, fmtMoney } from "@/lib/accounting";
import { bangkokDayKey, bangkokMonthStart, fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "บัญชี — PropOS" };

const STATUS_VARIANT = {
  DRAFT: "secondary",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  VOID: "destructive",
} as const;

/** Income docs: paid invoices + standalone paid receipts (receipts issued
 *  from an invoice carry refDocId and are excluded to avoid double count). */
const INCOME_WHERE = {
  status: "PAID" as const,
  docType: { in: ["INVOICE", "RECEIPT"] as ("INVOICE" | "RECEIPT")[] },
  refDocId: null,
};

export default async function AccountingDashboardPage() {
  const monthStart = bangkokMonthStart();
  const now = new Date();
  // first day (Bangkok) of the month 5 months ago
  const [y, m] = bangkokDayKey(now).split("-").map(Number);
  const chartStart = new Date(
    `${String(m - 5 <= 0 ? y - 1 : y)}-${String(((m - 6 + 12) % 12) + 1).padStart(2, "0")}-01T00:00:00+07:00`
  );

  const [incomeAgg, expenseAgg, awaitingAgg, draftCount, paidDocs, recentDocs] =
    await Promise.all([
      prisma.accDocument.aggregate({
        _sum: { total: true },
        where: { ...INCOME_WHERE, paidAt: { gte: monthStart } },
      }),
      prisma.accDocument.aggregate({
        _sum: { total: true },
        where: { status: "PAID", docType: "EXPENSE", paidAt: { gte: monthStart } },
      }),
      prisma.accDocument.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: "AWAITING_PAYMENT", docType: "INVOICE" },
      }),
      prisma.accDocument.count({ where: { status: "DRAFT" } }),
      prisma.accDocument.findMany({
        where: { status: "PAID", paidAt: { gte: chartStart } },
        select: { docType: true, refDocId: true, total: true, paidAt: true },
      }),
      prisma.accDocument.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { contact: { select: { name: true } } },
      }),
    ]);

  const income = Number(incomeAgg._sum.total ?? 0);
  const expense = Number(expenseAgg._sum.total ?? 0);
  const awaiting = Number(awaitingAgg._sum.total ?? 0);

  // income vs expense per month, last 6 Bangkok months
  const months: { key: string; label: string; income: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mi = m - 1 - i;
    const yy = mi < 0 ? y - 1 : y;
    const mm = ((mi + 12) % 12) + 1;
    months.push({
      key: `${yy}-${String(mm).padStart(2, "0")}`,
      label: `${mm}/${String(yy + 543).slice(2)}`,
      income: 0,
      expense: 0,
    });
  }
  for (const d of paidDocs) {
    if (!d.paidAt) continue;
    const key = bangkokDayKey(d.paidAt).slice(0, 7);
    const bucket = months.find((mo) => mo.key === key);
    if (!bucket) continue;
    if (d.docType === "EXPENSE") bucket.expense += Number(d.total);
    else if (!d.refDocId && (d.docType === "INVOICE" || d.docType === "RECEIPT"))
      bucket.income += Number(d.total);
  }
  const maxBar = Math.max(1, ...months.flatMap((mo) => [mo.income, mo.expense]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">ภาพรวมบัญชี</h1>
          <p className="text-sm text-muted-foreground">
            รายรับ-รายจ่ายภายในบริษัท (สไตล์ PEAK) — เดือนนี้เริ่ม {fmtBangkokDate(monthStart)}
          </p>
        </div>
        <Link
          href="/admin/accounting/documents/new"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + สร้างเอกสาร
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>รายรับเดือนนี้ (ชำระแล้ว)</CardDescription>
            <CardTitle className="text-xl text-emerald-700">฿{fmtMoney(income)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>รายจ่ายเดือนนี้ (ชำระแล้ว)</CardDescription>
            <CardTitle className="text-xl text-red-700">฿{fmtMoney(expense)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ใบแจ้งหนี้รอชำระ ({awaitingAgg._count} ฉบับ)</CardDescription>
            <CardTitle className="text-xl text-amber-700">฿{fmtMoney(awaiting)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>เอกสารร่าง</CardDescription>
            <CardTitle className="text-xl">{draftCount} ฉบับ</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">รายรับ vs รายจ่าย 6 เดือนล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {months.map((mo) => (
              <div key={mo.key} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{mo.label}</span>
                  <span>
                    รับ ฿{fmtMoney(mo.income)} / จ่าย ฿{fmtMoney(mo.expense)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(mo.income / maxBar) * 100}%` }}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${(mo.expense / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">เอกสารล่าสุด</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {recentDocs.map((d) => (
            <Link
              key={d.id}
              href={`/admin/accounting/documents/${d.id}`}
              className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {d.docNumber}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {DOC_TYPE_LABEL[d.docType]}
                  </span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{d.contact.name}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium">฿{fmtMoney(Number(d.total))}</span>
                <Badge variant={STATUS_VARIANT[d.status]}>{DOC_STATUS_LABEL[d.status]}</Badge>
              </div>
            </Link>
          ))}
          {recentDocs.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              ยังไม่มีเอกสาร — เริ่มจากปุ่ม &quot;สร้างเอกสาร&quot;
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
