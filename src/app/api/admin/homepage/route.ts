import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { SECTION_TYPES, normalizeHomepage, type HomepageConfig } from "@/lib/sections/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = await prisma.siteConfig.findUnique({ where: { id: "homepage" } });
  return NextResponse.json(normalizeHomepage(config?.data));
}

export async function PUT(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as HomepageConfig;
  if (
    !Array.isArray(body.sections) ||
    body.sections.some((s) => !SECTION_TYPES.includes(s.type))
  ) {
    return NextResponse.json({ error: "invalid config" }, { status: 400 });
  }

  const saved = await prisma.siteConfig.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", data: body },
    update: { data: body },
  });

  return NextResponse.json(normalizeHomepage(saved.data));
}
