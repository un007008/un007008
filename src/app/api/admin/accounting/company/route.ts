import { NextRequest, NextResponse } from "next/server";

import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { getCompanyProfile, type CompanyProfile } from "@/lib/company";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(await getCompanyProfile());
}

export async function PUT(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as Partial<CompanyProfile>;
  const data: CompanyProfile = {
    name: String(body.name ?? "").trim(),
    taxId: String(body.taxId ?? "").trim(),
    branch: String(body.branch ?? "").trim(),
    address: String(body.address ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    email: String(body.email ?? "").trim(),
  };

  await prisma.siteConfig.upsert({
    where: { id: "company" },
    create: { id: "company", data },
    update: { data },
  });
  return NextResponse.json(data);
}
