// /*
// |--------------------------------------------------------------------------
// | MF Sync Scheduler
// |--------------------------------------------------------------------------
// |
// | This file owns the ONE decision point for "should we talk to MFapi right
// | now?". Both development server startup and the production cron job call
// | the exact same runDailySyncIfNeeded() function below - there is no
// | separate dev-only or prod-only sync logic.
// |
// | Two independent layers of protection are combined, as required:
// |
// |   1. mf_sync_status (MySQL table)
// |      Persistent record of whether TODAY's sync already succeeded.
// |      Survives process restarts, crashes, and multi-day downtime.
// |      This answers: "has today's sync already happened?"
// |
// |   2. MySQL advisory lock (GET_LOCK / RELEASE_LOCK)
// |      Prevents two Node processes (or two overlapping triggers on the
// |      same process) from running MFapi sync at the exact same time.
// |      This answers: "is a sync running right now, elsewhere?"
// |
// | An in-memory flag such as `let alreadySynced = false` is intentionally
// | NOT used anywhere here - it would not survive a restart and would not
// | protect against multiple Node instances.
// |
// */

// const cron = require('node-cron');
// const pool = require('./db');
// const { syncLatestNAV, syncAllReturns } = require('./mfSyncService');
// const {
//   hasTodaysSyncSucceeded,
//   markRunning,
//   markSuccess,
//   markFailed,
// } = require('./mfSyncStatusService');

// const SYNC_NAME = 'mf_daily_sync';
// const LOCK_NAME = 'mf_daily_sync_lock';
// // How long (seconds) a process waits for the advisory lock before giving up.
// // Default 0 = do not wait, skip immediately if another process already holds it.
// const LOCK_TIMEOUT_SECONDS = Math.max(0, Number(process.env.MF_SYNC_LOCK_TIMEOUT || 0));

// let schedulerTask = null;

// async function acquireLock(connection, name, timeoutSeconds) {
//   const [rows] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [name, timeoutSeconds]);
//   return Number(rows[0]?.acquired) === 1;
// }

// async function releaseLock(connection, name) {
//   try {
//     await connection.query('SELECT RELEASE_LOCK(?)', [name]);
//   } catch (_) {
//     // Releasing a lock we may not hold (e.g. connection already dropped) is not fatal.
//   }
// }

// /**
//  * The single synchronization entry point. Safe to call:
//  *  - every time the dev server starts (`node server.js`)
//  *  - from the production cron schedule
//  *  - concurrently from multiple processes
//  *  - repeatedly within the same process
//  *
//  * @param {string} reason - human-readable trigger, only used for logging.
//  */
// async function runDailySyncIfNeeded(reason = 'sync') {
//   let connection;
//   let locked = false;

//   try {
//     connection = await pool.getConnection();

//     console.log(`[MF SYNC] (${reason}) Checking today's sync status`);

//     locked = await acquireLock(connection, LOCK_NAME, LOCK_TIMEOUT_SECONDS);
//     if (!locked) {
//       console.log('[MF SYNC] Another synchronization is already running.');
//       console.log('[MF SYNC] Skipping duplicate sync.');
//       return { success: true, skipped: true, reason: 'locked' };
//     }
//     console.log('[MF SYNC] Acquired sync lock');

//     const alreadyDone = await hasTodaysSyncSucceeded(SYNC_NAME, connection);
//     if (alreadyDone) {
//       const today = new Date().toISOString().slice(0, 10);
//       console.log("[MF SYNC] Today's sync already completed.");
//       console.log(`[MF SYNC] Date: ${today}`);
//       console.log('[MF SYNC] Skipping MFapi fetch.');
//       return { success: true, skipped: true, reason: 'already-done-today' };
//     }

//     console.log("[MF SYNC] Today's sync not found.");
//     console.log('[MF SYNC] Starting daily MFapi synchronization...');
//     await markRunning(SYNC_NAME, connection);

//     console.log('[MF SYNC] Fetching MFapi latest data');
//     const navResult = await syncLatestNAV();
//     console.log('[MF SYNC] Updating database. NAV result:', navResult);

