export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCron } = await import("@/lib/automation/cron");
    startCron();
  }
}
