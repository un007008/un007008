import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Simple property list for pickers. ?q= matches refCode / project / district. */
export async function GET(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();

  const properties = await prisma.property.findMany({
    where: q
      ? {
          OR: [
            { refCode: { contains: q, mode: "insensitive" } },
            { projectName: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
            { title: { path: ["th"], string_contains: q } },
          ],
        }
      : {},
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    properties.map((p) => ({
      id: p.id,
      refCode: p.refCode,
      title: (p.title as { th?: string } | null)?.th ?? p.refCode,
      listingType: p.listingType,
      priceSale: p.priceSale,
      priceRent: p.priceRent,
      district: p.district,
      thumbUrl: p.images[0]?.thumbUrl ?? null,
    }))
  );
}
