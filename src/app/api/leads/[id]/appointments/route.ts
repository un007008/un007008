import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Create an appointment for a lead. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    propertyId?: string;
    datetime?: string;
    note?: string;
  };

  const datetime = body.datetime ? new Date(body.datetime) : null;
  if (!body.propertyId || !datetime || isNaN(datetime.getTime())) {
    return NextResponse.json({ error: "propertyId and datetime required" }, { status: 400 });
  }

  const [lead, property] = await Promise.all([
    prisma.lead.findUnique({ where: { id: params.id } }),
    prisma.property.findUnique({ where: { id: body.propertyId } }),
  ]);
  if (!lead || !property) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (session.user.role !== "ADMIN" && lead.assignedTo !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      leadId: lead.id,
      propertyId: property.id,
      datetime,
      status: "SCHEDULED",
      note: body.note?.trim() || null,
    },
  });

  // viewing scheduled -> move stage forward if still early
  if (["NEW", "CONTACTED", "QUALIFIED"].includes(lead.stage)) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: "VIEWING_SCHEDULED" },
    });
  }

  return NextResponse.json(appointment, { status: 201 });
}