//     console.log('[MF SYNC] Returns calculation started');
//     const returnsResult = await syncAllReturns();
//     console.log('[MF SYNC] Returns result:', returnsResult);

//     const processed = Number(navResult.fetched || 0);
//     const updated = Number(navResult.updated || 0) + Number(returnsResult.updated || 0);
//     const failed = Number(navResult.invalid || 0) + Number(navResult.failed || 0) + Number(returnsResult.failed || 0);

//     await markSuccess(SYNC_NAME, { processed, updated, failed }, connection);

//     console.log(`[MF SYNC] Total records: ${processed}`);
//     console.log(`[MF SYNC] Updated: ${updated}`);
//     console.log(`[MF SYNC] Failed: ${failed}`);
//     console.log('[MF SYNC] Synchronization successful');

//     return { success: true, skipped: false, nav: navResult, returns: returnsResult };
//   } catch (error) {
//     console.error('[MF SYNC] Synchronization failed:', error.message);
//     console.log("[MF SYNC] Keeping previous successful sync date");
//     try {
//       if (connection) await markFailed(SYNC_NAME, error.message, {}, connection);
//     } catch (statusError) {
//       console.error('[MF SYNC] Could not record failure status:', statusError.message);
//     }
//     return { success: false, skipped: false, error: error.message };
//   } finally {
//     if (connection && locked) {
//       await releaseLock(connection, LOCK_NAME);
//       console.log('[MF SYNC] Releasing sync lock');
//     }
//     if (connection) connection.release();
//   }
// }

// /**
//  * Called once at server startup (dev and prod alike). Runs in the
//  * background so it never blocks the HTTP server from accepting requests.
//  * On a day where the sync already succeeded, this resolves almost
//  * instantly after the DB check (no MFapi call at all).
//  */
// function runStartupSync() {
//   setImmediate(() => {
//     runDailySyncIfNeeded('startup').catch((err) => {
//       console.error('[MF SYNC] Unexpected startup sync error:', err.message);
//     });
//   });
// }

// /**
//  * Registers the recurring production schedule. Uses the SAME
//  * runDailySyncIfNeeded() function as startup, so even if the scheduler
//  * fires twice, or fires right after a manual/startup sync already
//  * succeeded today, the DB status check makes the second call a no-op.
//  */
// function startMFScheduler() {
//   const cronExpression = process.env.MF_SYNC_CRON || '0 23 * * 1-5';
//   const timezone = process.env.MF_SYNC_TIMEZONE || 'Asia/Kolkata';

//   schedulerTask = cron.schedule(
//     cronExpression,
//     () => {
//       runDailySyncIfNeeded('scheduled').catch((err) => {
//         console.error('[MF SYNC] Unexpected scheduled sync error:', err.message);
//       });
//     },
//     { timezone }
//   );

//   console.log(`[MF SYNC] Scheduler active: ${cronExpression} ${timezone}`);
//   return schedulerTask;
// }

// function stopMFScheduler() {
//   if (schedulerTask) {
//     schedulerTask.stop();
//     schedulerTask = null;
//     console.log('[MF SYNC] Scheduler stopped');
//   }
// }

// module.exports = {
//   runStartupSync,
//   startMFScheduler,
//   stopMFScheduler,
//   runDailySyncIfNeeded,
// };






















/*
|--------------------------------------------------------------------------
| MF Sync Scheduler
|--------------------------------------------------------------------------
|
| One synchronization entry point is used for:
|
| 1. Server startup
| 2. Production cron
| 3. Manual sync-now endpoint
|
| mf_sync_status prevents repeated successful syncs on the same day.
|
| MySQL GET_LOCK prevents multiple Node processes from running the
| synchronization simultaneously.
|
*/

const cron = require('node-cron');

const pool = require('./db');

const {
  syncLatestNAV,
  syncAllReturns
} = require('./mfSyncService');

const {
  calculateAllRatings
} = require('./mfRatingRiskService');

const {
  hasTodaysSyncSucceeded,
  markRunning,
  markSuccess,
  markFailed
} = require('./mfSyncStatusService');

const SYNC_NAME = 'mf_daily_sync';

const LOCK_NAME = 'mf_daily_sync_lock';

