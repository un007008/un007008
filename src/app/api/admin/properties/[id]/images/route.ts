import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { processImage } from "@/lib/media/process";
import { storeFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

/** Upload one or more images (multipart field "files"). */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!property) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "no files" }, { status: 400 });
  }

  let order = property.images.length;
  const created = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { full, thumb } = await processImage(buffer);
    const key = `properties/${property.id}/${crypto.randomUUID()}`;
    const url = await storeFile(`${key}.webp`, full, "image/webp");
    const thumbUrl = await storeFile(`${key}-thumb.webp`, thumb, "image/webp");
    created.push(
      await prisma.propertyImage.create({
        data: { propertyId: property.id, url, thumbUrl, order: order++ },
      })
    );
  }

  return NextResponse.json(created, { status: 201 });
}

/** Reorder images: body { order: [imageId, ...] } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { order } = (await req.json()) as { order?: string[] };
  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "order array required" }, { status: 400 });
  }

  await prisma.$transaction(
    order.map((imageId, index) =>
      prisma.propertyImage.updateMany({
        where: { id: imageId, propertyId: params.id },
        data: { order: index },
      })
    )
  );

  const images = await prisma.propertyImage.findMany({
    where: { propertyId: params.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(images);
}
