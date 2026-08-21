const dotenv = require("dotenv");

dotenv.config();

function booleanValue(
  value,
  fallback = false,
) {
  if (value == null) {
    return fallback;
  }

  return [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    String(value)
      .trim()
      .toLowerCase(),
  );
}

function numberValue(
  value,
  fallback,
) {
  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

function listValue(
  value,
) {
  return String(
    value || "",
  )
    .split(",")
    .map((item) =>
      item.trim(),
    )
    .filter(Boolean);
}

module.exports = {
  port: numberValue(
    process.env.PORT,
    3011,
  ),

  nodeEnv:
    process.env.NODE_ENV ||
    "development",

  timezone:
    process.env.TZ ||
    process.env.TIMEZONE ||
    "Asia/Kolkata",

  origins:
    listValue(
      process.env.CORS_ORIGINS,
    ).length
      ? listValue(
          process.env.CORS_ORIGINS,
        )
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:5173",
        ],

  marketOpen:
    process.env.MARKET_OPEN ||
    "09:15",

  marketClose:
    process.env.MARKET_CLOSE ||
    "15:30",

  marketHolidays:
    listValue(
      process.env.MARKET_HOLIDAYS,
    ),

  mysqlEnabled:
    booleanValue(
      process.env.MYSQL_ENABLED,
      true,
    ),

  mysql: {
    host:
      process.env.MYSQL_HOST ||
      "localhost",

    port: numberValue(
      process.env.MYSQL_PORT,
      3306,
    ),

    user:
      process.env.MYSQL_USER ||
      "root",

    password:
      process.env.MYSQL_PASSWORD ||
      "",

    database:
      process.env.MYSQL_DATABASE ||
      "zerodha",

    connectionLimit:
      numberValue(
        process.env.MYSQL_CONNECTION_LIMIT,
        20,
      ),
  },

  redisUrl:
    process.env.REDIS_URL ||
    "redis://127.0.0.1:6379",

  upstoxAccessToken:
    process.env.UPSTOX_ACCESS_TOKEN ||
    "",

  /*
   * V3:
   *
   * ltpc = cheapest
   * full = required for OHLC/depth details
   */
  upstoxStreamMode:
    process.env.UPSTOX_STREAM_MODE ||
    "full",

  upstoxWsRetryDelayMs:
    numberValue(
      process.env.UPSTOX_WS_RETRY_DELAY_MS,
      15000,
    ),

  upstoxWsMaxRetries:
    numberValue(
      process.env.UPSTOX_WS_MAX_RETRIES,
      10,
    ),

  snapshotCacheSeconds:
    numberValue(
      process.env.SNAPSHOT_CACHE_SECONDS,
      86400,
    ),

  historyCacheSeconds:
    numberValue(
      process.env.HISTORY_CACHE_SECONDS,
      3600,
    ),

  closeQuoteBatchSize:
    numberValue(
      process.env.CLOSE_QUOTE_BATCH_SIZE,
      100,
    ),

  closeBatchDelayMs:
    numberValue(
      process.env.CLOSE_BATCH_DELAY_MS,
      150,
    ),
};