const LOCK_TIMEOUT_SECONDS = Math.max(
  0,
  Number(
    process.env.MF_SYNC_LOCK_TIMEOUT || 0
  )
);

let schedulerTask = null;

/*
|--------------------------------------------------------------------------
| Advisory lock
|--------------------------------------------------------------------------
*/

async function acquireLock(
  connection,
  name,
  timeoutSeconds
) {
  const [rows] = await connection.query(
    'SELECT GET_LOCK(?, ?) AS acquired',
    [
      name,
      timeoutSeconds
    ]
  );

  return Number(
    rows[0]?.acquired
  ) === 1;
}

async function releaseLock(
  connection,
  name
) {
  try {
    await connection.query(
      'SELECT RELEASE_LOCK(?)',
      [name]
    );
  } catch (_) {
    // Lock release failure is not fatal.
  }
}

/*
|--------------------------------------------------------------------------
| Daily synchronization
|--------------------------------------------------------------------------
*/

async function runDailySyncIfNeeded(
  reason = 'sync'
) {
  let connection;
  let locked = false;

  try {
    connection =
      await pool.getConnection();

    console.log(
      `[MF SYNC] (${reason}) Checking today's sync status`
    );

    /*
     * Prevent multiple Node processes from syncing simultaneously.
     */
    locked = await acquireLock(
      connection,
      LOCK_NAME,
      LOCK_TIMEOUT_SECONDS
    );

    if (!locked) {
      console.log(
        '[MF SYNC] Another synchronization is already running.'
      );

      console.log(
        '[MF SYNC] Skipping duplicate sync.'
      );

      return {
        success: true,
        skipped: true,
        reason: 'locked'
      };
    }

    console.log(
      '[MF SYNC] Acquired daily sync lock'
    );

    /*
     * Check persistent status.
     */
    const alreadyDone =
      await hasTodaysSyncSucceeded(
        SYNC_NAME,
        connection
      );

    if (alreadyDone) {
      console.log(
        "[MF SYNC] Today's sync already completed successfully."
      );

      console.log(
        '[MF SYNC] Skipping MFapi request.'
      );

      return {
        success: true,
        skipped: true,
        reason: 'already-done-today'
      };
    }

    /*
     * Mark as running.
     */
    await markRunning(
      SYNC_NAME,
      connection
    );

    console.log(
      '[MF SYNC] Daily synchronization started'
    );

    /*
     * STEP 1
     *
     * Fetch latest NAV.
     */
    console.log(
      '[MF SYNC] Step 1/3: Fetching latest NAV'
    );

    const navResult =
      await syncLatestNAV();

    console.log(
      '[MF SYNC] NAV result:',
      navResult
    );

    /*
     * Make sure MFapi actually returned data.
     *
     * If MFapi gives an empty response, don't mark today's
     * synchronization as successful.
     */
    if (
      !navResult ||
      navResult.success === false
    ) {
      throw new Error(
        'Latest NAV synchronization failed'
      );
    }

    if (
      !navResult.skipped &&
      Number(navResult.fetched || 0) === 0
    ) {
      throw new Error(
        'MFapi returned zero latest NAV records'
      );
    }

    /*
     * STEP 2
     *
     * Calculate 1Y / 3Y / 5Y and risk.
     */
    console.log(
      '[MF SYNC] Step 2/3: Calculating returns and risk'
    );

    const returnsResult =
      await syncAllReturns();

    console.log(
      '[MF SYNC] Returns/risk result:',
      returnsResult
    );

    /*
     * STEP 3
     *
     * Calculate relative 1-5 star ratings.
     */
    console.log(
      '[MF SYNC] Step 3/3: Calculating ratings'
    );

    const ratingResult =
      await calculateAllRatings(
        connection
      );

    console.log(
      '[MF SYNC] Rating result:',
      ratingResult
    );

    /*
     * Status counters.
     */
    const processed =
      Number(
        navResult.fetched || 0
      );

    const updated =
      Number(
        navResult.updated || 0
      ) +
      Number(
        returnsResult.updated || 0
      ) +
      Number(
        ratingResult.updated || 0
      );

    const failed =
      Number(
        navResult.invalid || 0
      ) +
      Number(
        navResult.failed || 0
      ) +
      Number(
        returnsResult.failed || 0
      ) +
      Number(
        ratingResult.failed || 0
      );

    /*
     * IMPORTANT:
     *
     * We still mark the overall sync SUCCESS if individual
     * schemes failed, because the sync itself completed.
     *
     * The failed count is preserved in mf_sync_status.
     */
    // NAV synchronization is the core daily sync. Individual return/rating
    // failures are preserved in counters, but a completely failed ratings
    // stage is surfaced explicitly instead of being mistaken for a clean run.
    await markSuccess(
      SYNC_NAME,
      {
        processed,
        updated,
        failed
      },
      connection
    );

    console.log(
      '================================================'
    );

    if (ratingResult.failed === ratingResult.processed && ratingResult.processed > 0) {
      console.warn('[MF SYNC] WARNING: ratings/risk stage failed for every scheme; NAV sync succeeded but ratings/risk require retry.');
    } else if (failed > 0) {
      console.warn(`[MF SYNC] DAILY SYNCHRONIZATION COMPLETED WITH ${failed} FAILED RECORDS`);
    } else {
      console.log('[MF SYNC] DAILY SYNCHRONIZATION SUCCESSFUL');
    }

    console.log(
      `[MF SYNC] NAV records: ${processed}`
    );

    console.log(
      `[MF SYNC] DB updates: ${updated}`
    );

    console.log(
      `[MF SYNC] Failed records: ${failed}`
    );

    console.log(
      '================================================'
    );

    return {
      success: true,
      skipped: false,

      nav: navResult,

      returns: returnsResult,

      ratings: ratingResult
    };
  } catch (error) {
    console.error(
      '[MF SYNC] Synchronization failed:',
      error.message
    );

    /*
     * DO NOT change last_success_date when the sync fails.
     *
     * This means the next startup/cron attempt can retry.
     */
    try {
      if (connection) {
        await markFailed(
          SYNC_NAME,
          error.message,
          {},
          connection
        );
      }
    } catch (statusError) {
      console.error(
        '[MF SYNC] Could not record failure status:',
        statusError.message
      );
    }

    return {
      success: false,
      skipped: false,
      error: error.message
    };
  } finally {
    if (connection && locked) {
      await releaseLock(
        connection,
        LOCK_NAME
      );

      console.log(
        '[MF SYNC] Released daily sync lock'
      );
    }

    if (connection) {
      connection.release();
    }
  }
}

