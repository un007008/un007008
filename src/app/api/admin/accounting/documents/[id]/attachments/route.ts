import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { apiSession, isAccountingRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { storeFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

/** Upload attachments (payment slips, tax invoices, ...) to an accounting document. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAccountingRole(session.user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const doc = await prisma.accDocument.findUnique({ where: { id: params.id } });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "no files" }, { status: 400 });

  const created = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9ก-๙._-]/g, "_").slice(0, 120) || "attachment";
    const key = `accounting/${doc.id}/${crypto.randomUUID()}-${safeName}`;
    const url = await storeFile(key, buffer, file.type || "application/octet-stream");
    created.push(
      await prisma.accAttachment.create({
        data: { documentId: doc.id, name: file.name.slice(0, 200), url },
      })
    );
  }
  return NextResponse.json(created, { status: 201 });
}
