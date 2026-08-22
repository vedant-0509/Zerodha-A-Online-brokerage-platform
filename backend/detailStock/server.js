// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const cron = require("node-cron");
// const { Server } = require("socket.io");

// const env = require("./env");
// const logger = require("./logger");

// const { redis, connectRedis } = require("./redis");

// const {
//   initDb,
//   close: closeDb,

//   saveDailyClose,

//   getPreviousStoredClose,
//   getDbHistory,

//   getMarketStockInstruments,
//   getMarketStockCount,

//   getDailyCloseCount,
// } = require("./db");

// const {
//   isMarketOpen,
//   isTradingDay,
//   indiaDate,
//   marketStatus,
// } = require("./market");

// const upstox = require("./upstox");

// /* =========================================================
//    EXPRESS
// ========================================================= */

// const app = express();

// const server = http.createServer(app);

// /* =========================================================
//    CORS
// ========================================================= */

// const origins = Array.isArray(env.origins) ? env.origins : [];

// const io = new Server(server, {
//   cors: {
//     origin: origins.length ? origins : true,

//     methods: ["GET", "POST"],

//     credentials: true,
//   },

//   /*
//    * Socket.IO settings suitable for
//    * many browser clients.
//    */
//   pingInterval: 25000,

//   pingTimeout: 20000,

//   maxHttpBufferSize: 1e6,

//   transports: ["websocket", "polling"],
// });

// app.use(
//   cors({
//     origin: origins.length ? origins : true,

//     credentials: true,
//   }),
// );

// app.use(
//   express.json({
//     limit: "1mb",
//   }),
// );

// /* =========================================================
//    MEMORY STATE
// ========================================================= */

// /*
//  * instrumentKey -> Set(socket.id)
//  *
//  * This is the most important map.
//  *
//  * Example:
//  *
//  * Reliance
//  *   socket A
//  *   socket B
//  *   socket C
//  *
//  * Upstox:
//  *   ONE subscription
//  */
// const subscribers = new Map();

// /*
//  * instrumentKey -> latest snapshot
//  */
// const snapshots = new Map();

// /*
//  * socket.id -> Set(instrumentKey)
//  *
//  * Makes disconnect cleanup O(number of
//  * subscriptions for that socket).
//  */
// const socketSubscriptions = new Map();

// /*
//  * Prevent duplicate subscribe operations
//  * while two users click the same stock at
//  * exactly the same time.
//  */
// const subscriptionLocks = new Map();

// /*
//  * Snapshot cache prefixes.
//  */
// const SNAP_PREFIX = "detailstock:snapshot:";

// const HISTORY_PREFIX = "detailstock:history:";

// /*
//  * Fundamentals cache.
//  */
// const fundamentalsByIsin = new Map();

// const FUNDAMENTALS_TTL = 15 * 60 * 1000;

// /*
//  * Closing reconciliation lock.
//  */
// let closingJobRunning = false;

// let lastClosingDate = null;

// /*
//  * Market lifecycle state.
//  */
// let previousMarketOpen = false;

// /* =========================================================
//    HELPERS
// ========================================================= */

// function validKey(key) {
//   return typeof key === "string" && key.length >= 3 && key.length <= 180;
// }

// function isinFromInstrumentKey(key) {
//   const parts = String(key || "").split("|");

//   const candidate = parts.length > 1 ? parts[1] : "";

//   return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(candidate) ? candidate : null;
// }

// function snapshotKey(key) {
//   return SNAP_PREFIX + key;
// }

// function historyKey(key, unit, interval, from, to) {
//   return [HISTORY_PREFIX, key, unit, interval, from || "", to].join(":");
// }

// function stockRoom(key) {
//   return `stock:${key}`;
// }

// /* =========================================================
//    REDIS SNAPSHOT
// ========================================================= */

// async function cacheSnapshot(snapshot) {
//   if (!snapshot || !snapshot.instrumentKey) {
//     return;
//   }

//   snapshots.set(snapshot.instrumentKey, snapshot);

//   if (redis && redis.isReady) {
//     try {
//       await redis.set(
//         snapshotKey(snapshot.instrumentKey),
//         JSON.stringify(snapshot),
//         {
//           EX: Number(env.snapshotCacheSeconds) || 86400,
//         },
//       );
//     } catch (error) {
//       logger.warn("Redis snapshot cache failed", {
//         error: error.message,
//       });
//     }
//   }
// }

// async function getSnapshot(instrumentKey) {
//   if (snapshots.has(instrumentKey)) {
//     return snapshots.get(instrumentKey);
//   }

//   if (redis && redis.isReady) {
//     try {
//       const raw = await redis.get(snapshotKey(instrumentKey));

//       if (raw) {
//         const snapshot = JSON.parse(raw);

//         snapshots.set(instrumentKey, snapshot);

//         return snapshot;
//       }
//     } catch (error) {
//       logger.warn("Redis snapshot read failed", {
//         instrumentKey,
//         error: error.message,
//       });
//     }
//   }

//   return null;
// }

// /* =========================================================
//    DB FALLBACK SNAPSHOT
// ========================================================= */

// async function getStoredMarketSnapshot(instrumentKey) {
//   /*
//    * We intentionally don't query MySQL on every tick.
//    *
//    * This is only used when the market is closed
//    * or no memory/Redis snapshot exists.
//    */

//   const { getMarketStockByInstrumentKey } = require("./db");

//   const row = await getMarketStockByInstrumentKey(instrumentKey);

//   if (!row) {
//     return null;
//   }

//   const snapshot = {
//     instrumentKey: row.instrument_key,

//     symbol: row.symbol,

//     name: row.name,

//     price: row.day_close ?? row.price,

//     ltp: row.day_close ?? row.price,

//     previousClose: row.previous_close,

//     change: row.change_value,

//     changePercent: row.change_percent,

//     open: row.open_price,

//     high: row.day_high,

//     low: row.day_low,

//     volume: row.volume,

//     sector: row.sector,

//     lastTradeTime: row.last_trade_time,

//     dayClose: row.day_close,

//     marketStatus: row.market_status || "CLOSED",

//     timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),

//     source: "database",
//   };

//   await cacheSnapshot(snapshot);

//   return snapshot;
// }

// /* =========================================================
//    PREVIOUS CLOSE
// ========================================================= */

// async function enrichSnapshotWithStoredPreviousClose(snapshot) {
//   if (!snapshot || !env.mysqlEnabled) {
//     return snapshot;
//   }

//   try {
//     const previous = await getPreviousStoredClose(
//       snapshot.instrumentKey,
//       indiaDate(),
//     );

//     if (previous?.close != null) {
//       const current = Number(snapshot.price);

//       const previousClose = Number(previous.close);

//       if (
//         Number.isFinite(current) &&
//         Number.isFinite(previousClose) &&
//         previousClose > 0
//       ) {
//         snapshot.previousClose = previousClose;

//         snapshot.change = current - previousClose;

//         snapshot.changePercent = (snapshot.change / previousClose) * 100;

//         snapshot.previousCloseDate = previous.trading_date;

//         snapshot.previousCloseSource = "database";
//       }
//     }
//   } catch (error) {
//     logger.warn("Previous close lookup failed", {
//       instrumentKey: snapshot.instrumentKey,

//       error: error.message,
//     });
//   }

//   return snapshot;
// }

// /* =========================================================
//    PRIME SNAPSHOT
// ========================================================= */

// async function primeSnapshot(instrumentKey) {
//   /*
//    * 1. Memory
//    * 2. Redis
//    * 3. DB if market closed
//    * 4. Upstox REST only as last resort
//    */

//   const memoryOrRedis = await getSnapshot(instrumentKey);

//   if (memoryOrRedis) {
//     return memoryOrRedis;
//   }

//   if (!isMarketOpen()) {
//     const stored = await getStoredMarketSnapshot(instrumentKey);

//     if (stored) {
//       return stored;
//     }
//   }

//   const snapshot = await upstox.fetchOhlc(instrumentKey);

//   await enrichSnapshotWithStoredPreviousClose(snapshot);

//   await cacheSnapshot(snapshot);

//   return snapshot;
// }

// /* =========================================================
//    FUNDAMENTALS CACHE
// ========================================================= */

// async function getFundamentalsCached(isin) {
//   if (!isin) {
//     return null;
//   }

//   const cached = fundamentalsByIsin.get(isin);

//   if (cached && cached.expiresAt > Date.now()) {
//     return cached.data;
//   }

//   const data = await upstox.getFundamentals(isin);

//   fundamentalsByIsin.set(isin, {
//     data,

//     expiresAt: Date.now() + FUNDAMENTALS_TTL,
//   });

//   return data;
// }

// /* =========================================================
//    TICK HANDLER
// ========================================================= */

// upstox.setTickHandler(async (tick) => {
//   try {
//     /*
//      * Never write the tick to MySQL.
//      *
//      * Only memory + Redis.
//      */
//     const previous = snapshots.get(tick.instrumentKey) || {};

