CREATE TABLE IF NOT EXISTS order_idempotency (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status ENUM('PROCESSING', 'COMPLETED') NOT NULL DEFAULT 'PROCESSING',
    order_id VARCHAR(64) NULL,
    response_json LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_order_idempotency_user_key (user_id, idempotency_key),
    KEY idx_order_idempotency_order_id (order_id),
    KEY idx_order_idempotency_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_transaction_audit (
    audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    idempotency_key VARCHAR(128) NULL,
    event_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_order_audit_order_id (order_id),
    KEY idx_order_audit_user_id (user_id),
    KEY idx_order_audit_idempotency (user_id, idempotency_key),
    KEY idx_order_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;