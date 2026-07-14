import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const entries = await prisma.knowledgeEntry.findMany({
    orderBy: [{ category: "asc" }, { question: "asc" }],
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    question?: string;
    answer?: string;
    category?: string;
  };
  if (!body.question?.trim() || !body.answer?.trim()) {
    return NextResponse.json({ error: "question and answer required" }, { status: 400 });
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      question: body.question.trim(),
      answer: body.answer.trim(),
      category: body.category?.trim() || null,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