//     const snapshot = {
//       ...previous,
//       ...tick,

//       marketOpen: true,

//       marketStatus: "OPEN",
//     };

//     await cacheSnapshot(snapshot);

//     /*
//      * Broadcast ONE message to the room.
//      *
//      * If 1000 users are watching:
//      * Socket.IO handles the fan-out.
//      *
//      * Upstox still has only ONE provider
//      * subscription for this instrument.
//      */
//     io.to(stockRoom(tick.instrumentKey)).emit("detailStock:tick", snapshot);
//   } catch (error) {
//     logger.error("Tick handling failed", {
//       instrumentKey: tick?.instrumentKey,

//       error: error.message,
//     });
//   }
// });

// /* =========================================================
//    SUBSCRIPTION LOCK
// ========================================================= */

// async function withSubscriptionLock(instrumentKey, operation) {
//   const previous = subscriptionLocks.get(instrumentKey) || Promise.resolve();

//   const next = previous.catch(() => { }).then(operation);

//   subscriptionLocks.set(instrumentKey, next);

//   try {
//     return await next;
//   } finally {
//     if (subscriptionLocks.get(instrumentKey) === next) {
//       subscriptionLocks.delete(instrumentKey);
//     }
//   }
// }

// /* =========================================================
//    RELEASE SUBSCRIPTION
// ========================================================= */

// async function releaseSubscription(instrumentKey, socketId) {
//   const set = subscribers.get(instrumentKey);

//   if (!set) {
//     return;
//   }

//   set.delete(socketId);

//   const socketSet = socketSubscriptions.get(socketId);

//   if (socketSet) {
//     socketSet.delete(instrumentKey);

//     if (!socketSet.size) {
//       socketSubscriptions.delete(socketId);
//     }
//   }

//   /*
//    * IMPORTANT:
//    *
//    * Do not unsubscribe from Upstox until
//    * the LAST browser leaves.
//    */
//   if (set.size > 0) {
//     return;
//   }

//   subscribers.delete(instrumentKey);

//   await withSubscriptionLock(instrumentKey, async () => {
//     /*
//      * Another user might have subscribed while
//      * we were waiting for the lock.
//      */
//     const current = subscribers.get(instrumentKey);

//     if (current && current.size > 0) {
//       return;
//     }

//     try {
//       await upstox.unsubscribe(instrumentKey);

//       logger.info("Upstox stock subscription released", {
//         instrumentKey,
//       });
//     } catch (error) {
//       logger.warn("Upstox unsubscribe failed", {
//         instrumentKey,

//         error: error.message,
//       });
//     }
//   });
// }

// /* =========================================================
//    SOCKET.IO
// ========================================================= */

// io.on("connection", (socket) => {
//   logger.info("DetailStock client connected", {
//     socketId: socket.id,
//   });

//   socketSubscriptions.set(socket.id, new Set());

//   /* =====================================================
//        SUBSCRIBE
//     ===================================================== */

//   socket.on("detailStock:subscribe", async (payload, ack) => {
//     const instrumentKey = payload?.instrumentKey;

//     if (!validKey(instrumentKey)) {
//       ack?.({
//         success: false,

//         message: "Valid instrumentKey is required",
//       });

//       return;
//     }

//     try {
//       /*
//        * Join the Socket.IO room immediately.
//        */
//       await socket.join(stockRoom(instrumentKey));

//       /*
//        * Track browser subscription.
//        */
//       if (!subscribers.has(instrumentKey)) {
//         subscribers.set(instrumentKey, new Set());
//       }

//       const set = subscribers.get(instrumentKey);

//       const alreadySubscribed = set.has(socket.id);

//       set.add(socket.id);

//       const socketSet = socketSubscriptions.get(socket.id);

//       socketSet?.add(instrumentKey);

//       /*
//        * Get snapshot FIRST.
//        *
//        * During closed market this comes
//        * from DB.
//        *
//        * During market it comes from cache
//        * or Upstox.
//        */
//       let snapshot = await primeSnapshot(instrumentKey);

//       snapshot = await enrichSnapshotWithStoredPreviousClose(snapshot);

//       /*
//        * Only the FIRST browser needs to ask
//        * Upstox for the provider subscription.
//        */
//       if (!alreadySubscribed && set.size === 1 && isMarketOpen()) {
//         await withSubscriptionLock(instrumentKey, async () => {
//           /*
//            * Check again because another
//            * request could have subscribed
//            * during the lock.
//            */
//           const current = subscribers.get(instrumentKey);

//           if (!current || current.size === 0) {
//             return;
//           }

//           const providerAlready = upstox
//             .getSubscribed()
//             .includes(instrumentKey);

//           if (!providerAlready) {
//             await upstox.subscribe(instrumentKey);

//             logger.info("New Upstox stock subscription", {
//               instrumentKey,

//               subscriberCount: current.size,
//             });
//           }
//         });
//       }

//       /*
//        * Optional fundamentals.
//        *
//        * This is cached for 15 minutes and
//        * therefore does NOT create a request
//        * per user.
//        */
//       const isin = isinFromInstrumentKey(instrumentKey);

//       if (isin) {
//         try {
//           const fundamentals = await getFundamentalsCached(isin);

//           snapshot = {
//             ...snapshot,

//             ...fundamentals,

//             isin,
//           };

//           await cacheSnapshot(snapshot);
//         } catch (error) {
//           logger.warn("Fundamentals unavailable", {
//             instrumentKey,

//             isin,

//             error: error.message,
//           });
//         }
//       }

//       const currentMarketOpen = isMarketOpen();

//       const responseSnapshot = {
//         ...snapshot,

//         marketOpen: currentMarketOpen,

//         marketStatus: currentMarketOpen ? "OPEN" : "CLOSED",
//       };

//       socket.emit("detailStock:snapshot", responseSnapshot);

//       ack?.({
//         success: true,

//         subscribed: true,

//         alreadySubscribed,

//         subscriberCount: set.size,

//         marketOpen: currentMarketOpen,

//         snapshot: responseSnapshot,
//       });

//       logger.info("DetailStock subscription", {
//         socketId: socket.id,

//         instrumentKey,

//         subscriberCount: set.size,

//         newUpstoxSubscription:
//           set.size === 1 && currentMarketOpen && !alreadySubscribed,
//       });
//     } catch (error) {
//       logger.error("DetailStock subscribe failed", {
//         socketId: socket.id,

//         instrumentKey,

//         error: error.message,
//       });

//       /*
//        * Roll back local subscription if provider
//        * subscription failed.
//        */
//       await releaseSubscription(instrumentKey, socket.id).catch(() => { });

//       socket.leave(stockRoom(instrumentKey));

//       ack?.({
//         success: false,

//         message: error?.message || "Unable to subscribe to market data",
//       });
//     }
//   });

//   /* =====================================================
//        UNSUBSCRIBE
//     ===================================================== */

//   socket.on("detailStock:unsubscribe", async (payload, ack) => {
//     const instrumentKey = payload?.instrumentKey;

//     if (!validKey(instrumentKey)) {
//       ack?.({
//         success: false,

//         message: "Valid instrumentKey is required",
//       });

//       return;
//     }

//     try {
//       await releaseSubscription(instrumentKey, socket.id);

//       socket.leave(stockRoom(instrumentKey));

//       ack?.({
//         success: true,
//       });
//     } catch (error) {
//       logger.warn("DetailStock unsubscribe failed", {
//         instrumentKey,

//         socketId: socket.id,

//         error: error.message,
//       });

//       ack?.({
//         success: false,

//         message: error.message,
//       });
//     }
//   });

//   /* =====================================================
//        DISCONNECT
//     ===================================================== */

//   socket.on("disconnect", async () => {
//     try {
//       const keys = [...(socketSubscriptions.get(socket.id) || [])];

//       for (const key of keys) {
//         await releaseSubscription(key, socket.id);
//       }

//       socketSubscriptions.delete(socket.id);

//       logger.info("DetailStock client disconnected", {
//         socketId: socket.id,
//       });
//     } catch (error) {
//       logger.warn("Socket disconnect cleanup failed", {
//         socketId: socket.id,

//         error: error.message,
//       });
//     }
//   });
// });

// /* =========================================================
//    CLOSE ALL LIVE PROVIDER SUBSCRIPTIONS
// ========================================================= */

// async function stopLiveMarketFeed() {
//   const keys = upstox.getSubscribed();

//   if (!keys.length) {
//     return;
//   }

//   logger.info("Stopping DetailStock live feed", {
//     subscriptions: keys.length,
//   });

//   /*
//    * Important:
//    *
//    * We unsubscribe provider instruments but DO NOT
//    * disconnect browser Socket.IO clients.
//    *
//    * They continue receiving the closing snapshot.
//    */
//   for (const key of keys) {
//     try {
//       await upstox.unsubscribe(key);
//     } catch (error) {
//       logger.warn("Failed to unsubscribe provider instrument", {
//         instrumentKey: key,

