import Link from "next/link";

import { PrintButton } from "@/components/accounting/print-button";
import { fmtMoney, incomeSign } from "@/lib/accounting";
import { getCompanyProfile } from "@/lib/company";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "งบกำไรขาดทุน — PropOS" };

const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export default async function PnlPage({
  searchParams,
}: {
  searchParams: { y?: string };
}) {
  const currentYear = Number(bangkokDayKey(new Date()).slice(0, 4));
  const year = /^\d{4}$/.test(searchParams.y ?? "") ? Number(searchParams.y) : currentYear;
  const yearStart = new Date(`${year}-01-01T00:00:00+07:00`);
  const nextYearStart = new Date(`${year + 1}-01-01T00:00:00+07:00`);

  const [paidDocs, company] = await Promise.all([
    prisma.accDocument.findMany({
      where: { status: "PAID", paidAt: { gte: yearStart, lt: nextYearStart } },
      select: { docType: true, refDocId: true, total: true, paidAt: true },
    }),
    getCompanyProfile(),
  ]);

  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  for (const d of paidDocs) {
    if (!d.paidAt) continue;
    const m = Number(bangkokDayKey(d.paidAt).slice(5, 7)) - 1;
    if (d.docType === "EXPENSE") months[m].expense += Number(d.total);
    else months[m].income += incomeSign(d) * Number(d.total);
  }
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-semibold">งบกำไรขาดทุนอย่างย่อ (เกณฑ์เงินสด)</h1>
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/admin/accounting/pnl?y=${year - 1}`}
            className="rounded-md border px-2.5 py-1.5 hover:bg-accent"
          >
            ← {year + 543 - 1}
          </Link>
          <span className="px-1 font-medium">ปี {year + 543}</span>
          {year < currentYear && (
            <Link
              href={`/admin/accounting/pnl?y=${year + 1}`}
              className="rounded-md border px-2.5 py-1.5 hover:bg-accent"
            >
              {year + 543 + 1} →
            </Link>
          )}
          <PrintButton />
        </div>
      </div>

      <div className="hidden print:block">
        <p className="font-semibold">{company.name || "งบกำไรขาดทุน"}</p>
        <p className="text-sm">งบกำไรขาดทุนอย่างย่อ (เกณฑ์เงินสด) ประจำปี {year + 543}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">รายรับรวมทั้งปี</p>
          <p className="font-semibold text-emerald-700">฿{fmtMoney(totalIncome)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">รายจ่ายรวมทั้งปี</p>
          <p className="font-semibold text-red-700">฿{fmtMoney(totalExpense)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">{net >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}</p>
          <p className={cn("font-semibold", net >= 0 ? "text-emerald-700" : "text-red-700")}>
            ฿{fmtMoney(Math.abs(net))}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">เดือน</th>
              <th className="p-2 text-right font-medium">รายรับ</th>
              <th className="p-2 text-right font-medium">รายจ่าย</th>
              <th className="p-2 text-right font-medium">กำไร/ขาดทุน</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => {
              const monthNet = m.income - m.expense;
              return (
                <tr key={i} className="border-b last:border-b-0">
                  <td className="p-2">
                    {TH_MONTHS[i]} {year + 543}
                  </td>
                  <td className="p-2 text-right">{fmtMoney(m.income)}</td>
                  <td className="p-2 text-right">{fmtMoney(m.expense)}</td>
                  <td
                    className={cn(
                      "p-2 text-right",
                      monthNet > 0 && "text-emerald-700",
                      monthNet < 0 && "text-red-700"
                    )}
                  >
                    {fmtMoney(monthNet)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td className="p-2">รวมทั้งปี</td>
              <td className="p-2 text-right">{fmtMoney(totalIncome)}</td>
              <td className="p-2 text-right">{fmtMoney(totalExpense)}</td>
              <td
                className={cn("p-2 text-right", net >= 0 ? "text-emerald-700" : "text-red-700")}
              >
                {fmtMoney(net)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        * นับตามวันที่ชำระจริง (เกณฑ์เงินสด) — รายรับหักใบลดหนี้/รวมใบเพิ่มหนี้แล้ว
        ใช้ดูภาพรวมภายใน ไม่ใช่งบการเงินตามมาตรฐานบัญชี
      </p>
    </div>
  );
}
