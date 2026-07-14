import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

async function adminSession() {
  const session = await apiSession();
  if (!session) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!property) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(property);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await adminSession();
  if ("error" in guard) return guard.error;

  const body = await req.json();

  try {
    const property = await prisma.property.update({
      where: { id: params.id },
      data: {
        refCode: body.refCode?.trim().toUpperCase() || undefined,
        slug: body.slug?.trim() || undefined,
        status: body.status ?? undefined,
        listingType: body.listingType ?? undefined,
        propertyType: body.propertyType ?? undefined,
        title: body.title ?? undefined,
        description: body.description ?? undefined,
        priceSale: body.priceSale === undefined ? undefined : body.priceSale,
        priceRent: body.priceRent === undefined ? undefined : body.priceRent,
        bedrooms: body.bedrooms === undefined ? undefined : body.bedrooms,
        bathrooms: body.bathrooms === undefined ? undefined : body.bathrooms,
        areaSqm: body.areaSqm === undefined ? undefined : body.areaSqm,
        floor: body.floor === undefined ? undefined : body.floor,
        projectName: body.projectName === undefined ? undefined : body.projectName?.trim() || null,
        district: body.district === undefined ? undefined : body.district?.trim() || null,
        btsMrt: body.btsMrt === undefined ? undefined : body.btsMrt?.trim() || null,
        lat: body.lat === undefined ? undefined : body.lat,
        lng: body.lng === undefined ? undefined : body.lng,
        featured: body.featured ?? undefined,
      },
      include: { images: { orderBy: { order: "asc" } } },
    });
    return NextResponse.json(property);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "refCode หรือ slug ซ้ำ" }, { status: 409 });
    }
    if (err.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await adminSession();
  if ("error" in guard) return guard.error;

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: { images: true },
  });
  if (!property) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.property.delete({ where: { id: params.id } }); // images cascade
  for (const img of property.images) {
    await deleteFile(img.url);
    await deleteFile(img.thumbUrl);
  }
  return NextResponse.json({ ok: true });
}
