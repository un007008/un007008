import { NextRequest, NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { emitInboxEvent } from "@/lib/inbox/bus";

export const dynamic = "force-dynamic";

/**
 * Change conversation state.
 * action: "ai_takeover" | "close" | "assign_me"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action } = (await req.json()) as { action?: string };

  const data =
    action === "ai_takeover"
      ? { status: "AI_HANDLING" as const }
      : action === "close"
        ? { status: "CLOSED" as const }
        : action === "assign_me"
          ? { assignedTo: session.user.id, status: "HUMAN_HANDLING" as const }
          : null;

  if (!data) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const conversation = await prisma.conversation.update({
    where: { id: params.id },
    data,
  });

  emitInboxEvent({ type: "conversation", conversationId: conversation.id });
  return NextResponse.json(conversation);
}
