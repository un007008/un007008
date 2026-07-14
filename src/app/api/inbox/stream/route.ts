import { NextRequest } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { inboxBus, type InboxEvent } from "@/lib/inbox/bus";

export const dynamic = "force-dynamic";

/** SSE stream of inbox events (new messages, status changes). */
export async function GET(req: NextRequest) {
  const session = await apiSession();
  if (!session) return new Response("unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: InboxEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // controller already closed
        }
      };

      inboxBus.on("inbox", send);
      controller.enqueue(encoder.encode(`: connected\n\n`));

      // heartbeat keeps proxies from closing the connection
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        inboxBus.off("inbox", send);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
