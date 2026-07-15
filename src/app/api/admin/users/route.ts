import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["ADMIN", "SALES", "CR"];

/** Create a staff user (ADMIN only). */
export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    name?: string;
    password?: string;
    role?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "ต้องระบุชื่อ" }, { status: 400 });
  if (!body.password || body.password.length < 8) {
    return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว" }, { status: 400 });
  }
  if (!body.role || !ROLES.includes(body.role as Role)) {
    return NextResponse.json({ error: "role ไม่ถูกต้อง" }, { status: 400 });
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "อีเมลนี้มีผู้ใช้แล้ว" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: body.role as Role,
      password: await bcrypt.hash(body.password, 10),
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json(user, { status: 201 });
}
