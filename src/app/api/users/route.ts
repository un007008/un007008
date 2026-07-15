import { NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Staff list for assignment dropdowns. */
export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}
