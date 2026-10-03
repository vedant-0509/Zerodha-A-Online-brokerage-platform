-- ============================================================================
-- ZERODHA PHASE 7 - DATABASE HARDENING (CORRECTED)
-- ============================================================================
-- Run as a database administrator (root), NOT as MYSQL_APP_USER.
-- Safe for the current zerodha schema, which already contains some foreign keys.
-- The migration is intended to be rerunnable.
-- ============================================================================

USE zerodha;

-- --------------------------------------------------------------------------
-- 0. Ensure the migration tracking table exists.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phase7_schema_version (
    version VARCHAR(64) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------------------------
-- 1. Runtime-created table moved into migrations.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS market_update_log (
    id INT NOT NULL,
    last_run_date DATE NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO market_update_log (id, last_run_date)
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE id = id;

-- --------------------------------------------------------------------------
-- 2. Remove pre-existing foreign keys that prevent user_id normalization.
--    These existed before Phase 7 and must be removed before ALTER COLUMN.
-- --------------------------------------------------------------------------
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'holdings'
          AND CONSTRAINT_NAME = 'holdings_ibfk_1'
    ),
    'ALTER TABLE holdings DROP FOREIGN KEY holdings_ibfk_1',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'watchlist'
          AND CONSTRAINT_NAME = 'watchlist_ibfk_1'
    ),
    'ALTER TABLE watchlist DROP FOREIGN KEY watchlist_ibfk_1',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- Existing MF scheme FKs use older names. Remove them so Phase 7 can recreate
-- the same relationships with consistent names without duplicate constraints.
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mf_holdings'
          AND CONSTRAINT_NAME = 'fk_mf_holding_scheme'
    ),
    'ALTER TABLE mf_holdings DROP FOREIGN KEY fk_mf_holding_scheme',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mf_orders'
          AND CONSTRAINT_NAME = 'fk_mf_order_scheme'
    ),
    'ALTER TABLE mf_orders DROP FOREIGN KEY fk_mf_order_scheme',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- Also remove Phase 7 names if a previous partial execution created them.
SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'holdings'
          AND CONSTRAINT_NAME = 'fk_holdings_user'
    ),
    'ALTER TABLE holdings DROP FOREIGN KEY fk_holdings_user',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'watchlist'
          AND CONSTRAINT_NAME = 'fk_watchlist_user'
    ),
    'ALTER TABLE watchlist DROP FOREIGN KEY fk_watchlist_user',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mf_holdings'
          AND CONSTRAINT_NAME = 'fk_mf_holdings_scheme'
    ),
    'ALTER TABLE mf_holdings DROP FOREIGN KEY fk_mf_holdings_scheme',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'mf_orders'
          AND CONSTRAINT_NAME = 'fk_mf_orders_scheme'
    ),
    'ALTER TABLE mf_orders DROP FOREIGN KEY fk_mf_orders_scheme',
    'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 3. Normalize application user identifiers.
-- --------------------------------------------------------------------------
SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'),
  'ALTER TABLE users MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='holdings'),
  'ALTER TABLE holdings MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders'),
  'ALTER TABLE orders MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watchlist'),
  'ALTER TABLE watchlist MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings'),
  'ALTER TABLE mf_holdings MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders'),
  'ALTER TABLE mf_orders MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_idempotency'),
  'ALTER TABLE order_idempotency MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_transaction_audit'),
  'ALTER TABLE order_transaction_audit MODIFY user_id VARCHAR(64) NOT NULL', 'SELECT 1');
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 4. Required unique keys.
-- --------------------------------------------------------------------------
SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uq_users_user_id'),
    'ALTER TABLE users ADD UNIQUE KEY uq_users_user_id (user_id)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uq_users_email'),
    'ALTER TABLE users ADD UNIQUE KEY uq_users_email (email)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_schemes')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_schemes' AND INDEX_NAME='uq_mf_schemes_scheme_code'),
    'ALTER TABLE mf_schemes ADD UNIQUE KEY uq_mf_schemes_scheme_code (scheme_code)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 5. Required indexes / unique constraints.
-- --------------------------------------------------------------------------
SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='holdings')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='holdings' AND INDEX_NAME='idx_holdings_user_id'),
    'ALTER TABLE holdings ADD INDEX idx_holdings_user_id (user_id)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND INDEX_NAME='idx_orders_user_placed_at'),
    'ALTER TABLE orders ADD INDEX idx_orders_user_placed_at (user_id, placed_at)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watchlist')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watchlist' AND INDEX_NAME='uq_watchlist_user_instrument'),
    'ALTER TABLE watchlist ADD UNIQUE KEY uq_watchlist_user_instrument (user_id, instrument_key)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings' AND INDEX_NAME='uq_mf_holdings_user_scheme'),
    'ALTER TABLE mf_holdings ADD UNIQUE KEY uq_mf_holdings_user_scheme (user_id, scheme_id)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders' AND INDEX_NAME='idx_mf_orders_user_completed'),
    'ALTER TABLE mf_orders ADD INDEX idx_mf_orders_user_completed (user_id, completed_at)', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 6. Recreate standardized user foreign keys.
-- --------------------------------------------------------------------------
SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='holdings')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='holdings' AND CONSTRAINT_NAME='fk_holdings_user'),
    'ALTER TABLE holdings ADD CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='orders')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='orders' AND CONSTRAINT_NAME='fk_orders_user'),
    'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='watchlist')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='watchlist' AND CONSTRAINT_NAME='fk_watchlist_user'),
    'ALTER TABLE watchlist ADD CONSTRAINT fk_watchlist_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings' AND CONSTRAINT_NAME='fk_mf_holdings_user'),
    'ALTER TABLE mf_holdings ADD CONSTRAINT fk_mf_holdings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders' AND CONSTRAINT_NAME='fk_mf_orders_user'),
    'ALTER TABLE mf_orders ADD CONSTRAINT fk_mf_orders_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_idempotency')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='order_idempotency' AND CONSTRAINT_NAME='fk_order_idempotency_user'),
    'ALTER TABLE order_idempotency ADD CONSTRAINT fk_order_idempotency_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_transaction_audit')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='order_transaction_audit' AND CONSTRAINT_NAME='fk_order_audit_user'),
    'ALTER TABLE order_transaction_audit ADD CONSTRAINT fk_order_audit_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 7. Recreate standardized mutual-fund scheme foreign keys.
-- --------------------------------------------------------------------------
SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings')
    AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_schemes')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mf_holdings' AND CONSTRAINT_NAME='fk_mf_holdings_scheme'),
    'ALTER TABLE mf_holdings ADD CONSTRAINT fk_mf_holdings_scheme FOREIGN KEY (scheme_id) REFERENCES mf_schemes(id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

SET @sql = IF(
    EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders')
    AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='mf_schemes')
    AND NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='mf_orders' AND CONSTRAINT_NAME='fk_mf_orders_scheme'),
    'ALTER TABLE mf_orders ADD CONSTRAINT fk_mf_orders_scheme FOREIGN KEY (scheme_id) REFERENCES mf_schemes(id) ON UPDATE CASCADE ON DELETE RESTRICT', 'SELECT 1'
);
PREPARE phase7_stmt FROM @sql; EXECUTE phase7_stmt; DEALLOCATE PREPARE phase7_stmt;

-- --------------------------------------------------------------------------
-- 8. Record successful application.
-- --------------------------------------------------------------------------
INSERT IGNORE INTO phase7_schema_version (version)
VALUES ('phase7-database-hardening-v1');

SELECT 'Phase 7 database hardening migration completed' AS status;
