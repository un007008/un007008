import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: doc.id } });
  await deleteFile(doc.url);

  return NextResponse.json({ ok: true });
}
