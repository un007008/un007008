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
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await deleteFile(asset.url);
  if (asset.thumbUrl) await deleteFile(asset.thumbUrl);

  return NextResponse.json({ ok: true });
}