//         error: error.message,
//       });
//     }
//   }
// }

// /* =========================================================
//    NORMALIZE CLOSE QUOTE
// ========================================================= */

// function normalizeQuote(instrumentKey, quote, marketRow) {
//   const ohlc = quote?.ohlc || {};

//   const price = Number(quote?.last_price);

//   const close = Number(ohlc.close);

//   const validPrice = Number.isFinite(price);

//   const validClose = Number.isFinite(close);

//   const actualClose = validClose ? close : validPrice ? price : null;

//   const change = validPrice && validClose ? price - close : null;

//   const changePercent =
//     validPrice && validClose && close !== 0 ? (change / close) * 100 : null;

//   return {
//     instrumentKey,

//     symbol: marketRow?.symbol || null,

//     name: marketRow?.name || null,

//     sector: marketRow?.sector || null,

//     ltp: validPrice ? price : actualClose,

//     price: validPrice ? price : actualClose,

//     previousClose: validClose ? close : null,

//     change,

//     changePercent,

//     open: Number.isFinite(Number(ohlc.open)) ? Number(ohlc.open) : null,

//     high: Number.isFinite(Number(ohlc.high)) ? Number(ohlc.high) : null,

//     low: Number.isFinite(Number(ohlc.low)) ? Number(ohlc.low) : null,

//     volume: Number.isFinite(Number(quote?.volume))
//       ? Number(quote.volume)
//       : null,

//     dayClose: actualClose,

//     lastTradeTime: quote?.last_trade_time ?? null,

//     timestamp: Date.now(),

//     source: "upstox-market-quote",

//     marketStatus: "CLOSED",
//   };
// }

// /* =========================================================
//    PERSIST ALL 2553 MARKET STOCK CLOSES
// ========================================================= */

// async function persistAllMarketStocksClosingPrices(reason = "market-close") {
//   if (!env.mysqlEnabled) {
//     return {
//       total: 0,
//       saved: 0,
//     };
//   }

//   const tradingDate = indiaDate();

//   /*
//    * Prevent duplicate close jobs.
//    */
//   if (closingJobRunning) {
//     logger.warn("Closing reconciliation already running", {
//       tradingDate,
//     });

//     return {
//       total: 0,
//       saved: 0,
//       skipped: true,
//     };
//   }

//   closingJobRunning = true;

//   try {
//     const rows = await getMarketStockInstruments();

//     if (!rows.length) {
//       logger.warn("No market stocks available for closing reconciliation");

//       return {
//         total: 0,
//         saved: 0,
//       };
//     }

//     const rowByKey = new Map();

//     for (const row of rows) {
//       rowByKey.set(row.instrument_key, row);
//     }

//     const keys = rows.map((row) => row.instrument_key).filter(Boolean);

//     /*
//      * Keep batches conservative.
//      *
//      * This is intentionally NOT executed every tick.
//      *
//      * It runs only at market close/startup reconciliation.
//      */
//     const batchSize = Number(env.closeQuoteBatchSize) || 100;

//     let saved = 0;

//     let failed = 0;

//     for (let start = 0; start < keys.length; start += batchSize) {
//       const batch = keys.slice(start, start + batchSize);

//       try {
//         const quotes = await upstox.fetchQuotes(batch);

//         for (const key of batch) {
//           const quote = quotes?.[key];

//           if (!quote) {
//             failed += 1;
//             continue;
//           }

//           const row = rowByKey.get(key);

//           const snapshot = normalizeQuote(key, quote, row);

//           if (snapshot.dayClose == null) {
//             failed += 1;
//             continue;
//           }

//           /*
//            * THIS is where MySQL is written.
//            *
//            * Not during live ticks.
//            */
//           await saveDailyClose(snapshot, tradingDate);

//           /*
//            * Update in-memory snapshot too.
//            */
//           await cacheSnapshot(snapshot);

//           saved += 1;
//         }
//       } catch (error) {
//         failed += batch.length;

//         logger.error("Closing quote batch failed", {
//           reason,

//           tradingDate,

//           batchStart: start,

//           batchSize: batch.length,

//           error: error.response?.data || error.message,
//         });
//       }

//       /*
//        * Tiny delay between batches to avoid unnecessarily
//        * hammering REST.
//        */
//       if (start + batchSize < keys.length) {
//         await new Promise((resolve) =>
//           setTimeout(resolve, Number(env.closeBatchDelayMs) || 150),
//         );
//       }
//     }

//     lastClosingDate = tradingDate;

//     logger.info("Market-stock closing reconciliation complete", {
//       reason,

//       tradingDate,

//       total: keys.length,

//       saved,

//       failed,
//     });

//     return {
//       total: keys.length,

//       saved,

//       failed,

//       tradingDate,
//     };
//   } finally {
//     closingJobRunning = false;
//   }
// }

// /* =========================================================
//    STARTUP RECONCILIATION
// ========================================================= */

// async function reconcileAfterHoursOnStartup() {
//   if (!env.mysqlEnabled) {
//     return;
//   }

//   if (isMarketOpen()) {
//     return;
//   }

//   if (!isTradingDay()) {
//     logger.info("Startup outside trading day; no closing reconciliation", {
//       date: indiaDate(),
//     });

//     return;
//   }

//   const tradingDate = indiaDate();

//   const expected = await getMarketStockCount();

//   const savedToday = await getDailyCloseCount(tradingDate);

//   logger.info("Startup close reconciliation check", {
//     date: tradingDate,

//     totalStocks: expected,

//     savedToday,
//   });

//   /*
//    * Already complete.
//    */
//   if (expected > 0 && savedToday >= expected) {
//     logger.info("Startup close reconciliation not required", {
//       date: tradingDate,

//       totalStocks: expected,

//       savedToday,
//     });

//     return;
//   }

//   logger.info("Startup close reconciliation required", {
//     date: tradingDate,

//     totalStocks: expected,

//     savedToday,
//   });

//   await persistAllMarketStocksClosingPrices("startup-after-market-hours");
// }

// /* =========================================================
//    MARKET CLOSE JOB
// ========================================================= */

// async function runMarketCloseJob() {
//   if (!env.mysqlEnabled) {
//     return;
//   }

//   if (closingJobRunning) {
//     return;
//   }

//   /*
//    * Only run on an actual trading day.
//    */
//   if (!isTradingDay()) {
//     return;
//   }

//   logger.info("Market close lifecycle started", {
//     tradingDate: indiaDate(),
//   });

//   /*
//    * Stop live provider subscriptions FIRST.
//    *
//    * Browser clients remain connected.
//    */
//   await stopLiveMarketFeed();

//   /*
//    * Fetch final values and persist them.
//    */
//   await persistAllMarketStocksClosingPrices("scheduled-market-close");

//   /*
//    * Tell every active stock room that market
//    * has transitioned to CLOSED.
//    */
//   for (const [instrumentKey] of subscribers.entries()) {
//     const snapshot = await getSnapshot(instrumentKey);

//     if (!snapshot) {
//       continue;
//     }

//     const closedSnapshot = {
//       ...snapshot,

//       marketOpen: false,

//       marketStatus: "CLOSED",

//       source: snapshot.source || "database",
//     };

//     await cacheSnapshot(closedSnapshot);

//     io.to(stockRoom(instrumentKey)).emit(
//       "detailStock:snapshot",
//       closedSnapshot,
//     );
//   }

//   logger.info("Market close lifecycle completed", {
//     tradingDate: indiaDate(),
//   });
// }

// /* =========================================================
//    MARKET STATE MONITOR
// ========================================================= */

// async function monitorMarketState() {
//   const currentOpen = isMarketOpen();

//   /*
//    * CLOSED -> OPEN
//    */
//   if (currentOpen && !previousMarketOpen) {
//     previousMarketOpen = true;

//     logger.info("Market opened; DetailStock live mode enabled", {
//       date: indiaDate(),
//     });

//     /*
//      * Existing browser subscriptions should be
//      * restored to Upstox.
//      */
//     for (const [instrumentKey, set] of subscribers.entries()) {
//       if (!set.size) {
//         continue;
//       }

//       try {
//         await withSubscriptionLock(instrumentKey, async () => {
//           if (!isMarketOpen()) {
//             return;
//           }

//           if (!upstox.getSubscribed().includes(instrumentKey)) {
//             await upstox.subscribe(instrumentKey);
//           }
//         });
//       } catch (error) {
//         logger.warn("Failed to restore live subscription", {
//           instrumentKey,

//           error: error.message,
//         });
//       }
//     }

//     /*
//      * Tell clients that live mode is active.
//      */
//     for (const [instrumentKey] of subscribers.entries()) {
//       io.to(stockRoom(instrumentKey)).emit("detailStock:market-status", {
//         instrumentKey,

