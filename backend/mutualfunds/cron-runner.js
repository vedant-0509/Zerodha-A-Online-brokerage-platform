require("dotenv").config();

const {
  connectMongoDB,
  closeMongoDB,
} = require("../config/mongodb");

const {
  runDailySyncIfNeeded,
} = require("./mfSyncScheduler");

async function main() {
  let exitCode = 0;

  try {
    await connectMongoDB();

    console.log(
      `[MF CRON] Starting scheduled NAV sync at ${new Date().toISOString()}.`
    );

    const result = await runDailySyncIfNeeded("render-cron", { scheduled: true });

    if (!result?.success) {
      exitCode = 1;
      console.error(
        `[MF CRON] Daily synchronization failed: ${result?.error || "unknown error"}`
      );
    } else if (result.skipped) {
      console.log(
        `[MF CRON] Run safely skipped: ${result.reason || "no reason returned"}.`
      );
    } else {
      console.log("[MF CRON] Daily synchronization completed successfully.");
    }
  } catch (error) {
    exitCode = 1;
    console.error("[MF CRON] Fatal error:", error?.stack || error);
  } finally {
    try {
      await closeMongoDB();
    } catch (error) {
      exitCode = 1;
      console.error("[MF CRON] Failed to close MongoDB cleanly:", error?.message || error);
    }
  }

  process.exitCode = exitCode;
}

main();
