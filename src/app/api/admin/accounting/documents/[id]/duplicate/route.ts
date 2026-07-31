import { NextRequest, NextResponse } from "next/server";

import { DOC_TYPE_PREFIX } from "@/lib/accounting";
import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Duplicate a document as a fresh DRAFT dated today with a new number. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const doc = await prisma.accDocument.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const issueDate = new Date();
  const ym = bangkokDayKey(issueDate).slice(0, 7).replace("-", "");
  const counterId = `${doc.docType}-${ym}`;

  const copy = await prisma.$transaction(async (tx) => {
    const counter = await tx.accDocCounter.upsert({
      where: { id: counterId },
      update: { value: { increment: 1 } },
      create: { id: counterId, value: 1 },
    });
    const docNumber = `${DOC_TYPE_PREFIX[doc.docType]}-${ym}-${String(counter.value).padStart(4, "0")}`;
    return tx.accDocument.create({
      data: {
        docType: doc.docType,
        docNumber,
        status: "DRAFT",
        contactId: doc.contactId,
        issueDate,
        subtotal: doc.subtotal,
        discount: doc.discount,
        vatRate: doc.vatRate,
        vatAmount: doc.vatAmount,
        whtRate: doc.whtRate,
        whtAmount: doc.whtAmount,
        total: doc.total,
        note: doc.note,
        createdBy: session.user.id,
        items: {
          create: doc.items.map((it) => ({
            order: it.order,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            amount: it.amount,
          })),
        },
      },
    });
  });

  return NextResponse.json(copy, { status: 201 });
}
