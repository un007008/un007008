import { NextRequest, NextResponse } from "next/server";
import type { DealStatus } from "@prisma/client";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES: DealStatus[] = ["DRAFT", "CONTRACT_SENT", "SIGNED", "COMPLETED", "CANCELLED"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    status?: string;
    amount?: number;
    contractStart?: string | null;
    contractEnd?: string | null;
  };

  if (body.status && !STATUSES.includes(body.status as DealStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const parseDate = (v: string | null | undefined) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  };

  const deal = await prisma.deal.update({
    where: { id: params.id },
    data: {
      status: (body.status as DealStatus) ?? undefined,
      amount: body.amount ?? undefined,
      contractStart: parseDate(body.contractStart),
      contractEnd: parseDate(body.contractEnd),
    },
  });

  // completing a deal closes the lead as won
  if (body.status === "COMPLETED") {
    await prisma.lead.update({ where: { id: deal.leadId }, data: { stage: "CLOSED_WON" } });
  }

  return NextResponse.json(deal);
}
