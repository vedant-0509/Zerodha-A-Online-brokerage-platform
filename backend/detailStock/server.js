const express = require("express");
const http = require("http");
const cors = require("cors");
const cron = require("node-cron");
const { Server } = require("socket.io");

const env = require("./env");
const logger = require("./logger");

const { redis, connectRedis } = require("./redis");

const {
  initDb,
  close: closeDb,

  saveDailyClose,

  getPreviousStoredClose,
  getDbHistory,

  getMarketStockInstruments,
  getMarketStockCount,

  getDailyCloseCount,
} = require("./db");

const {
  isMarketOpen,
  isTradingDay,
  indiaDate,
  marketStatus,
} = require("./market");

const upstox = require("./upstox");

/* =========================================================
   EXPRESS
========================================================= */

const app = express();

const server = http.createServer(app);

/* =========================================================
   CORS
========================================================= */

const origins = Array.isArray(env.origins) ? env.origins : [];

const io = new Server(server, {
  cors: {
    origin: origins.length ? origins : true,

    methods: ["GET", "POST"],

    credentials: true,
  },

  /*
   * Socket.IO settings suitable for
   * many browser clients.
   */
  pingInterval: 25000,

  pingTimeout: 20000,

  maxHttpBufferSize: 1e6,

  transports: ["websocket", "polling"],
});

app.use(
  cors({
    origin: origins.length ? origins : true,

    credentials: true,
  }),
);

app.use(
  express.json({
    limit: "1mb",
  }),
);

/* =========================================================
   MEMORY STATE
========================================================= */

/*
 * instrumentKey -> Set(socket.id)
 *
 * This is the most important map.
 *
 * Example:
 *
 * Reliance
 *   socket A
 *   socket B
 *   socket C
 *
 * Upstox:
 *   ONE subscription
 */
const subscribers = new Map();

/*
 * instrumentKey -> latest snapshot
 */
const snapshots = new Map();

/*
 * socket.id -> Set(instrumentKey)
 *
 * Makes disconnect cleanup O(number of
 * subscriptions for that socket).
 */
const socketSubscriptions = new Map();

/*
 * Prevent duplicate subscribe operations
 * while two users click the same stock at
 * exactly the same time.
 */
const subscriptionLocks = new Map();

/*
 * Snapshot cache prefixes.
 */
const SNAP_PREFIX = "detailstock:snapshot:";

const HISTORY_PREFIX = "detailstock:history:";

/*
 * Fundamentals cache.
 */
const fundamentalsByIsin = new Map();

const FUNDAMENTALS_TTL = 15 * 60 * 1000;

/*
 * Closing reconciliation lock.
 */
let closingJobRunning = false;

let lastClosingDate = null;

/*
 * Market lifecycle state.
 */
let previousMarketOpen = false;

/* =========================================================
   HELPERS
========================================================= */

function validKey(key) {
  return typeof key === "string" && key.length >= 3 && key.length <= 180;
}

function isinFromInstrumentKey(key) {
  const parts = String(key || "").split("|");

  const candidate = parts.length > 1 ? parts[1] : "";

  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(candidate) ? candidate : null;
}

function snapshotKey(key) {
  return SNAP_PREFIX + key;
}

function historyKey(key, unit, interval, from, to) {
  return [HISTORY_PREFIX, key, unit, interval, from || "", to].join(":");
}

function stockRoom(key) {
  return `stock:${key}`;
}

/* =========================================================
   REDIS SNAPSHOT
========================================================= */

async function cacheSnapshot(snapshot) {
  if (!snapshot || !snapshot.instrumentKey) {
    return;
  }

  snapshots.set(snapshot.instrumentKey, snapshot);

  if (redis && redis.isReady) {
    try {
      await redis.set(
        snapshotKey(snapshot.instrumentKey),
        JSON.stringify(snapshot),
        {
          EX: Number(env.snapshotCacheSeconds) || 86400,
        },
      );
    } catch (error) {
      logger.warn("Redis snapshot cache failed", {
        error: error.message,
      });
    }
  }
}

