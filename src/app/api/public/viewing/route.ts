import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { parseAsBangkok } from "@/lib/datetime";
import { createRateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// per-IP (x-forwarded-for from the platform proxy) — stops casual form spam
const rateLimited = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

/** Public viewing-request form -> Contact + Lead (WEBSITE_FORM) + Appointment. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  let body: {
    propertyId?: unknown;
    name?: unknown;
    phone?: unknown;
    datetime?: unknown;
    message?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const propertyId = str(body.propertyId);
  const name = str(body.name);
  const phone = str(body.phone);
  const datetimeInput = str(body.datetime);
  const message = str(body.message);
  if (!propertyId || !name || !phone) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (name.length > 200 || message.length > 2000 || !/^[0-9+\-\s()]{8,30}$/.test(phone)) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  // don't accept (or confirm the existence of) hidden/de-listed properties
  if (!property || property.status === "HIDDEN") {
    return NextResponse.json({ error: "property not found" }, { status: 404 });
  }

  // reuse contact by phone when possible
  const contact =
    (await prisma.contact.findFirst({ where: { phone } })) ??
    (await prisma.contact.create({ data: { name, phone } }));

  const noteParts = [
    `นัดชมจากเว็บ: ${property.refCode}`,
    datetimeInput ? `เวลาที่สะดวก: ${datetimeInput}` : null,
    message ? `ข้อความ: ${message}` : null,
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

  const requestedAt = datetimeInput ? new Date(parseAsBangkok(datetimeInput)) : null;
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
