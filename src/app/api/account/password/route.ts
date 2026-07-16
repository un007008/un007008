import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Change your own password (any role, requires current password). */
export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "กรอกให้ครบ" }, { status: 400 });
  }
  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: "รหัสใหม่ต้องยาวอย่างน้อย 8 ตัว" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !(await bcrypt.compare(body.currentPassword, user.password))) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(body.newPassword, 10),
      // invalidates every JWT session issued before now (see jwt callback)
      passwordChangedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