async function getSnapshot(instrumentKey) {
  if (snapshots.has(instrumentKey)) {
    return snapshots.get(instrumentKey);
  }

  if (redis && redis.isReady) {
    try {
      const raw = await redis.get(snapshotKey(instrumentKey));

      if (raw) {
        const snapshot = JSON.parse(raw);

        snapshots.set(instrumentKey, snapshot);

        return snapshot;
      }
    } catch (error) {
      logger.warn("Redis snapshot read failed", {
        instrumentKey,
        error: error.message,
      });
    }
  }

  return null;
}

/* =========================================================
   DB FALLBACK SNAPSHOT
========================================================= */

async function getStoredMarketSnapshot(instrumentKey) {
  /*
   * We intentionally don't query MySQL on every tick.
   *
   * This is only used when the market is closed
   * or no memory/Redis snapshot exists.
   */

  const { getMarketStockByInstrumentKey } = require("./db");

  const row = await getMarketStockByInstrumentKey(instrumentKey);

  if (!row) {
    return null;
  }

  const snapshot = {
    instrumentKey: row.instrument_key,

    symbol: row.symbol,

    name: row.name,

    price: row.day_close ?? row.price,

    ltp: row.day_close ?? row.price,

    previousClose: row.previous_close,

    change: row.change_value,

    changePercent: row.change_percent,

    open: row.open_price,

    high: row.day_high,

    low: row.day_low,

    volume: row.volume,

    sector: row.sector,

    lastTradeTime: row.last_trade_time,

    dayClose: row.day_close,

    marketStatus: row.market_status || "CLOSED",

    timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),

    source: "database",
  };

  await cacheSnapshot(snapshot);

  return snapshot;
}

/* =========================================================
   PREVIOUS CLOSE
========================================================= */

async function enrichSnapshotWithStoredPreviousClose(snapshot) {
  if (!snapshot || !env.mysqlEnabled) {
    return snapshot;
  }

  try {
    const previous = await getPreviousStoredClose(
      snapshot.instrumentKey,
      indiaDate(),
    );

    if (previous?.close != null) {
      const current = Number(snapshot.price);

      const previousClose = Number(previous.close);

      if (
        Number.isFinite(current) &&
        Number.isFinite(previousClose) &&
        previousClose > 0
      ) {
        snapshot.previousClose = previousClose;

        snapshot.change = current - previousClose;

        snapshot.changePercent = (snapshot.change / previousClose) * 100;

        snapshot.previousCloseDate = previous.trading_date;

        snapshot.previousCloseSource = "database";
      }
    }
  } catch (error) {
    logger.warn("Previous close lookup failed", {
      instrumentKey: snapshot.instrumentKey,

      error: error.message,
    });
  }

  return snapshot;
}

/* =========================================================
   PRIME SNAPSHOT
========================================================= */

async function primeSnapshot(instrumentKey) {
  /*
   * 1. Memory
   * 2. Redis
   * 3. DB if market closed
   * 4. Upstox REST only as last resort
   */

  const memoryOrRedis = await getSnapshot(instrumentKey);

  if (memoryOrRedis) {
    return memoryOrRedis;
  }

  if (!isMarketOpen()) {
    const stored = await getStoredMarketSnapshot(instrumentKey);

    if (stored) {
      return stored;
    }
  }

  const snapshot = await upstox.fetchOhlc(instrumentKey);

  await enrichSnapshotWithStoredPreviousClose(snapshot);

  await cacheSnapshot(snapshot);

  return snapshot;
}

/* =========================================================
   FUNDAMENTALS CACHE
========================================================= */

async function getFundamentalsCached(isin) {
  if (!isin) {
    return null;
  }

  const cached = fundamentalsByIsin.get(isin);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const data = await upstox.getFundamentals(isin);

  fundamentalsByIsin.set(isin, {
    data,

    expiresAt: Date.now() + FUNDAMENTALS_TTL,
  });

  return data;
}

/* =========================================================
   TICK HANDLER
========================================================= */

