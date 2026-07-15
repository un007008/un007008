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

  const created = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    if (file.type.startsWith("image/")) {
      const { full, thumb } = await processImage(buffer);
      const url = await storeFile(`media/${id}.webp`, full, "image/webp");
      const thumbUrl = await storeFile(`media/${id}-thumb.webp`, thumb, "image/webp");
      created.push(
        await prisma.mediaAsset.create({
          data: { url, thumbUrl, mimeType: "image/webp", sizeBytes: full.length },
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
