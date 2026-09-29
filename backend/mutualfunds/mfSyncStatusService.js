const pool = require('./db');

async function getSyncStatus(syncName, connection = pool) {
  const [rows] = await connection.query(
    `SELECT
       id,
       sync_name,
       last_success_date,
       last_attempt_date,
       last_processed_nav_date,
       last_success_at,
       status,
       records_processed,
       records_updated,
       records_failed,
       error_message,
       created_at,
       updated_at
     FROM mf_sync_status
     WHERE sync_name = ?
     LIMIT 1`,
    [syncName]
  );

  return rows[0] || null;
}

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

async function hasAttemptedToday(
  syncName,
  connection = pool
) {
  const [rows] =
    await connection.query(
      `
      SELECT 1
      FROM mf_sync_status
      WHERE sync_name = ?
        AND last_attempt_date = CURDATE()
        AND status IN ('SUCCESS', 'PENDING')
      LIMIT 1
      `,
      [syncName]
    );

  return rows.length > 0;
}

async function markRunning(syncName, connection = pool) {
  await connection.query(
    `INSERT INTO mf_sync_status
      (sync_name, last_attempt_date, status)
     VALUES (?, CURDATE(), 'RUNNING')
     ON DUPLICATE KEY UPDATE
       last_attempt_date = CURDATE(),
       status = 'RUNNING',
       error_message = NULL,
       updated_at = NOW()`,
    [syncName]
  );
}

async function markPending(syncName, message, processedNavDate = null, counts = {}, connection = pool) {
  await connection.query(
    `INSERT INTO mf_sync_status
      (sync_name, last_attempt_date, last_processed_nav_date, status,
       records_processed, records_updated, records_failed, error_message)
     VALUES (?, CURDATE(), ?, 'PENDING', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_attempt_date = CURDATE(),
       last_processed_nav_date = VALUES(last_processed_nav_date),
       status = 'PENDING',
       records_processed = VALUES(records_processed),
       records_updated = VALUES(records_updated),
       records_failed = VALUES(records_failed),
       error_message = VALUES(error_message),
       updated_at = NOW()`,
    [
      syncName,
      processedNavDate,
      Number(counts.processed || 0),
      Number(counts.updated || 0),
      Number(counts.failed || 0),
      String(message || 'No new NAV data').slice(0, 4000),
    ]
  );
}

async function markSuccess(syncName, counts = {}, processedNavDate = null, connection = pool) {
  await connection.query(
    `INSERT INTO mf_sync_status
      (sync_name, last_success_date, last_attempt_date,
       last_processed_nav_date, last_success_at, status,
       records_processed, records_updated, records_failed, error_message)
     VALUES (?, CURDATE(), CURDATE(), ?, NOW(), 'SUCCESS', ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       last_success_date = CURDATE(),
       last_attempt_date = CURDATE(),
       last_processed_nav_date = VALUES(last_processed_nav_date),
       last_success_at = NOW(),
       status = 'SUCCESS',
       records_processed = VALUES(records_processed),
       records_updated = VALUES(records_updated),
       records_failed = VALUES(records_failed),
       error_message = NULL,
       updated_at = NOW()`,
    [
      syncName,
      processedNavDate,
      Number(counts.processed || 0),
      Number(counts.updated || 0),
      Number(counts.failed || 0),
    ]
  );
}

async function markFailed(syncName, errorMessage, counts = {}, connection = pool) {
  await connection.query(
    `INSERT INTO mf_sync_status
      (sync_name, last_attempt_date, status,
       records_processed, records_updated, records_failed, error_message)
     VALUES (?, CURDATE(), 'FAILED', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_attempt_date = CURDATE(),
       status = 'FAILED',
       records_processed = VALUES(records_processed),
       records_updated = VALUES(records_updated),
       records_failed = VALUES(records_failed),
       error_message = VALUES(error_message),
       updated_at = NOW()`,
    [
      syncName,
      Number(counts.processed || 0),
      Number(counts.updated || 0),
      Number(counts.failed || 0),
      String(errorMessage || 'Unknown error').slice(0, 4000),
    ]
  );
}

module.exports = {
  getSyncStatus,
  hasTodaysSyncSucceeded,
  hasAttemptedToday,
  markRunning,
  markPending,
  markSuccess,
  markFailed,
};