upstox.setTickHandler(async (tick) => {
  try {
    /*
     * Never write the tick to MySQL.
     *
     * Only memory + Redis.
     */
    const previous = snapshots.get(tick.instrumentKey) || {};

    const snapshot = {
      ...previous,
      ...tick,

      marketOpen: true,

      marketStatus: "OPEN",
    };

    await cacheSnapshot(snapshot);

    /*
     * Broadcast ONE message to the room.
     *
     * If 1000 users are watching:
     * Socket.IO handles the fan-out.
     *
     * Upstox still has only ONE provider
     * subscription for this instrument.
     */
    io.to(stockRoom(tick.instrumentKey)).emit("detailStock:tick", snapshot);
  } catch (error) {
    logger.error("Tick handling failed", {
      instrumentKey: tick?.instrumentKey,

      error: error.message,
    });
  }
});

/* =========================================================
   SUBSCRIPTION LOCK
========================================================= */

async function withSubscriptionLock(instrumentKey, operation) {
  const previous = subscriptionLocks.get(instrumentKey) || Promise.resolve();

  const next = previous.catch(() => { }).then(operation);

  subscriptionLocks.set(instrumentKey, next);

  try {
    return await next;
  } finally {
    if (subscriptionLocks.get(instrumentKey) === next) {
      subscriptionLocks.delete(instrumentKey);
    }
  }
}

/* =========================================================
   RELEASE SUBSCRIPTION
========================================================= */

async function releaseSubscription(instrumentKey, socketId) {
  const set = subscribers.get(instrumentKey);

  if (!set) {
    return;
  }

  set.delete(socketId);

  const socketSet = socketSubscriptions.get(socketId);

  if (socketSet) {
    socketSet.delete(instrumentKey);

    if (!socketSet.size) {
      socketSubscriptions.delete(socketId);
    }
  }

  /*
   * IMPORTANT:
   *
   * Do not unsubscribe from Upstox until
   * the LAST browser leaves.
   */
  if (set.size > 0) {
    return;
  }

  subscribers.delete(instrumentKey);

  await withSubscriptionLock(instrumentKey, async () => {
    /*
     * Another user might have subscribed while
     * we were waiting for the lock.
     */
    const current = subscribers.get(instrumentKey);

    if (current && current.size > 0) {
      return;
    }

    try {
      await upstox.unsubscribe(instrumentKey);

      logger.info("Upstox stock subscription released", {
        instrumentKey,
      });
    } catch (error) {
      logger.warn("Upstox unsubscribe failed", {
        instrumentKey,

        error: error.message,
      });
    }
  });
}

/* =========================================================
   SOCKET.IO
========================================================= */

