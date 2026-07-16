import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

async function guard() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guard();
  if (denied) return denied;

  const body = await req.json();
  try {
    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: {
        slug: body.slug?.trim() ? slugify(body.slug) || undefined : undefined,
        title: body.title ?? undefined,
        content: body.content ?? undefined,
        coverUrl: body.coverUrl === undefined ? undefined : body.coverUrl?.trim() || null,
        category: body.category === undefined ? undefined : body.category?.trim() || null,
        tags: Array.isArray(body.tags) ? body.tags : undefined,
        published: body.published ?? undefined,
      },
    });
    return NextResponse.json(post);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === "P2002") return NextResponse.json({ error: "slug ซ้ำ" }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: "not found" }, { status: 404 });
    throw error;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await guard();
  if (denied) return denied;

  await prisma.blogPost.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
