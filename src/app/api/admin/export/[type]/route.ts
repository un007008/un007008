import { NextRequest, NextResponse } from "next/server";

import { docStatusLabel, DOC_TYPE_LABEL, incomeSign } from "@/lib/accounting";
import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/lead-labels";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  let s = v == null ? "" : String(v);
  // neutralize spreadsheet formula injection (names/notes are user-controlled)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  // BOM so Excel opens Thai text correctly
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** GET /api/admin/export/leads | deals | accounting | tax?m=YYYY-MM */
export async function GET(
  req: NextRequest,
  { params }: { params: { type: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // accounting exports are open to ACCOUNTANT; CRM exports stay ADMIN-only
  const accountingExport = params.type === "accounting" || params.type === "tax";
  const allowed = accountingExport
    ? isAccountingRole(session.user.role)
    : session.user.role === "ADMIN";
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let csv: string;
  if (params.type === "leads") {
    const leads = await prisma.lead.findMany({
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    });
    const users = new Map(
      (await prisma.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name])
    );
    csv = toCsv([
      ["วันที่สร้าง", "ชื่อลูกค้า", "เบอร์โทร", "ที่มา", "สถานะ", "สนใจ", "งบต่ำสุด", "งบสูงสุด", "ผู้ดูแล", "โน้ต"],
      ...leads.map((l) => [
        l.createdAt.toISOString().slice(0, 10),
        l.contact.name,
        l.contact.phone,
        l.source,
        STAGE_LABEL[l.stage] ?? l.stage,
        l.interest === "SALE" ? "ซื้อ" : l.interest === "RENT" ? "เช่า" : "",
        l.budgetMin?.toString(),
        l.budgetMax?.toString(),
        l.assignedTo ? users.get(l.assignedTo) : "",
        l.note,
      ]),
    ]);
  } else if (params.type === "deals") {
    const deals = await prisma.deal.findMany({
      include: { lead: { include: { contact: true } } },
      orderBy: { createdAt: "desc" },
    });
    const propertyRef = new Map(
      (
        await prisma.property.findMany({
          where: { id: { in: Array.from(new Set(deals.map((d) => d.propertyId))) } },
          select: { id: true, refCode: true },
        })
      ).map((p) => [p.id, p.refCode])
    );
    csv = toCsv([
      ["วันที่สร้าง", "ลูกค้า", "ทรัพย์", "ประเภท", "มูลค่า", "สถานะ", "เริ่มสัญญา", "สิ้นสุดสัญญา"],
      ...deals.map((d) => [
        d.createdAt.toISOString().slice(0, 10),
        d.lead.contact.name,
        propertyRef.get(d.propertyId),
        d.dealType === "SALE" ? "ขาย" : "เช่า",
        d.amount.toString(),
        d.status,
        d.contractStart?.toISOString().slice(0, 10),
        d.contractEnd?.toISOString().slice(0, 10),
      ]),
    ]);
  } else if (params.type === "accounting") {
    const docs = await prisma.accDocument.findMany({
      include: { contact: { select: { name: true, taxId: true } } },
      orderBy: { issueDate: "desc" },
    });
    csv = toCsv([
      [
        "เลขเอกสาร",
        "ประเภท",
        "สถานะ",
        "วันที่เอกสาร",
        "ครบกำหนด",
        "ผู้ติดต่อ",
        "เลขผู้เสียภาษี",
        "มูลค่าก่อน VAT",
        "VAT",
        "ยอดรวม",
        "หัก ณ ที่จ่าย",
        "ยอดสุทธิ",
        "วันที่ชำระ",
        "ช่องทางชำระ",
        "หมายเหตุ",
      ],
      ...docs.map((d) => [
        d.docNumber,
        DOC_TYPE_LABEL[d.docType],
        docStatusLabel(d.docType, d.status),
        bangkokDayKey(d.issueDate),
        d.dueDate ? bangkokDayKey(d.dueDate) : "",
        d.contact.name,
        d.contact.taxId,
        (Number(d.subtotal) - Number(d.discount)).toFixed(2),
        Number(d.vatAmount).toFixed(2),
        Number(d.total).toFixed(2),
        Number(d.whtAmount).toFixed(2),
        (Number(d.total) - Number(d.whtAmount)).toFixed(2),
        d.paidAt ? bangkokDayKey(d.paidAt) : "",
        d.paymentMethod,
        d.note,
      ]),
    ]);
  } else if (params.type === "tax") {
    const m = req.nextUrl.searchParams.get("m") ?? "";
    const ym = /^\d{4}-\d{2}$/.test(m) ? m : bangkokDayKey(new Date()).slice(0, 7);
    const [y, mo] = ym.split("-").map(Number);
    const monthStart = new Date(`${ym}-01T00:00:00+07:00`);
    const nextYm = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    const nextMonthStart = new Date(`${nextYm}-01T00:00:00+07:00`);

    const docs = await prisma.accDocument.findMany({
      where: {
        status: { in: ["AWAITING_PAYMENT", "PAID"] },
        issueDate: { gte: monthStart, lt: nextMonthStart },
      },
      orderBy: { issueDate: "asc" },
      include: { contact: { select: { name: true, taxId: true, branch: true } } },
    });

    const rows: unknown[][] = [];
    for (const d of docs) {
      const base = Number(d.subtotal) - Number(d.discount);
      const sign = incomeSign(d);
      const sections: [string, number][] = [];
      if (sign !== 0 && Number(d.vatAmount) > 0) sections.push(["ภาษีขาย", sign]);
      if (d.docType === "EXPENSE" && Number(d.vatAmount) > 0) sections.push(["ภาษีซื้อ", 1]);
      if (d.docType === "EXPENSE" && Number(d.whtAmount) > 0) sections.push(["หัก ณ ที่จ่าย", 1]);
      for (const [section, s] of sections) {
        rows.push([
          section,
          bangkokDayKey(d.issueDate),
          d.docNumber,
          DOC_TYPE_LABEL[d.docType],
          d.contact.name,
          d.contact.taxId ? `${d.contact.taxId}${d.contact.branch ? ` (${d.contact.branch})` : ""}` : "",
          (s * base).toFixed(2),
          section === "หัก ณ ที่จ่าย" ? "" : (s * Number(d.vatAmount)).toFixed(2),
          section === "หัก ณ ที่จ่าย" ? Number(d.whtAmount).toFixed(2) : "",
        ]);
      }
    }
    csv = toCsv([
      [
        "รายงาน",
        "วันที่",
        "เลขเอกสาร",
        "ประเภทเอกสาร",
        "ผู้ติดต่อ",
        "เลขผู้เสียภาษี",
        "ฐานภาษี",
        "VAT",
        "หัก ณ ที่จ่าย",
      ],
      ...rows,
    ]);
  } else {
    return NextResponse.json({ error: "unknown export type" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${params.type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
