import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const properties = await prisma.property.findMany({
    include: { images: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(properties);
}

export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.refCode?.trim() || !body.title?.th?.trim()) {
    return NextResponse.json({ error: "refCode and title.th required" }, { status: 400 });
  }

  const refCode = body.refCode.trim().toUpperCase();
  const baseSlug = slugify(body.slug || body.title.en || body.title.th) || refCode.toLowerCase();
  let slug = baseSlug;
  if (await prisma.property.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${refCode.toLowerCase()}`;
  }

  try {
    const property = await prisma.property.create({
      data: {
        refCode,
        slug,
        status: body.status ?? "AVAILABLE",
        listingType: body.listingType ?? "SALE",
        propertyType: body.propertyType ?? "CONDO",
        title: body.title,
        description: body.description ?? { th: "", en: "", zh: "" },
        priceSale: body.priceSale ?? null,
        priceRent: body.priceRent ?? null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        areaSqm: body.areaSqm ?? null,
        floor: body.floor ?? null,
        projectName: body.projectName?.trim() || null,
        district: body.district?.trim() || null,
        btsMrt: body.btsMrt?.trim() || null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        featured: body.featured ?? false,
      },
    });
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "refCode หรือ slug ซ้ำ" }, { status: 409 });
    }
    throw error;
  }
}
