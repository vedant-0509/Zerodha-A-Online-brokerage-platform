require("dotenv").config();

const {
  connectMongoDB,
  closeMongoDB,
} = require("../config/mongodb");

const {
  runDailySyncIfNeeded,
} = require("./mfSyncScheduler");

const LOCK_RETRY_ATTEMPTS = 20;
const LOCK_RETRY_DELAY_MS = 30 * 1000;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  let exitCode = 0;

  try {
    await connectMongoDB();

    console.log(
      `[MF CRON] Starting scheduled NAV sync at ${new Date().toISOString()}.`
    );

    let result = null;

    for (let attempt = 1; attempt <= LOCK_RETRY_ATTEMPTS; attempt += 1) {
      result = await runDailySyncIfNeeded("render-cron", { scheduled: true });

      if (result?.reason !== "locked") {
        break;
      }

      if (attempt === LOCK_RETRY_ATTEMPTS) {
        console.error(
          `[MF CRON] Another sync held the distributed lock after ${LOCK_RETRY_ATTEMPTS} attempts; reporting this cron run as failed instead of silently skipping it.`
        );
        exitCode = 1;
        break;
      }

      console.warn(
        `[MF CRON] Another sync currently owns the lock (attempt ${attempt}/${LOCK_RETRY_ATTEMPTS}); retrying in ${LOCK_RETRY_DELAY_MS / 1000}s.`
      );
      await sleep(LOCK_RETRY_DELAY_MS);
    }

    if (!result?.success) {
      exitCode = 1;
      console.error(
        `[MF CRON] Daily synchronization failed: ${result?.error || "unknown error"}`
      );
    } else if (result.skipped && result.reason !== "locked") {
      console.log(
        `[MF CRON] Run safely skipped: ${result.reason || "no reason returned"}.`
      );
    } else if (!result.skipped) {
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
