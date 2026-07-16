import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { SECTION_TYPES, normalizeHomepage, type HomepageConfig } from "@/lib/sections/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const config = await prisma.siteConfig.findUnique({ where: { id: "homepage" } });
  return NextResponse.json(normalizeHomepage(config?.data));
}

export async function PUT(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: HomepageConfig;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid config" }, { status: 400 });
  }
  if (
    !Array.isArray(body.sections) ||
    body.sections.some(
      (s) =>
        !s ||
        typeof s !== "object" ||
        !SECTION_TYPES.includes(s.type) ||
        typeof s.id !== "string"
    )
  ) {
    return NextResponse.json({ error: "invalid config" }, { status: 400 });
  }

  // fill missing lang objects so a hand-crafted payload can't brick the builder UI
  const lang = (v: unknown) => {
    const o = (v ?? {}) as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === "string" ? x : "");
    return { th: s(o.th), en: s(o.en), zh: s(o.zh) };
  };
  const sanitized: HomepageConfig = {
    sections: body.sections.map((s) => ({
      ...s,
      visible: !!s.visible,
      title: lang(s.title),
      subtitle: lang(s.subtitle),
      ...(s.buttonLabel !== undefined ? { buttonLabel: lang(s.buttonLabel) } : {}),
    })),
  };

  const saved = await prisma.siteConfig.upsert({
    where: { id: "homepage" },
    create: { id: "homepage", data: sanitized },
    update: { data: sanitized },
  });

  return NextResponse.json(normalizeHomepage(saved.data));
}
