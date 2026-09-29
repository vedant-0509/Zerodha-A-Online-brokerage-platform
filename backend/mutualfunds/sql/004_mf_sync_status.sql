-- Sync/update tracking table for the mutual-fund daily synchronization.
-- Safe to run more than once: the table is only created if it does not
-- already exist, and no existing data is touched.

CREATE TABLE IF NOT EXISTS mf_sync_status (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sync_name          VARCHAR(100)    NOT NULL,
  last_success_date  DATE            NULL,
  last_attempt_date  DATE            NULL,
  last_processed_nav_date DATE        NULL,
  last_success_at    DATETIME        NULL,
  status             ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  records_processed  INT UNSIGNED    NOT NULL DEFAULT 0,
  records_updated    INT UNSIGNED    NOT NULL DEFAULT 0,
  records_failed     INT UNSIGNED    NOT NULL DEFAULT 0,
  error_message      TEXT            NULL,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mf_sync_status_sync_name (sync_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed the row used by the daily NAV/returns sync so the very first
-- "has today's sync happened" check has something to read.
-- INSERT IGNORE means this is a no-op on every subsequent run.
INSERT IGNORE INTO mf_sync_status
  (sync_name, last_success_date, last_attempt_date, last_processed_nav_date, last_success_at, status, records_processed, records_updated, records_failed)
VALUES
  ('mf_daily_sync', NULL, NULL, NULL, NULL, 'PENDING', 0, 0, 0);