/*
|--------------------------------------------------------------------------
| Startup
|--------------------------------------------------------------------------
*/

function runStartupSync() {
  setImmediate(() => {
    runDailySyncIfNeeded(
      'startup'
    ).catch(error => {
      console.error(
        '[MF SYNC] Unexpected startup error:',
        error.message
      );
    });
  });
}

/*
|--------------------------------------------------------------------------
| Cron scheduler
|--------------------------------------------------------------------------
*/

function startMFScheduler() {
  const cronExpression =
    process.env.MF_SYNC_CRON ||
    '0 23 * * 1-5';

  const timezone =
    process.env.MF_SYNC_TIMEZONE ||
    'Asia/Kolkata';

  if (!cron.validate(cronExpression)) {
    throw new Error(
      `Invalid MF_SYNC_CRON expression: ${cronExpression}`
    );
  }

  schedulerTask =
    cron.schedule(
      cronExpression,
      () => {
        runDailySyncIfNeeded(
          'scheduled'
        ).catch(error => {
          console.error(
            '[MF SYNC] Unexpected scheduled error:',
            error.message
          );
        });
      },
      {
        timezone
      }
    );

  console.log(
    `[MF SYNC] Scheduler active: ${cronExpression} (${timezone})`
  );

  return schedulerTask;
}

/*
|--------------------------------------------------------------------------
| Stop scheduler
|--------------------------------------------------------------------------
*/

function stopMFScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();

    schedulerTask = null;

    console.log(
      '[MF SYNC] Scheduler stopped'
    );
  }
}

module.exports = {
  runStartupSync,
  startMFScheduler,
  stopMFScheduler,
  runDailySyncIfNeeded
};