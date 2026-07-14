import { NextRequest, NextResponse } from "next/server";
import type { LeadStage } from "@prisma/client";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "VIEWING_SCHEDULED",
  "VIEWED",
  "OFFER",
  "CLOSED_WON",
  "CLOSED_LOST",
];

/** Update lead stage / note / assignment. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { stage?: string; note?: string };

  if (body.stage && !STAGES.includes(body.stage as LeadStage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }

  // SALES/CR may only touch leads assigned to them
  if (session.user.role !== "ADMIN") {
    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead || lead.assignedTo !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const lead = await prisma.lead.update({
    where: { id: params.id },
    data: {
      stage: (body.stage as LeadStage) ?? undefined,
      note: body.note ?? undefined,
    },
  });

  return NextResponse.json(lead);
}
