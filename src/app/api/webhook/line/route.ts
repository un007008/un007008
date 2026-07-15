import { NextRequest, NextResponse } from "next/server";
import type { webhook } from "@line/bot-sdk";

import { prisma } from "@/lib/db";
import { generateAutoReply } from "@/lib/ai/reply";
import { emitInboxEvent } from "@/lib/inbox/bus";
import { getProfile, replyText, verifyLineSignature } from "@/lib/line/client";

export const dynamic = "force-dynamic";

const HOLDING_MESSAGE =
  "ขอบคุณที่ติดต่อเข้ามานะคะ ทีมงานได้รับข้อความแล้ว เจ้าหน้าที่จะรีบตอบกลับโดยเร็วที่สุดค่ะ";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events?: webhook.Event[] };
  const events = body.events ?? [];

  // Process events; LINE expects a fast 200 regardless of individual failures.
  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (error) {
      console.error("LINE webhook event failed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: webhook.Event) {
  // LINE may redeliver events after timeouts — skip to avoid duplicate rows
  if (event.deliveryContext?.isRedelivery) return;

  const lineUserId = event.source?.type === "user" ? event.source.userId : null;
  if (!lineUserId) return;

  if (event.type === "follow") {
    await upsertContact(lineUserId);
    return;
  }

  if (event.type !== "message") return;

  const contact = await upsertContact(lineUserId);
  const conversation = await findOrCreateConversation(contact.id);

  const message = event.message;
  const isText = message.type === "text";
  const content = isText ? message.text : `[${message.type}]`;

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "INBOUND",
      sender: "CUSTOMER",
      content,
      contentType: isText ? "text" : message.type,
      metadata: { lineMessageId: message.id },
    },
  });
  // touch updatedAt so the conversation sorts to the top of the inbox
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });
  emitInboxEvent({ type: "message", conversationId: conversation.id });

  // Only auto-reply while AI owns the conversation and the message is text.
  if (conversation.status !== "AI_HANDLING") return;

  if (!isText) {
    await escalate(conversation.id);
    return;
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const result = await generateAutoReply(
    message.text,
    history.reverse().map((m) => ({ sender: m.sender, content: m.content }))
  );

  if (result.ok && result.confident && result.answer) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        sender: "AI",
        content: result.answer,
        metadata: { reason: result.reason },
      },
    });
    emitInboxEvent({ type: "message", conversationId: conversation.id });
    if (event.replyToken) {
      await safeReply(event.replyToken, result.answer);
    }
  } else {
    await escalate(conversation.id, result.reason);
    if (event.replyToken) {
      await safeReply(event.replyToken, HOLDING_MESSAGE);
    }
  }
}

async function upsertContact(lineUserId: string) {
  const existing = await prisma.contact.findUnique({ where: { lineUserId } });
  if (existing) return existing;
  const profile = await getProfile(lineUserId);
  return prisma.contact.create({
    data: { lineUserId, name: profile?.displayName ?? null },
  });
}

async function findOrCreateConversation(contactId: string) {
  const open = await prisma.conversation.findFirst({
    where: { contactId, channel: "LINE", status: { not: "CLOSED" } },
    orderBy: { updatedAt: "desc" },
  });
  if (open) return open;
  return prisma.conversation.create({
    data: { contactId, channel: "LINE", status: "AI_HANDLING" },
  });
}

async function escalate(conversationId: string, reason?: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "HUMAN_HANDLING" },
  });
  emitInboxEvent({ type: "conversation", conversationId });
  if (reason) {
    console.log(`conversation ${conversationId} escalated: ${reason}`);
  }
}

async function safeReply(replyToken: string, text: string) {
  try {
    await replyText(replyToken, text);
  } catch (error) {
    // reply token may be expired/invalid (or LINE creds missing in dev)
    console.error("LINE reply failed:", error);
  }
}
