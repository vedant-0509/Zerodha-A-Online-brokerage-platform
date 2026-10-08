const dotenv = require("dotenv");

dotenv.config();

function booleanValue(value, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function listValue(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  port: numberValue(process.env.PORT, 3021),
  nodeEnv: process.env.NODE_ENV || "development",
  timezone: process.env.TZ || process.env.TIMEZONE || "Asia/Kolkata",

  origins: listValue(process.env.CORS_ORIGINS).length
    ? listValue(process.env.CORS_ORIGINS)
    : [
        "http://localhost:3002",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
      ],

  marketOpen: process.env.MARKET_OPEN || "09:15",
  marketClose: process.env.MARKET_CLOSE || "15:30",
  marketSettlement: process.env.MARKET_SETTLEMENT || "15:45",
  marketHolidays: listValue(process.env.MARKET_HOLIDAYS),

  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  redisEnabled: booleanValue(process.env.DETAIL_STOCK_REDIS_ENABLED, true),

  upstoxAccessToken:
    process.env.UPSTOX_ACCESS_TOKEN ||
    process.env.UPSTOX_ANALYTIC_TOKEN ||
    "",

  upstoxStreamMode: process.env.UPSTOX_STREAM_MODE || "full",
  upstoxWsRetryDelayMs: numberValue(
    process.env.UPSTOX_WS_RETRY_DELAY_MS,
    15000,
  ),
  upstoxWsMaxRetries: numberValue(process.env.UPSTOX_WS_MAX_RETRIES, 10),

  snapshotCacheSeconds: numberValue(
    process.env.SNAPSHOT_CACHE_SECONDS,
    86400,
  ),
  historyCacheSeconds: numberValue(
    process.env.HISTORY_CACHE_SECONDS,
    3600,
  ),
  week52CacheSeconds: numberValue(
    process.env.WEEK52_CACHE_SECONDS,
    86400,
  ),

  closeQuoteBatchSize: numberValue(
    process.env.CLOSE_QUOTE_BATCH_SIZE,
    500,
  ),
  closeBatchSize: numberValue(process.env.CLOSING_BATCH_SIZE, 5),
  closeBatchDelayMs: numberValue(
    process.env.CLOSE_BATCH_DELAY_MS,
    150,
  ),

  /*
   * Do not run the full ~2,553-stock repair on every Render restart.
   * The scheduled 15:45 / 15:50 EOD jobs handle normal settlement.
   * Enable explicitly only when a deliberate startup repair is required.
   */
  startupReconcileClosed: booleanValue(
    process.env.DETAIL_STOCK_STARTUP_RECONCILE_CLOSED,
    false,
  ),
};