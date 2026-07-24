import Link from "next/link";

import { fmtMoney, incomeSign } from "@/lib/accounting";
import { getCompanyProfile } from "@/lib/company";
import { bangkokDayKey, fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "รายงานภาษี — PropOS" };

type Row = {
  id: string;
  docNumber: string;
  issueDate: Date;
  contactName: string;
  taxId: string | null;
  branch: string | null;
  base: number; // subtotal - discount
  vat: number;
  wht: number;
};

function monthShift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function thMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function TaxTable({ title, rows, vatLabel }: { title: string; rows: Row[]; vatLabel: string }) {
  const totalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalVat = rows.reduce((s, r) => s + r.vat, 0);
  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">วันที่</th>
              <th className="p-2 font-medium">เลขเอกสาร</th>
              <th className="p-2 font-medium">ผู้ติดต่อ</th>
              <th className="p-2 font-medium">เลขผู้เสียภาษี</th>
              <th className="p-2 text-right font-medium">มูลค่าฐานภาษี</th>
              <th className="p-2 text-right font-medium">{vatLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-b-0">
                <td className="p-2 whitespace-nowrap">{fmtBangkokDate(r.issueDate)}</td>
                <td className="p-2 whitespace-nowrap">
                  <Link className="underline print:no-underline" href={`/admin/accounting/documents/${r.id}`}>
                    {r.docNumber}
                  </Link>
                </td>
                <td className="p-2">{r.contactName}</td>
                <td className="p-2 whitespace-nowrap">
                  {r.taxId ? `${r.taxId}${r.branch ? ` (${r.branch})` : ""}` : "—"}
                </td>
                <td className="p-2 text-right">{fmtMoney(r.base)}</td>
                <td className="p-2 text-right">{fmtMoney(r.vat)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  ไม่มีรายการในเดือนนี้
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/30 font-semibold">
              <td colSpan={4} className="p-2">
                รวม ({rows.length} รายการ)
              </td>
              <td className="p-2 text-right">{fmtMoney(totalBase)}</td>
              <td className="p-2 text-right">{fmtMoney(totalVat)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const currentYm = bangkokDayKey(new Date()).slice(0, 7);
  const ym = /^\d{4}-\d{2}$/.test(searchParams.m ?? "") ? searchParams.m! : currentYm;
  const monthStart = new Date(`${ym}-01T00:00:00+07:00`);
  const nextMonthStart = new Date(`${monthShift(ym, 1)}-01T00:00:00+07:00`);

  const [docs, company] = await Promise.all([
    prisma.accDocument.findMany({
      where: {
        status: { in: ["AWAITING_PAYMENT", "PAID"] },
        issueDate: { gte: monthStart, lt: nextMonthStart },
      },
      orderBy: { issueDate: "asc" },
      include: { contact: { select: { name: true, taxId: true, branch: true } } },
    }),
    getCompanyProfile(),
  ]);

  const toRow = (d: (typeof docs)[number], sign = 1): Row => ({
    id: d.id,
    docNumber: d.docNumber,
    issueDate: d.issueDate,
    contactName: d.contact.name,
    taxId: d.contact.taxId,
    branch: d.contact.branch,
    base: sign * (Number(d.subtotal) - Number(d.discount)),
    vat: sign * Number(d.vatAmount),
    wht: Number(d.whtAmount),
  });

  // Sales VAT: invoices + standalone receipts + debit notes, minus credit notes
  const salesRows = docs
    .filter((d) => incomeSign(d) !== 0 && Number(d.vatAmount) > 0)
    .map((d) => toRow(d, incomeSign(d)));
  // Purchase VAT: expenses
  const purchaseRows = docs
    .filter((d) => d.docType === "EXPENSE" && Number(d.vatAmount) > 0)
    .map(toRow);
  // Withholding tax deducted from expense payments (we are the payer)
  const whtRows = docs
    .filter((d) => d.docType === "EXPENSE" && Number(d.whtAmount) > 0)
    .map(toRow);

  const salesVat = salesRows.reduce((s, r) => s + r.vat, 0);
  const purchaseVat = purchaseRows.reduce((s, r) => s + r.vat, 0);
  const whtTotal = whtRows.reduce((s, r) => s + r.wht, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-semibold">รายงานภาษีรายเดือน</h1>
        <div className="flex items-center gap-1.5 text-sm">
          <Link
            href={`/admin/accounting/tax?m=${monthShift(ym, -1)}`}
            className="rounded-md border px-2.5 py-1.5 hover:bg-accent"
          >
            ← เดือนก่อน
          </Link>
          <span className="px-1 font-medium">{thMonthLabel(ym)}</span>
          {ym < currentYm && (
            <Link
              href={`/admin/accounting/tax?m=${monthShift(ym, 1)}`}
              className="rounded-md border px-2.5 py-1.5 hover:bg-accent"
            >
              เดือนถัดไป →
            </Link>
          )}
        </div>
      </div>

      <div className="hidden print:block">
        <p className="font-semibold">{company.name || "รายงานภาษี"}</p>
        {company.taxId && <p className="text-sm">เลขผู้เสียภาษี {company.taxId}</p>}
        <p className="text-sm">รายงานภาษีประจำเดือน {thMonthLabel(ym)}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">ภาษีขาย</p>
          <p className="font-semibold text-emerald-700">฿{fmtMoney(salesVat)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">ภาษีซื้อ</p>
          <p className="font-semibold text-red-700">฿{fmtMoney(purchaseVat)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            VAT {salesVat - purchaseVat >= 0 ? "ต้องชำระ" : "ขอคืน/ยกไป"} (ภ.พ.30)
          </p>
          <p className="font-semibold">฿{fmtMoney(Math.abs(salesVat - purchaseVat))}</p>
        </div>
      </div>

      <TaxTable title="ภาษีขาย (เอกสารรายได้ที่ออกเดือนนี้)" rows={salesRows} vatLabel="ภาษีขาย" />
      <TaxTable title="ภาษีซื้อ (ค่าใช้จ่ายเดือนนี้)" rows={purchaseRows} vatLabel="ภาษีซื้อ" />

      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold">
          หัก ณ ที่จ่าย (ที่กิจการหักจากคู่ค้า) — รวม ฿{fmtMoney(whtTotal)}
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">วันที่</th>
                <th className="p-2 font-medium">เลขเอกสาร</th>
                <th className="p-2 font-medium">ผู้ถูกหัก</th>
                <th className="p-2 font-medium">เลขผู้เสียภาษี</th>
                <th className="p-2 text-right font-medium">ยอดหัก</th>
              </tr>
            </thead>
            <tbody>
              {whtRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="p-2 whitespace-nowrap">{fmtBangkokDate(r.issueDate)}</td>
                  <td className="p-2 whitespace-nowrap">
                    <Link className="underline print:no-underline" href={`/admin/accounting/documents/${r.id}`}>
                      {r.docNumber}
                    </Link>
                  </td>
                  <td className="p-2">{r.contactName}</td>
                  <td className="p-2 whitespace-nowrap">{r.taxId ?? "—"}</td>
                  <td className="p-2 text-right">{fmtMoney(r.wht)}</td>
                </tr>
              ))}
              {whtRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    ไม่มีรายการในเดือนนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        * ตัวเลขนี้ใช้ประกอบการยื่น ภ.พ.30 / ภ.ง.ด. เท่านั้น กรุณาตรวจสอบกับนักบัญชีก่อนยื่นจริง
      </p>
    </div>
  );
}
