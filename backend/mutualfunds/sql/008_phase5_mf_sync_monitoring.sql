-- Phase 5: Mutual Fund synchronization monitoring.
-- Safe to run repeatedly against the Zerodha database.
-- Ensures all four Phase 5 monitoring stages exist.

INSERT IGNORE INTO mf_sync_status
  (sync_name, status, records_processed, records_updated, records_failed)
VALUES
  ('mf_daily_sync', 'PENDING', 0, 0, 0),
  ('mf_nav_sync', 'PENDING', 0, 0, 0),
  ('mf_returns_sync', 'PENDING', 0, 0, 0),
  ('mf_rating_sync', 'PENDING', 0, 0, 0);
