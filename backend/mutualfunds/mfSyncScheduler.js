const cron = require("node-cron");

const {
  connectMongoDB,
  getMongoDB,
} = require("../config/mongodb");

const {
  syncLatestNAV,
  syncAllReturns,
} = require("./mfSyncService");

const {
  calculateAllRatings,
} = require("./mfRatingRiskService");

const {
  getSyncStatus,
  hasTodaysSyncSucceeded,
  markRunning,
  markSuccess,
  markFailed,
} = require("./mfSyncStatusService");

const {
  shouldRecoverStartupSync,
  didSucceedAfterScheduledTime,
} = require("./mfSyncCalendar");

const NAV_SYNC_NAME = "mf_nav_sync";
const DAILY_SYNC_NAME = "mf_daily_sync";
const RETURNS_SYNC_NAME = "mf_returns_sync";
const RATING_SYNC_NAME = "mf_rating_sync";

const DAILY_LOCK_NAME = "mf_daily_sync_lock";

const MF_SYNC_CRON =
  process.env.MF_SYNC_CRON ||
  "15 23 * * 1-5";

const MF_SYNC_STARTUP_RECOVERY =
  String(
    process.env.MF_SYNC_STARTUP_RECOVERY ||
      "true"
  ).toLowerCase() !== "false";

const MF_SYNC_TIMEZONE =
  process.env.MF_SYNC_TIMEZONE ||
  "Asia/Kolkata";

const LOCK_TIMEOUT_MS = Math.max(
  1000,
  Number(
    process.env.MF_SYNC_LOCK_TIMEOUT_MS ||
      30000
  )
);

const LOCK_DURATION_MS = Math.max(
  60 * 1000,
  Number(
    process.env.MF_SYNC_LOCK_DURATION_MS ||
      10 * 60 * 1000
  )
);

let schedulerTask = null;

/*
|--------------------------------------------------------------------------
| MongoDB distributed lock
|--------------------------------------------------------------------------
|
| Replaces MySQL GET_LOCK / RELEASE_LOCK.
|
| Collection:
|   mfSyncLocks
|
| A lock automatically expires after LOCK_DURATION_MS.
|
*/

