-- Enforce the application's requested NAV precision.
-- Existing NAV values are rounded to 2 decimals during this migration.

UPDATE mf_schemes
SET current_nav = ROUND(current_nav, 2)
WHERE current_nav IS NOT NULL;

ALTER TABLE mf_schemes
  MODIFY COLUMN current_nav DECIMAL(20,2) NULL;
