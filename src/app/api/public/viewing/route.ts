import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// naive per-IP rate limit (in-memory, resets on redeploy) — enough to stop
// casual form spam on a single-instance deployment
const hits = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (hits.size > 5000) hits.clear(); // memory backstop
  return entry.count > MAX_PER_WINDOW;
}

/** Public viewing-request form -> Contact + Lead (WEBSITE_FORM) + Appointment. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const body = (await req.json()) as {
    propertyId?: string;
    name?: string;
    phone?: string;
    datetime?: string;
    message?: string;
  };

  const name = body.name?.trim();
  const phone = body.phone?.trim();
  if (!body.propertyId || !name || !phone) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (name.length > 200 || phone.length > 30 || (body.message ?? "").length > 2000) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { id: body.propertyId } });
  if (!property) return NextResponse.json({ error: "property not found" }, { status: 404 });

  // reuse contact by phone when possible
  const contact =
    (await prisma.contact.findFirst({ where: { phone } })) ??
    (await prisma.contact.create({ data: { name, phone } }));

  const noteParts = [
    `นัดชมจากเว็บ: ${property.refCode}`,
    body.datetime ? `เวลาที่สะดวก: ${body.datetime}` : null,
    body.message?.trim() ? `ข้อความ: ${body.message.trim()}` : null,
  ].filter(Boolean);

  const lead = await prisma.lead.create({
    data: {
      contactId: contact.id,
      source: "WEBSITE_FORM",
      stage: "NEW",
      interest: property.listingType === "RENT" ? "RENT" : "SALE",
      propertyId: property.id,
      note: noteParts.join("\n"),
    },
  });

  const requestedAt = body.datetime ? new Date(body.datetime) : null;
  if (requestedAt && !isNaN(requestedAt.getTime())) {
    await prisma.appointment.create({
      data: {
        leadId: lead.id,
        propertyId: property.id,
        datetime: requestedAt,
        status: "SCHEDULED",
        note: "นัดจากฟอร์มเว็บไซต์ (รอยืนยัน)",
      },
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
