import cron from "node-cron";

import { runAllJobs } from "./jobs";

/** Start daily automation (03:00 Asia/Bangkok). Singleton across hot reloads. */
const globalForCron = globalThis as unknown as { cronStarted?: boolean };

export function startCron() {
  if (globalForCron.cronStarted) return;
  globalForCron.cronStarted = true;

  cron.schedule(
    "0 3 * * *",
    async () => {
      console.log("[automation] daily jobs starting");
      try {
        const result = await runAllJobs();
        console.log(
          `[automation] done: ${result.contracts.items.length} expiring contracts (notified=${result.contracts.notified}), ${result.staleLeads.items.length} stale leads (notified=${result.staleLeads.notified})`
        );
      } catch (error) {
        console.error("[automation] daily jobs failed:", error);
      }
    },
    { timezone: "Asia/Bangkok" }
  );

  console.log("[automation] cron scheduled (daily 03:00 Asia/Bangkok)");
}
