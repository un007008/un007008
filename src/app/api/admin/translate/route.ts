import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { apiSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const TranslationSchema = z.object({
  translations: z
    .array(
      z.object({
        key: z.string().describe("same key as the input item"),
        en: z.string().describe("natural English translation"),
        zh: z.string().describe("natural Simplified Chinese translation"),
      })
    )
    .describe("one item per input text, same keys"),
});

/**
 * Translate Thai marketing copy to EN + ZH with Claude.
 * body: { items: { key: string, th: string }[] }
 */
export async function POST(req: NextRequest) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { items } = (await req.json()) as { items?: { key: string; th: string }[] };
  const valid = (items ?? []).filter((i) => i.key && i.th?.trim());
  if (valid.length === 0) {
    return NextResponse.json({ error: "no items" }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: zodOutputFormat(TranslationSchema),
      },
      system:
        "You translate Thai real-estate website copy into English and Simplified Chinese. Keep the marketing tone, keep it concise, do not add information. Return every input key exactly once.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(valid),
        },
      ],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return NextResponse.json({ error: "translation failed" }, { status: 502 });
    }
    return NextResponse.json(response.parsed_output);
  } catch (error) {
    console.error("translate failed:", error);
    return NextResponse.json(
      { error: "translation unavailable (check ANTHROPIC_API_KEY)" },
      { status: 502 }
    );
  }
}
