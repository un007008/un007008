import { NextResponse } from "next/server";

import { apiSession } from "@/lib/api-auth";
import { runAllJobs } from "@/lib/automation/jobs";

export const dynamic = "force-dynamic";

/** Manually trigger the daily automation (for testing / on-demand). */
export async function POST() {
  const session = await apiSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await runAllJobs();
  return NextResponse.json(result);
}