io.on("connection", (socket) => {
  logger.info("DetailStock client connected", {
    socketId: socket.id,
  });

  socketSubscriptions.set(socket.id, new Set());

  /* =====================================================
       SUBSCRIBE
    ===================================================== */

  socket.on("detailStock:subscribe", async (payload, ack) => {
    const instrumentKey = payload?.instrumentKey;

    if (!validKey(instrumentKey)) {
      ack?.({
        success: false,

        message: "Valid instrumentKey is required",
      });

      return;
    }

    try {
      /*
       * Join the Socket.IO room immediately.
       */
      await socket.join(stockRoom(instrumentKey));

      /*
       * Track browser subscription.
       */
      if (!subscribers.has(instrumentKey)) {
        subscribers.set(instrumentKey, new Set());
      }

      const set = subscribers.get(instrumentKey);

      const alreadySubscribed = set.has(socket.id);

      set.add(socket.id);

      const socketSet = socketSubscriptions.get(socket.id);

      socketSet?.add(instrumentKey);

      /*
       * Get snapshot FIRST.
       *
       * During closed market this comes
       * from DB.
       *
       * During market it comes from cache
       * or Upstox.
       */
      let snapshot = await primeSnapshot(instrumentKey);

      snapshot = await enrichSnapshotWithStoredPreviousClose(snapshot);

      /*
       * Only the FIRST browser needs to ask
       * Upstox for the provider subscription.
       */
      if (!alreadySubscribed && set.size === 1 && isMarketOpen()) {
        await withSubscriptionLock(instrumentKey, async () => {
          /*
           * Check again because another
           * request could have subscribed
           * during the lock.
           */
          const current = subscribers.get(instrumentKey);

          if (!current || current.size === 0) {
            return;
          }

          const providerAlready = upstox
            .getSubscribed()
            .includes(instrumentKey);

          if (!providerAlready) {
            await upstox.subscribe(instrumentKey);

            logger.info("New Upstox stock subscription", {
              instrumentKey,

              subscriberCount: current.size,
            });
          }
        });
      }

      /*
       * Optional fundamentals.
       *
       * This is cached for 15 minutes and
       * therefore does NOT create a request
       * per user.
       */
      const isin = isinFromInstrumentKey(instrumentKey);

      if (isin) {
        try {
          const fundamentals = await getFundamentalsCached(isin);

          snapshot = {
            ...snapshot,

            ...fundamentals,

            isin,
          };

          await cacheSnapshot(snapshot);
        } catch (error) {
          logger.warn("Fundamentals unavailable", {
            instrumentKey,

            isin,

            error: error.message,
          });
        }
      }

      const currentMarketOpen = isMarketOpen();

      const responseSnapshot = {
        ...snapshot,

        marketOpen: currentMarketOpen,

        marketStatus: currentMarketOpen ? "OPEN" : "CLOSED",
      };

      socket.emit("detailStock:snapshot", responseSnapshot);

      ack?.({
        success: true,

        subscribed: true,

        alreadySubscribed,

        subscriberCount: set.size,

        marketOpen: currentMarketOpen,

        snapshot: responseSnapshot,
      });

      logger.info("DetailStock subscription", {
        socketId: socket.id,

        instrumentKey,

        subscriberCount: set.size,

        newUpstoxSubscription:
          set.size === 1 && currentMarketOpen && !alreadySubscribed,
      });
    } catch (error) {
      logger.error("DetailStock subscribe failed", {
        socketId: socket.id,

        instrumentKey,

        error: error.message,
      });

      /*
       * Roll back local subscription if provider
       * subscription failed.
       */
      await releaseSubscription(instrumentKey, socket.id).catch(() => { });

      socket.leave(stockRoom(instrumentKey));

      ack?.({
        success: false,

        message: error?.message || "Unable to subscribe to market data",
      });
    }
  });

  /* =====================================================
       UNSUBSCRIBE
    ===================================================== */

  socket.on("detailStock:unsubscribe", async (payload, ack) => {
    const instrumentKey = payload?.instrumentKey;

    if (!validKey(instrumentKey)) {
      ack?.({
        success: false,

        message: "Valid instrumentKey is required",
      });

      return;
    }

    try {
      await releaseSubscription(instrumentKey, socket.id);

      socket.leave(stockRoom(instrumentKey));

      ack?.({
        success: true,
      });
    } catch (error) {
      logger.warn("DetailStock unsubscribe failed", {
        instrumentKey,

        socketId: socket.id,

        error: error.message,
      });

      ack?.({
        success: false,

        message: error.message,
      });
    }
  });

  /* =====================================================
       DISCONNECT
    ===================================================== */

  socket.on("disconnect", async () => {
    try {
      const keys = [...(socketSubscriptions.get(socket.id) || [])];

      for (const key of keys) {
        await releaseSubscription(key, socket.id);
      }

      socketSubscriptions.delete(socket.id);

      logger.info("DetailStock client disconnected", {
        socketId: socket.id,
      });
    } catch (error) {
      logger.warn("Socket disconnect cleanup failed", {
        socketId: socket.id,

        error: error.message,
      });
    }
  });
});

/* =========================================================
   CLOSE ALL LIVE PROVIDER SUBSCRIPTIONS
========================================================= */

async function stopLiveMarketFeed() {
  const keys = upstox.getSubscribed();

  if (!keys.length) {
    return;
  }

  logger.info("Stopping DetailStock live feed", {
    subscriptions: keys.length,
  });

  /*
   * Important:
   *
   * We unsubscribe provider instruments but DO NOT
   * disconnect browser Socket.IO clients.
   *
   * They continue receiving the closing snapshot.
   */
  for (const key of keys) {
    try {
      await upstox.unsubscribe(key);
    } catch (error) {
      logger.warn("Failed to unsubscribe provider instrument", {
        instrumentKey: key,

        error: error.message,
      });
    }
  }
}

