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

  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.title?.th?.trim()) {
    return NextResponse.json({ error: "title.th required" }, { status: 400 });
  }

  const baseSlug = slugify(body.slug || body.title.en || body.title.th) || `post-${Date.now()}`;
  let slug = baseSlug;
  if (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const post = await prisma.blogPost.create({
    data: {
      slug,
      title: body.title,
      content: body.content ?? { th: "", en: "", zh: "" },
      coverUrl: body.coverUrl?.trim() || null,
      category: body.category?.trim() || null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      published: body.published ?? false,
    },
  });
  return NextResponse.json(post, { status: 201 });
}
