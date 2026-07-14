import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { emitInboxEvent } from "@/lib/inbox/bus";
import { lineClient } from "@/lib/line/client";
import { propertyFlexMessage } from "@/lib/line/flex";

export const dynamic = "force-dynamic";

/** Send a property card (LINE Flex Message) into the conversation. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { propertyId } = (await req.json()) as { propertyId?: string };
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId required" }, { status: 400 });
  }

  const [conversation, property] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: params.id },
      include: { contact: true },
    }),
    prisma.property.findUnique({
      where: { id: propertyId },
      include: { images: { orderBy: { order: "asc" } } },
    }),
  ]);
  if (!conversation || !property) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const title = (property.title as { th?: string } | null)?.th ?? property.refCode;

  let lineDelivered = false;
  if (conversation.channel === "LINE" && conversation.contact.lineUserId) {
    try {
      const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
      await lineClient().pushMessage({
        to: conversation.contact.lineUserId,
        messages: [propertyFlexMessage(property, siteUrl)],
      });
      lineDelivered = true;
    } catch (error) {
      console.error("LINE flex push failed:", error);
    }
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      sender: "STAFF",
      content: `ส่งการ์ดทรัพย์: ${property.refCode} — ${title}`,
      contentType: "property_card",
      metadata: {
        propertyId: property.id,
        refCode: property.refCode,
        staffId: session.user.id,
      },
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      assignedTo: conversation.assignedTo ?? session.user.id,
      updatedAt: new Date(),
    },
  });

  emitInboxEvent({ type: "message", conversationId: conversation.id });

  return NextResponse.json({ message, lineDelivered });
}
