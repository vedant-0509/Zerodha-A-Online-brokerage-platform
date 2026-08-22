// const mysql = require("mysql2/promise");
// const env = require("./env");
// const logger = require("./logger");

// let pool = null;

// function requireDb() {
//   if (!env.mysqlEnabled) {
//     throw new Error("MySQL is disabled");
//   }

//   if (!pool) {
//     throw new Error("MySQL has not been initialized");
//   }

//   return pool;
// }

// async function initDb() {
//   if (!env.mysqlEnabled) {
//     logger.warn("MySQL disabled");
//     return;
//   }

//   if (pool) {
//     return;
//   }

//   pool = mysql.createPool({
//     host: env.mysql.host,
//     port: env.mysql.port,
//     user: env.mysql.user,
//     password: env.mysql.password,
//     database: env.mysql.database,

//     waitForConnections: true,
//     connectionLimit: Number(env.mysql.connectionLimit) || 20,
//     queueLimit: 0,
//     enableKeepAlive: true,
//     keepAliveInitialDelay: 10000,
//     decimalNumbers: true,
//     namedPlaceholders: false,
//   });

//   await pool.query("SELECT 1");

//   logger.info("MySQL connected", {
//     database: env.mysql.database,
//     connectionLimit: Number(env.mysql.connectionLimit) || 20,
//   });
// }

// /* =========================================================
//    MARKET STOCKS
// ========================================================= */

// async function getMarketStockInstruments() {
//   const db = requireDb();

//   const [rows] = await db.query(`
//     SELECT
//       id,
//       symbol,
//       name,
//       price,
//       change_value,
//       change_percent,
//       open_price,
//       previous_close,
//       day_high,
//       day_low,
//       volume,
//       updated_at,
//       sector,
//       instrument_key,
//       last_trade_time,
//       market_status,
//       day_close
//     FROM market_stocks_data
//     WHERE instrument_key IS NOT NULL
//       AND instrument_key <> ''
//     ORDER BY id
//   `);

//   return rows;
// }

// async function getMarketStockCount() {
//   const db = requireDb();

//   const [rows] = await db.query(`
//     SELECT COUNT(*) AS count
//     FROM market_stocks_data
//     WHERE instrument_key IS NOT NULL
//       AND instrument_key <> ''
//   `);

//   return Number(rows[0]?.count || 0);
// }

// async function getMarketStockByInstrumentKey(instrumentKey) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT *
//       FROM market_stocks_data
//       WHERE instrument_key = ?
//       LIMIT 1
//     `,
//     [instrumentKey],
//   );

//   return rows[0] || null;
// }

// /* =========================================================
//    INSTRUMENT MASTER
// ========================================================= */

// async function getInstrumentMaster(instrumentKey) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT *
//       FROM instruments_master
//       WHERE instrument_key = ?
//       LIMIT 1
//     `,
//     [instrumentKey],
//   );

//   return rows[0] || null;
// }

// async function getInstrumentMasterByIsin(isin, exchange = null) {
//   const db = requireDb();

//   if (exchange) {
//     const [rows] = await db.query(
//       `
//         SELECT *
//         FROM instruments_master
//         WHERE isin = ?
//           AND exchange = ?
//           AND segment IN ('NSE_EQ', 'BSE_EQ')
//         ORDER BY
//           CASE
//             WHEN segment = 'NSE_EQ' THEN 0
//             ELSE 1
//           END
//         LIMIT 1
//       `,
//       [isin, exchange],
//     );

//     return rows[0] || null;
//   }

//   const [rows] = await db.query(
//     `
//     SELECT *
//     FROM instruments_master
//     WHERE isin = ?
//       AND segment IN ('NSE_EQ', 'BSE_EQ')
//     ORDER BY
//       CASE
//         WHEN segment = 'NSE_EQ' THEN 0
//         ELSE 1
//       END
//     LIMIT 1
//   `,
//     [isin],
//   );

//   return rows[0] || null;
// }

// async function getBseInstrumentByIsin(isin) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT *
//       FROM instruments_master
//       WHERE isin = ?
//         AND segment = 'BSE_EQ'
//       LIMIT 1
//     `,
//     [isin],
//   );

//   return rows[0] || null;
// }

// /* =========================================================
//    SAVE DAILY CLOSE
// ========================================================= */

// async function saveDailyClose(snapshot, tradingDate) {
//   const db = requireDb();

//   if (!snapshot?.instrumentKey || snapshot?.price == null) {
//     return false;
//   }

//   const instrumentKey = String(snapshot.instrumentKey);
//   const price = Number(snapshot.price);

//   if (!Number.isFinite(price)) {
//     return false;
//   }

