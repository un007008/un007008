import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { emitInboxEvent } from "@/lib/inbox/bus";
import { pushText } from "@/lib/line/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json(messages);
}

/** Staff sends a reply: save to DB + push to LINE. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { content } = (await req.json()) as { content?: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: { contact: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Staff reply implies a human owns the conversation now.
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: "HUMAN_HANDLING",
      assignedTo: conversation.assignedTo ?? session.user.id,
      updatedAt: new Date(),
    },
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      sender: "STAFF",
      content: content.trim(),
      metadata: { staffId: session.user.id, staffName: session.user.name },
    },
  });

  let lineDelivered = false;
  if (conversation.channel === "LINE" && conversation.contact.lineUserId) {
    try {
      await pushText(conversation.contact.lineUserId, content.trim());
      lineDelivered = true;
    } catch (error) {
      console.error("LINE push failed:", error);
    }
  }

  emitInboxEvent({ type: "message", conversationId: conversation.id });
  emitInboxEvent({ type: "conversation", conversationId: conversation.id });

  return NextResponse.json({ message, lineDelivered });
}
