import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    question?: string;
    answer?: string;
    category?: string | null;
    active?: boolean;
  };

  const entry = await prisma.knowledgeEntry.update({
    where: { id: params.id },
    data: {
      question: body.question?.trim() || undefined,
      answer: body.answer?.trim() || undefined,
      category: body.category === undefined ? undefined : body.category?.trim() || null,
      active: body.active,
    },
  });
  return NextResponse.json(entry);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.knowledgeEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
