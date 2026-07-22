import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * AI provider switch: set GEMINI_API_KEY to use Gemini (free tier available),
 * else ANTHROPIC_API_KEY to use Claude. Neither set = AI features disabled
 * (chat escalates to humans, translate/summary unavailable).
 *
 * PDPA note: Gemini's free tier may use submitted data for training —
 * fine for testing, reconsider before sending real customer chats.
 */

export type AiProvider = "gemini" | "anthropic";

export function aiProvider(): AiProvider | null {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const CLAUDE_MODEL = "claude-opus-4-8";

/** Keep only the JSON-Schema keywords Gemini's responseSchema accepts. */
function toGeminiSchema(node: unknown): Record<string, unknown> {
  const o = (node ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (typeof o.type === "string") out.type = o.type;
  if (typeof o.description === "string") out.description = o.description;
  if (Array.isArray(o.enum)) out.enum = o.enum;
  if (Array.isArray(o.required)) out.required = o.required;
  if (o.properties && typeof o.properties === "object") {
    out.properties = Object.fromEntries(
      Object.entries(o.properties as Record<string, unknown>).map(([k, v]) => [
        k,
        toGeminiSchema(v),
      ])
    );
  }
  if (o.items) out.items = toGeminiSchema(o.items);
  return out;
}

/**
 * Provider-agnostic structured completion. Returns the parsed object or
 * null on refusal/parse failure/API error — never throws.
 */
export async function structuredCompletion<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  const provider = aiProvider();
  try {
    if (provider === "gemini") return await geminiCompletion(opts);
    if (provider === "anthropic") return await anthropicCompletion(opts);
    return null;
  } catch (error) {
    console.error(`[ai] ${provider} completion failed:`, error);
    return null;
  }
}

async function anthropicCompletion<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  return response.parsed_output;
}

async function geminiCompletion<T>(opts: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1024,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(z.toJSONSchema(opts.schema)),
        },
      }),
    }
  );
  if (!res.ok) {
    console.error(`[ai] gemini HTTP ${res.status}:`, (await res.text()).slice(0, 500));
    return null;
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) return null;
  const parsed = opts.schema.safeParse(JSON.parse(text));
  return parsed.success ? parsed.data : null;
}