//   const symbol = snapshot.symbol || null;
//   const name = snapshot.name || null;
//   const change = snapshot.change == null ? null : Number(snapshot.change);
//   const changePercent =
//     snapshot.changePercent == null ? null : Number(snapshot.changePercent);
//   const open = snapshot.open == null ? null : Number(snapshot.open);
//   const previousClose =
//     snapshot.previousClose == null ? null : Number(snapshot.previousClose);
//   const high = snapshot.high == null ? null : Number(snapshot.high);
//   const low = snapshot.low == null ? null : Number(snapshot.low);
//   const volume = snapshot.volume == null ? null : Number(snapshot.volume);
//   const lastTradeTime =
//     snapshot.lastTradeTime ??
//     snapshot.lastTradedTime ??
//     snapshot.timestamp ??
//     null;
//   const sector = snapshot.sector || null;
//   const dayClose =
//     snapshot.dayClose != null ? Number(snapshot.dayClose) : price;

//   /*
//    * We deliberately use INSERT ... ON DUPLICATE KEY
//    * with instrument_key as the unique key.
//    *
//    * Your database has instrument_key UNIQUE.
//    */

//   await db.query(
//     `
//       INSERT INTO market_stocks_data (
//         symbol,
//         name,
//         price,
//         change_value,
//         change_percent,
//         open_price,
//         previous_close,
//         day_high,
//         day_low,
//         volume,
//         updated_at,
//         sector,
//         instrument_key,
//         last_trade_time,
//         market_status,
//         day_close
//       )
//       VALUES (
//         ?, ?, ?, ?, ?,
//         ?, ?, ?, ?, ?,
//         NOW(),
//         ?, ?, ?, ?, ?, ?
//       )
//       ON DUPLICATE KEY UPDATE
//         symbol = COALESCE(VALUES(symbol), symbol),
//         name = COALESCE(VALUES(name), name),
//         price = VALUES(price),
//         change_value = VALUES(change_value),
//         change_percent = VALUES(change_percent),
//         open_price = VALUES(open_price),
//         previous_close = VALUES(previous_close),
//         day_high = VALUES(day_high),
//         day_low = VALUES(day_low),
//         volume = VALUES(volume),
//         updated_at = NOW(),
//         sector = COALESCE(VALUES(sector), sector),
//         last_trade_time = VALUES(last_trade_time),
//         market_status = 'CLOSED',
//         day_close = VALUES(day_close)
//     `,
//     [
//       symbol,
//       name,
//       price,
//       Number.isFinite(change) ? change : null,
//       Number.isFinite(changePercent) ? changePercent : null,

//       Number.isFinite(open) ? open : null,
//       Number.isFinite(previousClose) ? previousClose : null,

//       Number.isFinite(high) ? high : null,
//       Number.isFinite(low) ? low : null,

//       Number.isFinite(volume) ? Math.trunc(volume) : null,

//       sector,
//       instrumentKey,
//       lastTradeTime,
//       "CLOSED",
//       Number.isFinite(dayClose) ? dayClose : price,
//     ],
//   );

//   /*
//    * Save historical daily close.
//    *
//    * This table is independent from the live market table.
//    */

//   await db.query(
//     `
//       INSERT INTO detail_stock_daily_closes (
//         instrument_key,
//         trading_date,
//         close_price,
//         open_price,
//         high_price,
//         low_price,
//         volume,
//         previous_close,
//         created_at
//       )
//       VALUES (
//         ?, ?, ?, ?, ?,
//         ?, ?, ?, NOW()
//       )
//       ON DUPLICATE KEY UPDATE
//         close_price = VALUES(close_price),
//         open_price = VALUES(open_price),
//         high_price = VALUES(high_price),
//         low_price = VALUES(low_price),
//         volume = VALUES(volume),
//         previous_close = VALUES(previous_close)
//     `,
//     [
//       instrumentKey,
//       tradingDate,
//       Number.isFinite(dayClose) ? dayClose : price,
//       Number.isFinite(open) ? open : null,
//       Number.isFinite(high) ? high : null,
//       Number.isFinite(low) ? low : null,
//       Number.isFinite(volume) ? Math.trunc(volume) : null,
//       Number.isFinite(previousClose) ? previousClose : null,
//     ],
//   );

//   return true;
// }

// /* =========================================================
//    PREVIOUS CLOSE
// ========================================================= */

// async function getPreviousStoredClose(instrumentKey, beforeTradingDate) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT
//         trading_date,
//         close_price AS close
//       FROM detail_stock_daily_closes
//       WHERE instrument_key = ?
//         AND trading_date < ?
//       ORDER BY trading_date DESC
//       LIMIT 1
//     `,
//     [instrumentKey, beforeTradingDate],
//   );

//   return rows[0] || null;
// }

