const cron = require('node-cron');
const pool = require('./db');

const { syncLatestNAV, syncAllReturns } = require('./mfSyncService');
const { calculateAllRatings } = require('./mfRatingRiskService');
const {
  getSyncStatus,
  hasTodaysSyncSucceeded,
  hasAttemptedToday,
  markRunning,
  markPending,
  markSuccess,
  markFailed,
} = require('./mfSyncStatusService');

const NAV_SYNC_NAME = 'mf_nav_sync';
const DAILY_SYNC_NAME = 'mf_daily_sync';
const DAILY_LOCK_NAME = 'mf_daily_sync_lock';

const LOCK_TIMEOUT_SECONDS = Math.max(
  0,
  Number(process.env.MF_SYNC_LOCK_TIMEOUT || 0)
);

const MF_SYNC_CRON = process.env.MF_SYNC_CRON || '15 23 * * 1-5';
const MF_SYNC_TIMEZONE = process.env.MF_SYNC_TIMEZONE || 'Asia/Kolkata';
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

let schedulerTask = null;

async function acquireLock(connection, name) {
  const [rows] = await connection.query(
    'SELECT GET_LOCK(?, ?) AS acquired',
    [name, LOCK_TIMEOUT_SECONDS]
  );
  return Number(rows[0]?.acquired) === 1;
}

async function releaseLock(connection, name) {
  try {
    await connection.query('SELECT RELEASE_LOCK(?)', [name]);
  } catch (_) {
    // Non-fatal.
  }
}

function getScheduledMinutes() {
  const pieces = MF_SYNC_CRON.trim().split(/\s+/);
  if (pieces.length !== 5) return 23 * 60 + 15;

  const minute = Number(pieces[0]);
  const hour = Number(pieces[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 23 * 60 + 15;
  }
  return hour * 60 + minute;
}

function isPastScheduledTimeToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MF_SYNC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0) % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute >= getScheduledMinutes();
}

