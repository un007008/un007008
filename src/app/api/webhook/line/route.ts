import { NextRequest, NextResponse } from "next/server";
import type { webhook } from "@line/bot-sdk";

import { prisma } from "@/lib/db";
import { generateAutoReply } from "@/lib/ai/reply";
import { emitInboxEvent } from "@/lib/inbox/bus";
import { getProfile, pushText, replyText, verifyLineSignature } from "@/lib/line/client";

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
  const lineUserId = event.source?.type === "user" ? event.source.userId : null;
  if (!lineUserId) return;

  if (event.type === "follow") {
    await upsertContact(lineUserId);
    return;
  }

  if (event.type !== "message") return;

  const message = event.message;

  // Dedup by LINE message id (not deliveryContext.isRedelivery): a redelivered
  // event whose first attempt crashed before the insert must still be processed.
  const duplicate = await prisma.message.findFirst({
    where: { metadata: { path: ["lineMessageId"], equals: message.id } },
    select: { id: true },
  });
  if (duplicate) return;

  const contact = await upsertContact(lineUserId);
  const conversation = await findOrCreateConversation(contact.id);

  const isText = message.type === "text";
  const content = isText ? message.text : `[${message.type}]`;

  const inbound = await prisma.message.create({
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
    await escalate(conversation.id, "non-text message");
    await sendToCustomer(lineUserId, HOLDING_MESSAGE, event.replyToken);
    return;
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id, NOT: { id: inbound.id } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const result = await generateAutoReply(
    message.text,
    history.reverse().map((m) => ({ sender: m.sender, content: m.content }))
  );

  // Re-check: staff may have taken over while the AI was generating.
  const current = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: { status: true },
  });
  if (current?.status !== "AI_HANDLING") return;

  if (result.ok && result.confident && result.answer) {
    const delivered = await sendToCustomer(lineUserId, result.answer, event.replyToken);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        sender: "AI",
        content: result.answer,
        metadata: { reason: result.reason, lineDelivered: delivered },
      },
    });
    emitInboxEvent({ type: "message", conversationId: conversation.id });
    // customer never got the answer — hand over so staff follows up
    if (!delivered) await escalate(conversation.id, "LINE delivery failed");
  } else {
    await escalate(conversation.id, result.reason);
    await sendToCustomer(lineUserId, HOLDING_MESSAGE, event.replyToken);
  }
}

async function upsertContact(lineUserId: string) {
  const existing = await prisma.contact.findUnique({ where: { lineUserId } });
  if (existing) return existing;
  const profile = await getProfile(lineUserId);
  try {
    return await prisma.contact.create({
      data: { lineUserId, name: profile?.displayName ?? null },
    });
  } catch {
    // unique-constraint race: a concurrent webhook created the contact first
    const created = await prisma.contact.findUnique({ where: { lineUserId } });
    if (created) return created;
    throw new Error(`contact create failed for ${lineUserId}`);
  }
}

async function findOrCreateConversation(contactId: string) {
  // Advisory lock serializes concurrent webhooks for the same contact so two
  // quick messages can't split into two open conversations.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactId}))`;
    const open = await tx.conversation.findFirst({
      where: { contactId, channel: "LINE", status: { not: "CLOSED" } },
      orderBy: { updatedAt: "desc" },
    });
    if (open) return open;
    return tx.conversation.create({
      data: { contactId, channel: "LINE", status: "AI_HANDLING" },
    });
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

/** Reply with the token, fall back to push if it expired. Returns delivered? */
async function sendToCustomer(
  lineUserId: string,
  text: string,
  replyToken?: string
): Promise<boolean> {
  if (replyToken) {
    try {
      await replyText(replyToken, text);
      return true;
    } catch (error) {
      console.error("LINE reply failed, falling back to push:", error);
    }
  }
  try {
    await pushText(lineUserId, text);
    return true;
  } catch (error) {
    // LINE creds missing in dev, or user blocked the bot
    console.error("LINE push failed:", error);
    return false;
  }
}