/* =========================================================
   NORMALIZE CLOSE QUOTE
========================================================= */

function normalizeQuote(instrumentKey, quote, marketRow) {
  const ohlc = quote?.ohlc || {};

  const price = Number(quote?.last_price);

  const close = Number(ohlc.close);

  const validPrice = Number.isFinite(price);

  const validClose = Number.isFinite(close);

  const actualClose = validClose ? close : validPrice ? price : null;

  const change = validPrice && validClose ? price - close : null;

  const changePercent =
    validPrice && validClose && close !== 0 ? (change / close) * 100 : null;

  return {
    instrumentKey,

    symbol: marketRow?.symbol || null,

    name: marketRow?.name || null,

    sector: marketRow?.sector || null,

    ltp: validPrice ? price : actualClose,

    price: validPrice ? price : actualClose,

    previousClose: validClose ? close : null,

    change,

    changePercent,

    open: Number.isFinite(Number(ohlc.open)) ? Number(ohlc.open) : null,

    high: Number.isFinite(Number(ohlc.high)) ? Number(ohlc.high) : null,

    low: Number.isFinite(Number(ohlc.low)) ? Number(ohlc.low) : null,

    volume: Number.isFinite(Number(quote?.volume))
      ? Number(quote.volume)
      : null,

    dayClose: actualClose,

    lastTradeTime: quote?.last_trade_time ?? null,

    timestamp: Date.now(),

    source: "upstox-market-quote",

    marketStatus: "CLOSED",
  };
}

/* =========================================================
   PERSIST ALL 2553 MARKET STOCK CLOSES
========================================================= */

async function persistAllMarketStocksClosingPrices(reason = "market-close") {
  if (!env.mysqlEnabled) {
    return {
      total: 0,
      saved: 0,
    };
  }

  const tradingDate = indiaDate();

  /*
   * Prevent duplicate close jobs.
   */
  if (closingJobRunning) {
    logger.warn("Closing reconciliation already running", {
      tradingDate,
    });

    return {
      total: 0,
      saved: 0,
      skipped: true,
    };
  }

  closingJobRunning = true;

  try {
    const rows = await getMarketStockInstruments();

    if (!rows.length) {
      logger.warn("No market stocks available for closing reconciliation");

      return {
        total: 0,
        saved: 0,
      };
    }

    const rowByKey = new Map();

    for (const row of rows) {
      rowByKey.set(row.instrument_key, row);
    }

    const keys = rows.map((row) => row.instrument_key).filter(Boolean);

    /*
     * Keep batches conservative.
     *
     * This is intentionally NOT executed every tick.
     *
     * It runs only at market close/startup reconciliation.
     */
    const batchSize = Number(env.closeQuoteBatchSize) || 100;

    let saved = 0;

    let failed = 0;

    for (let start = 0; start < keys.length; start += batchSize) {
      const batch = keys.slice(start, start + batchSize);

      try {
        const quotes = await upstox.fetchQuotes(batch);

        for (const key of batch) {
          const quote = quotes?.[key];

          if (!quote) {
            failed += 1;
            continue;
          }

          const row = rowByKey.get(key);

          const snapshot = normalizeQuote(key, quote, row);

          if (snapshot.dayClose == null) {
            failed += 1;
            continue;
          }

          /*
           * THIS is where MySQL is written.
           *
           * Not during live ticks.
           */
          await saveDailyClose(snapshot, tradingDate);

          /*
           * Update in-memory snapshot too.
           */
          await cacheSnapshot(snapshot);

          saved += 1;
        }
      } catch (error) {
        failed += batch.length;

        logger.error("Closing quote batch failed", {
          reason,

          tradingDate,

          batchStart: start,

          batchSize: batch.length,

          error: error.response?.data || error.message,
        });
      }

      /*
       * Tiny delay between batches to avoid unnecessarily
       * hammering REST.
       */
      if (start + batchSize < keys.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number(env.closeBatchDelayMs) || 150),
        );
      }
    }

    lastClosingDate = tradingDate;

    logger.info("Market-stock closing reconciliation complete", {
      reason,

      tradingDate,

      total: keys.length,

      saved,

      failed,
    });

    return {
      total: keys.length,

      saved,

      failed,

      tradingDate,
    };
  } finally {
    closingJobRunning = false;
  }
}

