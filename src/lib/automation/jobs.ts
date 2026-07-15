import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { lineClient } from "@/lib/line/client";

/** Push a text message to the staff LINE group when configured. */
async function notifyStaff(text: string): Promise<boolean> {
  const groupId = process.env.LINE_STAFF_GROUP_ID;
  if (!groupId) {
    console.log("[automation] staff notify (no LINE_STAFF_GROUP_ID):\n" + text);
    return false;
  }
  try {
    await lineClient().pushMessage({ to: groupId, messages: [{ type: "text", text }] });
    return true;
  } catch (error) {
    console.error("[automation] LINE staff push failed:", error);
    return false;
  }
}

function thb(n: unknown) {
  return Number(n).toLocaleString("th-TH");
}

/** Rental contracts expiring within 7 or 30 days -> staff alert. */
export async function checkExpiringContracts() {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);

  const deals = await prisma.deal.findMany({
    where: {
      dealType: "RENT",
      status: { in: ["SIGNED", "COMPLETED"] },
      contractEnd: { gte: now, lte: in30 },
    },
    include: { lead: { include: { contact: true } } },
    orderBy: { contractEnd: "asc" },
  });

  const items = deals.map((d) => {
    const days = Math.ceil((d.contractEnd!.getTime() - now.getTime()) / 86400000);
    return {
      dealId: d.id,
      contact: d.lead.contact.name ?? "ไม่ระบุชื่อ",
      amount: d.amount.toString(),
      contractEnd: d.contractEnd!.toISOString(),
      daysLeft: days,
      urgent: days <= 7,
    };
  });

  if (items.length > 0) {
    const lines = items.map(
      (i) =>
        `${i.urgent ? "🔴" : "🟡"} ${i.contact} — สัญญาหมด ${new Date(i.contractEnd).toLocaleDateString("th-TH")} (อีก ${i.daysLeft} วัน) ค่าเช่า ${thb(i.amount)} บ.`
    );
    await notifyStaff(`⏰ สัญญาเช่าใกล้หมดอายุ ${items.length} ราย\n${lines.join("\n")}`);
  }

  return items;
}

const STALE_DAYS = 7;

/** Leads with no update for STALE_DAYS days (and not closed) -> staff alert. */
export async function checkStaleLeads() {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86400000);

  const leads = await prisma.lead.findMany({
    where: {
      updatedAt: { lt: cutoff },
      stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
    },
    include: { contact: true },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const items = leads.map((l) => ({
    leadId: l.id,
    contact: l.contact.name ?? "ไม่ระบุชื่อ",
    stage: l.stage,
    assignee: l.assignedTo ? (userName.get(l.assignedTo) ?? "-") : "ยังไม่มอบหมาย",
    idleDays: Math.floor((Date.now() - l.updatedAt.getTime()) / 86400000),
  }));

  if (items.length > 0) {
    const lines = items
      .slice(0, 10)
      .map((i) => `• ${i.contact} (${i.assignee}) เงียบมา ${i.idleDays} วัน`);
    await notifyStaff(
      `💤 Lead ไม่มีความเคลื่อนไหวเกิน ${STALE_DAYS} วัน: ${items.length} ราย\n${lines.join("\n")}`
    );
  }

  return items;
}

const SummarySchema = z.object({
  totalConversations: z.number().describe("number of conversations analyzed"),
  intents: z
    .array(z.object({ intent: z.string(), count: z.number() }))
    .describe("aggregated customer intents in Thai, e.g. สอบถามราคา, นัดชม"),
  sentiment: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
  }),
  highlights: z.array(z.string()).describe("up to 5 noteworthy items in Thai, no personal data"),
});

/**
 * Nightly PDPA-friendly summary: aggregate intents/sentiment only,
 * no personally identifiable info stored. Stored in SiteConfig("summary:YYYY-MM-DD").
 */
export async function nightlySummary() {
  const since = new Date(Date.now() - 86400000);
  const messages = await prisma.message.findMany({
    where: { createdAt: { gte: since }, sender: "CUSTOMER" },
    orderBy: { createdAt: "asc" },
    take: 300,
    select: { conversationId: true, content: true },
  });

  if (messages.length === 0) return { skipped: "no messages" };
  if (!process.env.ANTHROPIC_API_KEY) return { skipped: "no ANTHROPIC_API_KEY" };

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: zodOutputFormat(SummarySchema) },
      system:
        "You analyze one day of Thai real-estate customer chat messages. Aggregate intents and sentiment. PDPA: never include names, phone numbers, or identifying details in the output.",
      messages: [
        {
          role: "user",
          content: messages.map((m) => `[${m.conversationId.slice(-4)}] ${m.content}`).join("\n"),
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { skipped: "ai refused" };
    }

    const key = `summary:${new Date().toISOString().slice(0, 10)}`;
    await prisma.siteConfig.upsert({
      where: { id: key },
      create: { id: key, data: response.parsed_output },
      update: { data: response.parsed_output },
    });

    const s = response.parsed_output;
    await notifyStaff(
      `🌙 สรุปแชทเมื่อวาน: ${s.totalConversations} บทสนทนา\n` +
        s.intents.slice(0, 5).map((i) => `• ${i.intent}: ${i.count}`).join("\n")
    );
    return s;
  } catch (error) {
    console.error("[automation] nightly summary failed:", error);
    return { skipped: "error" };
  }
}

/** Run everything once (used by cron and the manual trigger endpoint). */
export async function runAllJobs() {
  const [contracts, staleLeads, summary] = await Promise.all([
    checkExpiringContracts(),
    checkStaleLeads(),
    nightlySummary(),
  ]);
  return { contracts, staleLeads, summary };
}
