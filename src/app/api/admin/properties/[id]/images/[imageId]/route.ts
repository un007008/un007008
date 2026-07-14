import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const image = await prisma.propertyImage.findFirst({
    where: { id: params.imageId, propertyId: params.id },
  });
  if (!image) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.propertyImage.delete({ where: { id: image.id } });
  await deleteFile(image.url);
  await deleteFile(image.thumbUrl);

  // compact remaining order
  const rest = await prisma.propertyImage.findMany({
    where: { propertyId: params.id },
    orderBy: { order: "asc" },
  });
  await prisma.$transaction(
    rest.map((img, index) =>
      prisma.propertyImage.update({ where: { id: img.id }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
