-- Safe migration for the improved return calculator.
-- Run against the database that contains mf_schemes.

SET @db = DATABASE();

SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='returns_for_nav_date')=0,
  'ALTER TABLE mf_schemes ADD COLUMN returns_for_nav_date DATE NULL AFTER return_5y', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='rating_source')=0,
  'ALTER TABLE mf_schemes ADD COLUMN rating_source VARCHAR(100) NULL AFTER rating', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='rating_updated_at')=0,
  'ALTER TABLE mf_schemes ADD COLUMN rating_updated_at DATETIME NULL AFTER rating_source', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='risk_source')=0,
  'ALTER TABLE mf_schemes ADD COLUMN risk_source VARCHAR(100) NULL AFTER risk', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='risk_updated_at')=0,
  'ALTER TABLE mf_schemes ADD COLUMN risk_updated_at DATETIME NULL AFTER risk_source', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='return_1y_nav_date')=0,
  'ALTER TABLE mf_schemes ADD COLUMN return_1y_nav_date DATE NULL AFTER returns_for_nav_date', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='return_3y_nav_date')=0,
  'ALTER TABLE mf_schemes ADD COLUMN return_3y_nav_date DATE NULL AFTER return_1y_nav_date', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql = IF((SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=@db AND TABLE_NAME='mf_schemes' AND COLUMN_NAME='return_5y_nav_date')=0,
  'ALTER TABLE mf_schemes ADD COLUMN return_5y_nav_date DATE NULL AFTER return_3y_nav_date', 'SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Existing installations already have the common filter indexes; no index is required for correctness.