/* =========================================================
   STARTUP RECONCILIATION
========================================================= */

async function reconcileAfterHoursOnStartup() {
  if (!env.mysqlEnabled) {
    return;
  }

  if (isMarketOpen()) {
    return;
  }

  if (!isTradingDay()) {
    logger.info("Startup outside trading day; no closing reconciliation", {
      date: indiaDate(),
    });

    return;
  }

  const tradingDate = indiaDate();

  const expected = await getMarketStockCount();

  const savedToday = await getDailyCloseCount(tradingDate);

  logger.info("Startup close reconciliation check", {
    date: tradingDate,

    totalStocks: expected,

    savedToday,
  });

  /*
   * Already complete.
   */
  if (expected > 0 && savedToday >= expected) {
    logger.info("Startup close reconciliation not required", {
      date: tradingDate,

      totalStocks: expected,

      savedToday,
    });

    return;
  }

  logger.info("Startup close reconciliation required", {
    date: tradingDate,

    totalStocks: expected,

    savedToday,
  });

  await persistAllMarketStocksClosingPrices("startup-after-market-hours");
}

/* =========================================================
   MARKET CLOSE JOB
========================================================= */

async function runMarketCloseJob() {
  if (!env.mysqlEnabled) {
    return;
  }

  if (closingJobRunning) {
    return;
  }

  /*
   * Only run on an actual trading day.
   */
  if (!isTradingDay()) {
    return;
  }

  logger.info("Market close lifecycle started", {
    tradingDate: indiaDate(),
  });

  /*
   * Stop live provider subscriptions FIRST.
   *
   * Browser clients remain connected.
   */
  await stopLiveMarketFeed();

  /*
   * Fetch final values and persist them.
   */
  await persistAllMarketStocksClosingPrices("scheduled-market-close");

  /*
   * Tell every active stock room that market
   * has transitioned to CLOSED.
   */
  for (const [instrumentKey] of subscribers.entries()) {
    const snapshot = await getSnapshot(instrumentKey);

    if (!snapshot) {
      continue;
    }

    const closedSnapshot = {
      ...snapshot,

      marketOpen: false,

      marketStatus: "CLOSED",

      source: snapshot.source || "database",
    };

    await cacheSnapshot(closedSnapshot);

    io.to(stockRoom(instrumentKey)).emit(
      "detailStock:snapshot",
      closedSnapshot,
    );
  }

  logger.info("Market close lifecycle completed", {
    tradingDate: indiaDate(),
  });
}

/* =========================================================
   MARKET STATE MONITOR
========================================================= */

async function monitorMarketState() {
  const currentOpen = isMarketOpen();

  /*
   * CLOSED -> OPEN
   */
  if (currentOpen && !previousMarketOpen) {
    previousMarketOpen = true;

    logger.info("Market opened; DetailStock live mode enabled", {
      date: indiaDate(),
    });

    /*
     * Existing browser subscriptions should be
     * restored to Upstox.
     */
    for (const [instrumentKey, set] of subscribers.entries()) {
      if (!set.size) {
        continue;
      }

      try {
        await withSubscriptionLock(instrumentKey, async () => {
          if (!isMarketOpen()) {
            return;
          }

          if (!upstox.getSubscribed().includes(instrumentKey)) {
            await upstox.subscribe(instrumentKey);
          }
        });
      } catch (error) {
        logger.warn("Failed to restore live subscription", {
          instrumentKey,

          error: error.message,
        });
      }
    }

    /*
     * Tell clients that live mode is active.
     */
    for (const [instrumentKey] of subscribers.entries()) {
      io.to(stockRoom(instrumentKey)).emit("detailStock:market-status", {
        instrumentKey,

        marketOpen: true,

        marketStatus: "OPEN",
      });
    }

    return;
  }

  /*
   * OPEN -> CLOSED
   */
  if (!currentOpen && previousMarketOpen) {
    previousMarketOpen = false;

    await runMarketCloseJob();

    return;
  }

  previousMarketOpen = currentOpen;
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", async (req, res) => {
  let redisReady = false;

  try {
    redisReady = Boolean(redis?.isReady);
  } catch { }

  res.json({
    success: true,

    service: "detailStock",

    market: marketStatus(),

    redis: redisReady,

    upstox: {
      connected: upstox.isConnected(),

      connecting: upstox.isConnecting(),

      subscribed: upstox.getSubscribed().length,
    },

    browserSubscriptions: subscribers.size,

    snapshots: snapshots.size,

    lastClosingDate: lastClosingDate,

    time: new Date().toISOString(),
  });
});

