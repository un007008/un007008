import crypto from "crypto";
import { messagingApi } from "@line/bot-sdk";

let _client: messagingApi.MessagingApiClient | null = null;

export function lineClient() {
  if (!_client) {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
    _client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
  }
  return _client;
}

/** Verify x-line-signature header against the raw request body. */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function replyText(replyToken: string, text: string) {
  await lineClient().replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function pushText(lineUserId: string, text: string) {
  await lineClient().pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
}

export async function getProfile(lineUserId: string) {
  try {
    return await lineClient().getProfile(lineUserId);
  } catch {
    return null; // profile may be unavailable (user blocked bot, etc.)
  }
}
