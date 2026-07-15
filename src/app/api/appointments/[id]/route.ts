import { NextRequest, NextResponse } from "next/server";
import type { ApptStatus } from "@prisma/client";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES: ApptStatus[] = ["SCHEDULED", "DONE", "CANCELLED", "NO_SHOW"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { status?: string; datetime?: string; note?: string };

  if (body.status && !STATUSES.includes(body.status as ApptStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const datetime = body.datetime ? new Date(body.datetime) : undefined;
  if (datetime && isNaN(datetime.getTime())) {
    return NextResponse.json({ error: "invalid datetime" }, { status: 400 });
  }

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      status: (body.status as ApptStatus) ?? undefined,
      datetime,
      note: body.note ?? undefined,
    },
  });

  return NextResponse.json(appointment);
}