async function runPipeline(reason, { startup = false, scheduled = false } = {}) {
  let connection = null;
  let locked = false;

  try {
    connection = await pool.getConnection();
    locked = await acquireLock(connection, DAILY_LOCK_NAME);

    if (!locked) {
      console.log(`[MF SYNC] ${reason}: another daily synchronization is running.`);
      return { success: true, skipped: true, reason: 'locked' };
    }

    const alreadyComplete = await hasTodaysSyncSucceeded(DAILY_SYNC_NAME, connection);
    if (alreadyComplete) {
      console.log(`[MF SYNC] ${reason}: today's complete sync already exists. No provider call.`);
      return { success: true, skipped: true, reason: 'already-complete-today' };
    }

    /*
     * Development startup:
     * one complete attempt per day, regardless of when the server is started.
     * Repeated starts the same day are blocked by last_attempt_date.
     *
     * Production startup:
     * before the normal 23:15 slot, do not perform the expensive daily job.
     * If production starts after 23:15 and today's job is missing, repair it.
     */
    if (startup && IS_PRODUCTION && !isPastScheduledTimeToday()) {
      console.log('[MF SYNC] production startup: waiting for scheduled daily run.');
      return { success: true, skipped: true, reason: 'waiting-for-schedule' };
    }

    // if (startup) {
    //   const attemptedToday = await hasAttemptedToday(DAILY_SYNC_NAME, connection);
    //   if (attemptedToday) {
    //     console.log('[MF SYNC] startup: a daily attempt already happened today. No second provider call.');
    //     return { success: true, skipped: true, reason: 'already-attempted-today' };
    //   }
    // }

    await markRunning(DAILY_SYNC_NAME, connection);
    await markRunning(NAV_SYNC_NAME, connection);

    console.log(`[MF SYNC] ${reason}: starting daily NAV + returns + risk + rating pipeline.`);

    /*
     * One bulk provider call for the entire provider report.
     * mfSyncService immediately filters that report to active DB schemes.
     */
    const navResult = await syncLatestNAV();

    if (!navResult.success || navResult.skipped) {
      throw new Error(navResult.error || navResult.reason || 'Latest NAV synchronization did not complete');
    }

    if (navResult.missingActive > 0) {
      throw new Error(
        `${navResult.missingActive} active schemes are missing from the provider report`
      );
    }

    if (navResult.failed > 0 || navResult.invalid > 0) {
      throw new Error(
        `NAV synchronization completed with invalid/failed records: ` +
        `invalid=${navResult.invalid}, failed=${navResult.failed}`
      );
    }

    await markSuccess(
      NAV_SYNC_NAME,
      {
        processed: navResult.fetched,
        updated: navResult.updated,
        failed: navResult.failed + navResult.invalid,
      },
      navResult.latestActiveNavDate,
      connection
    );

    console.log(
      `[MF NAV] active=${navResult.activeFunds}, fetched=${navResult.fetched}, ` +
      `updated=${navResult.updated}, unchanged=${navResult.unchanged}, ` +
      `newNavDays=${navResult.newNavDays}, latestActiveNavDate=${navResult.latestActiveNavDate}`
    );

    /*
     * Returns/risk uses the current DB NAV snapshot and only recalculates
     * schemes whose returns_for_nav_date differs from nav_date.
     */
    console.log(`[MF SYNC] ${reason}: calculating returns and risk.`);
    const returnsResult = await syncAllReturns();

    if (!returnsResult.success || returnsResult.failed > 0) {
      throw new Error(
        `Returns/risk stage failed: processed=${returnsResult.processed}, failed=${returnsResult.failed}`
      );
    }

    /*
     * Ratings use already stored returns/risk. They do not perform another
     * provider history sweep.
     */
    console.log(`[MF SYNC] ${reason}: calculating ratings from DB values.`);
    const ratingResult = await calculateAllRatings(connection);

    if (!ratingResult || ratingResult.failed > 0) {
      throw new Error(
        `Rating stage failed: processed=${ratingResult?.processed || 0}, failed=${ratingResult?.failed || 0}`
      );
    }

    const [latestRows] = await connection.query(
      `SELECT MAX(nav_date) AS latest_nav_date
       FROM mf_schemes
       WHERE is_active = 1`
    );

    const latestNavDate = latestRows[0]?.latest_nav_date || navResult.latestActiveNavDate || null;

    await markSuccess(
      DAILY_SYNC_NAME,
      {
        processed: returnsResult.processed,
        updated: navResult.updated + returnsResult.updated + Number(ratingResult.updated || 0),
        failed: 0,
      },
      latestNavDate,
      connection
    );

    console.log('================================================');
    console.log(`[MF SYNC] ${reason}: DAILY SYNCHRONIZATION SUCCESSFUL`);
    console.log(`[MF SYNC] Active funds: ${navResult.activeFunds}`);
    console.log(`[MF SYNC] NAV updated: ${navResult.updated}`);
    console.log(`[MF SYNC] Returns updated: ${returnsResult.updated}`);
    console.log(`[MF SYNC] Ratings updated: ${ratingResult.updated}`);
    console.log(`[MF SYNC] NAV date: ${latestNavDate}`);
    console.log('================================================');

    return {
      success: true,
      skipped: false,
      nav: navResult,
      returns: returnsResult,
      ratings: ratingResult,
    };
  } catch (error) {
    console.error(`[MF SYNC] ${reason}: ${error.message}`);

    try {
      if (connection) {
        await markFailed(DAILY_SYNC_NAME, error.message, {}, connection);
        await markFailed(NAV_SYNC_NAME, error.message, {}, connection);
      }
    } catch (statusError) {
      console.error(`[MF SYNC] Could not record sync failure: ${statusError.message}`);
    }

    return {
      success: false,
      skipped: false,
      error: error.message,
    };
  } finally {
    if (connection && locked) await releaseLock(connection, DAILY_LOCK_NAME);
    if (connection) connection.release();
  }
}

async function runStartupSync() {
  setImmediate(async () => {
    try {
      await runPipeline('startup', { startup: true, scheduled: false });
    } catch (error) {
      console.error(`[MF SYNC] startup error: ${error.message}`);
    }
  });
}

function startMFScheduler() {
  if (!cron.validate(MF_SYNC_CRON)) {
    throw new Error(`Invalid MF_SYNC_CRON: ${MF_SYNC_CRON}`);
  }

  schedulerTask = cron.schedule(
    MF_SYNC_CRON,
    () => {
      runPipeline('scheduled', { startup: false, scheduled: true }).catch((error) => {
        console.error(`[MF SYNC] scheduled error: ${error.message}`);
      });
    },
    { timezone: MF_SYNC_TIMEZONE }
  );

  console.log(`[MF SYNC] Scheduler active: ${MF_SYNC_CRON} (${MF_SYNC_TIMEZONE})`);
  return schedulerTask;
}

function stopMFScheduler() {
  if (!schedulerTask) return;
  schedulerTask.stop();
  schedulerTask = null;
  console.log('[MF SYNC] Scheduler stopped');
}

async function runDailySyncIfNeeded(reason = 'manual') {
  return runPipeline(reason, { startup: false, scheduled: false });
}

module.exports = {
  runStartupSync,
  startMFScheduler,
  stopMFScheduler,
  runDailySyncIfNeeded,
};
