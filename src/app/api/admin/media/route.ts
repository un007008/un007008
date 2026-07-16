import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { processImage } from "@/lib/media/process";
import { storeFile } from "@/lib/media/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(assets);
}

/** Upload files (multipart "files"). Images become WebP + thumb; others stored as-is. */
export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "no files" }, { status: 400 });

  // validate everything up front so a bad file doesn't leave partial uploads
  const MAX_BYTES = 15 * 1024 * 1024;
  const DOC_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "zip"];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `ไฟล์ ${file.name} ใหญ่เกิน 15MB` }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      // no html/svg/js etc. — files are served from the public origin
      if (!DOC_EXT.includes(ext)) {
        return NextResponse.json({ error: `ไม่รองรับไฟล์ประเภทนี้: ${file.name}` }, { status: 400 });
      }
    }
  }

  const created = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    if (file.type.startsWith("image/")) {
      let processed;
      try {
        processed = await processImage(buffer);
      } catch {
        return NextResponse.json(
          { error: `ไฟล์ ${file.name} ไม่ใช่รูปภาพที่รองรับ`, created },
          { status: 400 }
        );
      }
      const url = await storeFile(`media/${id}.webp`, processed.full, "image/webp");
      const thumbUrl = await storeFile(`media/${id}-thumb.webp`, processed.thumb, "image/webp");
      created.push(
        await prisma.mediaAsset.create({
          data: { url, thumbUrl, mimeType: "image/webp", sizeBytes: processed.full.length },
        })
      );
    } else {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
      const url = await storeFile(`media/${id}.${ext}`, buffer, file.type || "application/octet-stream");
      created.push(
        await prisma.mediaAsset.create({
          data: { url, thumbUrl: null, mimeType: file.type || "application/octet-stream", sizeBytes: buffer.length },
        })
      );
    }
  }

  return NextResponse.json(created, { status: 201 });
}