// /* =========================================================
//    DAILY CLOSE STATUS
// ========================================================= */

// async function hasDailyCloseForDate(instrumentKey, tradingDate) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT 1
//       FROM detail_stock_daily_closes
//       WHERE instrument_key = ?
//         AND trading_date = ?
//       LIMIT 1
//     `,
//     [instrumentKey, tradingDate],
//   );

//   return rows.length > 0;
// }

// async function getDailyCloseCount(tradingDate) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT COUNT(*) AS count
//       FROM detail_stock_daily_closes
//       WHERE trading_date = ?
//     `,
//     [tradingDate],
//   );

//   return Number(rows[0]?.count || 0);
// }

// /* =========================================================
//    HISTORY
// ========================================================= */

// async function getDbHistory(instrumentKey, from, to) {
//   const db = requireDb();

//   const [rows] = await db.query(
//     `
//       SELECT
//         CONCAT(
//           trading_date,
//           'T15:30:00+05:30'
//         ) AS timestamp,

//         open_price AS open,
//         high_price AS high,
//         low_price AS low,
//         close_price AS close,
//         volume

//       FROM detail_stock_daily_closes

//       WHERE instrument_key = ?
//         AND trading_date BETWEEN ? AND ?

//       ORDER BY trading_date
//     `,
//     [instrumentKey, from, to],
//   );

//   return rows;
// }

// /* =========================================================
//    CLOSE
// ========================================================= */

// async function close() {
//   if (pool) {
//     await pool.end();
//   }

//   pool = null;
// }

// module.exports = {
//   initDb,
//   close,

//   getMarketStockInstruments,
//   getMarketStockCount,
//   getMarketStockByInstrumentKey,

//   getInstrumentMaster,
//   getInstrumentMasterByIsin,
//   getBseInstrumentByIsin,

//   saveDailyClose,

//   getPreviousStoredClose,
//   hasDailyCloseForDate,
//   getDailyCloseCount,

//   getDbHistory,
// };























































const mysql = require("mysql2/promise");
const env = require("./env");
const logger = require("./logger");

let pool = null;

function requireDb() {
  if (!env.mysqlEnabled) throw new Error("MySQL is disabled");
  if (!pool) throw new Error("MySQL has not been initialized");
  return pool;
}

async function initDb() {
  if (!env.mysqlEnabled) {
    logger.warn("MySQL disabled");
    return;
  }

  pool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    waitForConnections: true,
    connectionLimit: env.mysql.connectionLimit,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    decimalNumbers: true,
  });

  await pool.query("SELECT 1");
  logger.info("MySQL connected", {
    database: env.mysql.database,
    connectionLimit: env.mysql.connectionLimit,
  });
}

async function getMarketStockInstruments() {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT
       ms.id,
       COALESCE(im.trading_symbol, ms.symbol) AS symbol,
       COALESCE(im.name, ms.name) AS name,
       ms.price, ms.change_value, ms.change_percent,
       ms.open_price, ms.previous_close, ms.day_high, ms.day_low, ms.volume,
       ms.updated_at, ms.sector, ms.instrument_key, ms.last_trade_time,
       ms.market_status, ms.day_close
     FROM market_stocks_data ms
     LEFT JOIN instruments_master im
       ON im.instrument_key = ms.instrument_key
     WHERE ms.instrument_key IS NOT NULL
       AND ms.instrument_key <> ''
     ORDER BY ms.id`
  );
  return rows;
}

async function getMarketStockCount() {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
       FROM market_stocks_data
      WHERE instrument_key IS NOT NULL AND instrument_key <> ''`
  );
  return Number(rows[0]?.count || 0);
}

async function getMarketStockByInstrumentKey(instrumentKey) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT
       ms.*,
       im.exchange AS master_exchange,
       im.segment AS master_segment,
       im.trading_symbol AS master_trading_symbol,
       im.name AS master_name,
       im.isin AS master_isin
     FROM market_stocks_data ms
     LEFT JOIN instruments_master im
       ON im.instrument_key = ms.instrument_key
     WHERE ms.instrument_key = ?
     LIMIT 1`,
    [instrumentKey]
  );
  return rows[0] || null;
}

async function getInstrumentMaster(instrumentKey) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT *
       FROM instruments_master
      WHERE instrument_key = ?
      LIMIT 1`,
    [instrumentKey]
  );
  return rows[0] || null;
}

