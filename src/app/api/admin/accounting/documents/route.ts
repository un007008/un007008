import { NextRequest, NextResponse } from "next/server";
import type { AccDocStatus, AccDocType, Prisma } from "@prisma/client";

import { calcTotals, DOC_TYPE_PREFIX } from "@/lib/accounting";
import { apiSession } from "@/lib/api-auth";
import { bangkokDayKey, parseAsBangkok } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DOC_TYPES = [
  "QUOTATION",
  "INVOICE",
  "RECEIPT",
  "EXPENSE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const;
const STATUSES = ["DRAFT", "AWAITING_PAYMENT", "PAID", "VOID"] as const;

export async function GET(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const where: Prisma.AccDocumentWhereInput = {};
  const docType = sp.get("docType");
  if (docType && DOC_TYPES.includes(docType as AccDocType)) where.docType = docType as AccDocType;
  const status = sp.get("status");
  if (status && STATUSES.includes(status as AccDocStatus)) where.status = status as AccDocStatus;
  const q = sp.get("q")?.trim();
  if (q) {
    where.OR = [
      { docNumber: { contains: q, mode: "insensitive" } },
      { contact: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const docs = await prisma.accDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    take: 200,
    include: { contact: { select: { name: true } } },
  });
  return NextResponse.json(docs);
}

type ItemBody = { description?: string; quantity?: number; unitPrice?: number };

export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    docType?: string;
    contactId?: string;
    issueDate?: string;
    dueDate?: string;
    items?: ItemBody[];
    discount?: number;
    vatRate?: number;
    whtRate?: number;
    note?: string;
    refDocId?: string; // source document (e.g. invoice a credit note adjusts)
    issue?: boolean; // true = issue immediately (AWAITING_PAYMENT), false = keep as draft
  };

  if (!DOC_TYPES.includes(body.docType as AccDocType)) {
    return NextResponse.json({ error: "invalid docType" }, { status: 400 });
  }
  if (!body.contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  const contact = await prisma.accContact.findUnique({ where: { id: body.contactId } });
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 400 });

  let refDocId: string | null = null;
  if (body.refDocId) {
    const refDoc = await prisma.accDocument.findUnique({ where: { id: body.refDocId } });
    if (!refDoc) return NextResponse.json({ error: "ref document not found" }, { status: 400 });
    refDocId = refDoc.id;
  }

  const items = (body.items ?? [])
    .map((it) => ({
      description: (it.description ?? "").trim(),
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unitPrice ?? 0),
    }))
    .filter((it) => it.description);
  if (items.length === 0) {
    return NextResponse.json({ error: "ต้องมีรายการอย่างน้อย 1 รายการ" }, { status: 400 });
  }
  if (items.some((it) => !Number.isFinite(it.quantity) || !Number.isFinite(it.unitPrice) || it.quantity <= 0 || it.unitPrice < 0)) {
    return NextResponse.json({ error: "จำนวน/ราคาต่อหน่วยไม่ถูกต้อง" }, { status: 400 });
  }

  const discount = Number(body.discount ?? 0);
  const vatRate = Number(body.vatRate ?? 7);
  const whtRate = Number(body.whtRate ?? 0);
  if (![0, 7].includes(vatRate) || discount < 0 || whtRate < 0 || whtRate > 10) {
    return NextResponse.json({ error: "อัตราภาษี/ส่วนลดไม่ถูกต้อง" }, { status: 400 });
  }

  const issueDate = body.issueDate ? parseAsBangkok(body.issueDate) : new Date();
  if (Number.isNaN(issueDate.getTime())) {
    return NextResponse.json({ error: "issueDate ไม่ถูกต้อง" }, { status: 400 });
  }
  const dueDate = body.dueDate ? parseAsBangkok(body.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: "dueDate ไม่ถูกต้อง" }, { status: 400 });
  }

  const { lines, subtotal, vatAmount, whtAmount, total } = calcTotals(
    items,
    discount,
    vatRate,
    whtRate
  );

  const docType = body.docType as AccDocType;
  // Running number per type per Bangkok month, e.g. INV-202607-0001
  const ym = bangkokDayKey(issueDate).slice(0, 7).replace("-", "");
  const counterId = `${docType}-${ym}`;

  const doc = await prisma.$transaction(async (tx) => {
    const counter = await tx.accDocCounter.upsert({
      where: { id: counterId },
      update: { value: { increment: 1 } },
      create: { id: counterId, value: 1 },
    });
    const docNumber = `${DOC_TYPE_PREFIX[docType]}-${ym}-${String(counter.value).padStart(4, "0")}`;
    return tx.accDocument.create({
      data: {
        docType,
        docNumber,
        status: body.issue ? "AWAITING_PAYMENT" : "DRAFT",
        contactId: contact.id,
        issueDate,
        dueDate,
        subtotal,
        discount,
        vatRate,
        vatAmount,
        whtRate,
        whtAmount,
        total,
        note: body.note?.trim() || null,
        refDocId,
        createdBy: session.user.id,
        items: {
          create: lines.map((it, i) => ({
            order: i,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
          })),
        },
      },
      include: { items: true, contact: true },
    });
  });

  return NextResponse.json(doc, { status: 201 });
}
