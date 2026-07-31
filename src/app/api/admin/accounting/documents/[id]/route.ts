import { NextRequest, NextResponse } from "next/server";

import { calcTotals, DOC_TYPE_PREFIX, PAYMENT_METHODS } from "@/lib/accounting";
import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { bangkokDayKey, parseAsBangkok } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const doc = await prisma.accDocument.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: "asc" } }, contact: true },
  });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(doc);
}

type ItemBody = { description?: string; quantity?: number; unitPrice?: number };

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const doc = await prisma.accDocument.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json()) as {
    action?: "update" | "issue" | "markPaid" | "void";
    // update fields (draft only)
    contactId?: string;
    issueDate?: string;
    dueDate?: string | null;
    items?: ItemBody[];
    discount?: number;
    vatRate?: number;
    whtRate?: number;
    note?: string;
    // markPaid fields
    paymentMethod?: string;
    paidAt?: string;
    createReceipt?: boolean;
  };

  switch (body.action) {
    case "update": {
      if (doc.status !== "DRAFT") {
        return NextResponse.json({ error: "แก้ไขได้เฉพาะเอกสารร่าง" }, { status: 409 });
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
      const discount = Number(body.discount ?? Number(doc.discount));
      const vatRate = Number(body.vatRate ?? Number(doc.vatRate));
      const whtRate = Number(body.whtRate ?? Number(doc.whtRate));
      if (![0, 7].includes(vatRate) || discount < 0 || whtRate < 0 || whtRate > 10) {
        return NextResponse.json({ error: "อัตราภาษี/ส่วนลดไม่ถูกต้อง" }, { status: 400 });
      }
      if (body.contactId) {
        const contact = await prisma.accContact.findUnique({ where: { id: body.contactId } });
        if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 400 });
      }
      const issueDate = body.issueDate ? parseAsBangkok(body.issueDate) : doc.issueDate;
      const dueDate =
        body.dueDate === undefined
          ? doc.dueDate
          : body.dueDate
            ? parseAsBangkok(body.dueDate)
            : null;

      const { lines, subtotal, vatAmount, whtAmount, total } = calcTotals(
        items,
        discount,
        vatRate,
        whtRate
      );

      const updated = await prisma.$transaction(async (tx) => {
        await tx.accDocumentItem.deleteMany({ where: { documentId: doc.id } });
        return tx.accDocument.update({
          where: { id: doc.id },
          data: {
            ...(body.contactId ? { contactId: body.contactId } : {}),
            issueDate,
            dueDate,
            subtotal,
            discount,
            vatRate,
            vatAmount,
            whtRate,
            whtAmount,
            total,
            ...(body.note !== undefined ? { note: body.note.trim() || null } : {}),
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
          include: { items: { orderBy: { order: "asc" } }, contact: true },
        });
      });
      return NextResponse.json(updated);
    }

    case "issue": {
      if (doc.status !== "DRAFT") {
        return NextResponse.json({ error: "ออกเอกสารได้เฉพาะเอกสารร่าง" }, { status: 409 });
      }
      const updated = await prisma.accDocument.update({
        where: { id: doc.id },
        data: { status: "AWAITING_PAYMENT" },
      });
      return NextResponse.json(updated);
    }

    case "markPaid": {
      if (doc.status !== "AWAITING_PAYMENT") {
        return NextResponse.json({ error: "บันทึกชำระได้เฉพาะเอกสารสถานะรอชำระ" }, { status: 409 });
      }
      const paymentMethod = PAYMENT_METHODS.includes(
        body.paymentMethod as (typeof PAYMENT_METHODS)[number]
      )
        ? body.paymentMethod!
        : PAYMENT_METHODS[0];
      const paidAt = body.paidAt ? parseAsBangkok(body.paidAt) : new Date();
      if (Number.isNaN(paidAt.getTime())) {
        return NextResponse.json({ error: "วันที่ชำระไม่ถูกต้อง" }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.accDocument.update({
          where: { id: doc.id },
          // a quotation is "accepted", not paid — no payment method applies
          data: {
            status: "PAID",
            paidAt,
            paymentMethod: doc.docType === "QUOTATION" ? null : paymentMethod,
          },
          include: { items: { orderBy: { order: "asc" } } },
        });

        // PEAK-style: receiving payment on an invoice can issue the receipt in one step
        let receiptId: string | null = null;
        if (doc.docType === "INVOICE" && body.createReceipt) {
          const ym = bangkokDayKey(paidAt).slice(0, 7).replace("-", "");
          const counterId = `RECEIPT-${ym}`;
          const counter = await tx.accDocCounter.upsert({
            where: { id: counterId },
            update: { value: { increment: 1 } },
            create: { id: counterId, value: 1 },
          });
          const docNumber = `${DOC_TYPE_PREFIX.RECEIPT}-${ym}-${String(counter.value).padStart(4, "0")}`;
          const receipt = await tx.accDocument.create({
            data: {
              docType: "RECEIPT",
              docNumber,
              status: "PAID",
              contactId: doc.contactId,
              issueDate: paidAt,
              subtotal: doc.subtotal,
              discount: doc.discount,
              vatRate: doc.vatRate,
              vatAmount: doc.vatAmount,
              whtRate: doc.whtRate,
              whtAmount: doc.whtAmount,
              total: doc.total,
              note: `อ้างอิงใบแจ้งหนี้ ${doc.docNumber}`,
              paidAt,
              paymentMethod,
              refDocId: doc.id,
              createdBy: session.user.id,
              items: {
                create: updated.items.map((it) => ({
                  order: it.order,
                  description: it.description,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  amount: it.amount,
                })),
              },
            },
          });
          receiptId = receipt.id;
        }
        return { updated, receiptId };
      });
      return NextResponse.json({ ...result.updated, receiptId: result.receiptId });
    }

    case "void": {
      if (doc.status === "VOID") {
        return NextResponse.json({ error: "เอกสารถูกยกเลิกแล้ว" }, { status: 409 });
      }
      const updated = await prisma.accDocument.update({
        where: { id: doc.id },
        data: { status: "VOID" },
      });
      return NextResponse.json(updated);
    }

    default:
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const doc = await prisma.accDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (doc.status !== "DRAFT") {
    return NextResponse.json(
      { error: "ลบได้เฉพาะเอกสารร่าง — เอกสารที่ออกแล้วให้ใช้ยกเลิก (VOID) แทน" },
      { status: 409 }
    );
  }
  await prisma.accDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