async function acquireLock(name) {
  await connectMongoDB();

  const db = getMongoDB();
  const locks = db.collection("mfSyncLocks");

  const owner =
    `${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const startedAt = new Date();

  const expiresAt = new Date(
    Date.now() + LOCK_DURATION_MS
  );

  /*
   * First try to take an existing expired lock.
   */
  const expiredResult =
    await locks.findOneAndUpdate(
      {
        _id: name,
        expiresAt: {
          $lte: startedAt,
        },
      },
      {
        $set: {
          owner,
          acquiredAt: startedAt,
          expiresAt,
          updatedAt: startedAt,
        },
      },
      {
        returnDocument: "after",
      }
    );

  if (
    expiredResult &&
    expiredResult.owner === owner
  ) {
    return {
      acquired: true,
      owner,
    };
  }

  /*
   * Try to create the lock if it doesn't exist.
   */
  try {
    await locks.insertOne({
      _id: name,
      owner,
      acquiredAt: startedAt,
      expiresAt,
      updatedAt: startedAt,
    });

    return {
      acquired: true,
      owner,
    };
  } catch (error) {
    /*
     * Duplicate key means another process already owns
     * the lock.
     */
    if (
      error &&
      error.code === 11000
    ) {
      return {
        acquired: false,
        owner: null,
      };
    }

    throw error;
  }
}

async function releaseLock(
  name,
  owner
) {
  if (!owner) return;

  try {
    await connectMongoDB();

    const db = getMongoDB();
    const locks =
      db.collection("mfSyncLocks");

    await locks.deleteOne({
      _id: name,
      owner,
    });
  } catch (error) {
    console.error(
      `[MF SYNC] Could not release lock: ${error.message}`
    );
  }
}

/*
|--------------------------------------------------------------------------
| Scheduled-time helpers
|--------------------------------------------------------------------------
*/

function getScheduledMinutes() {
  const pieces =
    MF_SYNC_CRON
      .trim()
      .split(/\s+/);

  if (pieces.length !== 5) {
    return 23 * 60 + 15;
  }

  const minute =
    Number(pieces[0]);

  const hour =
    Number(pieces[1]);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return 23 * 60 + 15;
  }

  return (
    hour * 60 + minute
  );
}



/*
|--------------------------------------------------------------------------
| Latest NAV date from MongoDB
|--------------------------------------------------------------------------
*/

async function getLatestActiveNavDate() {
  await connectMongoDB();

  const db = getMongoDB();

  const latest =
    await db
      .collection("mfSchemes")
      .find(
        {
          isActive: true,
          navDate: {
            $exists: true,
            $ne: null,
          },
        },
        {
          projection: {
            navDate: 1,
          },
        }
      )
      .sort({
        navDate: -1,
      })
      .limit(1)
      .next();

  return (
    latest?.navDate ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| Main MF synchronization pipeline
|--------------------------------------------------------------------------
*/

async function runPipeline(
  reason,
  {
    startup = false,
    scheduled = false,
  } = {}
) {
  let lockOwner = null;
  let locked = false;

  try {
    await connectMongoDB();

    /*
     * Acquire MongoDB distributed lock.
     */
    const lock =
      await acquireLock(
        DAILY_LOCK_NAME
      );

    locked = lock.acquired;
    lockOwner = lock.owner;

    if (!locked) {
      console.log(
        `[MF SYNC] ${reason}: another daily synchronization is running.`
      );

      return {
        success: true,
        skipped: true,
        reason: "locked",
      };
    }

    /*
     * Check whether today's complete sync
     * already succeeded.
     */
    let alreadyComplete =
      await hasTodaysSyncSucceeded(
        DAILY_SYNC_NAME
      );

    /*
     * A startup catch-up can succeed earlier in the day, before the
     * official NAV report is updated. The dedicated 23:15 IST cron must
     * still run unless today's success occurred at/after the scheduled
     * cutoff. This prevents an early catch-up from suppressing the normal
     * end-of-day refresh.
     */
    if (alreadyComplete && scheduled) {
      const dailyStatus = await getSyncStatus(DAILY_SYNC_NAME);
      const scheduledRunAlreadySucceeded = didSucceedAfterScheduledTime(
        dailyStatus,
        new Date(),
        {
          scheduleMinuteOfDay: getScheduledMinutes(),
          timeZone: MF_SYNC_TIMEZONE,
        }
      );

      if (!scheduledRunAlreadySucceeded) {
        console.log(
          `[MF SYNC] ${reason}: a sync succeeded earlier today, before the ${MF_SYNC_CRON} cutoff; continuing with the scheduled refresh.`
        );
        alreadyComplete = false;
      }
    }

    if (alreadyComplete) {
      console.log(
        `[MF SYNC] ${reason}: today's complete sync already exists. No provider call.`
      );

      return {
        success: true,
        skipped: true,
        reason: "already-complete-today",
      };
    }

    /*
     * Startup recovery compares the persisted daily-sync success
     * timestamp to the latest weekday whose scheduled run was due.
     * It catches up missed runs on weekends as well as weekdays, while
     * skipping recovery after that expected run has succeeded.
     */
    if (
      startup &&
      MF_SYNC_STARTUP_RECOVERY
    ) {
      const dailyStatus = await getSyncStatus(DAILY_SYNC_NAME);
      const recovery = shouldRecoverStartupSync(
        dailyStatus,
        new Date(),
        {
          scheduleMinuteOfDay: getScheduledMinutes(),
          timeZone: MF_SYNC_TIMEZONE,
        }
      );

      if (!recovery.shouldRun) {
        console.log(
          `[MF SYNC] startup: latest expected sync date ${recovery.expectedDate} is already successful (last success ${recovery.lastSuccessDate}); catch-up not needed.`
        );

        return {
          success: true,
          skipped: true,
          reason: "startup-sync-current",
          expectedDate: recovery.expectedDate,
          lastSuccessDate: recovery.lastSuccessDate,
        };
      }

      console.log(
        `[MF SYNC] startup: catch-up required for expected sync date ${recovery.expectedDate}; last successful run date is ${recovery.lastSuccessDate || "unknown"}.`
      );
    }

    if (
      startup &&
      !MF_SYNC_STARTUP_RECOVERY
    ) {
      console.log(
        "[MF SYNC] startup recovery disabled by configuration."
      );

      return {
        success: true,
        skipped: true,
        reason:
          "startup-recovery-disabled",
      };
    }

    /*
     * Mark daily and NAV synchronization as running.
     */
    await markRunning(
      DAILY_SYNC_NAME
    );

    await markRunning(
      NAV_SYNC_NAME
    );

    console.log(
      `[MF SYNC] ${reason}: starting daily NAV + returns + risk + rating pipeline.`
    );

    /*
     * ---------------------------------------------------------------
     * 1. NAV SYNC
     * ---------------------------------------------------------------
     *
     * One bulk provider call.
     */
    const navResult =
      await syncLatestNAV();

    if (
      !navResult.success ||
      navResult.skipped
    ) {
      throw new Error(
        navResult.error ||
          navResult.reason ||
          "Latest NAV synchronization did not complete"
      );
    }

    if (
      navResult.missingActive >
      0
    ) {
      throw new Error(
        `${navResult.missingActive} active schemes are missing from the provider report`
      );
    }

    if (
      navResult.failed > 0 ||
      navResult.invalid > 0
    ) {
      throw new Error(
        `NAV synchronization completed with invalid/failed records: invalid=${navResult.invalid}, failed=${navResult.failed}`
      );
    }

    /*
     * NAV sync successful.
     */
    await markSuccess(
      NAV_SYNC_NAME,
      {
        processed:
          Number(
            navResult.fetched || 0
          ),
        updated:
          Number(
            navResult.updated || 0
          ),
        failed:
          Number(
            navResult.failed || 0
          ) +
          Number(
            navResult.invalid || 0
          ),
      },
      navResult.latestActiveNavDate
    );

    console.log(
      `[MF NAV] active=${navResult.activeFunds}, fetched=${navResult.fetched}, updated=${navResult.updated}, unchanged=${navResult.unchanged}, newNavDays=${navResult.newNavDays}, latestActiveNavDate=${navResult.latestActiveNavDate}`
    );

    /*
     * ---------------------------------------------------------------
     * 2. RETURNS + RISK
     * ---------------------------------------------------------------
     */
    await markRunning(
      RETURNS_SYNC_NAME
    );

    console.log(
      `[MF SYNC] ${reason}: calculating returns and risk.`
    );

    const returnsResult =
      await syncAllReturns();

    if (
      !returnsResult.success ||
      returnsResult.skipped ||
      returnsResult.failed > 0
    ) {
      throw new Error(
        `Returns/risk stage failed: processed=${returnsResult.processed}, failed=${returnsResult.failed}`
      );
    }

    const latestActiveNavDate =
      navResult.latestActiveNavDate ||
      (await getLatestActiveNavDate());

    await markSuccess(
      RETURNS_SYNC_NAME,
      {
        processed:
          Number(
            returnsResult.processed || 0
          ),
        updated:
          Number(
            returnsResult.updated || 0
          ),
        failed:
          Number(
            returnsResult.failed || 0
          ),
      },
      latestActiveNavDate
    );

    /*
     * ---------------------------------------------------------------
     * 3. RATINGS
     * ---------------------------------------------------------------
     *
     * Ratings use already stored MongoDB values.
     * No additional provider history sweep.
     */
    await markRunning(
      RATING_SYNC_NAME
    );

    console.log(
      `[MF SYNC] ${reason}: calculating ratings from DB values.`
    );

    const ratingResult =
      await calculateAllRatings();

    if (
      !ratingResult ||
      ratingResult.failed > 0
    ) {
      throw new Error(
        `Rating stage failed: processed=${ratingResult?.processed || 0}, failed=${ratingResult?.failed || 0}`
      );
    }

    await markSuccess(
      RATING_SYNC_NAME,
      {
        processed:
          Number(
            ratingResult.processed ||
              0
          ),
        updated:
          Number(
            ratingResult.updated ||
              0
          ),
        failed:
          Number(
            ratingResult.failed ||
              0
          ),
      },
      latestActiveNavDate
    );

    /*
     * ---------------------------------------------------------------
     * 4. DAILY SYNC SUCCESS
     * ---------------------------------------------------------------
     */
    const latestNavDate =
      await getLatestActiveNavDate();

    await markSuccess(
      DAILY_SYNC_NAME,
      {
        processed:
          Number(
            returnsResult.processed ||
              0
          ),
        updated:
          Number(
            navResult.updated ||
              0
          ) +
          Number(
            returnsResult.updated ||
              0
          ) +
          Number(
            ratingResult.updated ||
              0
          ),
        failed: 0,
      },
      latestNavDate
    );

    console.log(
      "================================================"
    );

    console.log(
      `[MF SYNC] ${reason}: DAILY SYNCHRONIZATION SUCCESSFUL`
    );

    console.log(
      `[MF SYNC] Active funds: ${navResult.activeFunds}`
    );

    console.log(
      `[MF SYNC] NAV updated: ${navResult.updated}`
    );

    console.log(
      `[MF SYNC] Returns updated: ${returnsResult.updated}`
    );

    console.log(
      `[MF SYNC] Ratings updated: ${ratingResult.updated}`
    );

    console.log(
      `[MF SYNC] NAV date: ${latestNavDate}`
    );

    console.log(
      "================================================"
    );

    return {
      success: true,
      skipped: false,
      nav: navResult,
      returns: returnsResult,
      ratings: ratingResult,
    };
  } catch (error) {
    console.error(
      `[MF SYNC] ${reason}: ${error.message}`
    );

    /*
     * Record failure in MongoDB.
     */
    try {
      await markFailed(
        DAILY_SYNC_NAME,
        error.message
      );

      await markFailed(
        NAV_SYNC_NAME,
        error.message
      );

      await markFailed(
        RETURNS_SYNC_NAME,
        error.message
      );

      await markFailed(
        RATING_SYNC_NAME,
        error.message
      );
    } catch (statusError) {
      console.error(
        `[MF SYNC] Could not record sync failure: ${statusError.message}`
      );
    }

    return {
      success: false,
      skipped: false,
      error: error.message,
    };
  } finally {
    /*
     * Always release the MongoDB lock.
     */
    if (locked) {
      await releaseLock(
        DAILY_LOCK_NAME,
        lockOwner
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| Startup synchronization
|--------------------------------------------------------------------------
*/

async function runStartupSync() {
  setImmediate(async () => {
    try {
      await runPipeline(
        "startup",
        {
          startup: true,
          scheduled: false,
        }
      );
    } catch (error) {
      console.error(
        `[MF SYNC] startup error: ${error.message}`
      );
    }
  });
}

/*
|--------------------------------------------------------------------------
| Cron scheduler
|--------------------------------------------------------------------------
*/

function startMFScheduler() {
  if (
    !cron.validate(
      MF_SYNC_CRON
    )
  ) {
    throw new Error(
      `Invalid MF_SYNC_CRON: ${MF_SYNC_CRON}`
    );
  }

  /*
   * Prevent accidental duplicate scheduler
   * registration.
   */
  if (schedulerTask) {
    console.log(
      "[MF SYNC] Scheduler already running."
    );

    return schedulerTask;
  }

  schedulerTask =
    cron.schedule(
      MF_SYNC_CRON,
      () => {
        runPipeline(
          "scheduled",
          {
            startup: false,
            scheduled: true,
          }
        ).catch((error) => {
          console.error(
            `[MF SYNC] scheduled error: ${error.message}`
          );
        });
      },
      {
        timezone:
          MF_SYNC_TIMEZONE,
      }
    );

  console.log(
    `[MF SYNC] Scheduler active: ${MF_SYNC_CRON} (${MF_SYNC_TIMEZONE})`
  );

  return schedulerTask;
}

/*
|--------------------------------------------------------------------------
| Stop scheduler
|--------------------------------------------------------------------------
*/

function stopMFScheduler() {
  if (!schedulerTask) {
    return;
  }

  schedulerTask.stop();
  schedulerTask = null;

  console.log(
    "[MF SYNC] Scheduler stopped"
  );
}

/*
|--------------------------------------------------------------------------
| Manual daily sync
|--------------------------------------------------------------------------
*/

async function runDailySyncIfNeeded(
  reason = "manual",
  {
    scheduled = false,
  } = {}
) {
  return runPipeline(
    reason,
    {
      startup: false,
      scheduled,
    }
  );
}

module.exports = {
  runStartupSync,
  startMFScheduler,
  stopMFScheduler,
  runDailySyncIfNeeded,
};
