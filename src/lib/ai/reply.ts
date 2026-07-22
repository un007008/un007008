import { z } from "zod";

import { structuredCompletion } from "@/lib/ai/provider";
import { prisma } from "@/lib/db";

const AutoReplySchema = z.object({
  confident: z
    .boolean()
    .describe(
      "true only when the knowledge base clearly answers the customer's question"
    ),
  answer: z
    .string()
    .describe(
      "Reply to the customer in Thai, polite female register (ค่ะ/นะคะ). Empty string when not confident."
    ),
  reason: z
    .string()
    .describe("Short note (Thai) for staff: why confident or why escalating"),
});

export type AutoReplyResult = z.infer<typeof AutoReplySchema> & {
  ok: boolean; // false = AI unavailable/errored -> caller must escalate
};

/**
 * Generate an auto-reply for a customer message using the knowledge base.
 * Never throws — on any failure returns { ok: false } so the webhook can
 * escalate the conversation to a human instead of crashing.
 */
export async function generateAutoReply(
  customerMessage: string,
  history: { sender: string; content: string }[] = []
): Promise<AutoReplyResult> {
  try {
    const entries = await prisma.knowledgeEntry.findMany({
      where: { active: true },
    });

    const kb = entries
      .map((e, i) => `${i + 1}. คำถาม: ${e.question}\n   คำตอบ: ${e.answer}`)
      .join("\n");

    const historyText = history
      .slice(-10)
      .map((m) => `${m.sender === "CUSTOMER" ? "ลูกค้า" : "แอดมิน"}: ${m.content}`)
      .join("\n");

    const result = await structuredCompletion({
      schema: AutoReplySchema,
      maxTokens: 1024,
      system: [
        "You are the LINE customer-service assistant for Bangkok Prime Property (BPP), a Thai real-estate agency.",
        "Answer ONLY from the knowledge base below. If the knowledge base does not clearly cover the question, set confident=false so a human agent takes over.",
        "Reply in Thai, polite female register (ค่ะ/นะคะ), short and friendly. Never invent prices, availability, or legal details.",
        "",
        "## Knowledge base",
        kb || "(empty)",
      ].join("\n"),
      user: [
        historyText ? `บทสนทนาก่อนหน้า:\n${historyText}\n` : "",
        `ข้อความล่าสุดจากลูกค้า: ${customerMessage}`,
      ].join("\n"),
    });

    if (!result) {
      return { ok: false, confident: false, answer: "", reason: "AI ตอบไม่ได้" };
    }
    return { ok: true, ...result };
  } catch (error) {
    console.error("generateAutoReply failed:", error);
    return { ok: false, confident: false, answer: "", reason: "AI ขัดข้อง" };
  }
}
