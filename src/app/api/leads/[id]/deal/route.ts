import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { parseAsBangkok } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** Create a Deal for a lead. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    propertyId?: string;
    dealType?: "SALE" | "RENT";
    amount?: number;
    contractStart?: string;
    contractEnd?: string;
  };

  if (!body.propertyId || !body.dealType || !body.amount || body.amount <= 0) {
    return NextResponse.json(
      { error: "propertyId, dealType, amount required" },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { deal: true },
  });
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (lead.deal) return NextResponse.json({ error: "lead มี Deal อยู่แล้ว" }, { status: 409 });
  if (session.user.role !== "ADMIN" && lead.assignedTo !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // date-only strings are Bangkok calendar dates, not UTC
  const start = body.contractStart ? parseAsBangkok(body.contractStart) : null;
  const end = body.contractEnd ? parseAsBangkok(body.contractEnd) : null;

  const deal = await prisma.deal.create({
    data: {
      leadId: lead.id,
      propertyId: body.propertyId,
      dealType: body.dealType,
      amount: body.amount,
      status: "DRAFT",
      contractStart: start && !isNaN(start.getTime()) ? start : null,
      contractEnd: end && !isNaN(end.getTime()) ? end : null,
    },
  });

  // deal opened -> lead moves to OFFER unless already closed
  if (!lead.stage.startsWith("CLOSED")) {
    await prisma.lead.update({ where: { id: lead.id }, data: { stage: "OFFER" } });
  }

  return NextResponse.json(deal, { status: 201 });
}
