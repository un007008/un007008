import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

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

let _anthropic: Anthropic | null = null;
function anthropic() {
  if (!_anthropic) _anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
  return _anthropic;
}

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

    const response = await anthropic().messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      output_config: {
        // low effort: chat replies are latency-sensitive and KB lookup is simple
        effort: "low",
        format: zodOutputFormat(AutoReplySchema),
      },
      system: [
        "You are the LINE customer-service assistant for Bangkok Prime Property (BPP), a Thai real-estate agency.",
        "Answer ONLY from the knowledge base below. If the knowledge base does not clearly cover the question, set confident=false so a human agent takes over.",
        "Reply in Thai, polite female register (ค่ะ/นะคะ), short and friendly. Never invent prices, availability, or legal details.",
        "",
        "## Knowledge base",
        kb || "(empty)",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            historyText ? `บทสนทนาก่อนหน้า:\n${historyText}\n` : "",
            `ข้อความล่าสุดจากลูกค้า: ${customerMessage}`,
          ].join("\n"),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ok: false, confident: false, answer: "", reason: "AI ตอบไม่ได้" };
    }
    return { ok: true, ...response.parsed_output };
  } catch (error) {
    console.error("generateAutoReply failed:", error);
    return { ok: false, confident: false, answer: "", reason: "AI ขัดข้อง" };
  }
}
