import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Update contact details from the inbox side panel. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    phone?: string;
    email?: string;
    note?: string;
  };

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() || undefined,
      phone: body.phone?.trim() ?? undefined,
      email: body.email?.trim() ?? undefined,
      note: body.note ?? undefined,
    },
  });

  return NextResponse.json(contact);
}
