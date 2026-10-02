-- Phase 2: USER / ADMIN authorization role
-- Existing users remain USER unless explicitly promoted.

SET @db_name = DATABASE();

SET @role_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
);

SET @sql = IF(
    @role_exists = 0,
    "ALTER TABLE users ADD COLUMN role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER'",
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users
SET role = 'USER'
WHERE role IS NULL OR role = '';

-- Promote the intended administrator manually, for example:
-- UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
