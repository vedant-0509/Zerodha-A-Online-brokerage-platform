const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('./logger');

let pool = null;

async function initDb() {
  if (!env.mysqlEnabled) return null;
  pool = mysql.createPool({ ...env.mysql, waitForConnections:true, connectionLimit:10, queueLimit:0 });
  await pool.query(`CREATE TABLE IF NOT EXISTS detail_stock_daily_closes (
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_detail_stock_close (instrument_key, trading_date), KEY idx_detail_stock_history (instrument_key, trading_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  logger.info('MySQL connected');
  return pool;
}

async function saveDailyClose(snapshot, tradingDate) {
  if (!pool || !snapshot?.price) return;
  await pool.execute(`INSERT INTO detail_stock_daily_closes
    (instrument_key,trading_date,symbol,open_price,high_price,low_price,close_price,previous_close,volume,source)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE symbol=VALUES(symbol),open_price=VALUES(open_price),high_price=VALUES(high_price),low_price=VALUES(low_price),close_price=VALUES(close_price),previous_close=VALUES(previous_close),volume=VALUES(volume),source=VALUES(source)`,
    [snapshot.instrumentKey, tradingDate, snapshot.symbol || null, snapshot.open ?? null, snapshot.high ?? null, snapshot.low ?? null, snapshot.price, snapshot.previousClose ?? null, snapshot.volume ?? null, 'upstox']);
}

async function getDbHistory(instrumentKey, from, to) {
  if (!pool) return [];
  const [rows] = await pool.execute(`SELECT trading_date as timestamp, open_price as open, high_price as high, low_price as low, close_price as close, volume FROM detail_stock_daily_closes WHERE instrument_key=? AND trading_date BETWEEN ? AND ? ORDER BY trading_date ASC`, [instrumentKey, from, to]);
  return rows;
}

module.exports = { initDb, saveDailyClose, getDbHistory };