//         marketOpen: true,

//         marketStatus: "OPEN",
//       });
//     }

//     return;
//   }

//   /*
//    * OPEN -> CLOSED
//    */
//   if (!currentOpen && previousMarketOpen) {
//     previousMarketOpen = false;

//     await runMarketCloseJob();

//     return;
//   }

//   previousMarketOpen = currentOpen;
// }

// /* =========================================================
//    HEALTH
// ========================================================= */

// app.get("/health", async (req, res) => {
//   let redisReady = false;

//   try {
//     redisReady = Boolean(redis?.isReady);
//   } catch { }

//   res.json({
//     success: true,

//     service: "detailStock",

//     market: marketStatus(),

//     redis: redisReady,

//     upstox: {
//       connected: upstox.isConnected(),

//       connecting: upstox.isConnecting(),

//       subscribed: upstox.getSubscribed().length,
//     },

//     browserSubscriptions: subscribers.size,

//     snapshots: snapshots.size,

//     lastClosingDate: lastClosingDate,

//     time: new Date().toISOString(),
//   });
// });

// /* =========================================================
//    SNAPSHOT API
// ========================================================= */

// app.get("/api/detail-stock/snapshot/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;

//   if (!validKey(key)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid instrumentKey",
//     });
//   }

//   try {
//     const snapshot = await primeSnapshot(key);

//     return res.json({
//       success: true,

//       marketOpen: isMarketOpen(),

//       data: {
//         ...snapshot,

//         marketOpen: isMarketOpen(),

//         marketStatus: isMarketOpen() ? "OPEN" : "CLOSED",
//       },
//     });
//   } catch (error) {
//     logger.error("Snapshot request failed", {
//       instrumentKey: key,

//       error: error.message,
//     });

//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// /* =========================================================
//    HISTORY API
// ========================================================= */

// app.get("/api/detail-stock/history/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;

//   if (!validKey(key)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid instrumentKey",
//     });
//   }

//   const allowedUnits = ["minutes", "hours", "days", "weeks", "months"];

//   const unit = allowedUnits.includes(req.query.unit) ? req.query.unit : "days";

//   const interval = String(req.query.interval || "1");

//   const to = String(req.query.to || indiaDate());

//   const from = req.query.from ? String(req.query.from) : undefined;

//   const cacheKey = historyKey(key, unit, interval, from, to);

//   try {
//     if (redis && redis.isReady) {
//       const cached = await redis.get(cacheKey);

//       if (cached) {
//         return res.json({
//           success: true,

//           source: "cache",

//           data: JSON.parse(cached),
//         });
//       }
//     }

//     let data = await upstox.fetchHistory(key, unit, interval, to, from);

//     /*
//      * Daily history can fall back to DB.
//      */
//     if ((!data || !data.length) && unit === "days") {
//       data = await getDbHistory(key, from || "2000-01-01", to);
//     }

//     if (redis && redis.isReady) {
//       await redis.set(cacheKey, JSON.stringify(data), {
//         EX: Number(env.historyCacheSeconds) || 3600,
//       });
//     }

//     return res.json({
//       success: true,

//       source: "upstox",

//       data,
//     });
//   } catch (error) {
//     try {
//       const dbData = await getDbHistory(key, from || "2000-01-01", to);

//       if (dbData.length) {
//         return res.json({
//           success: true,

//           source: "database",

//           data: dbData,
//         });
//       }
//     } catch { }

//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// /* =========================================================
//    FUNDAMENTALS
// ========================================================= */

// app.get("/api/detail-stock/fundamentals/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);

//     return res.json({
//       success: true,

//       isin,

//       ...data,
//     });
//   } catch (error) {
//     logger.error("Fundamentals request failed", {
//       isin,

//       error: error.response?.data || error.message,
//     });

//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/shareholding/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);

//     return res.json({
//       success: true,

//       isin,

//       shareholding: data.shareholding || [],

//       mutualFunds: data.mutualFunds || [],

