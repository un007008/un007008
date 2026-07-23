import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "BOTH"] as const;

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const contacts = await prisma.accContact.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { documents: true } } },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    name?: string;
    type?: string;
    taxId?: string;
    branch?: string;
    address?: string;
    phone?: string;
    email?: string;
    note?: string;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const type = CONTACT_TYPES.includes(body.type as (typeof CONTACT_TYPES)[number])
    ? (body.type as (typeof CONTACT_TYPES)[number])
    : "CUSTOMER";

  const contact = await prisma.accContact.create({
    data: {
      name: body.name.trim(),
      type,
      taxId: body.taxId?.trim() || null,
      branch: body.branch?.trim() || null,
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      note: body.note?.trim() || null,
    },
  });
  return NextResponse.json(contact, { status: 201 });
}
