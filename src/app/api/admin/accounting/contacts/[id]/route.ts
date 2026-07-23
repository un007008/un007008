import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONTACT_TYPES = ["CUSTOMER", "VENDOR", "BOTH"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const existing = await prisma.accContact.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

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
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const contact = await prisma.accContact.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.type !== undefined &&
      CONTACT_TYPES.includes(body.type as (typeof CONTACT_TYPES)[number])
        ? { type: body.type as (typeof CONTACT_TYPES)[number] }
        : {}),
      ...(body.taxId !== undefined ? { taxId: body.taxId.trim() || null } : {}),
      ...(body.branch !== undefined ? { branch: body.branch.trim() || null } : {}),
      ...(body.address !== undefined ? { address: body.address.trim() || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
      ...(body.email !== undefined ? { email: body.email.trim() || null } : {}),
      ...(body.note !== undefined ? { note: body.note.trim() || null } : {}),
    },
  });
  return NextResponse.json(contact);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const docCount = await prisma.accDocument.count({ where: { contactId: params.id } });
  if (docCount > 0) {
    return NextResponse.json(
      { error: "ลบไม่ได้ — ผู้ติดต่อนี้มีเอกสารอยู่ในระบบ" },
      { status: 409 }
    );
  }
  await prisma.accContact.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