//       updatedAt: data.updatedAt,
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/about/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     return res.json({
//       success: true,

//       isin,

//       profile: await upstox.getProfile(isin),
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/ratios/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);

//     return res.json({
//       success: true,

//       isin,

//       ratios: data.ratios || [],

//       updatedAt: data.updatedAt,
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/corporate-actions/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     return res.json({
//       success: true,

//       isin,

//       data: await upstox.getCorporateActions(isin),

//       updatedAt: Date.now(),
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/competitors/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const list = await upstox.getCompetitors(isin);

//     /*
//      * Don't fire hundreds of concurrent
//      * quote calls.
//      *
//      * Limit concurrency.
//      */
//     const enriched = [];

//     for (const competitor of list || []) {
//       try {
//         if (competitor.instrument_key) {
//           const quote = await upstox.fetchOhlc(competitor.instrument_key);

//           enriched.push({
//             ...competitor,
//             quote,
//           });
//         } else {
//           enriched.push(competitor);
//         }
//       } catch {
//         enriched.push(competitor);
//       }
//     }

//     return res.json({
//       success: true,

//       isin,

//       data: enriched,

//       updatedAt: Date.now(),
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// app.get("/api/detail-stock/financial-performance/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) {
//     return res.status(400).json({
//       success: false,

//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const data = await upstox.getBalanceSheet(
//       isin,
//       String(req.query.type || "consolidated"),
//     );

//     return res.json({
//       success: true,

//       isin,

//       data,

//       updatedAt: Date.now(),
//     });
//   } catch (error) {
//     return res.status(502).json({
//       success: false,

//       message: error.response?.data || error.message,
//     });
//   }
// });

// /* =========================================================
//    MARKET STOCK COUNT
// ========================================================= */

// app.get("/api/detail-stock/market-stocks-count", async (req, res) => {
//   try {
//     return res.json({
//       success: true,

//       count: await getMarketStockCount(),
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,

//       message: error.message,
//     });
//   }
// });

// /* =========================================================
//    STOCK STATUS
// ========================================================= */

// app.get("/api/detail-stock/status/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;

//   return res.json({
//     success: true,

//     instrumentKey: key,

//     marketOpen: isMarketOpen(),

//     subscriberCount: subscribers.get(key)?.size || 0,

//     subscribed: upstox.getSubscribed().includes(key),

//     snapshot: await getSnapshot(key),
//   });
// });

// /* =========================================================
//    MARKET CLOSE CRON
// ========================================================= */

// /*
//  * Run shortly after 15:30.
//  *
//  * We don't write every tick.
//  * We write closing values ONCE.
//  */
// cron.schedule(
//   "31 15 * * 1-5",
//   async () => {
//     try {
//       /*
//        * Don't blindly run if market calendar says
//        * today is a holiday.
//        */
//       if (!isTradingDay()) {
//         return;
//       }

//       await runMarketCloseJob();
//     } catch (error) {
//       logger.error("Scheduled market close failed", {
//         error: error.stack || error.message,
//       });
//     }
//   },
//   {
//     timezone: env.timezone || "Asia/Kolkata",
//   },
// );

// /* =========================================================
//    MARKET STATE MONITOR
// ========================================================= */

// /*
//  * This handles:
//  *
//  * 09:15 startup
//  * 09:15 transition
//  * 15:30 transition
//  *
//  * It also makes development testing much easier.
//  */
// setInterval(() => {
//   monitorMarketState().catch((error) => {
//     logger.error("Market state monitor failed", {
//       error: error.message,
//     });
//   });
// }, 5000);

// /* =========================================================
//    STARTUP
// ========================================================= */

// async function start() {
//   try {
//     logger.info("Starting DetailStock backend");

//     await connectRedis();

//     await initDb();

//     previousMarketOpen = isMarketOpen();

//     /*
//      * If the server starts after market hours:
//      *
//      * 1. Do NOT connect Upstox WS.
//      * 2. Check whether today's close exists.
//      * 3. If not, fetch close values.
//      */
//     if (!previousMarketOpen) {
//       await reconcileAfterHoursOnStartup();
//     } else {
//       logger.info("Server started during market hours");
//     }

//     server.listen(env.port, () => {
//       logger.info("DetailStock server started", {
//         port: env.port,

//         marketOpen: previousMarketOpen,

//         origins: env.origins,
//       });
//     });
//   } catch (error) {
//     logger.error("DetailStock startup failed", {
//       error: error.stack || error.message,
//     });

//     process.exit(1);
//   }
// }

// /* =========================================================
//    GRACEFUL SHUTDOWN
// ========================================================= */

// async function shutdown(signal) {
//   logger.info("DetailStock shutting down", {
//     signal,
//   });

//   try {
//     await upstox.shutdown();
//   } catch { }

//   try {
//     await closeDb();
//   } catch { }

//   try {
//     if (redis && redis.isReady) {
//       await redis.quit();
//     }
//   } catch { }

//   server.close(() => {
//     process.exit(0);
//   });

//   setTimeout(() => {
//     process.exit(0);
//   }, 5000).unref();
// }

// process.on("SIGTERM", () => shutdown("SIGTERM"));

// process.on("SIGINT", () => shutdown("SIGINT"));

// process.on("uncaughtException", (error) => {
//   logger.error("Uncaught exception", {
//     error: error.stack || error.message,
//   });
// });

// process.on("unhandledRejection", (error) => {
//   logger.error("Unhandled rejection", {
//     error: error?.stack || error?.message || String(error),
//   });
// });

// start();





























const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
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
  getMarketStockByInstrumentKey,
  getInstrumentMaster,
  getBseInstrumentByIsin,
} = require("./db");

const {
  isMarketOpen,
  isTradingDay,
  indiaDate,
  marketStatus,
} = require("./market");

const upstox = require("./upstox");

const app = express();
const server = http.createServer(app);

/* =========================================================
   BASIC SERVER CONFIG
========================================================= */

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.origins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "64kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

/* =========================================================
   IN-MEMORY STATE
========================================================= */

const subscribers = new Map();
// instrumentKey -> Set(socket.id)

const snapshots = new Map();
// instrumentKey -> latest snapshot

const SNAP_PREFIX = "detailstock:snapshot:";
const HISTORY_PREFIX = "detailstock:history:";

const fundamentalsByIsin = new Map();
const FUNDAMENTALS_TTL = 15 * 60 * 1000;

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function validKey(key) {
  return (
    typeof key === "string" &&
    key.length >= 5 &&
    key.length <= 180
  );
}

function validIsin(isin) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
}

function snapshotKey(key) {
  return `${SNAP_PREFIX}${key}`;
}

function historyKey(key, unit, interval, from, to) {
  return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ""}:${to}`;
}

function isinFromInstrumentKey(key) {
  const candidate =
    String(key || "").split("|")[1] || "";

  return validIsin(candidate) ? candidate : null;
}

function errorMessage(err) {
  return (
    err?.response?.data?.errors?.[0]?.message ||
    err?.response?.data?.message ||
    err?.response?.data ||
    err?.message ||
    "Unexpected error"
  );
}

/* =========================================================
   CRON HELPERS
========================================================= */

/*
  Your .env uses:

  CLOSE_JOB_TIME=15:35
  CLOSE_RETRY_TIME=15:45

  node-cron needs:

  35 15 * * 1-5
  45 15 * * 1-5

  This helper converts HH:MM into a weekday cron expression.
*/

function timeToWeekdayCron(value, fallback) {
  const raw = String(value || fallback || "").trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    throw new Error(
      `Invalid cron time "${raw}". Expected HH:MM, for example 15:35`
    );
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(
      `Invalid cron time "${raw}". Expected HH:MM between 00:00 and 23:59`
    );
  }

  return `${minute} ${hour} * * 1-5`;
}

function getCronTimeFromEnv(key, fallback) {
  /*
    Prefer the values directly from process.env because those are
    exactly the values provided in your .env file.
  */

  const value = process.env[key];

  if (value) {
    return value;
  }

  /*
    Also support env.js exposing camelCase values.
  */

  if (key === "CLOSE_JOB_TIME" && env.closeJobTime) {
    return env.closeJobTime;
  }

  if (key === "CLOSE_RETRY_TIME" && env.closeRetryTime) {
    return env.closeRetryTime;
  }

  return fallback;
}

const closeJobTime = getCronTimeFromEnv(
  "CLOSE_JOB_TIME",
  "15:35"
);

const closeRetryTime = getCronTimeFromEnv(
  "CLOSE_RETRY_TIME",
  "15:45"
);

const closeCron = timeToWeekdayCron(
  closeJobTime,
  "15:35"
);

const closeRetryCron = timeToWeekdayCron(
  closeRetryTime,
  "15:45"
);

logger.info("Cron configuration loaded", {
  closeJobTime,
  closeRetryTime,
  closeCron,
  closeRetryCron,
  timezone: env.timezone,
});

/* =========================================================
   SNAPSHOT CACHE
========================================================= */

async function cacheSnapshot(snapshot) {
  if (!snapshot?.instrumentKey) {
    return;
  }

  snapshots.set(
    snapshot.instrumentKey,
    snapshot
  );

  if (env.redisEnabled) {
    await redis.set(
      snapshotKey(snapshot.instrumentKey),
      JSON.stringify(snapshot),
      {
        EX: env.snapshotCacheSeconds,
      }
    );
  }
}

async function getSnapshot(key) {
  if (snapshots.has(key)) {
    return snapshots.get(key);
  }

  if (!env.redisEnabled) {
    return null;
  }

  const raw = await redis.get(
    snapshotKey(key)
  );

  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw);

    snapshots.set(key, value);

    return value;
  } catch {
    return null;
  }
}

/* =========================================================
   PREVIOUS CLOSE FALLBACK
========================================================= */

async function enrichWithStoredPreviousClose(snapshot) {
  /*
    Never overwrite an authoritative Upstox previousClose.
    MySQL is only a fallback.
  */

  if (
    !snapshot ||
    Number(snapshot.previousClose) > 0
  ) {
    return snapshot;
  }

  if (!env.mysqlEnabled) {
    return snapshot;
  }

  try {
    const previous = await getPreviousStoredClose(
      snapshot.instrumentKey,
      indiaDate()
    );

    if (previous?.close != null) {
      const close = Number(previous.close);
      const price = Number(snapshot.price);

      if (
        Number.isFinite(close) &&
        close > 0
      ) {
        snapshot.previousClose = close;

        if (Number.isFinite(price)) {
          snapshot.change = price - close;

          snapshot.changePercent =
            ((price - close) / close) * 100;
        }

        snapshot.previousCloseDate =
          previous.trading_date;

        snapshot.previousCloseSource =
          "database-fallback";
      }
    }
  } catch (err) {
    logger.warn(
      "Previous close fallback lookup failed",
      {
        instrumentKey: snapshot.instrumentKey,
        error: err.message,
      }
    );
  }

  return snapshot;
}

/* =========================================================
   INSTRUMENT CONTEXT
========================================================= */

async function getInstrumentContext(instrumentKey) {
  if (!env.mysqlEnabled) {
    return null;
  }

  const marketRow =
    await getMarketStockByInstrumentKey(
      instrumentKey
    );

  const master =
    await getInstrumentMaster(
      instrumentKey
    );

  if (!marketRow && !master) {
    return null;
  }

  const isin =
    master?.isin ||
    isinFromInstrumentKey(instrumentKey);

  let bse = null;

  if (isin) {
    bse =
      await getBseInstrumentByIsin(isin);
  }

  return {
    marketRow,
    master,
    bse,
    isin,
    symbol:
      master?.trading_symbol ||
      marketRow?.symbol ||
      null,
    name:
      master?.name ||
      marketRow?.name ||
      null,
    exchange:
      master?.exchange ||
      "NSE",
    segment:
      master?.segment ||
      null,
  };
}

/* =========================================================
   PRIME SNAPSHOT
========================================================= */

async function primeSnapshot(instrumentKey) {
  const context =
    await getInstrumentContext(
      instrumentKey
    );

  const today = indiaDate();
  const marketOpen = isMarketOpen();

  const existing =
    await getSnapshot(instrumentKey);

  /*
    Never reuse yesterday's snapshot.

    After market close, only the explicitly reconciled
    closing snapshot is considered authoritative.
  */

  const existingIsFresh =
    existing?.marketDate === today &&
    (
      marketOpen
        ? existing?.marketStatus !== "CLOSED"
        : existing?.marketStatus === "CLOSED" &&
          existing?.source ===
            "upstox-close-reconciliation"
    );

  if (
    existing &&
    existingIsFresh
  ) {
    return existing;
  }

  const snapshot =
    await upstox.fetchOhlc(
      instrumentKey
    );

  if (context) {
    snapshot.symbol =
      context.symbol;

    snapshot.name =
      context.name;

    snapshot.exchange =
      context.exchange;

    snapshot.segment =
      context.segment;

    snapshot.isin =
      context.isin;

    snapshot.sector =
      context.marketRow?.sector ||
      null;
  }

  snapshot.marketDate = today;
  snapshot.marketOpen = marketOpen;

  snapshot.marketStatus =
    marketOpen
      ? "OPEN"
      : "CLOSED";

  await enrichWithStoredPreviousClose(
    snapshot
  );

  await cacheSnapshot(snapshot);

  return snapshot;
}

/* =========================================================
   FUNDAMENTALS CACHE
========================================================= */

async function getFundamentalsCached(isin) {
  const cached =
    fundamentalsByIsin.get(isin);

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.data;
  }

  const data =
    await upstox.getFundamentals(isin);

  fundamentalsByIsin.set(isin, {
    data,
    expiresAt:
      Date.now() +
      FUNDAMENTALS_TTL,
  });

  return data;
}

/* =========================================================
   MARKET DATE HELPERS
========================================================= */

function isAfterMarketClose(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: env.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }
    ).formatToParts(date);

  const hour = Number(
    parts.find(
      (x) => x.type === "hour"
    )?.value || 0
  );

  const minute = Number(
    parts.find(
      (x) => x.type === "minute"
    )?.value || 0
  );

  const [
    closeHour,
    closeMinute,
  ] = String(env.marketClose)
    .split(":")
    .map(Number);

  return (
    hour * 60 + minute >=
    closeHour * 60 + closeMinute
  );
}

function previousTradingDate(
  date = new Date()
) {
  const d = new Date(date);

  d.setDate(
    d.getDate() - 1
  );

  while (!isTradingDay(d)) {
    d.setDate(
      d.getDate() - 1
    );
  }

  return indiaDate(d);
}

function latestCompletedTradingDate(
  date = new Date()
) {
  if (
    isTradingDay(date) &&
    isAfterMarketClose(date)
  ) {
    return indiaDate(date);
  }

  return previousTradingDate(date);
}

/* =========================================================
   CLOSING SNAPSHOT NORMALIZATION
========================================================= */

function normalizeClosingSnapshot(
  key,
  q,
  row
) {
  const ohlc =
    q?.ohlc || {};

  const price =
    Number(q?.last_price);

  if (!Number.isFinite(price)) {
    return null;
  }

  /*
    Upstox Full Market Quote exposes net_change
    as the absolute move from yesterday's close.

    Therefore:

      previousClose =
        lastPrice - netChange

    Do NOT use q.ohlc.close as previous close.
  */

  const netChange =
    Number(q?.net_change);

  let previousClose =
    Number.NaN;

  if (
    Number.isFinite(netChange)
  ) {
    previousClose =
      price - netChange;
  } else if (
    Number.isFinite(
      Number(q?.cp)
    )
  ) {
    previousClose =
      Number(q.cp);
  } else if (
    Number.isFinite(
      Number(q?.prev_close)
    )
  ) {
    previousClose =
      Number(q.prev_close);
  } else if (
    Number.isFinite(
      Number(q?.previous_close)
    )
  ) {
    previousClose =
      Number(q.previous_close);
  }

  /*
    Last-resort compatibility fallback.
  */

  if (
    !Number.isFinite(previousClose) ||
    previousClose <= 0
  ) {
    const fallback =
      Number(ohlc.close);

    if (
      Number.isFinite(fallback) &&
      fallback > 0
    ) {
      previousClose =
        fallback;
    }
  }

  const change =
    Number.isFinite(previousClose)
      ? price - previousClose
      : null;

  return {
    instrumentKey: key,

    symbol:
      row?.symbol ||
      q?.symbol ||
      null,

    tradingSymbol:
      row?.symbol ||
      q?.symbol ||
      null,

    name:
      row?.name ||
      null,

    companyName:
      row?.name ||
      null,

    exchange:
      env.marketStockExchange,

    segment:
      env.marketStockSegment,

    sector:
      row?.sector ||
      null,

    ltp: price,

    price,

    dayClose: price,

    previousClose:
      Number.isFinite(previousClose)
        ? previousClose
        : null,

    change,

    changePercent:
      Number.isFinite(previousClose) &&
      previousClose
        ? (change / previousClose) * 100
        : null,

    open:
      Number.isFinite(
        Number(ohlc.open)
      )
        ? Number(ohlc.open)
        : null,

    high:
      Number.isFinite(
        Number(ohlc.high)
      )
        ? Number(ohlc.high)
        : null,

    low:
      Number.isFinite(
        Number(ohlc.low)
      )
        ? Number(ohlc.low)
        : null,

    volume:
      Number.isFinite(
        Number(q?.volume)
      )
        ? Number(q.volume)
        : null,

    upperCircuit:
      Number.isFinite(
        Number(
          q?.upper_circuit_limit
        )
      )
        ? Number(
            q.upper_circuit_limit
          )
        : null,

    lowerCircuit:
      Number.isFinite(
        Number(
          q?.lower_circuit_limit
        )
      )
        ? Number(
            q.lower_circuit_limit
          )
        : null,

    lastTradeTime:
      Number.isFinite(
        Number(q?.last_trade_time)
      )
        ? Number(q.last_trade_time)
        : null,

    timestamp:
      Date.now(),

    marketDate:
      indiaDate(),

    marketOpen:
      false,

    marketStatus:
      "CLOSED",

    source:
      "upstox-close-reconciliation",
  };
}

/* =========================================================
   CLOSING RECONCILIATION
========================================================= */

let closingSyncPromise = null;

async function reconcileAllMarketStocks(
  reason,
  targetTradingDate =
    latestCompletedTradingDate()
) {
  if (!env.mysqlEnabled) {
    logger.warn(
      "Closing reconciliation skipped: MySQL disabled",
      { reason }
    );

    return {
      total: 0,
      saved: 0,
    };
  }

  if (closingSyncPromise) {
    return closingSyncPromise;
  }

  closingSyncPromise =
    (async () => {
      const tradingDate =
        targetTradingDate;

      const rows =
        await getMarketStockInstruments();

      if (!rows.length) {
        logger.warn(
          "No market stocks found for closing reconciliation"
        );

        return {
          total: 0,
          saved: 0,
        };
      }

      const rowByKey =
        new Map(
          rows.map((row) => [
            row.instrument_key,
            row,
          ])
        );

      const keys =
        rows
          .map(
            (row) =>
              row.instrument_key
          )
          .filter(Boolean);

      let saved = 0;

      /*
        Upstox Full Market Quote supports
        maximum 500 keys per request.
      */

      for (
        let i = 0;
        i < keys.length;
        i += 500
      ) {
        const chunk =
          keys.slice(
            i,
            i + 500
          );

        try {
          const quotes =
            await upstox.fetchQuotes(
              chunk
            );

          for (
            const key of chunk
          ) {
            const q =
              quotes[key] ||
              quotes[
                key.replace(
                  "|",
                  ":"
                )
              ] ||
              Object.values(
                quotes
              ).find(
                (x) =>
                  x?.instrument_token ===
                  key
              );

            if (!q) {
              continue;
            }

            const snapshot =
              normalizeClosingSnapshot(
                key,
                q,
                rowByKey.get(key)
              );

            if (!snapshot) {
              continue;
            }

            await saveDailyClose(
              snapshot,
              tradingDate
            );

            const finalSnapshot = {
              ...snapshot,
              marketOpen: false,
              marketStatus: "CLOSED",
              marketDate:
                tradingDate,
            };

            await cacheSnapshot(
              finalSnapshot
            );

            /*
              Push final closing snapshot
              to connected browser pages.
            */

            if (
              subscribers.has(key)
            ) {
              io
                .to(`stock:${key}`)
                .emit(
                  "detailStock:snapshot",
                  finalSnapshot
                );
            }

            saved++;
          }
        } catch (err) {
          logger.error(
            "Closing quote batch failed",
            {
              reason,
              batchStart: i,
              batchSize:
                chunk.length,
              error:
                errorMessage(err),
            }
          );
        }
      }

      logger.info(
        "Market-stock closing reconciliation complete",
        {
          reason,
          tradingDate,
          total: keys.length,
          saved,
        }
      );

      return {
        total: keys.length,
        saved,
      };
    })();

  try {
    return await closingSyncPromise;
  } finally {
    closingSyncPromise = null;
  }
}

/* =========================================================
   STARTUP RECONCILIATION
========================================================= */

async function reconcileOnStartup() {
  if (
    !env.startupReconcileClosed ||
    isMarketOpen()
  ) {
    return;
  }

  const rows =
    await getMarketStockInstruments();

  if (!rows.length) {
    return;
  }

  const date =
    latestCompletedTradingDate();

  const totalStocks =
    rows.length;

  const savedToday =
    await getDailyCloseCount(
      date
    );

  const markerKey =
    `detailstock:close-reconciled:v2:${date}`;

  let marker = null;

  if (env.redisEnabled) {
    try {
      marker =
        await redis.get(
          markerKey
        );
    } catch (err) {
      logger.warn(
        "Close reconciliation marker read failed",
        {
          error: err.message,
        }
      );
    }
  }

  const needsRepair =
    savedToday < totalStocks ||
    marker !== "ok";

  if (needsRepair) {
    logger.info(
      "Startup close reconciliation required",
      {
        date,
        totalStocks,
        savedToday,
        marker,
      }
    );

    const result =
      await reconcileAllMarketStocks(
        "startup-after-market-hours-v2",
        date
      );

    if (
      env.redisEnabled &&
      result.saved > 0
    ) {
      try {
        await redis.set(
          markerKey,
          "ok",
          {
            EX:
              3 * 24 * 60 * 60,
          }
        );
      } catch (err) {
        logger.warn(
          "Close reconciliation marker write failed",
          {
            error:
              err.message,
          }
        );
      }
    }
  } else {
    logger.info(
      "Startup close reconciliation already complete",
      {
        date,
        totalStocks,
        savedToday,
      }
    );
  }
}

/* =========================================================
   UPSTOX LIVE TICK HANDLER
========================================================= */

upstox.setTickHandler(
  (tick) => {
    const previous =
      snapshots.get(
        tick.instrumentKey
      ) || {};

    const snapshot = {
      ...previous,
      ...tick,

      instrumentKey:
        tick.instrumentKey,

      marketDate:
        indiaDate(),

      marketOpen:
        true,

      marketStatus:
        "OPEN",

      source:
        "upstox-websocket",
    };

    /*
      If partial feed omits a field,
      keep the previous known value.
    */

    for (
      const field of [
        "previousClose",
        "open",
        "high",
        "low",
        "volume",
        "upperCircuit",
        "lowerCircuit",
        "lastTradeTime",
      ]
    ) {
      if (
        snapshot[field] == null &&
        previous[field] != null
      ) {
        snapshot[field] =
          previous[field];
      }
    }

    if (
      snapshot.price != null &&
      snapshot.previousClose != null
    ) {
      snapshot.change =
        Number(snapshot.price) -
        Number(
          snapshot.previousClose
        );

      snapshot.changePercent =
        Number(
          snapshot.previousClose
        )
          ? (
              snapshot.change /
              Number(
                snapshot.previousClose
              )
            ) * 100
          : null;
    }

    snapshots.set(
      tick.instrumentKey,
      snapshot
    );

    if (env.redisEnabled) {
      redis
        .set(
          snapshotKey(
            tick.instrumentKey
          ),
          JSON.stringify(
            snapshot
          ),
          {
            EX:
              env.snapshotCacheSeconds,
          }
        )
        .catch((err) =>
          logger.warn(
            "Tick cache write failed",
            {
              error:
                err.message,
            }
          )
        );
    }

    io
      .to(
        `stock:${tick.instrumentKey}`
      )
      .emit(
        "detailStock:tick",
        snapshot
      );
  }
);

/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
  "connection",
  (socket) => {
    socket.on(
      "detailStock:subscribe",
      async (
        payload,
        ack = () => {}
      ) => {
        const key =
          payload?.instrumentKey;

        if (!validKey(key)) {
          return ack({
            success: false,
            message:
              "Valid instrumentKey is required",
          });
        }

        try {
          const context =
            await getInstrumentContext(
              key
            );

          /*
            Do not allow arbitrary instruments
            to consume Upstox subscription budget.
          */

          if (
            !context?.master &&
            env.mysqlEnabled
          ) {
            return ack({
              success: false,
              message:
                "Instrument is not in the stock universe",
            });
          }

          socket.join(
            `stock:${key}`
          );

          if (
            !subscribers.has(key)
          ) {
            subscribers.set(
              key,
              new Set()
            );
          }

          const set =
            subscribers.get(key);

          const first =
            set.size === 0;

          set.add(
            socket.id
          );

          if (first) {
            await upstox.subscribe(
              key
            );
          }

          let snapshot =
            await primeSnapshot(
              key
            );

          if (context) {
            snapshot = {
              ...snapshot,

              instrumentKey:
                key,

              symbol:
                context.symbol,

              name:
                context.name,

              exchange:
                context.exchange,

              segment:
                context.segment,

              isin:
                context.isin,

              sector:
                context.marketRow
                  ?.sector ||
                null,

              bseInstrumentKey:
                context.bse
                  ?.instrument_key ||
                null,
            };
          }

          const isin =
            snapshot.isin ||
            context?.isin;

          if (isin) {
            try {
              const fundamentals =
                await getFundamentalsCached(
                  isin
                );

              snapshot = {
                ...snapshot,
                ...fundamentals,
                isin,
              };
            } catch (err) {
              logger.warn(
                "Fundamentals unavailable on subscribe",
                {
                  instrumentKey:
                    key,

                  isin,

                  error:
                    errorMessage(
                      err
                    ),
                }
              );
            }
          }

          await cacheSnapshot(
            snapshot
          );

          socket.emit(
            "detailStock:snapshot",
            {
              ...snapshot,
              marketOpen:
                isMarketOpen(),
            }
          );

          ack({
            success: true,
            subscribed: true,
            deduplicated:
              !first,
            subscriberCount:
              set.size,
            snapshot,
          });
        } catch (err) {
          logger.error(
            "Detail stock subscribe failed",
            {
              instrumentKey:
                key,

              socketId:
                socket.id,

              error:
                errorMessage(
                  err
                ),
            }
          );

          ack({
            success: false,
            message:
              errorMessage(err),
          });
        }
      }
    );

    socket.on(
      "detailStock:unsubscribe",
      async (
        payload,
        ack = () => {}
      ) => {
        const key =
          payload?.instrumentKey;

        if (!validKey(key)) {
          return ack({
            success: false,
          });
        }

        await release(
          key,
          socket.id
        );

        socket.leave(
          `stock:${key}`
        );

        ack({
          success: true,
        });
      }
    );

    socket.on(
      "disconnect",
      async () => {
        for (
          const [
            key,
            set,
          ] of subscribers.entries()
        ) {
          if (
            set.has(
              socket.id
            )
          ) {
            await release(
              key,
              socket.id
            );
          }
        }
      }
    );
  }
);

/* =========================================================
   RELEASE SUBSCRIPTION
========================================================= */

async function release(
  key,
  socketId
) {
  const set =
    subscribers.get(key);

  if (!set) {
    return;
  }

  set.delete(
    socketId
  );

  if (
    set.size === 0
  ) {
    subscribers.delete(
      key
    );

    /*
      Grace period is handled inside
      upstox.js if supported.
    */

    await upstox.unsubscribe(
      key,
      false
    );

    logger.info(
      "Stock room became empty",
      {
        instrumentKey:
          key,
      }
    );
  }
}

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  async (req, res) => {
    const status =
      marketStatus();

    res.json({
      success: true,

      service:
        "detail-stock",

      uptimeSeconds:
        Math.round(
          process.uptime()
        ),

      ...status,

      redis:
        env.redisEnabled
          ? redis.isReady
          : false,

      mysql:
        env.mysqlEnabled,

      upstoxConnected:
        upstox.isConnected(),

      upstoxSubscribed:
        upstox
          .getSubscribed()
          .length,

      activeRooms:
        subscribers.size,

      time:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   MARKET STOCKS
========================================================= */

app.get(
  "/api/detail-stock/market-stocks",
  async (req, res) => {
    if (!env.mysqlEnabled) {
      return res.status(503).json({
        success: false,
        message:
          "MySQL disabled",
      });
    }

    try {
      const rows =
        await getMarketStockInstruments();

      res.json({
        success: true,

        marketOpen:
          isMarketOpen(),

        count:
          rows.length,

        data:
          rows,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   INSTRUMENT
========================================================= */

app.get(
  "/api/detail-stock/instrument/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    if (!validKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid instrumentKey",
      });
    }

    try {
      const context =
        await getInstrumentContext(
          key
        );

      if (!context) {
        return res.status(404).json({
          success: false,
          message:
            "Instrument not found",
        });
      }

      res.json({
        success: true,
        data:
          context,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   SNAPSHOT
========================================================= */

app.get(
  "/api/detail-stock/snapshot/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    if (!validKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid instrumentKey",
      });
    }

    try {
      const snapshot =
        await primeSnapshot(
          key
        );

      res.json({
        success: true,

        marketOpen:
          isMarketOpen(),

        data:
          snapshot,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/detail-stock/history/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    if (!validKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid instrumentKey",
      });
    }

    const allowedUnits =
      new Set([
        "minutes",
        "hours",
        "days",
        "weeks",
        "months",
      ]);

    const unit =
      allowedUnits.has(
        req.query.unit
      )
        ? req.query.unit
        : "days";

    const interval =
      String(
        req.query.interval ||
          "1"
      );

    const to =
      String(
        req.query.to ||
          indiaDate()
      );

    const from =
      req.query.from
        ? String(
            req.query.from
          )
        : "";

    const cacheKey =
      historyKey(
        key,
        unit,
        interval,
        from,
        to
      );

    try {
      if (env.redisEnabled) {
        const cached =
          await redis.get(
            cacheKey
          );

        if (cached) {
          return res.json({
            success: true,
            source:
              "cache",

            marketOpen:
              isMarketOpen(),

            data:
              JSON.parse(
                cached
              ),
          });
        }
      }

      const data =
        await upstox.fetchHistory(
          key,
          unit,
          interval,
          to,
          from ||
            undefined
        );

      if (env.redisEnabled) {
        await redis.set(
          cacheKey,
          JSON.stringify(
            data
          ),
          {
            EX:
              env.historyCacheSeconds,
          }
        );
      }

      res.json({
        success: true,

        source:
          "upstox",

        marketOpen:
          isMarketOpen(),

        data:
          data,
      });
    } catch (err) {
      /*
        Database fallback for longer ranges.
      */

      if (
        env.mysqlEnabled &&
        [
          "days",
          "weeks",
          "months",
        ].includes(unit)
      ) {
        try {
          const dbData =
            await getDbHistory(
              key,
              from ||
                "2000-01-01",
              to
            );

          if (
            dbData.length
          ) {
            return res.json({
              success: true,

              source:
                "database",

              marketOpen:
                isMarketOpen(),

              data:
                dbData,
            });
          }
        } catch {}
      }

      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   FUNDAMENTALS
========================================================= */

app.get(
  "/api/detail-stock/fundamentals/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      const data =
        await getFundamentalsCached(
          isin
        );

      res.json({
        success: true,
        isin,
        ...data,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

app.get(
  "/api/detail-stock/shareholding/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      const data =
        await getFundamentalsCached(
          isin
        );

      res.json({
        success: true,

        isin,

        shareholding:
          data.shareholding ||
          [],

        mutualFunds:
          data.mutualFunds ||
          [],

        updatedAt:
          data.updatedAt,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

app.get(
  "/api/detail-stock/about/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      res.json({
        success: true,
        isin,

        profile:
          await upstox.getProfile(
            isin
          ),
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

app.get(
  "/api/detail-stock/ratios/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      const data =
        await getFundamentalsCached(
          isin
        );

      res.json({
        success: true,

        isin,

        ratios:
          data.ratios ||
          [],

        updatedAt:
          data.updatedAt,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   CORPORATE ACTIONS
========================================================= */

app.get(
  "/api/detail-stock/corporate-actions/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      res.json({
        success: true,

        isin,

        data:
          await upstox.getCorporateActions(
            isin
          ),

        updatedAt:
          Date.now(),
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   COMPETITORS
========================================================= */

app.get(
  "/api/detail-stock/competitors/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      res.json({
        success: true,

        isin,

        data:
          await upstox.getCompetitors(
            isin
          ),

        updatedAt:
          Date.now(),
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   FINANCIAL PERFORMANCE
========================================================= */

app.get(
  "/api/detail-stock/financial-performance/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid ISIN",
      });
    }

    try {
      const data =
        await upstox.getFundamentals(
          isin
        );

      res.json({
        success: true,

        isin,

        incomeStatement:
          data.incomeStatement ||
          null,

        balanceSheet:
          data.balanceSheet ||
          null,

        cashFlow:
          data.cashFlow ||
          null,

        updatedAt:
          data.updatedAt,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   FUNDS
========================================================= */

app.get(
  "/api/detail-stock/funds",
  async (req, res) => {
    try {
      const data =
        await upstox.getFunds();

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   ORDER
========================================================= */

app.post(
  "/api/detail-stock/order",
  async (req, res) => {
    const body =
      req.body || {};

    if (
      !validKey(
        body.instrumentKey
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid instrumentKey is required",
      });
    }

    const quantity =
      Number(
        body.quantity
      );

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quantity must be a positive integer",
      });
    }

    if (
      ![
        "BUY",
        "SELL",
      ].includes(
        body.transactionType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "transactionType must be BUY or SELL",
      });
    }

    const orderType =
      body.orderType ||
      "LIMIT";

    if (
      ![
        "MARKET",
        "LIMIT",
        "SL",
        "SL-M",
      ].includes(
        orderType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid orderType",
      });
    }

    try {
      const context =
        await getInstrumentContext(
          body.instrumentKey
        );

      if (!context?.master) {
        return res.status(404).json({
          success: false,
          message:
            "Instrument not found in instrument master",
        });
      }

      const result =
        await upstox.placeOrder({
          ...body,

          orderType,

          quantity,

          instrumentKey:
            context.master
              .instrument_key,

          product:
            body.product ||
            "D",

          price:
            orderType === "MARKET"
              ? 0
              : Number(
                  body.price ||
                    0
                ),
        });

      res.json({
        success: true,
        data:
          result,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   MARKET STOCK COUNT
========================================================= */

app.get(
  "/api/detail-stock/market-stocks-count",
  async (req, res) => {
    try {
      res.json({
        success: true,

        count:
          env.mysqlEnabled
            ? await getMarketStockCount()
            : 0,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  }
);

/* =========================================================
   STOCK STATUS
========================================================= */

app.get(
  "/api/detail-stock/status/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    res.json({
      success: true,

      instrumentKey:
        key,

      marketOpen:
        isMarketOpen(),

      subscriberCount:
        subscribers.get(key)
          ?.size || 0,

      subscribed:
        upstox
          .getSubscribed()
          .includes(key),

      snapshot:
        await getSnapshot(key),
    });
  }
);

/* =========================================================
   CLOSE PERSISTENCE
========================================================= */

async function persistClosingPrices(
  reason = "scheduled-close"
) {
  if (!isTradingDay()) {
    logger.info(
      "Close persistence skipped on non-trading day",
      {
        date:
          indiaDate(),

        reason,
      }
    );

    return;
  }

  if (!isMarketOpen()) {
    const result =
      await reconcileAllMarketStocks(
        reason,
        indiaDate()
      );

    if (
      env.redisEnabled &&
      result.saved > 0
    ) {
      try {
        await redis.set(
          `detailstock:close-reconciled:v2:${indiaDate()}`,
          "ok",
          {
            EX:
              3 * 24 * 60 * 60,
          }
        );
      } catch (err) {
        logger.warn(
          "Close reconciliation marker write failed",
          {
            error:
              err.message,
          }
        );
      }
    }
  } else {
    logger.warn(
      "Closing persistence job ran while market was open",
      {
        reason,
      }
    );
  }
}

/* =========================================================
   CRON JOBS
========================================================= */

/*
  IMPORTANT:

  We do NOT use env.closeCron directly.

  Your .env contains:

    CLOSE_JOB_TIME=15:35
    CLOSE_RETRY_TIME=15:45

  They are converted above into:

    35 15 * * 1-5
    45 15 * * 1-5

  This fixes:

    Error: pattern must be a string
*/

cron.schedule(
  closeCron,
  () => {
    persistClosingPrices(
      "scheduled-close"
    ).catch((err) => {
      logger.error(
        "Scheduled close persistence failed",
        {
          error:
            errorMessage(err),
        }
      );
    });
  },
  {
    timezone:
      env.timezone,
  }
);

cron.schedule(
  closeRetryCron,
  () => {
    persistClosingPrices(
      "scheduled-close-retry"
    ).catch((err) => {
      logger.error(
        "Scheduled close retry failed",
        {
          error:
            errorMessage(err),
        }
      );
    });
  },
  {
    timezone:
      env.timezone,
  }
);

logger.info(
  "Closing cron jobs registered",
  {
    closeJobTime,
    closeRetryTime,
    closeCron,
    closeRetryCron,
    timezone:
      env.timezone,
  }
);

/* =========================================================
   STARTUP
========================================================= */

async function startup() {
  await connectRedis();

  await initDb();

  await reconcileOnStartup();

  server.listen(
    env.port,
    () => {
      logger.info(
        "detail-stock server started",
        {
          port:
            env.port,

          nodeEnv:
            env.nodeEnv,

          marketOpen:
            isMarketOpen(),

          origins:
            env.origins,

          closeJobTime,

          closeRetryTime,

          closeCron,

          closeRetryCron,

          timezone:
            env.timezone,
        }
      );
    }
  );
}

/* =========================================================
   SHUTDOWN
========================================================= */

let shuttingDown = false;

async function shutdown(
  signal
) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info(
    "Shutdown requested",
    {
      signal,
    }
  );

  try {
    for (
      const key of upstox.getSubscribed()
    ) {
      await upstox.unsubscribe(
        key,
        true
      );
    }
  } catch {}

  try {
    io.close();
  } catch {}

  try {
    server.close();
  } catch {}

  try {
    await closeDb();
  } catch {}

  try {
    if (env.redisEnabled) {
      await redis.quit();
    }
  } catch {}

  process.exit(0);
}

/* =========================================================
   PROCESS HANDLERS
========================================================= */

process.on(
  "SIGTERM",
  () =>
    shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () =>
    shutdown("SIGINT")
);

process.on(
  "uncaughtException",
  (err) => {
    logger.error(
      "Uncaught exception",
      {
        error:
          err.stack ||
          err.message,
      }
    );
  }
);

process.on(
  "unhandledRejection",
  (err) => {
    logger.error(
      "Unhandled rejection",
      {
        error:
          err?.stack ||
          String(err),
      }
    );
  }
);

/* =========================================================
   START APPLICATION
========================================================= */

startup().catch(
  (err) => {
    logger.error(
      "Startup failed",
      {
        error:
          err.stack ||
          err.message,
      }
    );

    process.exit(1);
  }
);