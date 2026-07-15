import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { STAGE_LABEL } from "@/lib/lead-labels";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  // BOM so Excel opens Thai text correctly
  return "﻿" + rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/** GET /api/admin/export/leads | /api/admin/export/deals */
export async function GET(
  _req: NextRequest,
  { params }: { params: { type: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
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
