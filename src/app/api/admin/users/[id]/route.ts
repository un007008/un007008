import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["ADMIN", "SALES", "CR", "ACCOUNTANT"];

/** Update name/role or reset password (ADMIN only). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    name?: string;
    role?: string;
    password?: string;
  };

  if (body.role && !ROLES.includes(body.role as Role)) {
    return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
  }
  if (body.password !== undefined && body.password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว" }, { status: 400 });
  }
  // an admin can't demote themselves — prevents locking everyone out
  if (body.role && body.role !== "ADMIN" && params.id === session.user.id) {
    return NextResponse.json({ error: "ลดสิทธิ์ตัวเองไม่ได้" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: body.name?.trim() || undefined,
      role: (body.role as Role) ?? undefined,
      password: body.password ? await bcrypt.hash(body.password, 10) : undefined,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user);
}

/** Delete a user (ADMIN only, not yourself). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (params.id === session.user.id) {
    return NextResponse.json({ error: "ลบตัวเองไม่ได้" }, { status: 400 });
  }

  // unassign this user's leads/conversations before deleting
  await prisma.$transaction([
    prisma.lead.updateMany({ where: { assignedTo: params.id }, data: { assignedTo: null } }),
    prisma.conversation.updateMany({ where: { assignedTo: params.id }, data: { assignedTo: null } }),
    prisma.user.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
