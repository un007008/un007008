import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Create a Lead from the inbox (source=CHAT) or manually. */
export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    contactId?: string;
    source?: "CHAT" | "WEBSITE_FORM" | "MANUAL";
    interest?: "SALE" | "RENT" | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    propertyId?: string | null;
    note?: string | null;
  };

  if (!body.contactId) {
    return NextResponse.json({ error: "contactId required" }, { status: 400 });
  }
  const contact = await prisma.contact.findUnique({ where: { id: body.contactId } });
  if (!contact) return NextResponse.json({ error: "contact not found" }, { status: 404 });

  const lead = await prisma.lead.create({
    data: {
      contactId: body.contactId,
      source: body.source ?? "CHAT",
      stage: "NEW",
      interest: body.interest ?? null,
      budgetMin: body.budgetMin ?? null,
      budgetMax: body.budgetMax ?? null,
      propertyId: body.propertyId ?? null,
      note: body.note?.trim() || null,
      assignedTo: session.user.id,
    },
  });

  return NextResponse.json(lead, { status: 201 });
}
