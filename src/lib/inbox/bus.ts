import { EventEmitter } from "events";

/**
 * In-process event bus for inbox realtime (SSE).
 * Single-process deployment (Railway) — swap for Redis pub/sub if scaled out.
 * globalThis singleton survives Next.js dev hot-reload, same trick as db.ts.
 */

export type InboxEvent =
  | { type: "message"; conversationId: string }
  | { type: "conversation"; conversationId: string }; // status/assignment change

const globalForBus = globalThis as unknown as { inboxBus?: EventEmitter };

export const inboxBus = globalForBus.inboxBus ?? new EventEmitter();
inboxBus.setMaxListeners(100);

if (process.env.NODE_ENV !== "production") globalForBus.inboxBus = inboxBus;

export function emitInboxEvent(event: InboxEvent) {
  inboxBus.emit("inbox", event);
}
