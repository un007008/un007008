import { NextRequest, NextResponse } from "next/server";

import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const attachment = await prisma.accAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment || attachment.documentId !== params.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await deleteFile(attachment.url);
  await prisma.accAttachment.delete({ where: { id: attachment.id } });
  return NextResponse.json({ ok: true });
}