/* =========================================================
   SNAPSHOT API
========================================================= */

app.get("/api/detail-stock/snapshot/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  if (!validKey(key)) {
    return res.status(400).json({
      success: false,

      message: "Invalid instrumentKey",
    });
  }

  try {
    const snapshot = await primeSnapshot(key);

    return res.json({
      success: true,

      marketOpen: isMarketOpen(),

      data: {
        ...snapshot,

        marketOpen: isMarketOpen(),

        marketStatus: isMarketOpen() ? "OPEN" : "CLOSED",
      },
    });
  } catch (error) {
    logger.error("Snapshot request failed", {
      instrumentKey: key,

      error: error.message,
    });

    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

/* =========================================================
   HISTORY API
========================================================= */

app.get("/api/detail-stock/history/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  if (!validKey(key)) {
    return res.status(400).json({
      success: false,

      message: "Invalid instrumentKey",
    });
  }

  const allowedUnits = ["minutes", "hours", "days", "weeks", "months"];

  const unit = allowedUnits.includes(req.query.unit) ? req.query.unit : "days";

  const interval = String(req.query.interval || "1");

  const to = String(req.query.to || indiaDate());

  const from = req.query.from ? String(req.query.from) : undefined;

  const cacheKey = historyKey(key, unit, interval, from, to);

  try {
    if (redis && redis.isReady) {
      const cached = await redis.get(cacheKey);

      if (cached) {
        return res.json({
          success: true,

          source: "cache",

          data: JSON.parse(cached),
        });
      }
    }

    let data = await upstox.fetchHistory(key, unit, interval, to, from);

    /*
     * Daily history can fall back to DB.
     */
    if ((!data || !data.length) && unit === "days") {
      data = await getDbHistory(key, from || "2000-01-01", to);
    }

    if (redis && redis.isReady) {
      await redis.set(cacheKey, JSON.stringify(data), {
        EX: Number(env.historyCacheSeconds) || 3600,
      });
    }

    return res.json({
      success: true,

      source: "upstox",

      data,
    });
  } catch (error) {
    try {
      const dbData = await getDbHistory(key, from || "2000-01-01", to);

      if (dbData.length) {
        return res.json({
          success: true,

          source: "database",

          data: dbData,
        });
      }
    } catch { }

    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

/* =========================================================
   FUNDAMENTALS
========================================================= */

app.get("/api/detail-stock/fundamentals/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    return res.json({
      success: true,

      isin,

      ...data,
    });
  } catch (error) {
    logger.error("Fundamentals request failed", {
      isin,

      error: error.response?.data || error.message,
    });

    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/shareholding/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    return res.json({
      success: true,

      isin,

      shareholding: data.shareholding || [],

      mutualFunds: data.mutualFunds || [],

      updatedAt: data.updatedAt,
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/about/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    return res.json({
      success: true,

      isin,

      profile: await upstox.getProfile(isin),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/ratios/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    return res.json({
      success: true,

      isin,

      ratios: data.ratios || [],

      updatedAt: data.updatedAt,
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/corporate-actions/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    return res.json({
      success: true,

      isin,

      data: await upstox.getCorporateActions(isin),

      updatedAt: Date.now(),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/competitors/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    const list = await upstox.getCompetitors(isin);

    /*
     * Don't fire hundreds of concurrent
     * quote calls.
     *
     * Limit concurrency.
     */
    const enriched = [];

    for (const competitor of list || []) {
      try {
        if (competitor.instrument_key) {
          const quote = await upstox.fetchOhlc(competitor.instrument_key);

          enriched.push({
            ...competitor,
            quote,
          });
        } else {
          enriched.push(competitor);
        }
      } catch {
        enriched.push(competitor);
      }
    }

    return res.json({
      success: true,

      isin,

      data: enriched,

      updatedAt: Date.now(),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

app.get("/api/detail-stock/financial-performance/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
    return res.status(400).json({
      success: false,

      message: "Invalid ISIN",
    });
  }

  try {
    const data = await upstox.getBalanceSheet(
      isin,
      String(req.query.type || "consolidated"),
    );

    return res.json({
      success: true,

      isin,

      data,

      updatedAt: Date.now(),
    });
  } catch (error) {
    return res.status(502).json({
      success: false,

      message: error.response?.data || error.message,
    });
  }
});

/* =========================================================
   MARKET STOCK COUNT
========================================================= */

app.get("/api/detail-stock/market-stocks-count", async (req, res) => {
  try {
    return res.json({
      success: true,

      count: await getMarketStockCount(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,

      message: error.message,
    });
  }
});

/* =========================================================
   STOCK STATUS
========================================================= */

app.get("/api/detail-stock/status/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  return res.json({
    success: true,

    instrumentKey: key,

    marketOpen: isMarketOpen(),

    subscriberCount: subscribers.get(key)?.size || 0,

    subscribed: upstox.getSubscribed().includes(key),

    snapshot: await getSnapshot(key),
  });
});

/* =========================================================
   MARKET CLOSE CRON
========================================================= */

/*
 * Run shortly after 15:30.
 *
 * We don't write every tick.
 * We write closing values ONCE.
 */
cron.schedule(
  "31 15 * * 1-5",
  async () => {
    try {
      /*
       * Don't blindly run if market calendar says
       * today is a holiday.
       */
      if (!isTradingDay()) {
        return;
      }

      await runMarketCloseJob();
    } catch (error) {
      logger.error("Scheduled market close failed", {
        error: error.stack || error.message,
      });
    }
  },
  {
    timezone: env.timezone || "Asia/Kolkata",
  },
);

/* =========================================================
   MARKET STATE MONITOR
========================================================= */

/*
 * This handles:
 *
 * 09:15 startup
 * 09:15 transition
 * 15:30 transition
 *
 * It also makes development testing much easier.
 */
setInterval(() => {
  monitorMarketState().catch((error) => {
    logger.error("Market state monitor failed", {
      error: error.message,
    });
  });
}, 5000);

/* =========================================================
   STARTUP
========================================================= */

async function start() {
  try {
    logger.info("Starting DetailStock backend");

    await connectRedis();

    await initDb();

    previousMarketOpen = isMarketOpen();

    /*
     * If the server starts after market hours:
     *
     * 1. Do NOT connect Upstox WS.
     * 2. Check whether today's close exists.
     * 3. If not, fetch close values.
     */
    if (!previousMarketOpen) {
      await reconcileAfterHoursOnStartup();
    } else {
      logger.info("Server started during market hours");
    }

    server.listen(env.port, () => {
      logger.info("DetailStock server started", {
        port: env.port,

        marketOpen: previousMarketOpen,

        origins: env.origins,
      });
    });
  } catch (error) {
    logger.error("DetailStock startup failed", {
      error: error.stack || error.message,
    });

    process.exit(1);
  }
}

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {
  logger.info("DetailStock shutting down", {
    signal,
  });

  try {
    await upstox.shutdown();
  } catch { }

  try {
    await closeDb();
  } catch { }

  try {
    if (redis && redis.isReady) {
      await redis.quit();
    }
  } catch { }

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", {
    error: error.stack || error.message,
  });
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection", {
    error: error?.stack || error?.message || String(error),
  });
});

start();