async function getInstrumentMasterByIsin(isin, exchange = null) {
  const db = requireDb();
  const sql = exchange
    ? `SELECT * FROM instruments_master
        WHERE isin = ? AND exchange = ?
          AND segment IN ('NSE_EQ','BSE_EQ')
        ORDER BY CASE WHEN segment='NSE_EQ' THEN 0 ELSE 1 END
        LIMIT 1`
    : `SELECT * FROM instruments_master
        WHERE isin = ?
          AND segment IN ('NSE_EQ','BSE_EQ')
        ORDER BY CASE WHEN segment='NSE_EQ' THEN 0 ELSE 1 END
        LIMIT 1`;
  const params = exchange ? [isin, exchange] : [isin];
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

async function getBseInstrumentByIsin(isin) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT *
       FROM instruments_master
      WHERE isin = ? AND segment = 'BSE_EQ'
      LIMIT 1`,
    [isin]
  );
  return rows[0] || null;
}

async function saveDailyClose(snapshot, tradingDate) {
  const db = requireDb();
  if (!snapshot?.instrumentKey || snapshot?.price == null) return false;

  const sql = `
    INSERT INTO market_stocks_data
      (symbol, name, price, change_value, change_percent,
       open_price, previous_close, day_high, day_low, volume,
       updated_at, sector, instrument_key, last_trade_time,
       market_status, day_close)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = COALESCE(VALUES(name), name),
      price = VALUES(price),
      change_value = VALUES(change_value),
      change_percent = VALUES(change_percent),
      open_price = VALUES(open_price),
      previous_close = VALUES(previous_close),
      day_high = VALUES(day_high),
      day_low = VALUES(day_low),
      volume = VALUES(volume),
      updated_at = NOW(),
      sector = COALESCE(VALUES(sector), sector),
      last_trade_time = VALUES(last_trade_time),
      market_status = 'CLOSED',
      day_close = VALUES(day_close)
  `;

  await db.query(sql, [
    snapshot.symbol || null,
    snapshot.name || null,
    snapshot.price,
    snapshot.change ?? null,
    snapshot.changePercent ?? null,
    snapshot.open ?? null,
    snapshot.previousClose ?? null,
    snapshot.high ?? null,
    snapshot.low ?? null,
    snapshot.volume ?? null,
    snapshot.sector || null,
    snapshot.instrumentKey,
    snapshot.lastTradeTime ?? null,
    "CLOSED",
    snapshot.dayClose ?? snapshot.price,
  ]);

  // Optional daily history table. It is created by the migration below.
  await db.query(
    `INSERT INTO detail_stock_daily_closes
       (instrument_key, trading_date, close_price, open_price, high_price, low_price, volume, previous_close, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       close_price = VALUES(close_price),
       open_price = VALUES(open_price),
       high_price = VALUES(high_price),
       low_price = VALUES(low_price),
       volume = VALUES(volume),
       previous_close = VALUES(previous_close)`,
    [
      snapshot.instrumentKey,
      tradingDate,
      snapshot.dayClose ?? snapshot.price,
      snapshot.open ?? null,
      snapshot.high ?? null,
      snapshot.low ?? null,
      snapshot.volume ?? null,
      snapshot.previousClose ?? null,
    ]
  );

  return true;
}

async function getPreviousStoredClose(instrumentKey, beforeTradingDate) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT trading_date, close_price AS close
       FROM detail_stock_daily_closes
      WHERE instrument_key = ? AND trading_date < ?
      ORDER BY trading_date DESC
      LIMIT 1`,
    [instrumentKey, beforeTradingDate]
  );
  return rows[0] || null;
}

async function hasDailyCloseForDate(instrumentKey, tradingDate) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT 1 FROM detail_stock_daily_closes
      WHERE instrument_key = ? AND trading_date = ?
      LIMIT 1`,
    [instrumentKey, tradingDate]
  );
  return !!rows.length;
}

async function getDailyCloseCount(tradingDate) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
       FROM detail_stock_daily_closes
      WHERE trading_date = ?`,
    [tradingDate]
  );
  return Number(rows[0]?.count || 0);
}

async function getDbHistory(instrumentKey, from, to) {
  const db = requireDb();
  const [rows] = await db.query(
    `SELECT
       CONCAT(trading_date, 'T15:30:00+05:30') AS timestamp,
       open_price AS open,
       high_price AS high,
       low_price AS low,
       close_price AS close,
       volume
     FROM detail_stock_daily_closes
     WHERE instrument_key = ?
       AND trading_date BETWEEN ? AND ?
     ORDER BY trading_date`,
    [instrumentKey, from, to]
  );
  return rows;
}

async function close() {
  if (pool) await pool.end();
  pool = null;
}

module.exports = {
  initDb,
  close,
  getMarketStockInstruments,
  getMarketStockCount,
  getMarketStockByInstrumentKey,
  getInstrumentMaster,
  getInstrumentMasterByIsin,
  getBseInstrumentByIsin,
  saveDailyClose,
  getPreviousStoredClose,
  hasDailyCloseForDate,
  getDailyCloseCount,
  getDbHistory,
};
