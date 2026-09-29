-- Persistent state for development restart protection and production recovery.
-- Safe to run more than once.

SET @db = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_sync_status' AND COLUMN_NAME='last_attempt_date')=0,
  'ALTER TABLE mf_sync_status ADD COLUMN last_attempt_date DATE NULL AFTER last_success_date',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_sync_status' AND COLUMN_NAME='last_processed_nav_date')=0,
  'ALTER TABLE mf_sync_status ADD COLUMN last_processed_nav_date DATE NULL AFTER last_attempt_date',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO mf_sync_status
  (sync_name, status, records_processed, records_updated, records_failed)
VALUES
  ('mf_nav_sync', 'PENDING', 0, 0, 0);

INSERT IGNORE INTO mf_sync_status
  (sync_name, status, records_processed, records_updated, records_failed)
VALUES
  ('mf_daily_sync', 'PENDING', 0, 0, 0);
