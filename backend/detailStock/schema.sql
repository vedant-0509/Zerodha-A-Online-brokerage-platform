CREATE TABLE IF NOT EXISTS detail_stock_daily_closes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    instrument_key VARCHAR(180) NOT NULL,

    trading_date DATE NOT NULL,

    symbol VARCHAR(120) NULL,

    open_price DECIMAL(18,4) NULL,

    high_price DECIMAL(18,4) NULL,

    low_price DECIMAL(18,4) NULL,

    close_price DECIMAL(18,4) NOT NULL,

    previous_close DECIMAL(18,4) NULL,

    volume BIGINT NULL,

    source VARCHAR(40) NOT NULL DEFAULT 'upstox',

    created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_detail_stock_close (
        instrument_key,
        trading_date
    ),

    KEY idx_detail_stock_history (
        instrument_key,
        trading_date
    )

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4;