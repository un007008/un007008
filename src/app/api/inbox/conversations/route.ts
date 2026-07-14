import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** List conversations for the inbox sidebar. ?filter=all|mine|unassigned|ai */
export async function GET(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const filter = req.nextUrl.searchParams.get("filter") ?? "all";
  const where =
    filter === "mine"
      ? { assignedTo: session.user.id }
      : filter === "unassigned"
        ? { assignedTo: null, status: { not: "CLOSED" as const } }
        : filter === "ai"
          ? { status: "AI_HANDLING" as const }
          : {};

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      channel: c.channel,
      status: c.status,
      assignedTo: c.assignedTo,
      updatedAt: c.updatedAt,
      contact: {
        id: c.contact.id,
        name: c.contact.name,
        phone: c.contact.phone,
        email: c.contact.email,
        note: c.contact.note,
        tags: c.contact.tags,
        lineUserId: c.contact.lineUserId,
      },
      lastMessage: c.messages[0]
        ? {
            content: c.messages[0].content,
            sender: c.messages[0].sender,
            createdAt: c.messages[0].createdAt,
          }
        : null,
    }))
  );
}
