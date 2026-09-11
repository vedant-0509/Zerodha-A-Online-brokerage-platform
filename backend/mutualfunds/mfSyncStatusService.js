/*
|--------------------------------------------------------------------------
| MF Sync Status Service
|--------------------------------------------------------------------------
|
| Single source of truth for "has today's mutual-fund sync already
| completed successfully?". Backed by the mf_sync_status table so the
| answer survives server restarts, crashes, and multi-day downtime.
|
| This file does NOT decide when to sync. It only reads/writes status.
| mfSyncScheduler.js is the component that combines this with the MySQL
| advisory lock to decide whether to actually run a sync.
|
*/

const pool = require('./db');

/**
 * Fetch the current status row for a given sync name.
 * Returns null if no row exists yet (treated as "never synced").
 */
async function getSyncStatus(syncName, connection = pool) {
  const [rows] = await connection.query(
    `SELECT id, sync_name, last_success_date, last_success_at, status,
            records_processed, records_updated, records_failed,
            error_message, created_at, updated_at
     FROM mf_sync_status
     WHERE sync_name = ?
     LIMIT 1`,
    [syncName]
  );
  return rows[0] || null;
}

/**
 * True only if last_success_date is TODAY (server/DB date) AND status = SUCCESS.
 * Uses MySQL's CURDATE() so the "today" comparison is the database's date,
 * not Node's, which keeps behavior consistent regardless of host TZ config.
 */
async function hasTodaysSyncSucceeded(syncName, connection = pool) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM mf_sync_status
     WHERE sync_name = ?
       AND status = 'SUCCESS'
       AND last_success_date = CURDATE()
     LIMIT 1`,
    [syncName]
  );
  return rows.length > 0;
}

/**
 * Mark a sync as currently running. Useful for observability
 * (e.g. a status API can show RUNNING instead of a stale SUCCESS/FAILED).
 * Does NOT touch last_success_date/last_success_at.
 */
async function markRunning(syncName, connection = pool) {
  await connection.query(
    `INSERT INTO mf_sync_status (sync_name, status)
     VALUES (?, 'RUNNING')
     ON DUPLICATE KEY UPDATE status = 'RUNNING', updated_at = NOW()`,
    [syncName]
  );
}

/**
 * Mark today's sync as successfully completed. This is the ONLY place
 * that advances last_success_date, and it only ever advances it to
 * CURDATE() on success - never on failure.
 */
async function markSuccess(syncName, counts = {}, connection = pool) {
  const processed = Number(counts.processed || 0);
  const updated = Number(counts.updated || 0);
  const failed = Number(counts.failed || 0);

  await connection.query(
    `INSERT INTO mf_sync_status
       (sync_name, last_success_date, last_success_at, status,
        records_processed, records_updated, records_failed, error_message)
     VALUES (?, CURDATE(), NOW(), 'SUCCESS', ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       last_success_date = CURDATE(),
       last_success_at   = NOW(),
       status             = 'SUCCESS',
       records_processed  = VALUES(records_processed),
       records_updated    = VALUES(records_updated),
       records_failed     = VALUES(records_failed),
       error_message      = NULL,
       updated_at         = NOW()`,
    [syncName, processed, updated, failed]
  );
}

/**
 * Mark today's sync attempt as failed. Deliberately does NOT touch
 * last_success_date/last_success_at, so the previous successful sync
 * date is preserved and the next startup/scheduler tick will retry.
 */
async function markFailed(syncName, errorMessage, counts = {}, connection = pool) {
  const processed = Number(counts.processed || 0);
  const updated = Number(counts.updated || 0);
  const failed = Number(counts.failed || 0);
  const message = String(errorMessage || 'Unknown error').slice(0, 4000);

  await connection.query(
    `INSERT INTO mf_sync_status
       (sync_name, status, records_processed, records_updated, records_failed, error_message)
     VALUES (?, 'FAILED', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status             = 'FAILED',
       records_processed  = VALUES(records_processed),
       records_updated    = VALUES(records_updated),
       records_failed     = VALUES(records_failed),
       error_message      = VALUES(error_message),
       updated_at         = NOW()`,
    [syncName, processed, updated, failed, message]
  );
}

module.exports = {
  getSyncStatus,
  hasTodaysSyncSucceeded,
  markRunning,
  markSuccess,
  markFailed,
};
