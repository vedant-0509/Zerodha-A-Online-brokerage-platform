// require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const helmet = require("helmet");
// const compression = require("compression");
// const rateLimit = require("express-rate-limit");
// const cron = require("node-cron");
// const { Server } = require("socket.io");
// const { connectMongoDB } = require("../config/mongodb");

// const env = require("./env");
// const logger = require("./logger");
// const { redis, connectRedis } = require("./redis");
// const upstox = require("./upstox");
// const { getStockFinancials } = upstox;

// const { simulateOrder } = require("./simulatedOrderService");

// const authenticateToken = require("../middleware/authenticateToken");
// const requestContext = require("../middleware/requestContext");
// const createCorsOptions = require("../middleware/corsOptions");
// const errorHandler = require("../middleware/errorHandler");
// const { validateBodyObject } = require("../middleware/validateRequest");

// const {
//   initDb,
//   close: closeDb,
//   saveDailyClose,
//   getPreviousStoredClose,
//   getDbHistory,
//   getMarketStockInstruments,
//   getMarketStockCount,
//   getDailyCloseCount,
//   getMarketStockByInstrumentKey,
//   getInstrumentMaster,
//   getBseInstrumentByIsin,
//   getIsinBySymbol,
// } = require("./db");

// const {
//   isMarketOpen,
//   isTradingDay,
//   isAfterMarketClose,
//   indiaDate,
//   marketStatus,
// } = require("./market");

// const app = express();
// const server = http.createServer(app);

// /* =========================================================
//    BASIC SERVER CONFIG
// ========================================================= */

// if (env.trustProxy) {
//   app.set("trust proxy", 1);
// }

// const corsOptions = createCorsOptions({
//   credentials: true,
//   origins: env.origins,
// });

// const io = new Server(server, {
//   cors: corsOptions,
//   transports: ["websocket", "polling"],
//   pingInterval: 25000,
//   pingTimeout: 20000,
//   maxHttpBufferSize: 1e6,
// });

// app.use(requestContext);

// app.use(
//   helmet({
//     crossOriginResourcePolicy: false,
//   })
// );

// app.use(compression());
// app.use(cors(corsOptions));

// app.use(
//   express.json({
//     limit: "64kb",
//   })
// );

// const apiLimiter = rateLimit({
//   windowMs: 60 * 1000,
//   limit: 300,
//   standardHeaders: "draft-8",
//   legacyHeaders: false,
//   handler: (req, res) => {
//     res.status(429).json({
//       success: false,
//       error: {
//         code: "RATE_LIMITED",
//         message: "Too many requests. Please try again later.",
//       },
//       requestId: req.requestId,
//     });
//   },
// });

// app.use("/api/", apiLimiter);

// /* =========================================================
//    IN-MEMORY STATE
// ========================================================= */

// const subscribers = new Map();
// const snapshots = new Map();

// const SNAP_PREFIX = "detailstock:snapshot:";
// const HISTORY_PREFIX = "detailstock:history:v4:";
// const FINAL_1D_PREFIX = "detailstock:finalized-1d:v1:";

// const fundamentalsByIsin = new Map();
// const fundamentalsInflight = new Map();

// const FUNDAMENTALS_TTL = 15 * 60 * 1000;

// /* =========================================================
//    VALIDATION HELPERS
// ========================================================= */

// function validKey(key) {
//   return (
//     typeof key === "string" &&
//     key.length >= 5 &&
//     key.length <= 180
//   );
// }

// function validIdempotencyKey(key) {
//   return (
//     typeof key === "string" &&
//     /^[A-Za-z0-9._:-]{16,128}$/.test(key.trim())
//   );
// }

// function validIsin(isin) {
//   return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
// }

// function snapshotKey(key) {
//   return `${SNAP_PREFIX}${key}`;
// }

// function historyKey(
//   key,
//   unit,
//   interval,
//   from,
//   to
// ) {
//   return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ""}:${to}`;
// }

// function finalized1DKey(instrumentKey, tradingDate) {
//   return `${FINAL_1D_PREFIX}${instrumentKey}:${tradingDate}`;
// }

// function shiftIndiaDate(dateString, days) {
//   const value = new Date(`${dateString}T00:00:00Z`);
//   value.setUTCDate(value.getUTCDate() + Number(days || 0));
//   return value.toISOString().slice(0, 10);
// }

// function dateAtISTNoon(dateString) {
//   return new Date(`${dateString}T12:00:00+05:30`);
// }

// async function getFinalized1D(instrumentKey, tradingDate) {
//   if (!env.redisEnabled) return null;

//   try {
//     const raw = await redis.get(finalized1DKey(instrumentKey, tradingDate));
//     if (!raw) return null;
//     const parsed = JSON.parse(raw);
//     return Array.isArray(parsed?.candles) ? parsed : null;
//   } catch (err) {
//     logger.warn("Finalized 1D cache read failed", {
//       instrumentKey,
//       tradingDate,
//       error: errorMessage(err),
//     });
//     return null;
//   }
// }

// async function cacheFinalized1D(instrumentKey, tradingDate, payload) {
//   if (!env.redisEnabled || !Array.isArray(payload?.candles) || !payload.candles.length) {
//     return;
//   }

//   await redis.set(
//     finalized1DKey(instrumentKey, tradingDate),
//     JSON.stringify(payload),
//     { EX: 3 * 24 * 60 * 60 },
//   );
// }

// function isinFromInstrumentKey(key) {
//   const candidate =
//     String(key || "").split("|")[1] || "";

//   return validIsin(candidate)
//     ? candidate
//     : null;
// }

// function errorMessage(err) {
//   return (
//     err?.response?.data?.errors?.[0]?.message ||
//     err?.response?.data?.message ||
//     err?.response?.data ||
//     err?.message ||
//     "Unexpected error"
//   );
// }

// /* =========================================================
//    CRON HELPERS
// ========================================================= */

// function timeToWeekdayCron(
//   value,
//   fallback
// ) {
//   const raw = String(
//     value || fallback || ""
//   ).trim();

//   const match =
//     raw.match(/^(\d{1,2}):(\d{2})$/);

//   if (!match) {
//     throw new Error(
//       `Invalid cron time "${raw}". Expected HH:MM, for example 15:35`
//     );
//   }

//   const hour = Number(match[1]);
//   const minute = Number(match[2]);

//   if (
//     !Number.isInteger(hour) ||
//     !Number.isInteger(minute) ||
//     hour < 0 ||
//     hour > 23 ||
//     minute < 0 ||
//     minute > 59
//   ) {
//     throw new Error(
//       `Invalid cron time "${raw}". Expected HH:MM between 00:00 and 23:59`
//     );
//   }

//   return `${minute} ${hour} * * 1-5`;
// }

// function getCronTimeFromEnv(
//   key,
//   fallback
// ) {
//   const value = process.env[key];

//   if (value) {
//     return value;
//   }

//   if (
//     key === "CLOSE_JOB_TIME" &&
//     env.closeJobTime
//   ) {
//     return env.closeJobTime;
//   }

//   if (
//     key === "CLOSE_RETRY_TIME" &&
//     env.closeRetryTime
//   ) {
//     return env.closeRetryTime;
//   }

//   return fallback;
// }

// const closeJobTime =
//   getCronTimeFromEnv(
//     "CLOSE_JOB_TIME",
//     "15:45"
//   );

// const closeRetryTime =
//   getCronTimeFromEnv(
//     "CLOSE_RETRY_TIME",
//     "15:50"
//   );

// const closeCron =
//   timeToWeekdayCron(
//     closeJobTime,
//     "15:45"
//   );

// const closeRetryCron =
//   timeToWeekdayCron(
//     closeRetryTime,
//     "15:50"
//   );

// logger.info(
//   "Cron configuration loaded",
//   {
//     closeJobTime,
//     closeRetryTime,
//     closeCron,
//     closeRetryCron,
//     timezone: env.timezone,
//   }
// );

// /* =========================================================
//    SNAPSHOT CACHE
// ========================================================= */

// async function cacheSnapshot(
//   snapshot
// ) {
//   if (!snapshot?.instrumentKey) {
//     return;
//   }

//   snapshots.set(
//     snapshot.instrumentKey,
//     snapshot
//   );

//   if (env.redisEnabled) {
//     await redis.set(
//       snapshotKey(
//         snapshot.instrumentKey
//       ),
//       JSON.stringify(snapshot),
//       {
//         EX: env.snapshotCacheSeconds,
//       }
//     );
//   }
// }

// async function getSnapshot(key) {
//   if (snapshots.has(key)) {
//     return snapshots.get(key);
//   }

//   if (!env.redisEnabled) {
//     return null;
//   }

//   const raw =
//     await redis.get(snapshotKey(key));

//   if (!raw) {
//     return null;
//   }

//   try {
//     const value = JSON.parse(raw);

//     snapshots.set(key, value);

//     return value;
//   } catch {
//     return null;
//   }
// }

// /* =========================================================
//    PREVIOUS CLOSE FALLBACK
// ========================================================= */

// async function enrichWithStoredPreviousClose(
//   snapshot
// ) {
//   if (!snapshot || !env.mysqlEnabled) {
//     return snapshot;
//   }

//   try {
//     const previous =
//       await getPreviousStoredClose(
//         snapshot.instrumentKey,
//         indiaDate()
//       );

//     if (previous?.close != null) {
//       const close =
//         Number(previous.close);

//       const price =
//         Number(snapshot.price);

//       if (
//         Number.isFinite(close) &&
//         close > 0
//       ) {
//         snapshot.previousClose =
//           close;

//         if (
//           Number.isFinite(price)
//         ) {
//           snapshot.change =
//             price - close;

//           snapshot.changePercent =
//             ((price - close) / close) *
//             100;
//         }

//         snapshot.previousCloseDate =
//           previous.trading_date;

//         snapshot.previousCloseSource =
//           "database-fallback";
//       }
//     }
//   } catch (err) {
//     logger.warn(
//       "Previous close fallback lookup failed",
//       {
//         instrumentKey:
//           snapshot.instrumentKey,
//         error: err.message,
//       }
//     );
//   }

//   return snapshot;
// }

// /* =========================================================
//    INSTRUMENT CONTEXT
// ========================================================= */

// async function getInstrumentContext(
//   instrumentKey
// ) {
//   if (!env.mysqlEnabled) {
//     return null;
//   }

//   const marketRow =
//     await getMarketStockByInstrumentKey(
//       instrumentKey
//     );

//   const master =
//     await getInstrumentMaster(
//       instrumentKey
//     );

//   if (!marketRow && !master) {
//     return null;
//   }

//   const isin =
//     master?.isin ||
//     isinFromInstrumentKey(
//       instrumentKey
//     );

//   let bse = null;

//   if (isin) {
//     bse =
//       await getBseInstrumentByIsin(
//         isin
//       );
//   }

//   return {
//     marketRow,
//     master,
//     bse,
//     isin,

//     symbol:
//       master?.trading_symbol ||
//       marketRow?.symbol ||
//       null,

//     name:
//       master?.name ||
//       marketRow?.name ||
//       null,

//     exchange:
//       master?.exchange ||
//       "NSE",

//     segment:
//       master?.segment ||
//       null,
//   };
// }

// /* =========================================================
//    PRIME SNAPSHOT
// ========================================================= */

// async function primeSnapshot(
//   instrumentKey
// ) {
//   const context =
//     await getInstrumentContext(
//       instrumentKey
//     );

//   const today = indiaDate();

//   const marketOpen =
//     isMarketOpen();

//   const existing =
//     await getSnapshot(
//       instrumentKey
//     );

//   const existingIsFresh =
//     existing?.marketDate === today &&
//     (
//       marketOpen
//         ? existing?.marketStatus !==
//           "CLOSED"
//         : existing?.marketStatus ===
//             "CLOSED" &&
//           existing?.source ===
//             "upstox-close-reconciliation"
//     );

//   if (
//     existing &&
//     existingIsFresh
//   ) {
//     return existing;
//   }

//   const snapshot =
//     await upstox.fetchOhlc(
//       instrumentKey
//     );

//   if (context) {
//     snapshot.symbol =
//       context.symbol;

//     snapshot.name =
//       context.name;

//     snapshot.exchange =
//       context.exchange;

//     snapshot.segment =
//       context.segment;

//     snapshot.isin =
//       context.isin;

//     snapshot.sector =
//       context.marketRow?.sector ||
//       null;
//   }

//   snapshot.marketDate =
//     today;

//   snapshot.marketOpen =
//     marketOpen;

//   snapshot.marketStatus =
//     marketOpen
//       ? "OPEN"
//       : "CLOSED";

//   await enrichWithStoredPreviousClose(
//     snapshot
//   );

//   await cacheSnapshot(
//     snapshot
//   );

//   return snapshot;
// }

// /* =========================================================
//    FUNDAMENTALS CACHE
// ========================================================= */

// async function getFundamentalsCached(
//   isin
// ) {
//   const cached =
//     fundamentalsByIsin.get(isin);

//   if (
//     cached &&
//     cached.expiresAt > Date.now()
//   ) {
//     return cached.data;
//   }

//   const inflight =
//     fundamentalsInflight.get(
//       isin
//     );

//   if (inflight) {
//     return inflight;
//   }

//   const fetchPromise =
//     (async () => {
//       try {
//         const data =
//           await upstox.getFundamentals(
//             isin
//           );

//         fundamentalsByIsin.set(
//           isin,
//           {
//             data,
//             expiresAt:
//               Date.now() +
//               FUNDAMENTALS_TTL,
//           }
//         );

//         return data;
//       } catch (err) {
//         logger.error(
//           "getFundamentalsCached upstream fetch failed",
//           {
//             isin,
//             error: err?.message,
//           }
//         );

//         throw err;
//       } finally {
//         fundamentalsInflight.delete(
//           isin
//         );
//       }
//     })();

//   fundamentalsInflight.set(
//     isin,
//     fetchPromise
//   );

//   return fetchPromise;
// }

// /* =========================================================
//    MARKET DATE HELPERS
// ========================================================= */

// function previousTradingDate(date = new Date()) {
//   let candidate = shiftIndiaDate(indiaDate(date), -1);

//   while (!isTradingDay(dateAtISTNoon(candidate))) {
//     candidate = shiftIndiaDate(candidate, -1);
//   }

//   return candidate;
// }

// function latestCompletedTradingDate(date = new Date()) {
//   if (isTradingDay(date) && isAfterMarketClose(date)) {
//     return indiaDate(date);
//   }

//   return previousTradingDate(date);
// }

// /* =========================================================
//    OFFICIAL INTRADAY SETTLEMENT
// ========================================================= */

// async function resolvePreviousClose(instrumentKey, beforeDate) {
//   if (!beforeDate) return null;

//   /*
//    * Upstox daily history is the source of truth for a historical range
//    * baseline. The daily-close table is a useful fallback, but it can contain
//    * older rows written by previous versions of the application. Trusting
//    * those rows first can produce a visibly wrong 1W/1M/etc return.
//    *
//    * We deliberately fetch a small window ending before `beforeDate`, then
//    * select the latest actual trading session. This also handles weekends and
//    * exchange holidays without assuming that `beforeDate - 1` traded.
//    */
//   const fetchTo = shiftIndiaDate(beforeDate, -1);
//   const fetchFrom = shiftIndiaDate(beforeDate, -10);

//   try {
//     const candles = await upstox.fetchHistory(
//       instrumentKey,
//       "days",
//       "1",
//       fetchTo,
//       fetchFrom,
//     );

//     const candidates = (Array.isArray(candles) ? candles : [])
//       .filter((candle) => {
//         const timestamp = Date.parse(candle?.timestamp);
//         return (
//           Number.isFinite(timestamp) &&
//           indiaDate(new Date(timestamp)) < beforeDate &&
//           Number(candle?.close) > 0
//         );
//       })
//       .sort(
//         (a, b) =>
//           Date.parse(a.timestamp) - Date.parse(b.timestamp),
//       );

//     const last = candidates[candidates.length - 1];
//     if (last) {
//       return {
//         close: Number(last.close),
//         tradingDate: indiaDate(new Date(last.timestamp)),
//         source: "upstox-daily-history",
//       };
//     }
//   } catch (err) {
//     logger.warn("Upstox prior close lookup failed", {
//       instrumentKey,
//       beforeDate,
//       error: errorMessage(err),
//     });
//   }

//   // Only use persisted data if the authoritative Upstox lookup fails.
//   if (env.mysqlEnabled) {
//     try {
//       const stored = await getPreviousStoredClose(instrumentKey, beforeDate);
//       const close = Number(stored?.close);
//       if (Number.isFinite(close) && close > 0) {
//         return {
//           close,
//           tradingDate: stored.trading_date,
//           source: "database-fallback",
//         };
//       }
//     } catch (err) {
//       logger.warn("Stored prior close fallback failed", {
//         instrumentKey,
//         beforeDate,
//         error: errorMessage(err),
//       });
//     }
//   }

//   return null;
// }

// function filterTradingSession(candles, tradingDate) {
//   return (Array.isArray(candles) ? candles : [])
//     .filter((candle) => {
//       const timestamp = Date.parse(candle?.timestamp);
//       if (!Number.isFinite(timestamp)) return false;

//       const parts = new Intl.DateTimeFormat("en-GB", {
//         timeZone: "Asia/Kolkata",
//         hour: "2-digit",
//         minute: "2-digit",
//         second: "2-digit",
//         hourCycle: "h23",
//       }).formatToParts(new Date(timestamp));
//       const values = Object.fromEntries(
//         parts.map((part) => [part.type, part.value]),
//       );
//       const minutes =
//         Number(values.hour || 0) * 60 +
//         Number(values.minute || 0) +
//         Number(values.second || 0) / 60;

//       return (
//         indiaDate(new Date(timestamp)) === tradingDate &&
//         minutes >= 9 * 60 + 15 &&
//         minutes <= 15 * 60 + 30
//       );
//     })
//     .sort(
//       (a, b) =>
//         Date.parse(a.timestamp) - Date.parse(b.timestamp),
//     );
// }

// async function fetchOfficialIntradaySession(instrumentKey, tradingDate) {
//   /*
//    * A requested date can be a market holiday even when it is a weekday.
//    * Upstox correctly returns no candles for such a date. Instead of making
//    * the 1D chart fail, walk backwards to the latest session for which
//    * official 1-minute candles actually exist.
//    */
//   const requestedDate = String(tradingDate || indiaDate());
//   let lastProviderError = null;

//   for (let offset = 0; offset <= 10; offset += 1) {
//     const candidateDate = shiftIndiaDate(requestedDate, -offset);

//     if (!isTradingDay(dateAtISTNoon(candidateDate))) {
//       continue;
//     }

//     try {
//       const raw =
//         candidateDate === indiaDate()
//           ? await upstox.fetchHistory(
//               instrumentKey,
//               "minutes",
//               "1",
//               candidateDate,
//             )
//           : await upstox.fetchHistory(
//               instrumentKey,
//               "minutes",
//               "1",
//               candidateDate,
//               shiftIndiaDate(candidateDate, -7),
//             );

//       const candles = filterTradingSession(raw, candidateDate);

//       if (candles.length) {
//         if (candidateDate !== requestedDate) {
//           logger.info("Using latest available intraday session", {
//             instrumentKey,
//             requestedDate,
//             actualTradingDate: candidateDate,
//           });
//         }
//         return candles;
//       }
//     } catch (err) {
//       lastProviderError = err;
//       logger.warn("Intraday session lookup failed", {
//         instrumentKey,
//         candidateDate,
//         error: errorMessage(err),
//       });
//     }
//   }

//   throw new Error(
//     `No official 1-minute candles available for ${instrumentKey} on or before ${requestedDate}` +
//       (lastProviderError ? `: ${errorMessage(lastProviderError)}` : ""),
//   );
// }

// function buildOfficialCloseSnapshot(
//   row,
//   candles,
//   previousClose,
//   tradingDate,
// ) {
//   const first = candles[0];
//   const last = candles[candles.length - 1];
//   const close = Number(last.close);

//   if (!Number.isFinite(close) || close <= 0) {
//     throw new Error(
//       `Invalid official close for ${row?.instrument_key || "instrument"}`,
//     );
//   }

//   const highs = candles
//     .map((candle) => Number(candle.high))
//     .filter((value) => Number.isFinite(value) && value > 0);
//   const lows = candles
//     .map((candle) => Number(candle.low))
//     .filter((value) => Number.isFinite(value) && value > 0);

//   const volume = candles.reduce((sum, candle) => {
//     const value = Number(candle.volume);
//     return sum + (Number.isFinite(value) && value > 0 ? value : 0);
//   }, 0);

//   const change =
//     previousClose?.close != null
//       ? close - Number(previousClose.close)
//       : null;

//   return {
//     instrumentKey: row.instrument_key,
//     symbol: row.symbol || null,
//     tradingSymbol: row.symbol || null,
//     name: row.name || null,
//     companyName: row.name || null,
//     exchange: row.master_exchange || row.exchange || env.marketStockExchange || "NSE",
//     segment: row.master_segment || row.segment || env.marketStockSegment || "NSE_EQ",
//     sector: row.sector || null,
//     ltp: close,
//     price: close,
//     dayClose: close,
//     previousClose:
//       previousClose?.close != null
//         ? Number(previousClose.close)
//         : null,
//     previousCloseDate: previousClose?.tradingDate || null,
//     previousCloseSource: previousClose?.source || null,
//     change,
//     changePercent:
//       previousClose?.close
//         ? (change / Number(previousClose.close)) * 100
//         : null,
//     open: Number(first.open),
//     high: highs.length ? Math.max(...highs) : Number(first.high),
//     low: lows.length ? Math.min(...lows) : Number(first.low),
//     volume,
//     lastTradeTime: Date.parse(last.timestamp) || null,
//     timestamp: Date.now(),
//     marketDate: tradingDate,
//     marketOpen: false,
//     marketStatus: "CLOSED",
//     source: "upstox-finalized-intraday",
//   };
// }

// let closingSyncPromise = null;

// async function reconcileAllMarketStocks(
//   reason,
//   targetTradingDate = latestCompletedTradingDate(),
// ) {
//   if (!isTradingDay(dateAtISTNoon(targetTradingDate))) {
//     return { total: 0, saved: 0, skipped: true };
//   }

//   if (closingSyncPromise) return closingSyncPromise;

//   closingSyncPromise = (async () => {
//     const rows = env.mysqlEnabled
//       ? await getMarketStockInstruments()
//       : [];

//     if (!rows.length) {
//       logger.warn("No market stocks available for official settlement", {
//         reason,
//         tradingDate: targetTradingDate,
//         mysqlEnabled: env.mysqlEnabled,
//       });
//       return { total: 0, saved: 0 };
//     }

//     const batchSize = Math.max(
//       1,
//       Number(env.closeBatchSize) || 5,
//     );
//     let saved = 0;

//     for (let i = 0; i < rows.length; i += batchSize) {
//       const batch = rows.slice(i, i + batchSize);

//       const results = await Promise.allSettled(
//         batch.map(async (row) => {
//           const key = row.instrument_key;
//           if (!validKey(key)) {
//             throw new Error("Invalid instrument key");
//           }

//           const cached = await getFinalized1D(
//             key,
//             targetTradingDate,
//           );
//           const hasClose = env.mysqlEnabled
//             ? await hasDailyCloseForDate(
//                 key,
//                 targetTradingDate,
//               )
//             : false;

//           if (cached && hasClose) {
//             return { skipped: true };
//           }

//           // The settlement job owns the final official pull. If a cache was
//           // seeded by a client immediately after close, use it only together
//           // with a persisted close; otherwise fetch fresh official data.
//           const candles =
//             cached?.candles?.length && hasClose
//               ? cached.candles
//               : await fetchOfficialIntradaySession(
//                   key,
//                   targetTradingDate,
//                 );

//           const previousClose = await resolvePreviousClose(
//             key,
//             targetTradingDate,
//           );

//           const snapshot = buildOfficialCloseSnapshot(
//             row,
//             candles,
//             previousClose,
//             targetTradingDate,
//           );

//           await saveDailyClose(
//             snapshot,
//             targetTradingDate,
//           );

//           await cacheFinalized1D(key, targetTradingDate, {
//             tradingDate: targetTradingDate,
//             candles,
//             closePrice: snapshot.dayClose,
//             baselineClose: snapshot.previousClose,
//             baselineDate: snapshot.previousCloseDate,
//             source: "upstox-finalized-intraday",
//             finalizedAt: new Date().toISOString(),
//           });

//           await cacheSnapshot(snapshot);

//           if (subscribers.has(key)) {
//             io.to(`stock:${key}`).emit(
//               "detailStock:snapshot",
//               snapshot,
//             );
//           }

//           return { skipped: false };
//         }),
//       );

//       for (const result of results) {
//         if (result.status === "fulfilled") {
//           saved++;
//         } else {
//           logger.error("Official settlement instrument failed", {
//             reason,
//             tradingDate: targetTradingDate,
//             error: errorMessage(result.reason),
//           });
//         }
//       }

//       if (
//         i + batch.length < rows.length &&
//         Number(env.closeBatchDelayMs) > 0
//       ) {
//         await new Promise((resolve) =>
//           setTimeout(
//             resolve,
//             Number(env.closeBatchDelayMs),
//           ),
//         );
//       }
//     }

//     logger.info("Official 1D settlement complete", {
//       reason,
//       tradingDate: targetTradingDate,
//       total: rows.length,
//       saved,
//     });

//     return {
//       total: rows.length,
//       saved,
//     };
//   })();

//   try {
//     return await closingSyncPromise;
//   } finally {
//     closingSyncPromise = null;
//   }
// }

// /* =========================================================
//    STARTUP RECONCILIATION
// ========================================================= */

// async function reconcileOnStartup() {
//   if (
//     !env.startupReconcileClosed ||
//     isMarketOpen()
//   ) {
//     return;
//   }

//   const rows =
//     await getMarketStockInstruments();

//   if (!rows.length) {
//     return;
//   }

//   const date =
//     latestCompletedTradingDate();

//   const totalStocks =
//     rows.length;

//   const savedToday =
//     await getDailyCloseCount(
//       date
//     );

//   const markerKey =
//     `detailstock:close-reconciled:v3:${date}`;

//   let marker = null;

//   if (env.redisEnabled) {
//     try {
//       marker =
//         await redis.get(
//           markerKey
//         );
//     } catch (err) {
//       logger.warn(
//         "Close reconciliation marker read failed",
//         {
//           error: err.message,
//         }
//       );
//     }
//   }

//   const needsRepair =
//     savedToday <
//       totalStocks ||
//     marker !== "ok";

//   if (needsRepair) {
//     logger.info(
//       "Startup close reconciliation required",
//       {
//         date,
//         totalStocks,
//         savedToday,
//         marker,
//       }
//     );

//     const result =
//       await reconcileAllMarketStocks(
//         "startup-after-market-hours-v2",
//         date
//       );

//     if (
//       env.redisEnabled &&
//       result.total > 0 &&
//       result.saved >= result.total
//     ) {
//       try {
//         await redis.set(
//           markerKey,
//           "ok",
//           {
//             EX:
//               3 *
//               24 *
//               60 *
//               60,
//           }
//         );
//       } catch (err) {
//         logger.warn(
//           "Close reconciliation marker write failed",
//           {
//             error: err.message,
//           }
//         );
//       }
//     }
//   } else {
//     logger.info(
//       "Startup close reconciliation already complete",
//       {
//         date,
//         totalStocks,
//         savedToday,
//       }
//     );
//   }
// }

// /* =========================================================
//    UPSTOX LIVE TICK HANDLER
// ========================================================= */

// upstox.setTickHandler(
//   (tick) => {
//     // Ignore late/out-of-order packets after the exchange has closed.
//     // Finalized historical data owns the 1D chart after close.
//     if (!isTradingDay() || !isMarketOpen()) {
//       return;
//     }

//     const previous =
//       snapshots.get(
//         tick.instrumentKey
//       ) || {};

//     const snapshot = {
//       ...previous,
//       ...tick,

//       instrumentKey:
//         tick.instrumentKey,

//       marketDate:
//         indiaDate(),

//       marketOpen:
//         true,

//       marketStatus:
//         "OPEN",

//       source:
//         "upstox-websocket",
//     };

//     for (
//       const field of [
//         "previousClose",
//         "open",
//         "high",
//         "low",
//         "volume",
//         "upperCircuit",
//         "lowerCircuit",
//         "lastTradeTime",
//       ]
//     ) {
//       if (
//         snapshot[field] == null &&
//         previous[field] != null
//       ) {
//         snapshot[field] =
//           previous[field];
//       }
//     }

//     if (
//       snapshot.price != null &&
//       snapshot.previousClose !=
//         null
//     ) {
//       snapshot.change =
//         Number(snapshot.price) -
//         Number(
//           snapshot.previousClose
//         );

//       snapshot.changePercent =
//         Number(
//           snapshot.previousClose
//         )
//           ? (snapshot.change /
//               Number(
//                 snapshot.previousClose
//               )) *
//             100
//           : null;
//     }

//     snapshots.set(
//       tick.instrumentKey,
//       snapshot
//     );

//     if (env.redisEnabled) {
//       redis
//         .set(
//           snapshotKey(
//             tick.instrumentKey
//           ),
//           JSON.stringify(snapshot),
//           {
//             EX:
//               env.snapshotCacheSeconds,
//           }
//         )
//         .catch((err) =>
//           logger.warn(
//             "Tick cache write failed",
//             {
//               error: err.message,
//             }
//           )
//         );
//     }

//     io.to(
//       `stock:${tick.instrumentKey}`
//     ).emit(
//       "detailStock:tick",
//       snapshot
//     );
//   }
// );

// /* =========================================================
//    SOCKET.IO
// ========================================================= */

// io.on(
//   "connection",
//   (socket) => {
//     socket.on(
//       "detailStock:subscribe",
//       async (
//         payload,
//         ack = () => {}
//       ) => {
//         const key =
//           payload?.instrumentKey;

//         if (!validKey(key)) {
//           return ack({
//             success: false,
//             message:
//               "Valid instrumentKey is required",
//           });
//         }

//         try {
//           const context =
//             await getInstrumentContext(
//               key
//             );

//           if (
//             !context?.master &&
//             env.mysqlEnabled
//           ) {
//             return ack({
//               success: false,
//               message:
//                 "Instrument is not in the stock universe",
//             });
//           }

//           socket.join(
//             `stock:${key}`
//           );

//           if (
//             !subscribers.has(key)
//           ) {
//             subscribers.set(
//               key,
//               new Set()
//             );
//           }

//           const set =
//             subscribers.get(key);

//           const first =
//             set.size === 0;

//           set.add(socket.id);

//           if (first) {
//             await upstox.subscribe(
//               key
//             );
//           }

//           let snapshot =
//             await primeSnapshot(
//               key
//             );

//           if (context) {
//             snapshot = {
//               ...snapshot,

//               instrumentKey:
//                 key,

//               symbol:
//                 context.symbol,

//               name:
//                 context.name,

//               exchange:
//                 context.exchange,

//               segment:
//                 context.segment,

//               isin:
//                 context.isin,

//               sector:
//                 context.marketRow
//                   ?.sector ||
//                 null,

//               bseInstrumentKey:
//                 context.bse
//                   ?.instrument_key ||
//                 null,
//             };
//           }

//           const isin =
//             snapshot.isin ||
//             context?.isin;

//           if (isin) {
//             try {
//               const fundamentals =
//                 await getFundamentalsCached(
//                   isin
//                 );

//               snapshot = {
//                 ...snapshot,
//                 ...fundamentals,
//                 isin,
//               };
//             } catch (err) {
//               logger.warn(
//                 "Fundamentals unavailable on subscribe",
//                 {
//                   instrumentKey:
//                     key,

//                   isin,

//                   error:
//                     errorMessage(
//                       err
//                     ),
//                 }
//               );
//             }
//           }

//           await cacheSnapshot(
//             snapshot
//           );

//           socket.emit(
//             "detailStock:snapshot",
//             {
//               ...snapshot,
//               marketOpen:
//                 isMarketOpen(),
//             }
//           );

//           ack({
//             success: true,
//             subscribed: true,
//             deduplicated:
//               !first,
//             subscriberCount:
//               set.size,
//             snapshot,
//           });
//         } catch (err) {
//           logger.error(
//             "Detail stock subscribe failed",
//             {
//               instrumentKey:
//                 key,

//               socketId:
//                 socket.id,

//               error:
//                 errorMessage(err),
//             }
//           );

//           ack({
//             success: false,
//             message:
//               errorMessage(err),
//           });
//         }
//       }
//     );

//     socket.on(
//       "detailStock:unsubscribe",
//       async (
//         payload,
//         ack = () => {}
//       ) => {
//         const key =
//           payload?.instrumentKey;

//         if (!validKey(key)) {
//           return ack({
//             success: false,
//           });
//         }

//         await release(
//           key,
//           socket.id
//         );

//         socket.leave(
//           `stock:${key}`
//         );

//         ack({
//           success: true,
//         });
//       }
//     );

//     socket.on(
//       "disconnect",
//       async () => {
//         for (
//           const [
//             key,
//             set,
//           ] of subscribers.entries()
//         ) {
//           if (
//             set.has(
//               socket.id
//             )
//           ) {
//             await release(
//               key,
//               socket.id
//             );
//           }
//         }
//       }
//     );
//   }
// );

// async function release(
//   key,
//   socketId
// ) {
//   const set =
//     subscribers.get(key);

//   if (!set) {
//     return;
//   }

//   set.delete(
//     socketId
//   );

//   if (set.size === 0) {
//     subscribers.delete(
//       key
//     );

//     await upstox.unsubscribe(
//       key,
//       false
//     );

//     logger.info(
//       "Stock room became empty",
//       {
//         instrumentKey:
//           key,
//       }
//     );
//   }
// }

// /* =========================================================
//    ROUTES
// ========================================================= */

// app.get(
//   "/health",
//   async (req, res) => {
//     const status =
//       marketStatus();

//     res.json({
//       success: true,
//       service:
//         "detail-stock",

//       uptimeSeconds:
//         Math.round(
//           process.uptime()
//         ),

//       ...status,

//       redis:
//         env.redisEnabled
//           ? redis.isReady
//           : false,

//       mysql:
//         env.mysqlEnabled,

//       upstoxConnected:
//         upstox.isConnected(),

//       upstoxSubscribed:
//         upstox.getSubscribed()
//           .length,

//       activeRooms:
//         subscribers.size,

//       time:
//         new Date().toISOString(),
//     });
//   }
// );

// app.get(
//   "/api/detail-stock/market-status",
//   async (req, res) => {
//     res.json({
//       success: true,
//       ...marketStatus(),
//     });
//   },
// );

// app.get(
//   "/api/financials/:symbol",
//   async (req, res) => {
//     try {
//       const {
//         symbol,
//       } = req.params;

//       const financials =
//         await getStockFinancials(
//           symbol
//         );

//       res.json({
//         success: true,
//         data: financials,
//       });
//     } catch (error) {
//       res.status(500).json({
//         success: false,
//         message:
//           error.message ||
//           "Internal server error",
//       });
//     }
//   }
// );

// app.get(
//   "/api/stock/:symbol/financials",
//   async (req, res) => {
//     try {
//       const {
//         symbol,
//       } = req.params;

//       let isin =
//         symbol;

//       if (
//         !symbol.startsWith("INE") &&
//         !symbol.startsWith("IN0")
//       ) {
//         isin =
//           await getIsinBySymbol(
//             symbol
//           );
//       }

//       if (!isin) {
//         return res
//           .status(404)
//           .json({
//             success: false,
//             error:
//               `Could not resolve ISIN for symbol: ${symbol}`,
//           });
//       }

//       const financials =
//         await getStockFinancials(
//           isin
//         );

//       return res.json({
//         symbol,
//         isin,
//         ...financials,
//       });
//     } catch (error) {
//       return res.status(500).json({
//         success: false,
//         error:
//           error.message ||
//           "Failed to fetch financials",
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/market-stocks",
//   async (req, res) => {
//     if (!env.mysqlEnabled) {
//       return res.status(503).json({
//         success: false,
//         message:
//           "MySQL disabled",
//       });
//     }

//     try {
//       const rows =
//         await getMarketStockInstruments();

//       res.json({
//         success: true,
//         marketOpen:
//           isMarketOpen(),

//         count:
//           rows.length,

//         data:
//           rows,
//       });
//     } catch (err) {
//       res.status(500).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/instrument/:instrumentKey",
//   async (req, res) => {
//     const key =
//       req.params.instrumentKey;

//     if (!validKey(key)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid instrumentKey",
//         });
//     }

//     try {
//       const context =
//         await getInstrumentContext(
//           key
//         );

//       if (!context) {
//         return res
//           .status(404)
//           .json({
//             success: false,
//             message:
//               "Instrument not found",
//           });
//       }

//       res.json({
//         success: true,
//         data: context,
//       });
//     } catch (err) {
//       res.status(500).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/snapshot/:instrumentKey",
//   async (req, res) => {
//     const key =
//       req.params.instrumentKey;

//     if (!validKey(key)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid instrumentKey",
//         });
//     }

//     try {
//       const snapshot =
//         await primeSnapshot(
//           key
//         );

//       res.json({
//         success: true,
//         marketOpen:
//           isMarketOpen(),

//         data:
//           snapshot,
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/history/:instrumentKey",
//   async (req, res) => {
//     const key = req.params.instrumentKey;

//     if (!validKey(key)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid instrumentKey",
//       });
//     }

//     const allowedUnits = new Set([
//       "minutes",
//       "hours",
//       "days",
//       "weeks",
//       "months",
//     ]);

//     const unit = allowedUnits.has(req.query.unit)
//       ? req.query.unit
//       : "days";
//     const interval = String(req.query.interval || "1");
//     const to = String(req.query.to || indiaDate());
//     const from = req.query.from ? String(req.query.from) : "";
//     const forceRefresh =
//       String(req.query.refresh || "") === "1";
//     const isOneDay =
//       unit === "minutes" &&
//       interval === "1" &&
//       !from;

//     try {
//       /*
//        * After close, finalized settlement data is immutable for the session.
//        * refresh=1 is used only for the OPEN -> CLOSED handover when the final
//        * cache may not exist yet.
//        */
//       if (
//         isOneDay &&
//         !isMarketOpen() &&
//         !forceRefresh
//       ) {
//         const sessionDate =
//           latestCompletedTradingDate();
//         const finalized =
//           await getFinalized1D(
//             key,
//             sessionDate,
//           );

//         if (finalized?.candles?.length) {
//           return res.json({
//             success: true,
//             source: "redis-finalized-1d",
//             marketOpen: false,
//             sessionDate,
//             baselineClose:
//               finalized.baselineClose ?? null,
//             baselineDate:
//               finalized.baselineDate ?? null,
//             data: {
//               candles: finalized.candles,
//               baselineClose:
//                 finalized.baselineClose ?? null,
//               baselineDate:
//                 finalized.baselineDate ?? null,
//             },
//           });
//         }
//       }

//       const cacheKey = historyKey(
//         key,
//         unit,
//         interval,
//         from,
//         to,
//       );

//       if (
//         env.redisEnabled &&
//         !forceRefresh
//       ) {
//         const cached =
//           await redis.get(cacheKey);

//         if (cached) {
//           const parsed =
//             JSON.parse(cached);

//           // Only accept v2 history objects. Older array-only cache entries
//           // did not contain a real prior-day baseline.
//           if (
//             parsed &&
//             !Array.isArray(parsed) &&
//             Object.prototype.hasOwnProperty.call(
//               parsed,
//               "baselineClose",
//             )
//           ) {
//             return res.json({
//               success: true,
//               source: "cache",
//               marketOpen:
//                 isMarketOpen(),
//               refreshed: false,
//               data: parsed,
//             });
//           }
//         }
//       }

//       let data;

//       if (
//         isOneDay &&
//         !isMarketOpen()
//       ) {
//         const sessionDate =
//           latestCompletedTradingDate();
//         data =
//           await fetchOfficialIntradaySession(
//             key,
//             sessionDate,
//           );
//       } else {
//         data =
//           await upstox.fetchHistory(
//             key,
//             unit,
//             interval,
//             to,
//             from || undefined,
//           );
//       }

//       let baselineClose = null;
//       let baselineDate = null;
//       let sessionDate = null;

//       if (isOneDay) {
//         sessionDate =
//           !isMarketOpen()
//             ? latestCompletedTradingDate()
//             : to;

//         const previous =
//           await resolvePreviousClose(
//             key,
//             sessionDate,
//           );

//         baselineClose =
//           previous?.close ?? null;
//         baselineDate =
//           previous?.tradingDate ?? null;

//         data =
//           filterTradingSession(
//             data,
//             sessionDate,
//           );
//       } else {
//         /*
//          * Match the range-return convention used by the stock detail UI: the
//          * selected period starts at the first trading candle inside the range,
//          * and its opening price is the starting value. This is why a 1W range
//          * beginning on a trading day can differ from the prior-day-close
//          * convention. It also makes All work by using the first available
//          * historical candle rather than looking for a date before 2000.
//          */
//         const firstCandle =
//           Array.isArray(data) && data.length
//             ? data[0]
//             : null;
//         const firstOpen = Number(
//           firstCandle?.open ??
//           firstCandle?.openPrice ??
//           firstCandle?.price,
//         );

//         if (Number.isFinite(firstOpen) && firstOpen > 0) {
//           baselineClose = firstOpen;
//           const firstTimestamp = Date.parse(
//             firstCandle?.timestamp,
//           );
//           baselineDate = Number.isFinite(firstTimestamp)
//             ? indiaDate(new Date(firstTimestamp))
//             : from || null;
//         }
//       }

//       const payload = {
//         candles:
//           Array.isArray(data)
//             ? data
//             : [],
//         baselineClose,
//         baselineDate,
//         source: "upstox",
//       };

//       if (!payload.candles.length) {
//         throw new Error(
//           `No historical candles returned for ${key}`,
//         );
//       }

//       if (env.redisEnabled) {
//         await redis.set(
//           cacheKey,
//           JSON.stringify(payload),
//           {
//             EX:
//               env.historyCacheSeconds,
//           },
//         );
//       }

//       /*
//        * Seed the finalized session cache for after-close reads. The scheduled
//        * settlement still persists the official close and can retry safely.
//        */
//       if (
//         isOneDay &&
//         !isMarketOpen() &&
//         sessionDate
//       ) {
//         const last =
//           payload.candles[
//             payload.candles.length - 1
//           ];

//         await cacheFinalized1D(
//           key,
//           sessionDate,
//           {
//             tradingDate:
//               sessionDate,
//             candles:
//               payload.candles,
//             closePrice:
//               Number(last?.close) || null,
//             baselineClose,
//             baselineDate,
//             source:
//               "upstox-finalized-intraday",
//             finalizedAt:
//               new Date().toISOString(),
//           },
//         );
//       }

//       return res.json({
//         success: true,
//         source: "upstox",
//         marketOpen:
//           isMarketOpen(),
//         refreshed:
//           forceRefresh,
//         sessionDate:
//           sessionDate || undefined,
//         baselineClose,
//         baselineDate,
//         data: payload,
//       });
//     } catch (err) {
//       /*
//        * Keep the existing DB fallback for longer ranges. Baseline is resolved
//        * independently from the first candle, so weekends/holidays are safe.
//        */
//       if (
//         !isOneDay &&
//         env.mysqlEnabled &&
//         ["days", "weeks", "months"].includes(
//           unit,
//         )
//       ) {
//         try {
//           const dbData =
//             await getDbHistory(
//               key,
//               from || "2000-01-01",
//               to,
//             );

//           if (dbData.length) {
//             const firstCandle = dbData[0];
//             const firstOpen = Number(
//               firstCandle?.open ??
//               firstCandle?.openPrice ??
//               firstCandle?.price,
//             );
//             const firstTimestamp = Date.parse(
//               firstCandle?.timestamp,
//             );
//             const baselineClose =
//               Number.isFinite(firstOpen) && firstOpen > 0
//                 ? firstOpen
//                 : null;
//             const baselineDate =
//               Number.isFinite(firstTimestamp)
//                 ? indiaDate(new Date(firstTimestamp))
//                 : from || null;

//             const payload = {
//               candles: dbData,
//               baselineClose,
//               baselineDate,
//               source: "database",
//             };

//             if (env.redisEnabled) {
//               await redis.set(
//                 historyKey(
//                   key,
//                   unit,
//                   interval,
//                   from,
//                   to,
//                 ),
//                 JSON.stringify(
//                   payload,
//                 ),
//                 {
//                   EX:
//                     env.historyCacheSeconds,
//                 },
//               );
//             }

//             return res.json({
//               success: true,
//               source: "database",
//               marketOpen:
//                 isMarketOpen(),
//               refreshed: false,
//               baselineClose,
//               baselineDate,
//               data: payload,
//             });
//           }
//         } catch (dbError) {
//           logger.warn(
//             "Database history fallback failed",
//             {
//               instrumentKey: key,
//               error:
//                 errorMessage(
//                   dbError,
//                 ),
//             },
//           );
//         }
//       }

//       logger.error(
//         "History request failed",
//         {
//           instrumentKey: key,
//           unit,
//           interval,
//           from,
//           to,
//           forceRefresh,
//           error:
//             errorMessage(err),
//         },
//       );

//       return res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   },
// );

// app.get(
//   "/api/detail-stock/fundamentals/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       ).toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       const data =
//         await getFundamentalsCached(
//           isin
//         );

//       res.json({
//         success: true,
//         isin,
//         ...data,
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/shareholding/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       ).toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       const data =
//         await getFundamentalsCached(
//           isin
//         );

//       res.json({
//         success: true,

//         isin,

//         shareholding:
//           data?.shareholding ||
//           [],

//         mutualFunds:
//           data?.mutualFunds ||
//           [],

//         updatedAt:
//           data?.updatedAt,
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/about/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       )
//         .trim()
//         .toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       const profile =
//         await upstox.getProfile(
//           isin
//         );

//       return res.json({
//         success: true,

//         isin,

//         profile: {
//           company_profile:
//             profile?.company_profile ??
//             null,

//           sector:
//             profile?.sector ??
//             null,

//           sector_market_cap_inr:
//             {
//               value:
//                 profile
//                   ?.sector_market_cap_inr
//                   ?.value ??
//                 null,

//               unit:
//                 profile
//                   ?.sector_market_cap_inr
//                   ?.unit ??
//                 "crore",

//               formatted:
//                 profile
//                   ?.sector_market_cap_inr
//                   ?.formatted ??
//                 null,
//             },

//           sector_market_cap_usd:
//             {
//               value:
//                 profile
//                   ?.sector_market_cap_usd
//                   ?.value ??
//                 null,

//               unit:
//                 profile
//                   ?.sector_market_cap_usd
//                   ?.unit ??
//                 null,

//               formatted:
//                 profile
//                   ?.sector_market_cap_usd
//                   ?.formatted ??
//                 null,
//             },
//         },
//       });
//     } catch (err) {
//       logger.error(
//         "Company profile fetch failed",
//         {
//           isin,

//           error:
//             errorMessage(err),
//         }
//       );

//       return res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/ratios/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       ).toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       const data =
//         await getFundamentalsCached(
//           isin
//         );

//       res.json({
//         success: true,

//         isin,

//         ratios:
//           data?.ratios ||
//           [],

//         updatedAt:
//           data?.updatedAt,
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/corporate-actions/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       ).toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       res.json({
//         success: true,

//         isin,

//         data:
//           await upstox.getCorporateActions(
//             isin
//           ),

//         updatedAt:
//           Date.now(),
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/competitors/:isin",
//   async (req, res) => {
//     const isin =
//       String(
//         req.params.isin ||
//           ""
//       ).toUpperCase();

//     if (!validIsin(isin)) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Invalid ISIN",
//         });
//     }

//     try {
//       res.json({
//         success: true,

//         isin,

//         data:
//           await upstox.getCompetitors(
//             isin
//           ),

//         updatedAt:
//           Date.now(),
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/financial-performance/:identifier",
//   async (req, res) => {
//     try {
//       const identifier = String(
//         req.params.identifier || ""
//       ).trim().toUpperCase();

//       if (!identifier) {
//         return res.status(400).json({
//           success: false,
//           message: "Stock identifier is required",
//         });
//       }

//       let isin = identifier;

//       // If identifier is a SYMBOL, resolve it from DB
//       if (!validIsin(isin)) {
//         isin = await getIsinBySymbol(identifier);
//       }

//       if (!isin || !validIsin(isin)) {
//         return res.status(404).json({
//           success: false,
//           message: `Could not resolve ISIN for ${identifier}`,
//         });
//       }

//       const data = await getFundamentalsCached(isin);

//       return res.json({
//         success: true,
//         symbol: identifier,
//         isin,

//         incomeStatement:
//           data?.incomeStatement || null,

//         balanceSheet:
//           data?.balanceSheet || null,

//         cashFlow:
//           data?.cashFlow || null,

//         fundamentals:
//           data?.fundamentals || null,

//         ratios:
//           data?.ratios || [],

//         updatedAt:
//           data?.updatedAt || Date.now(),
//       });

//     } catch (error) {
//       logger.error("Failed to fetch financial performance", {
//         error: error?.message || String(error),
//       });

//       return res.status(502).json({
//         success: false,
//         message:
//           error?.message ||
//           "Failed to fetch financial performance",
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/funds",
//   async (req, res) => {
//     try {
//       const data =
//         await upstox.getFunds();

//       res.json({
//         success: true,
//         data,
//       });
//     } catch (err) {
//       res.status(502).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// /* =========================================================
//    SIMULATED BUY / SELL
// ========================================================= */

// app.post(
//   "/api/detail-stock/order",
//   authenticateToken,
//   validateBodyObject({
//     allowEmpty: false,
//     allowedFields: [
//       "symbol",
//       "instrumentKey",
//       "transactionType",
//       "quantity",
//       "limitPrice",
//       "orderType",
//       "product",
//     ],
//     requiredFields: ["instrumentKey", "transactionType", "quantity", "orderType", "product"],
//     fieldRules: {
//       symbol: { type: "string", maxLength: 100 },
//       instrumentKey: { type: "string", maxLength: 255 },
//       transactionType: { type: "string", maxLength: 10 },
//       quantity: { type: "number" },
//       limitPrice: { type: "number" },
//       orderType: { type: "string", maxLength: 10 },
//       product: { type: "string", maxLength: 10 },
//     },
//   }),
//   async (req, res) => {
//     const body =
//       req.body || {};

//     const idempotencyKey = String(
//       req.get("Idempotency-Key") || ""
//     ).trim();

//     if (!validIdempotencyKey(idempotencyKey)) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_IDEMPOTENCY_KEY",
//         message:
//           "A valid Idempotency-Key header is required (16-128 characters).",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * Validate instrument
//      * ---------------------------------------------
//      */

//     if (
//       !validKey(
//         body.instrumentKey
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Valid instrumentKey is required",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * Validate quantity
//      * ---------------------------------------------
//      */

//     const quantity =
//       Number(body.quantity);

//     if (
//       !Number.isInteger(
//         quantity
//       ) ||
//       quantity <= 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Quantity must be a positive integer",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * BUY / SELL
//      * ---------------------------------------------
//      */

//     const transactionType =
//       String(
//         body.transactionType ||
//           body.orderType ||
//           ""
//       ).toUpperCase();

//     if (
//       !["BUY", "SELL"].includes(
//         transactionType
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "transactionType must be BUY or SELL",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * MARKET / LIMIT
//      * ---------------------------------------------
//      */

//     const orderType =
//       String(
//         body.orderType ||
//           "MARKET"
//       ).toUpperCase();

//     /*
//      * orderType is simulation-only.
//      * It is NEVER sent to Upstox.
//      */

//     if (
//       !["MARKET", "LIMIT"].includes(
//         orderType
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid orderType",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * TEST MODE
//      * ---------------------------------------------
//      *
//      * For now BUY/SELL is allowed even
//      * when the real market is closed.
//      *
//      * This is ONLY for testing.
//      *
//      * No real Upstox order is sent.
//      */

//     const marketOpen =
//       true;

//     /*
//      * When testing is finished, replace
//      * the above with:
//      *
//      * const marketOpen =
//      *   isMarketOpen();
//      *
//      * if (!marketOpen) {
//      *   return res.status(403).json({
//      *     success: false,
//      *     code: "MARKET_CLOSED",
//      *     marketOpen: false,
//      *     message: "Market is closed",
//      *   });
//      * }
//      */

//     /*
//      * ---------------------------------------------
//      * LIMIT price validation
//      * ---------------------------------------------
//      *
//      * The client price is treated only as a LIMIT condition.
//      * The execution price always comes from the locked database row.
//      */

//     const requestedLimitPrice =
//       body.limitPrice != null && body.limitPrice !== ""
//         ? Number(body.limitPrice)
//         : body.price != null && body.price !== ""
//           ? Number(body.price)
//           : null;

//     if (
//       orderType === "LIMIT" &&
//       (!Number.isFinite(requestedLimitPrice) ||
//         requestedLimitPrice <= 0)
//     ) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_LIMIT_PRICE",
//         message: "A positive limitPrice is required for LIMIT orders.",
//       });
//     }

//     try {
//       /*
//        * ---------------------------------------------
//        * SIMULATION ONLY
//        * ---------------------------------------------
//        *
//        * This calls simulateOrder().
//        *
//        * It NEVER calls:
//        *
//        * upstox.placeOrder()
//        *
//        * or any broker order API.
//        */

//       const result =
//         await simulateOrder({
//           userId:
//             req.userId,

//           instrumentKey:
//             body.instrumentKey,

//           transactionType,

//           quantity,

//           orderType,

//           product:
//             "CNC",

//           limitPrice:
//             requestedLimitPrice,

//           idempotencyKey,
//         });

//       /*
//        * Failed simulated order,
//        * for example insufficient
//        * holdings on SELL.
//        */

//       if (!result.success) {
//         return res.status(400).json(
//           result
//         );
//       }

//       /*
//        * Successful simulated order
//        */

//       return res.json({
//         success: true,

//         simulated:
//           true,

//         marketOpen:
//           true,

//         data:
//           result,
//       });
//     } catch (err) {
//       logger.error(
//         "Simulated order failed",
//         {
//           userId:
//             req.userId,

//           instrumentKey:
//             body.instrumentKey,

//           transactionType,

//           error:
//             errorMessage(err),
//         }
//       );

//       const status =
//         Number.isInteger(err?.httpStatus) &&
//         err.httpStatus >= 400 &&
//         err.httpStatus < 500
//           ? err.httpStatus
//           : 500;

//       return res.status(status).json({
//         success: false,
//         code: err?.code || "SIMULATED_ORDER_FAILED",
//         message:
//           err?.message ||
//           "Unable to complete simulated order",
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/market-stocks-count",
//   async (req, res) => {
//     try {
//       res.json({
//         success: true,

//         count:
//           env.mysqlEnabled
//             ? await getMarketStockCount()
//             : 0,
//       });
//     } catch (err) {
//       res.status(500).json({
//         success: false,
//         message:
//           errorMessage(err),
//       });
//     }
//   }
// );

// app.get(
//   "/api/detail-stock/status/:instrumentKey",
//   async (req, res) => {
//     const key =
//       req.params.instrumentKey;

//     res.json({
//       success: true,

//       instrumentKey:
//         key,

//       marketOpen:
//         isMarketOpen(),

//       subscriberCount:
//         subscribers.get(key)
//           ?.size || 0,

//       subscribed:
//         upstox
//           .getSubscribed()
//           .includes(key),

//       snapshot:
//         await getSnapshot(key),
//     });
//   }
// );

// /* =========================================================
//    PERSISTENCE & CRON
// ========================================================= */

// async function persistClosingPrices(
//   reason = "scheduled-settlement",
// ) {
//   if (!isTradingDay()) {
//     logger.info("EOD settlement skipped on non-trading day", {
//       date: indiaDate(),
//       reason,
//     });
//     return { total: 0, saved: 0, skipped: true };
//   }

//   if (!isAfterMarketClose()) {
//     logger.warn("EOD settlement skipped because market is still open", {
//       date: indiaDate(),
//       reason,
//     });
//     return { total: 0, saved: 0, skipped: true };
//   }

//   const tradingDate = indiaDate();
//   const result = await reconcileAllMarketStocks(
//     reason,
//     tradingDate,
//   );

//   if (
//     env.redisEnabled &&
//     result.total > 0 &&
//     result.saved >= result.total
//   ) {
//     try {
//       await redis.set(
//         `detailstock:close-reconciled:v3:${tradingDate}`,
//         "ok",
//         { EX: 3 * 24 * 60 * 60 },
//       );
//     } catch (err) {
//       logger.warn("EOD settlement marker write failed", {
//         date: tradingDate,
//         error: errorMessage(err),
//       });
//     }
//   }

//   return result;
// }

// const closeTask = cron.schedule(
//   closeCron,
//   () => {
//     persistClosingPrices("scheduled-settlement").catch((err) => {
//       logger.error("Scheduled EOD settlement failed", {
//         error: errorMessage(err),
//       });
//     });
//   },
//   { timezone: env.timezone },
// );

// const closeRetryTask = cron.schedule(
//   closeRetryCron,
//   () => {
//     persistClosingPrices("scheduled-settlement-retry").catch((err) => {
//       logger.error("Scheduled EOD settlement retry failed", {
//         error: errorMessage(err),
//       });
//     });
//   },
//   { timezone: env.timezone },
// );

// function getNextCronRun(task) {
//   try {
//     const next = task?.getNextRun?.();
//     return next instanceof Date
//       ? next.toISOString()
//       : String(next || "unknown");
//   } catch {
//     return "unknown";
//   }
// }

// logger.info("EOD settlement cron jobs registered", {
//   closeJobTime,
//   closeRetryTime,
//   timezone: env.timezone,
//   nextSettlementRun:
//     getNextCronRun(closeTask),
//   nextRetryRun:
//     getNextCronRun(closeRetryTask),
// });

// /* =========================================================
//    FINAL ERROR HANDLING
// ========================================================= */

// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     error: {
//       code: "ROUTE_NOT_FOUND",
//       message: "Route not found.",
//     },
//     requestId: req.requestId,
//   });
// });

// app.use(errorHandler);

// /* =========================================================
//    STARTUP & SHUTDOWN
// ========================================================= */

// async function startup() {
//   await connectMongoDB();

//   await connectRedis();

//   await initDb();

//   await reconcileOnStartup();

//   server.listen(
//     env.port,
//     "127.0.0.1",
//     () => {
//       logger.info(
//         "detail-stock server started",
//         {
//           port:
//             env.port,

//           nodeEnv:
//             env.nodeEnv,

//           marketOpen:
//             isMarketOpen(),

//           origins:
//             env.origins,

//           closeJobTime,

//           closeRetryTime,

//           closeCron,

//           closeRetryCron,

//           timezone:
//             env.timezone,
//         }
//       );
//     }
//   );
// }

// let shuttingDown =
//   false;

// async function shutdown(
//   signal
// ) {
//   if (shuttingDown) {
//     return;
//   }

//   shuttingDown =
//     true;

//   logger.info(
//     "Shutdown requested",
//     {
//       signal,
//     }
//   );

//   try {
//     for (
//       const key of
//         upstox.getSubscribed()
//     ) {
//       await upstox.unsubscribe(
//         key,
//         true
//       );
//     }
//   } catch {}

//   try {
//     io.close();
//   } catch {}

//   try {
//     server.close();
//   } catch {}

//   try {
//     await closeDb();
//   } catch {}

//   try {
//     if (
//       env.redisEnabled
//     ) {
//       await redis.quit();
//     }
//   } catch {}

//   process.exit(0);
// }

// process.on(
//   "SIGTERM",
//   () =>
//     shutdown("SIGTERM")
// );

// process.on(
//   "SIGINT",
//   () =>
//     shutdown("SIGINT")
// );

// process.on(
//   "uncaughtException",
//   (err) => {
//     logger.error(
//       "Uncaught exception",
//       {
//         error:
//           err.stack ||
//           err.message,
//       }
//     );
//   }
// );

// process.on(
//   "unhandledRejection",
//   (err) => {
//     logger.error(
//       "Unhandled rejection",
//       {
//         error:
//           err?.stack ||
//           String(err),
//       }
//     );
//   }
// );

// startup().catch(
//   (err) => {
//     logger.error(
//       "Startup failed",
//       {
//         error:
//           err.stack ||
//           err.message,
//       }
//     );

//     process.exit(1);
//   }
// );











































































require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cron = require("node-cron");
const { Server } = require("socket.io");
const { connectMongoDB } = require("../config/mongodb");

const env = require("./env");
const logger = require("./logger");
const { redis, connectRedis } = require("./redis");
const upstox = require("./upstox");
const { getStockFinancials } = upstox;

const { simulateOrder } = require("./simulatedOrderService");

const authenticateToken = require("../middleware/authenticateToken");
const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");
const { validateBodyObject } = require("../middleware/validateRequest");

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
  getIsinBySymbol,
} = require("./db");

const {
  isMarketOpen,
  isTradingDay,
  isAfterMarketClose,
  indiaDate,
  marketStatus,
} = require("./market");

const app = express();
const server = http.createServer(app);

/* =========================================================
   BASIC SERVER CONFIG
========================================================= */

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

const corsOptions = createCorsOptions({
  credentials: true,
  origins: env.origins,
});

const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6,
});

app.use(requestContext);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(compression());
app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "64kb",
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
      requestId: req.requestId,
    });
  },
});

app.use("/api/", apiLimiter);

/* =========================================================
   IN-MEMORY STATE
========================================================= */

const subscribers = new Map();
const snapshots = new Map();

const SNAP_PREFIX = "detailstock:snapshot:";
const HISTORY_PREFIX = "detailstock:history:v4:";
const FINAL_1D_PREFIX = "detailstock:finalized-1d:v1:";

const fundamentalsByIsin = new Map();
const fundamentalsInflight = new Map();

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

function validIdempotencyKey(key) {
  return (
    typeof key === "string" &&
    /^[A-Za-z0-9._:-]{16,128}$/.test(key.trim())
  );
}

function validIsin(isin) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
}

function snapshotKey(key) {
  return `${SNAP_PREFIX}${key}`;
}

function historyKey(
  key,
  unit,
  interval,
  from,
  to
) {
  return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ""}:${to}`;
}

function finalized1DKey(
  instrumentKey,
  tradingDate
) {
  return `${FINAL_1D_PREFIX}${instrumentKey}:${tradingDate}`;
}

function shiftIndiaDate(
  dateString,
  days
) {
  const value =
    new Date(
      `${dateString}T00:00:00Z`
    );

  value.setUTCDate(
    value.getUTCDate() +
      Number(days || 0)
  );

  return value
    .toISOString()
    .slice(0, 10);
}

function dateAtISTNoon(
  dateString
) {
  return new Date(
    `${dateString}T12:00:00+05:30`
  );
}

async function getFinalized1D(
  instrumentKey,
  tradingDate
) {
  if (!env.redisEnabled) {
    return null;
  }

  try {
    const raw =
      await redis.get(
        finalized1DKey(
          instrumentKey,
          tradingDate
        )
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    return Array.isArray(
      parsed?.candles
    )
      ? parsed
      : null;
  } catch (err) {
    logger.warn(
      "Finalized 1D cache read failed",
      {
        instrumentKey,
        tradingDate,
        error: errorMessage(err),
      }
    );

    return null;
  }
}

async function cacheFinalized1D(
  instrumentKey,
  tradingDate,
  payload
) {
  if (
    !env.redisEnabled ||
    !Array.isArray(
      payload?.candles
    ) ||
    !payload.candles.length
  ) {
    return;
  }

  await redis.set(
    finalized1DKey(
      instrumentKey,
      tradingDate
    ),
    JSON.stringify(payload),
    {
      EX:
        3 *
        24 *
        60 *
        60,
    }
  );
}

function isinFromInstrumentKey(
  key
) {
  const candidate =
    String(key || "")
      .split("|")[1] || "";

  return validIsin(candidate)
    ? candidate
    : null;
}

function errorMessage(err) {
  return (
    err?.response?.data?.errors?.[0]
      ?.message ||
    err?.response?.data?.message ||
    err?.response?.data ||
    err?.message ||
    "Unexpected error"
  );
}

/* =========================================================
   CRON HELPERS
========================================================= */

function timeToWeekdayCron(
  value,
  fallback
) {
  const raw =
    String(
      value ||
        fallback ||
        ""
    ).trim();

  const match =
    raw.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (!match) {
    throw new Error(
      `Invalid cron time "${raw}". Expected HH:MM, for example 15:35`
    );
  }

  const hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

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

function getCronTimeFromEnv(
  key,
  fallback
) {
  const value =
    process.env[key];

  if (value) {
    return value;
  }

  if (
    key ===
      "CLOSE_JOB_TIME" &&
    env.closeJobTime
  ) {
    return env.closeJobTime;
  }

  if (
    key ===
      "CLOSE_RETRY_TIME" &&
    env.closeRetryTime
  ) {
    return env.closeRetryTime;
  }

  return fallback;
}

const closeJobTime =
  getCronTimeFromEnv(
    "CLOSE_JOB_TIME",
    "15:45"
  );

const closeRetryTime =
  getCronTimeFromEnv(
    "CLOSE_RETRY_TIME",
    "15:50"
  );

const closeCron =
  timeToWeekdayCron(
    closeJobTime,
    "15:45"
  );

const closeRetryCron =
  timeToWeekdayCron(
    closeRetryTime,
    "15:50"
  );

logger.info(
  "Cron configuration loaded",
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
   SNAPSHOT CACHE
========================================================= */

async function cacheSnapshot(
  snapshot
) {
  if (
    !snapshot?.instrumentKey
  ) {
    return;
  }

  snapshots.set(
    snapshot.instrumentKey,
    snapshot
  );

  if (env.redisEnabled) {
    await redis.set(
      snapshotKey(
        snapshot.instrumentKey
      ),
      JSON.stringify(snapshot),
      {
        EX:
          env.snapshotCacheSeconds,
      }
    );
  }
}

async function getSnapshot(
  key
) {
  if (snapshots.has(key)) {
    return snapshots.get(key);
  }

  if (!env.redisEnabled) {
    return null;
  }

  const raw =
    await redis.get(
      snapshotKey(key)
    );

  if (!raw) {
    return null;
  }

  try {
    const value =
      JSON.parse(raw);

    snapshots.set(
      key,
      value
    );

    return value;
  } catch {
    return null;
  }
}

/* =========================================================
   PREVIOUS CLOSE FALLBACK
========================================================= */

async function enrichWithStoredPreviousClose(
  snapshot
) {
  if (!snapshot) {
    return snapshot;
  }

  try {
    const previous =
      await getPreviousStoredClose(
        snapshot.instrumentKey,
        indiaDate()
      );

    if (
      previous?.close != null
    ) {
      const close =
        Number(
          previous.close
        );

      const price =
        Number(
          snapshot.price
        );

      if (
        Number.isFinite(close) &&
        close > 0
      ) {
        snapshot.previousClose =
          close;

        if (
          Number.isFinite(price)
        ) {
          snapshot.change =
            price - close;

          snapshot.changePercent =
            ((price - close) /
              close) *
            100;
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
        instrumentKey:
          snapshot.instrumentKey,
        error:
          err.message,
      }
    );
  }

  return snapshot;
}

/* =========================================================
   INSTRUMENT CONTEXT
========================================================= */

async function getInstrumentContext(
  instrumentKey
) {
  const marketRow =
    await getMarketStockByInstrumentKey(
      instrumentKey
    );

  const master =
    await getInstrumentMaster(
      instrumentKey
    );

  if (
    !marketRow &&
    !master
  ) {
    return null;
  }

  const isin =
    master?.isin ||
    isinFromInstrumentKey(
      instrumentKey
    );

  let bse = null;

  if (isin) {
    bse =
      await getBseInstrumentByIsin(
        isin
      );
  }

  return {
    marketRow,
    master,
    bse,
    isin,

    symbol:
      master?.tradingSymbol ||
      marketRow?.symbol ||
      null,

    name:
      master?.name ||
      marketRow?.name ||
      null,

    exchange:
      master?.exchange ||
      marketRow?.master_exchange ||
      "NSE",

    segment:
      master?.segment ||
      marketRow?.master_segment ||
      null,

    tradingSymbol:
      master?.tradingSymbol ||
      marketRow?.symbol ||
      null,

    isin: isin,

    bseInstrumentKey:
      bse?.instrumentKey ||
      null,
  };
}

/* =========================================================
   THE REST OF THE FILE
========================================================= */


/* =========================================================
   PRIME SNAPSHOT
========================================================= */

async function primeSnapshot(
  instrumentKey
) {
  const context =
    await getInstrumentContext(
      instrumentKey
    );

  const today =
    indiaDate();

  const marketOpen =
    isMarketOpen();

  const existing =
    await getSnapshot(
      instrumentKey
    );

  const existingIsFresh =
    existing?.marketDate ===
      today &&
    (
      marketOpen
        ? existing?.marketStatus !==
          "CLOSED"
        : existing?.marketStatus ===
            "CLOSED" &&
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

  snapshot.marketDate =
    today;

  snapshot.marketOpen =
    marketOpen;

  snapshot.marketStatus =
    marketOpen
      ? "OPEN"
      : "CLOSED";

  await enrichWithStoredPreviousClose(
    snapshot
  );

  await cacheSnapshot(
    snapshot
  );

  return snapshot;
}

/* =========================================================
   FUNDAMENTALS CACHE
========================================================= */

async function getFundamentalsCached(
  isin
) {
  const cached =
    fundamentalsByIsin.get(
      isin
    );

  if (
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.data;
  }

  const inflight =
    fundamentalsInflight.get(
      isin
    );

  if (inflight) {
    return inflight;
  }

  const fetchPromise =
    (async () => {
      try {
        const data =
          await upstox.getFundamentals(
            isin
          );

        fundamentalsByIsin.set(
          isin,
          {
            data,
            expiresAt:
              Date.now() +
              FUNDAMENTALS_TTL,
          }
        );

        return data;
      } catch (err) {
        logger.error(
          "getFundamentalsCached upstream fetch failed",
          {
            isin,
            error:
              err?.message,
          }
        );

        throw err;
      } finally {
        fundamentalsInflight.delete(
          isin
        );
      }
    })();

  fundamentalsInflight.set(
    isin,
    fetchPromise
  );

  return fetchPromise;
}

/* =========================================================
   MARKET DATE HELPERS
========================================================= */

function previousTradingDate(
  date = new Date()
) {
  let candidate =
    shiftIndiaDate(
      indiaDate(date),
      -1
    );

  while (
    !isTradingDay(
      dateAtISTNoon(
        candidate
      )
    )
  ) {
    candidate =
      shiftIndiaDate(
        candidate,
        -1
      );
  }

  return candidate;
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

  return previousTradingDate(
    date
  );
}

/* =========================================================
   OFFICIAL INTRADAY SETTLEMENT
========================================================= */

async function resolvePreviousClose(
  instrumentKey,
  beforeDate
) {
  if (!beforeDate) {
    return null;
  }

  /*
   * Upstox daily history is the source of truth for a historical range
   * baseline. The daily-close table is a useful fallback, but it can contain
   * older rows written by previous versions of the application. Trusting
   * those rows first can produce a visibly wrong 1W/1M/etc return.
   *
   * We deliberately fetch a small window ending before `beforeDate`, then
   * select the latest actual trading session. This also handles weekends and
   * exchange holidays without assuming that `beforeDate - 1` traded.
   */

  const fetchTo =
    shiftIndiaDate(
      beforeDate,
      -1
    );

  const fetchFrom =
    shiftIndiaDate(
      beforeDate,
      -10
    );

  try {
    const candles =
      await upstox.fetchHistory(
        instrumentKey,
        "days",
        "1",
        fetchTo,
        fetchFrom
      );

    const candidates =
      (
        Array.isArray(candles)
          ? candles
          : []
      )
        .filter(
          (candle) => {
            const timestamp =
              Date.parse(
                candle?.timestamp
              );

            return (
              Number.isFinite(
                timestamp
              ) &&
              indiaDate(
                new Date(timestamp)
              ) <
                beforeDate &&
              Number(
                candle?.close
              ) > 0
            );
          }
        )
        .sort(
          (a, b) =>
            Date.parse(
              a.timestamp
            ) -
            Date.parse(
              b.timestamp
            )
        );

    const last =
      candidates[
        candidates.length - 1
      ];

    if (last) {
      return {
        close:
          Number(
            last.close
          ),

        tradingDate:
          indiaDate(
            new Date(
              last.timestamp
            )
          ),

        source:
          "upstox-daily-history",
      };
    }
  } catch (err) {
    logger.warn(
      "Upstox prior close lookup failed",
      {
        instrumentKey,
        beforeDate,
        error:
          errorMessage(err),
      }
    );
  }

  /*
   * Only use persisted data if the authoritative
   * Upstox lookup fails.
   */

  {
    try {
      const stored =
        await getPreviousStoredClose(
          instrumentKey,
          beforeDate
        );

      const close =
        Number(
          stored?.close
        );

      if (
        Number.isFinite(close) &&
        close > 0
      ) {
        return {
          close,

          tradingDate:
            stored.trading_date,

          source:
            "database-fallback",
        };
      }
    } catch (err) {
      logger.warn(
        "Stored prior close fallback failed",
        {
          instrumentKey,
          beforeDate,
          error:
            errorMessage(err),
        }
      );
    }
  }

  return null;
}

function filterTradingSession(
  candles,
  tradingDate
) {
  return (
    Array.isArray(candles)
      ? candles
      : []
  )
    .filter(
      (candle) => {
        const timestamp =
          Date.parse(
            candle?.timestamp
          );

        if (
          !Number.isFinite(
            timestamp
          )
        ) {
          return false;
        }

        const parts =
          new Intl.DateTimeFormat(
            "en-GB",
            {
              timeZone:
                "Asia/Kolkata",

              hour:
                "2-digit",

              minute:
                "2-digit",

              second:
                "2-digit",

              hourCycle:
                "h23",
            }
          ).formatToParts(
            new Date(
              timestamp
            )
          );

        const values =
          Object.fromEntries(
            parts.map(
              (part) => [
                part.type,
                part.value,
              ]
            )
          );

        const minutes =
          Number(
            values.hour || 0
          ) *
            60 +
          Number(
            values.minute || 0
          ) +
          Number(
            values.second || 0
          ) /
            60;

        return (
          indiaDate(
            new Date(
              timestamp
            )
          ) ===
            tradingDate &&
          minutes >=
            9 * 60 + 15 &&
          minutes <=
            15 * 60 + 30
        );
      }
    )
    .sort(
      (a, b) =>
        Date.parse(
          a.timestamp
        ) -
        Date.parse(
          b.timestamp
        )
    );
}

/* =========================================================
   BUILD OFFICIAL CLOSE SNAPSHOT
========================================================= */

async function buildOfficialCloseSnapshot(
  instrumentKey,
  tradingDate
) {
  const context =
    await getInstrumentContext(
      instrumentKey
    );

  if (!context) {
    return null;
  }

  let candles = [];

  try {
    candles =
      await upstox.fetchHistory(
        instrumentKey,
        "days",
        "1",
        tradingDate,
        tradingDate
      );
  } catch (err) {
    logger.warn(
      "Unable to fetch official daily candle",
      {
        instrumentKey,
        tradingDate,
        error:
          errorMessage(err),
      }
    );
  }

  let sessionCandles =
    filterTradingSession(
      candles,
      tradingDate
    );

  /*
   * If the daily endpoint does not return a candle for the exact
   * requested date, fetch a slightly wider range and select the
   * latest candle belonging to that session.
   */

  if (
    !sessionCandles.length
  ) {
    try {
      const fallbackFrom =
        shiftIndiaDate(
          tradingDate,
          -5
        );

      const fallbackCandles =
        await upstox.fetchHistory(
          instrumentKey,
          "days",
          "1",
          tradingDate,
          fallbackFrom
        );

      sessionCandles =
        filterTradingSession(
          fallbackCandles,
          tradingDate
        );
    } catch (err) {
      logger.warn(
        "Official close fallback history failed",
        {
          instrumentKey,
          tradingDate,
          error:
            errorMessage(err),
        }
      );
    }
  }

  const candle =
    sessionCandles[
      sessionCandles.length - 1
    ];

  if (!candle) {
    return null;
  }

  const open =
    Number(candle.open);

  const high =
    Number(candle.high);

  const low =
    Number(candle.low);

  const close =
    Number(candle.close);

  const volume =
    Number(candle.volume || 0);

  if (
    !Number.isFinite(close) ||
    close <= 0
  ) {
    return null;
  }

  const previous =
    await resolvePreviousClose(
      instrumentKey,
      tradingDate
    );

  const previousClose =
    Number(
      previous?.close
    );

  let change = 0;
  let changePercent = 0;

  if (
    Number.isFinite(
      previousClose
    ) &&
    previousClose > 0
  ) {
    change =
      Number(
        (
          close -
          previousClose
        ).toFixed(2)
      );

    changePercent =
      Number(
        (
          (change /
            previousClose) *
          100
        ).toFixed(2)
      );
  }

  return {
    instrumentKey,

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
      context.marketRow?.sector ||
      null,

    price:
      close,

    open,
    high,
    low,

    volume,

    previousClose:
      Number.isFinite(
        previousClose
      )
        ? previousClose
        : null,

    previousCloseDate:
      previous?.tradingDate ||
      null,

    change,
    changePercent,

    marketDate:
      tradingDate,

    marketOpen:
      false,

    marketStatus:
      "CLOSED",

    source:
      "upstox-close-reconciliation",

    updatedAt:
      new Date().toISOString(),
  };
}

/* =========================================================
   SAVE OFFICIAL DAILY CLOSE
========================================================= */

async function reconcileInstrument(
  instrumentKey,
  tradingDate
) {
  const snapshot =
    await buildOfficialCloseSnapshot(
      instrumentKey,
      tradingDate
    );

  if (!snapshot) {
    return {
      success: false,
      instrumentKey,
      tradingDate,
      reason:
        "No official close candle available",
    };
  }

  await saveDailyClose(
    snapshot
  );

  await cacheSnapshot(
    snapshot
  );

  await cacheFinalized1D(
    instrumentKey,
    tradingDate,
    {
      instrumentKey,
      tradingDate,
      candles: [
        {
          timestamp:
            `${tradingDate}T15:30:00+05:30`,

          open:
            snapshot.open,

          high:
            snapshot.high,

          low:
            snapshot.low,

          close:
            snapshot.price,

          volume:
            snapshot.volume,
        },
      ],
    }
  );

  return {
    success: true,
    instrumentKey,
    tradingDate,
    snapshot,
  };
}

/* =========================================================
   RECONCILE ALL MARKET STOCKS
========================================================= */

let reconciliationRunning =
  false;

async function reconcileAllMarketStocks(
  options = {}
) {
  if (reconciliationRunning) {
    logger.warn(
      "Market reconciliation already running"
    );

    return {
      success: false,
      skipped: true,
      reason:
        "reconciliation-already-running",
    };
  }

  reconciliationRunning =
    true;

  const tradingDate =
    options.tradingDate ||
    latestCompletedTradingDate();

  try {
    const rows =
      await getMarketStockInstruments();

    if (!rows.length) {
      logger.warn(
        "No market stocks available for reconciliation"
      );

      return {
        success: false,
        tradingDate,
        total: 0,
        processed: 0,
        failed: 0,
      };
    }

    logger.info(
      "Starting market close reconciliation",
      {
        tradingDate,
        total:
          rows.length,
      }
    );

    let processed = 0;
    let failed = 0;

    for (
      const row of rows
    ) {
      try {
        const result =
          await reconcileInstrument(
            row.instrument_key,
            tradingDate
          );

        if (
          result.success
        ) {
          processed += 1;
        } else {
          failed += 1;
        }
      } catch (err) {
        failed += 1;

        logger.warn(
          "Instrument reconciliation failed",
          {
            instrumentKey:
              row.instrument_key,

            tradingDate,

            error:
              errorMessage(err),
          }
        );
      }

      /*
       * Avoid overwhelming the provider with thousands of requests.
       */

      if (
        processed % 25 ===
          0 ||
        failed % 25 ===
          0
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              50
            )
        );
      }
    }

    logger.info(
      "Market close reconciliation completed",
      {
        tradingDate,
        total:
          rows.length,
        processed,
        failed,
      }
    );

    return {
      success:
        failed === 0,
      tradingDate,
      total:
        rows.length,
      processed,
      failed,
    };
  } finally {
    reconciliationRunning =
      false;
  }
}

                context.exchange,

              segment:
                context.segment,

              isin:
                context.isin,

              bseInstrumentKey:
                context.bse?.instrumentKey ||
                null,
            };
          }

          ack({
            success: true,
            snapshot,
          });

          socket.emit(
            "detailStock:snapshot",
            snapshot
          );
        } catch (err) {
          logger.error(
            "Socket subscribe failed",
            {
              instrumentKey: key,
              error:
                errorMessage(err),
            }
          );

          ack({
            success: false,
            message:
              "Unable to subscribe to instrument",
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
            message:
              "Valid instrumentKey is required",
          });
        }

        try {
          socket.leave(
            `stock:${key}`
          );

          const set =
            subscribers.get(key);

          if (set) {
            set.delete(
              socket.id
            );

            if (
              set.size === 0
            ) {
              subscribers.delete(
                key
              );

              try {
                await upstox.unsubscribe(
                  key
                );
              } catch (err) {
                logger.warn(
                  "Upstox unsubscribe failed",
                  {
                    instrumentKey:
                      key,

                    error:
                      errorMessage(err),
                  }
                );
              }
            }
          }

          ack({
            success: true,
          });
        } catch (err) {
          logger.warn(
            "Socket unsubscribe failed",
            {
              instrumentKey: key,
              error:
                errorMessage(err),
            }
          );

          ack({
            success: false,
            message:
              "Unable to unsubscribe",
          });
        }
      }
    );

    socket.on(
      "disconnect",
      async () => {
        for (
          const [
            key,
            set,
          ] of subscribers
        ) {
          if (
            !set.has(
              socket.id
            )
          ) {
            continue;
          }

          set.delete(
            socket.id
          );

          if (
            set.size === 0
          ) {
            subscribers.delete(
              key
            );

            try {
              await upstox.unsubscribe(
                key
              );
            } catch (err) {
              logger.warn(
                "Upstox unsubscribe after disconnect failed",
                {
                  instrumentKey:
                    key,

                  error:
                    errorMessage(err),
                }
              );
            }
          }
        }
      }
    );
  }
);

/* =========================================================
   ROOT / HEALTH
========================================================= */

app.get(
  "/",
  (req, res) => {
    return res.json({
      success: true,

      service:
        "detail-stock",

      database:
        "mongodb",

      status:
        "running",

      market:
        marketStatus(),

      endpoints: {
        health:
          "/health",

        readiness:
          "/ready",

        stock:
          "/api/detail-stock/:instrumentKey",

        history:
          "/api/detail-stock/history/:instrumentKey",

        marketStocks:
          "/api/detail-stock/market-stocks",

        marketStocksCount:
          "/api/detail-stock/market-stocks-count",

        fundamentals:
          "/api/detail-stock/:instrumentKey/fundamentals",

        order:
          "/api/detail-stock/order",
      },
    });
  }
);

app.get(
  "/health",
  async (req, res) => {
    let mongo =
      false;

    let redisStatus =
      false;

    try {
      const db =
        await require("../config/mongodb")
          .getMongoDB();

      await db.command({
        ping: 1,
      });

      mongo = true;
    } catch (err) {
      logger.warn(
        "Mongo health check failed",
        {
          error:
            err.message,
        }
      );
    }

    if (env.redisEnabled) {
      try {
        redisStatus =
          Boolean(
            redis &&
              redis.isReady
          );
      } catch {
        redisStatus =
          false;
      }
    }

    const healthy =
      mongo &&
      (
        !env.redisEnabled ||
        redisStatus
      );

    return res
      .status(
        healthy
          ? 200
          : 503
      )
      .json({
        success:
          healthy,

        status:
          healthy
            ? "ok"
            : "degraded",

        database:
          "mongodb",

        mongo,

        redis:
          env.redisEnabled
            ? redisStatus
            : "disabled",

        market:
          marketStatus(),

        time:
          new Date().toISOString(),

        requestId:
          req.requestId,
      });
  }
);

app.get(
  "/ready",
  async (req, res) => {
    try {
      const {
        getMongoDB,
      } =
        require("../config/mongodb");

      const db =
        await getMongoDB();

      await db.command({
        ping: 1,
      });

      return res.json({
        success: true,
        ready: true,
        database:
          "mongodb",
        requestId:
          req.requestId,
      });
    } catch (err) {
      return res
        .status(503)
        .json({
          success: false,
          ready: false,
          database:
            "mongodb",
          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   MARKET STATUS
========================================================= */

app.get(
  "/api/detail-stock/market-status",
  (req, res) => {
    return res.json({
      success: true,

      status:
        marketStatus(),

      isOpen:
        isMarketOpen(),

      isTradingDay:
        isTradingDay(),

      date:
        indiaDate(),

      requestId:
        req.requestId,
    });
  }
);

/* =========================================================
   MARKET STOCKS
========================================================= */

app.get(
  "/api/detail-stock/market-stocks",
  async (req, res) => {
    try {
      const rows =
        await getMarketStockInstruments();

      const results =
        rows.map(
          (stock) => ({
            id:
              stock.id,

            instrument_key:
              stock.instrument_key,

            symbol:
              stock.symbol,

            name:
              stock.name,

            price:
              Number(
                stock.price || 0
              ),

            change_value:
              Number(
                stock.change_value ||
                  0
              ),

            change_percent:
              Number(
                stock.change_percent ||
                  0
              ),

            open_price:
              Number(
                stock.open_price ||
                  0
              ),

            previous_close:
              Number(
                stock.previous_close ||
                  0
              ),

            day_high:
              Number(
                stock.day_high ||
                  0
              ),

            day_low:
              Number(
                stock.day_low ||
                  0
              ),

            volume:
              Number(
                stock.volume ||
                  0
              ),

            updated_at:
              stock.updated_at,

            sector:
              stock.sector,

            instrumentKey:
              stock.instrument_key,

            tradingSymbol:
              stock.symbol,

            exchange:
              stock.master_exchange,

            segment:
              stock.master_segment,

            isin:
              stock.master_isin,

            lastTradeTime:
              stock.last_trade_time,

            marketStatus:
              stock.market_status,

            dayClose:
              stock.day_close,
          })
        );

      return res.json({
        success: true,

        count:
          results.length,

        results,

        market:
          marketStatus(),

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Market stocks endpoint failed",
        {
          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "MARKET_STOCKS_FAILED",

            message:
              "Unable to load market stocks.",
          },

          requestId:
            req.requestId,
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
      const count =
        await getMarketStockCount();

      return res.json({
        success: true,

        count:

          Number(count || 0),

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Market stock count failed",
        {
          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "MARKET_STOCK_COUNT_FAILED",

            message:
              "Unable to load market stock count.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   STOCK SEARCH
========================================================= */

app.get(
  "/api/detail-stock/search",
  async (req, res) => {
    try {
      const q =
        String(
          req.query.q || ""
        )
          .trim()
          .toLowerCase();

      if (!q) {
        return res.json({
          success: true,

          query: "",

          count: 0,

          results: [],

          requestId:
            req.requestId,
        });
      }

      const rows =
        await getMarketStockInstruments();

      const matches =
        rows
          .filter(
            (stock) => {
              const symbol =
                String(
                  stock.symbol ||
                    ""
                ).toLowerCase();

              const name =
                String(
                  stock.name ||
                    ""
                ).toLowerCase();

              const key =
                String(
                  stock.instrument_key ||
                    ""
                ).toLowerCase();

              return (
                symbol.includes(q) ||
                name.includes(q) ||
                key.includes(q)
              );
            }
          )
          .sort(
            (a, b) => {
              const aSymbol =
                String(
                  a.symbol || ""
                ).toLowerCase();

              const bSymbol =
                String(
                  b.symbol || ""
                ).toLowerCase();

              const aName =
                String(
                  a.name || ""
                ).toLowerCase();

              const bName =
                String(
                  b.name || ""
                ).toLowerCase();

              const aRank =
                aSymbol === q
                  ? 0
                  : aSymbol.startsWith(
                        q
                      )
                    ? 1
                    : aName.startsWith(
                          q
                        )
                      ? 2
                      : 3;

              const bRank =
                bSymbol === q
                  ? 0
                  : bSymbol.startsWith(
                        q
                      )
                    ? 1
                    : bName.startsWith(
                          q
                        )
                      ? 2
                      : 3;

              if (
                aRank !==
                bRank
              ) {
                return (
                  aRank -
                  bRank
                );
              }

              return aName.localeCompare(
                bName
              );
            }
          )
          .slice(0, 10);

      return res.json({
        success: true,

        query: q,

        count:
          matches.length,

        results:
          matches.map(
            (stock) => ({
              id:
                stock.id,

              instrument_key:
                stock.instrument_key,

              symbol:
                stock.symbol,

              name:
                stock.name,

              price:
                Number(
                  stock.price ||
                    0
                ),

              change_value:
                Number(
                  stock.change_value ||
                    0
                ),

              change_percent:
                Number(
                  stock.change_percent ||
                    0
                ),

              open_price:
                Number(
                  stock.open_price ||
                    0
                ),

              previous_close:
                Number(
                  stock.previous_close ||
                    0
                ),

              day_high:
                Number(
                  stock.day_high ||
                    0
                ),

              day_low:
                Number(
                  stock.day_low ||
                    0
                ),

              volume:
                Number(
                  stock.volume ||
                    0
                ),

              sector:
                stock.sector,

              exchange:
                stock.master_exchange,

              segment:
                stock.master_segment,

              isin:
                stock.master_isin,
            })
          ),

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Detail stock search failed",
        {
          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "SEARCH_FAILED",

            message:
              "Search failed.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);


/* =========================================================
   UPSTOX LIVE TICK HANDLER
========================================================= */

upstox.setTickHandler(
  async (tick) => {
    try {
      /*
       * Ignore late/out-of-order packets after the exchange
       * has closed. Finalized historical data owns the 1D
       * chart after close.
       */
      if (
        !isTradingDay() ||
        !isMarketOpen()
      ) {
        return;
      }

      if (
        !tick?.instrumentKey
      ) {
        return;
      }

      const previous =
        snapshots.get(
          tick.instrumentKey
        ) || {};

      const snapshot = {
        ...previous,
        ...tick,

        instrumentKey:
          tick.instrumentKey,

        updatedAt:
          new Date().toISOString(),

        marketDate:
          indiaDate(),

        marketOpen:
          true,

        marketStatus:
          "OPEN",

        source:
          "upstox-live",
      };

      /*
       * Preserve master-data fields when the live tick
       * does not contain them.
       */
      if (
        !snapshot.symbol ||
        !snapshot.name ||
        !snapshot.isin
      ) {
        try {
          const context =
            await getInstrumentContext(
              tick.instrumentKey
            );

          if (context) {
            snapshot.symbol =
              snapshot.symbol ||
              context.symbol;

            snapshot.name =
              snapshot.name ||
              context.name;

            snapshot.exchange =
              snapshot.exchange ||
              context.exchange;

            snapshot.segment =
              snapshot.segment ||
              context.segment;

            snapshot.isin =
              snapshot.isin ||
              context.isin;

            snapshot.sector =
              snapshot.sector ||
              context.marketRow?.sector ||
              null;
          }
        } catch (err) {
          logger.warn(
            "Unable to enrich live tick",
            {
              instrumentKey:
                tick.instrumentKey,

              error:
                errorMessage(err),
            }
          );
        }
      }

      /*
       * If the provider gives a previous close,
       * calculate change directly.
       */
      const price =
        Number(
          snapshot.price ??
            snapshot.lastPrice
        );

      const previousClose =
        Number(
          snapshot.previousClose
        );

      if (
        Number.isFinite(price) &&
        Number.isFinite(
          previousClose
        ) &&
        previousClose > 0
      ) {
        snapshot.change =
          Number(
            (
              price -
              previousClose
            ).toFixed(2)
          );

        snapshot.changePercent =
          Number(
            (
              (snapshot.change /
                previousClose) *
              100
            ).toFixed(2)
          );
      }

      snapshots.set(
        tick.instrumentKey,
        snapshot
      );

      /*
       * Redis is best-effort. A Redis failure must never
       * break the live market stream.
       */
      try {
        await cacheSnapshot(
          snapshot
        );
      } catch (err) {
        logger.warn(
          "Live snapshot cache update failed",
          {
            instrumentKey:
              tick.instrumentKey,

            error:
              errorMessage(err),
          }
        );
      }

      /*
       * Broadcast to all Socket.IO clients subscribed
       * to this instrument.
       */
      io.to(
        `stock:${tick.instrumentKey}`
      ).emit(
        "detailStock:tick",
        snapshot
      );
    } catch (err) {
      logger.error(
        "Live tick handler failed",
        {
          instrumentKey:
            tick?.instrumentKey,

          error:
            errorMessage(err),
        }
      );
    }
  }
);

/* =========================================================
   SINGLE STOCK SNAPSHOT
========================================================= */

app.get(
  "/api/detail-stock/:instrumentKey",
  async (req, res) => {
    const instrumentKey =
      String(
        req.params.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(instrumentKey)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const snapshot =
        await primeSnapshot(
          instrumentKey
        );

      if (!snapshot) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "INSTRUMENT_NOT_FOUND",

              message:
                "Instrument not found.",
            },

            requestId:
              req.requestId,
          });
      }

      return res.json({
        success: true,

        data:
          snapshot,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Detail stock snapshot failed",
        {
          instrumentKey,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "DETAIL_STOCK_FAILED",

            message:
              "Unable to load stock details.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   INSTRUMENT CONTEXT
========================================================= */

app.get(
  "/api/detail-stock/:instrumentKey/context",
  async (req, res) => {
    const instrumentKey =
      String(
        req.params.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(instrumentKey)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const context =
        await getInstrumentContext(
          instrumentKey
        );

      if (!context) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "INSTRUMENT_NOT_FOUND",

              message:
                "Instrument not found.",
            },

            requestId:
              req.requestId,
          });
      }

      return res.json({
        success: true,

        data: {
          instrumentKey,

          symbol:
            context.symbol,

          tradingSymbol:
            context.tradingSymbol,

          name:
            context.name,

          exchange:
            context.exchange,

          segment:
            context.segment,

          isin:
            context.isin,

          bseInstrumentKey:
            context.bseInstrumentKey,

          sector:
            context.marketRow?.sector ||
            null,
        },

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Instrument context lookup failed",
        {
          instrumentKey,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "INSTRUMENT_CONTEXT_FAILED",

            message:
              "Unable to load instrument context.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   FUNDAMENTALS
========================================================= */

app.get(
  "/api/detail-stock/:instrumentKey/fundamentals",
  async (req, res) => {
    const instrumentKey =
      String(
        req.params.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(instrumentKey)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const context =
        await getInstrumentContext(
          instrumentKey
        );

      if (!context) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "INSTRUMENT_NOT_FOUND",

              message:
                "Instrument not found.",
            },

            requestId:
              req.requestId,
          });
      }

      const isin =
        context.isin;

      if (
        !validIsin(isin)
      ) {
        return res.json({
          success: true,

          data: null,

          message:
            "No valid ISIN is available for this instrument.",

          requestId:
            req.requestId,
        });
      }

      const data =
        await getFundamentalsCached(
          isin
        );

      return res.json({
        success: true,

        instrumentKey,

        isin,

        data,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Fundamentals endpoint failed",
        {
          instrumentKey,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(502)
        .json({
          success: false,

          error: {
            code:
              "FUNDAMENTALS_UNAVAILABLE",

            message:
              "Unable to load fundamentals.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   FINANCIAL DATA
========================================================= */

app.get(
  "/api/detail-stock/:instrumentKey/financials",
  async (req, res) => {
    const instrumentKey =
      String(
        req.params.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(instrumentKey)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const context =
        await getInstrumentContext(
          instrumentKey
        );

      if (!context) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "INSTRUMENT_NOT_FOUND",

              message:
                "Instrument not found.",
            },

            requestId:
              req.requestId,
          });
      }

      if (
        !validIsin(
          context.isin
        )
      ) {
        return res.json({
          success: true,

          data: null,

          requestId:
            req.requestId,
        });
      }

      const data =
        await getStockFinancials(
          context.isin
        );

      return res.json({
        success: true,

        instrumentKey,

        isin:
          context.isin,

        data,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Financial data endpoint failed",
        {
          instrumentKey,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(502)
        .json({
          success: false,

          error: {
            code:
              "FINANCIALS_UNAVAILABLE",

            message:
              "Unable to load financial data.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   HISTORICAL DATA HELPERS
========================================================= */

function normalizeHistoryCandle(
  candle
) {
  if (!candle) {
    return null;
  }

  const timestamp =
    candle.timestamp;

  const open =
    Number(candle.open);

  const high =
    Number(candle.high);

  const low =
    Number(candle.low);

  const close =
    Number(candle.close);

  const volume =
    Number(
      candle.volume || 0
    );

  if (
    !timestamp ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close)
  ) {
    return null;
  }

  return {
    timestamp,

    open,
    high,
    low,
    close,

    volume:
      Number.isFinite(
        volume
      )
        ? volume
        : 0,
  };
}

function normalizeHistoryResponse(
  candles
) {
  return (
    Array.isArray(candles)
      ? candles
      : []
  )
    .map(
      normalizeHistoryCandle
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        Date.parse(
          a.timestamp
        ) -
        Date.parse(
          b.timestamp
        )
    );
}

function historyRange(
  unit,
  value
) {
  const amount =
    Math.max(
      1,
      Number(value) || 1
    );

  switch (
    String(
      unit || ""
    ).toLowerCase()
  ) {
    case "day":
    case "days":
      return {
        days:
          amount,
        unit:
          "days",
      };

    case "week":
    case "weeks":
      return {
        days:
          amount * 7,
        unit:
          "weeks",
      };

    case "month":
    case "months":
      return {
        days:
          amount * 30,
        unit:
          "months",
      };

    case "year":
    case "years":
      return {
        days:
          amount * 365,
        unit:
          "years",
      };

    default:
      return {
        days:
          amount,
        unit:
          "days",
      };
  }
}

/* =========================================================
   HISTORICAL DATA
========================================================= */

app.get(
  "/api/detail-stock/history/:instrumentKey",
  async (req, res) => {
    const instrumentKey =
      String(
        req.params.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(instrumentKey)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    const unit =
      String(
        req.query.unit ||
          "days"
      ).toLowerCase();

    const amount =
      Math.max(
        1,
        Number(
          req.query.value ||
            req.query.range ||
            1
        )
      );

    const interval =
      String(
        req.query.interval ||
          "1"
      );

    const requestedTo =
      req.query.to
        ? String(
            req.query.to
          )
        : indiaDate();

    const requestedFrom =
      req.query.from
        ? String(
            req.query.from
          )
        : null;

    try {
      /*
       * -----------------------------------------------------
       * 1D
       * -----------------------------------------------------
       *
       * The 1D chart after market close must use the
       * finalized official daily close.
       */

      if (
        unit === "day" &&
        amount === 1
      ) {
        const tradingDate =
          requestedTo;

        const finalized =
          await getFinalized1D(
            instrumentKey,
            tradingDate
          );

        if (
          finalized?.candles?.length
        ) {
          return res.json({
            success: true,

            instrumentKey,

            unit,

            interval,

            from:
              tradingDate,

            to:
              tradingDate,

            candles:
              finalized.candles,

            source:
              "finalized-cache",

            requestId:
              req.requestId,
          });
        }

        /*
         * During market hours use live/intraday history.
         */

        if (
          isMarketOpen() &&
          tradingDate ===
            indiaDate()
        ) {
          try {
            const candles =
              await upstox.fetchHistory(
                instrumentKey,
                "days",
                interval,
                tradingDate,
                tradingDate
              );

            const normalized =
              normalizeHistoryResponse(
                candles
              );

            if (
              normalized.length
            ) {
              return res.json({
                success: true,

                instrumentKey,

                unit,

                interval,

                from:
                  tradingDate,

                to:
                  tradingDate,

                candles:
                  normalized,

                source:
                  "upstox-live",

                requestId:
                  req.requestId,
              });
            }
          } catch (err) {
            logger.warn(
              "Live 1D history failed",
              {
                instrumentKey,

                error:
                  errorMessage(err),
              }
            );
          }
        }

        /*
         * Fall back to the persisted daily close.
         */

        const dbHistory =
          await getDbHistory(
            instrumentKey,
            tradingDate,
            tradingDate
          );

        if (
          dbHistory?.length
        ) {
          return res.json({
            success: true,

            instrumentKey,

            unit,

            interval,

            from:
              tradingDate,

            to:
              tradingDate,

            candles:
              dbHistory,

            source:
              "mongodb",

            requestId:
              req.requestId,
          });
        }

        /*
         * If today's date has no candle, find the latest
         * available official trading session.
         *
         * This is important on weekends and holidays.
         */

        let fallbackDate =
          tradingDate;

        for (
          let i = 0;
          i < 10;
          i += 1
        ) {
          fallbackDate =
            previousTradingDate(
              dateAtISTNoon(
                fallbackDate
              )
            );

          const fallbackHistory =
            await getDbHistory(
              instrumentKey,
              fallbackDate,
              fallbackDate
            );

          if (
            fallbackHistory?.length
          ) {
            return res.json({
              success: true,

              instrumentKey,

              unit,

              interval,

              from:
                fallbackDate,

              to:
                fallbackDate,

              requestedDate:
                tradingDate,

              candles:
                fallbackHistory,

              source:
                "mongodb-latest-trading-session",

              requestId:
                req.requestId,
            });
          }
        }

        /*
         * Last fallback: Upstox.
         */

        try {
          const fallbackDate =
            latestCompletedTradingDate();

          const candles =
            await upstox.fetchHistory(
              instrumentKey,
              "days",
              interval,
              fallbackDate,
              shiftIndiaDate(
                fallbackDate,
                -5
              )
            );

          const normalized =
            normalizeHistoryResponse(
              candles
            ).filter(
              (candle) =>
                indiaDate(
                  new Date(
                    candle.timestamp
                  )
                ) ===
                fallbackDate
            );

          if (
            normalized.length
          ) {
            return res.json({
              success: true,

              instrumentKey,

              unit,

              interval,

              from:
                fallbackDate,

              to:
                fallbackDate,

              requestedDate:
                tradingDate,

              candles:
                normalized,

              source:
                "upstox-latest-trading-session",

              requestId:
                req.requestId,
            });
          }
        } catch (err) {
          logger.warn(
            "1D historical fallback failed",
            {
              instrumentKey,

              error:
                errorMessage(err),
            }
          );
        }

        return res.json({
          success: true,

          instrumentKey,

          unit,

          interval,

          from:
            tradingDate,

          to:
            tradingDate,

          candles: [],

          source:
            "none",

          requestId:
            req.requestId,
        });
      }

      /*
       * -----------------------------------------------------
       * Multi-day / week / month / year history
       * -----------------------------------------------------
       */

      const range =
        historyRange(
          unit,
          amount
        );

      const toDate =
        requestedTo;

      const fromDate =
        requestedFrom ||
        shiftIndiaDate(
          toDate,
          -range.days
        );

      /*
       * First try persisted MongoDB history.
       *
       * This avoids unnecessary provider calls and makes
       * MongoDB the application's stored history source.
       */

      try {
        const dbHistory =
          await getDbHistory(
            instrumentKey,
            toDate,
            fromDate
          );

        if (
          dbHistory?.length
        ) {
          return res.json({
            success: true,

            instrumentKey,

            unit,

            interval,

            from:
              fromDate,

            to:
              toDate,

            candles:
              dbHistory,

            source:
              "mongodb",

            requestId:
              req.requestId,
          });
        }
      } catch (err) {
        logger.warn(
          "MongoDB history lookup failed",
          {
            instrumentKey,

            fromDate,

            toDate,

            error:
              errorMessage(err),
          }
        );
      }

      /*
       * If MongoDB does not contain the requested range,
       * ask Upstox for the historical candles.
       */

      try {
        const candles =
          await upstox.fetchHistory(
            instrumentKey,
            unit,
            interval,
            toDate,
            fromDate
          );

        const normalized =
          normalizeHistoryResponse(
            candles
          );

        return res.json({
          success: true,

          instrumentKey,

          unit,

          interval,

          from:
            fromDate,

          to:
            toDate,

          candles:
            normalized,

          source:
            "upstox",

          requestId:
            req.requestId,
        });
      } catch (err) {
        logger.warn(
          "Upstox historical data failed",
          {
            instrumentKey,

            unit,

            interval,

            fromDate,

            toDate,

            error:
              errorMessage(err),
          }
        );
      }

      /*
       * Final fallback to the application's local
       * history cache.
       */

      if (env.redisEnabled) {
        try {
          const key =
            historyKey(
              instrumentKey,
              unit,
              interval,
              fromDate,
              toDate
            );

          const cached =
            await redis.get(key);

          if (cached) {
            const parsed =
              JSON.parse(
                cached
              );

            if (
              Array.isArray(
                parsed
              )
            ) {
              return res.json({
                success: true,

                instrumentKey,

                unit,

                interval,

                from:
                  fromDate,

                to:
                  toDate,

                candles:
                  parsed,

                source:
                  "redis-cache",

                requestId:
                  req.requestId,
              });
            }
          }
        } catch (err) {
          logger.warn(
            "Redis historical fallback failed",
            {
              instrumentKey,

              error:
                errorMessage(err),
            }
          );
        }
      }

      return res.json({
        success: true,

        instrumentKey,

        unit,

        interval,

        from:
          fromDate,

        to:
          toDate,

        candles: [],

        source:
          "none",

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Historical data endpoint failed",
        {
          instrumentKey,

          unit,

          interval,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "HISTORY_FAILED",

            message:
              "Unable to load historical data.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   ISIN LOOKUP
========================================================= */

app.get(
  "/api/detail-stock/isin/:symbol",
  async (req, res) => {
    const symbol =
      String(
        req.params.symbol ||
          ""
      ).trim();

    if (
      !symbol ||
      symbol.length > 100
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_SYMBOL",

            message:
              "A valid symbol is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const result =
        await getIsinBySymbol(
          symbol
        );

      if (!result) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "ISIN_NOT_FOUND",

              message:
                "ISIN not found for the requested symbol.",
            },

            requestId:
              req.requestId,
          });
      }

      return res.json({
        success: true,

        data:
          result,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "ISIN lookup failed",
        {
          symbol,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "ISIN_LOOKUP_FAILED",

            message:
              "Unable to resolve ISIN.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   BSE INSTRUMENT LOOKUP
========================================================= */

app.get(
  "/api/detail-stock/bse/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      !validIsin(isin)
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_ISIN",

            message:
              "A valid ISIN is required.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const instrument =
        await getBseInstrumentByIsin(
          isin
        );

      if (!instrument) {
        return res
          .status(404)
          .json({
            success: false,

            error: {
              code:
                "BSE_INSTRUMENT_NOT_FOUND",

              message:
                "BSE instrument not found.",
            },

            requestId:
              req.requestId,
          });
      }

      return res.json({
        success: true,

        data: {
          instrumentKey:
            instrument.instrumentKey,

          exchange:
            instrument.exchange,

          segment:
            instrument.segment,

          tradingSymbol:
            instrument.tradingSymbol,

          name:
            instrument.name,

          isin:
            instrument.isin,
        },

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "BSE instrument lookup failed",
        {
          isin,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "BSE_LOOKUP_FAILED",

            message:
              "Unable to load BSE instrument.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);



/* =========================================================
   OFFICIAL CLOSE SETTLEMENT
========================================================= */

let closingSyncPromise = null;

async function runOfficialCloseSettlement(
  targetTradingDate,
  reason = "scheduled"
) {
  if (
    !isTradingDay(
      dateAtISTNoon(
        targetTradingDate
      )
    )
  ) {
    return {
      total: 0,
      saved: 0,
      skipped: true,
    };
  }

  if (closingSyncPromise) {
    return closingSyncPromise;
  }

  closingSyncPromise =
    (async () => {
      /*
       * MongoDB is now the source for the complete
       * market-stock universe.
       */
      const rows =
        await getMarketStockInstruments();

      if (!rows.length) {
        logger.warn(
          "No market stocks available for official settlement",
          {
            reason,
            tradingDate:
              targetTradingDate,
            database:
              "mongodb",
          }
        );

        return {
          total: 0,
          saved: 0,
        };
      }

      const batchSize =
        Math.max(
          1,
          Number(
            env.closeBatchSize
          ) || 5
        );

      let saved = 0;
      let skipped = 0;
      let failed = 0;

      logger.info(
        "Starting official market close settlement",
        {
          reason,
          tradingDate:
            targetTradingDate,

          total:
            rows.length,

          batchSize,
        }
      );

      for (
        let i = 0;
        i < rows.length;
        i += batchSize
      ) {
        const batch =
          rows.slice(
            i,
            i + batchSize
          );

        const results =
          await Promise.allSettled(
            batch.map(
              async (row) => {
                const key =
                  row.instrument_key;

                if (
                  !validKey(key)
                ) {
                  throw new Error(
                    "Invalid instrument key"
                  );
                }

                /*
                 * A finalized cache entry alone is not enough.
                 * MongoDB must also contain the persisted daily
                 * close before we skip the provider call.
                 */
                const cached =
                  await getFinalized1D(
                    key,
                    targetTradingDate
                  );

                const hasClose =
                  await require("./db")
                    .hasDailyCloseForDate(
                      key,
                      targetTradingDate
                    );

                if (
                  cached &&
                  hasClose
                ) {
                  return {
                    skipped: true,
                  };
                }

                /*
                 * The settlement job owns the final official pull.
                 * If a cache was seeded by a client immediately after
                 * close, use it only together with a persisted close;
                 * otherwise fetch fresh official data.
                 */

                let candles =
                  cached?.candles
                    ?.length &&
                  hasClose
                    ? cached.candles
                    : null;

                let snapshot =
                  null;

                if (
                  !candles
                ) {
                  snapshot =
                    await buildOfficialCloseSnapshot(
                      key,
                      targetTradingDate
                    );

                  if (
                    !snapshot
                  ) {
                    return {
                      skipped: true,
                      reason:
                        "official-close-unavailable",
                    };
                  }

                  await saveDailyClose(
                    snapshot
                  );

                  await cacheFinalized1D(
                    key,
                    targetTradingDate,
                    {
                      instrumentKey:
                        key,

                      tradingDate:
                        targetTradingDate,

                      candles: [
                        {
                          timestamp:
                            `${targetTradingDate}T15:30:00+05:30`,

                          open:
                            snapshot.open,

                          high:
                            snapshot.high,

                          low:
                            snapshot.low,

                          close:
                            snapshot.price,

                          volume:
                            snapshot.volume,
                        },
                      ],
                    }
                  );

                  await cacheSnapshot(
                    snapshot
                  );

                  return {
                    saved: true,
                  };
                }

                /*
                 * A valid cached + persisted close does not need
                 * another database write.
                 */
                return {
                  skipped: true,
                  reason:
                    "already-finalized",
                };
              }
            )
          );

        for (
          const result of results
        ) {
          if (
            result.status ===
            "fulfilled"
          ) {
            if (
              result.value?.saved
            ) {
              saved += 1;
            } else {
              skipped += 1;
            }
          } else {
            failed += 1;

            logger.warn(
              "Official settlement item failed",
              {
                tradingDate:
                  targetTradingDate,

                error:
                  errorMessage(
                    result.reason
                  ),
              }
            );
          }
        }

        /*
         * Small delay between batches prevents a large market
         * universe from creating an unnecessary provider burst.
         */
        if (
          i + batchSize <
          rows.length
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                100
              )
          );
        }

        logger.info(
          "Official settlement progress",
          {
            reason,

            tradingDate:
              targetTradingDate,

            processed:
              Math.min(
                i + batch.length,
                rows.length
              ),

            total:
              rows.length,

            saved,
            skipped,
            failed,
          }
        );
      }

      const result = {
        total:
          rows.length,

        saved,

        skipped,

        failed,

        tradingDate:
          targetTradingDate,

        success:
          failed === 0,
      };

      logger.info(
        "Official market close settlement completed",
        result
      );

      return result;
    })();

  try {
    return await closingSyncPromise;
  } finally {
    closingSyncPromise = null;
  }
}

/* =========================================================
   CRON: OFFICIAL CLOSE
========================================================= */

cron.schedule(
  closeCron,
  async () => {
    try {
      const tradingDate =
        latestCompletedTradingDate();

      logger.info(
        "Running scheduled official close settlement",
        {
          tradingDate,
          cron:
            closeCron,
        }
      );

      await runOfficialCloseSettlement(
        tradingDate,
        "scheduled-close"
      );
    } catch (err) {
      logger.error(
        "Scheduled close settlement failed",
        {
          error:
            errorMessage(err),
        }
      );
    }
  },
  {
    timezone:
      env.timezone ||
      "Asia/Kolkata",
  }
);

/* =========================================================
   CRON: CLOSE RETRY
========================================================= */

cron.schedule(
  closeRetryCron,
  async () => {
    try {
      const tradingDate =
        latestCompletedTradingDate();

      logger.info(
        "Running close settlement retry",
        {
          tradingDate,
          cron:
            closeRetryCron,
        }
      );

      await runOfficialCloseSettlement(
        tradingDate,
        "scheduled-retry"
      );
    } catch (err) {
      logger.error(
        "Scheduled close retry failed",
        {
          error:
            errorMessage(err),
        }
      );
    }
  },
  {
    timezone:
      env.timezone ||
      "Asia/Kolkata",
  }
);

/* =========================================================
   HEALTH DETAILS
========================================================= */

app.get(
  "/api/detail-stock/status",
  async (req, res) => {
    let mongo = false;

    try {
      const {
        getMongoDB,
      } =
        require("../config/mongodb");

      const db =
        await getMongoDB();

      await db.command({
        ping: 1,
      });

      mongo = true;
    } catch (err) {
      logger.warn(
        "Mongo status check failed",
        {
          error:
            errorMessage(err),
        }
      );
    }

    const status =
      marketStatus();

    return res.json({
      success: true,

      status,

      database:
        "mongodb",

      mongo,

      redis:
        env.redisEnabled
          ? Boolean(
              redis?.isReady
            )
          : false,

      upstoxConnected:
        upstox.isConnected(),

      upstoxSubscribed:
        upstox
          .getSubscribed()
          .length,

      activeRooms:
        subscribers.size,

      cachedSnapshots:
        snapshots.size,

      time:
        new Date().toISOString(),

      requestId:
        req.requestId,
    });
  }
);

/* =========================================================
   MARKET STOCKS
========================================================= */

app.get(
  "/api/detail-stock/market-stocks",
  async (req, res) => {
    try {
      const rows =
        await getMarketStockInstruments();

      return res.json({
        success: true,

        marketOpen:
          isMarketOpen(),

        marketStatus:
          marketStatus(),

        count:
          rows.length,

        data:
          rows,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Market stocks request failed",
        {
          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "MARKET_STOCKS_FAILED",

            message:
              "Unable to load market stocks.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   DAILY CLOSE COUNT
========================================================= */

app.get(
  "/api/detail-stock/daily-close-count",
  async (req, res) => {
    const date =
      req.query.date
        ? String(
            req.query.date
          )
        : indiaDate();

    try {
      const count =
        await getDailyCloseCount(
          date
        );

      return res.json({
        success: true,

        date,

        count:
          Number(count || 0),

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Daily close count failed",
        {
          date,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "DAILY_CLOSE_COUNT_FAILED",

            message:
              "Unable to load daily close count.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   MANUAL CLOSE / RECONCILIATION
========================================================= */

app.post(
  "/api/detail-stock/reconcile",
  authenticateToken,
  async (req, res) => {
    /*
     * Manual reconciliation is intentionally restricted to
     * administrators. Normal users should never be able to
     * trigger thousands of provider calls.
     */

    if (
      String(
        req.userRole || ""
      ).toUpperCase() !==
      "ADMIN"
    ) {
      return res
        .status(403)
        .json({
          success: false,

          error: {
            code:
              "ADMIN_REQUIRED",

            message:
              "Administrator access is required.",
          },

          requestId:
            req.requestId,
        });
    }

    const requestedDate =
      req.body?.tradingDate
        ? String(
            req.body.tradingDate
          )
        : latestCompletedTradingDate();

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        requestedDate
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_TRADING_DATE",

            message:
              "tradingDate must use YYYY-MM-DD format.",
          },

          requestId:
            req.requestId,
        });
    }

    try {
      const result =
        await runOfficialCloseSettlement(
          requestedDate,
          "manual-admin"
        );

      return res.json({
        success:
          result.success !== false,

        data:
          result,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Manual reconciliation failed",
        {
          tradingDate:
            requestedDate,

          error:
            errorMessage(err),
        }
      );

      return res
        .status(500)
        .json({
          success: false,

          error: {
            code:
              "RECONCILIATION_FAILED",

            message:
              "Unable to complete market reconciliation.",
          },

          requestId:
            req.requestId,
        });
    }
  }
);

/* =========================================================
   CURRENT STOCK PRICE FOR ORDER EXECUTION
========================================================= */

async function getExecutionSnapshot(
  instrumentKey
) {
  /*
   * Never accept execution price from the browser.
   *
   * The server determines the simulated execution price from
   * the current market snapshot / provider quote.
   */

  const context =
    await getInstrumentContext(
      instrumentKey
    );

  if (!context) {
    const error =
      new Error(
        "Instrument not found"
      );

    error.code =
      "INSTRUMENT_NOT_FOUND";

    throw error;
  }

  let snapshot =
    await getSnapshot(
      instrumentKey
    );

  /*
   * Refresh when no usable server-side price exists.
   */
  if (
    !snapshot ||
    !Number.isFinite(
      Number(
        snapshot.price
      )
    ) ||
    Number(snapshot.price) <= 0
  ) {
    snapshot =
      await primeSnapshot(
        instrumentKey
      );
  }

  if (
    !snapshot ||
    !Number.isFinite(
      Number(
        snapshot.price
      )
    ) ||
    Number(snapshot.price) <= 0
  ) {
    const error =
      new Error(
        "Current market price unavailable"
      );

    error.code =
      "PRICE_UNAVAILABLE";

    throw error;
  }

  return {
    instrumentKey,

    symbol:
      context.symbol ||
      snapshot.symbol,

    name:
      context.name ||
      snapshot.name,

    exchange:
      context.exchange ||
      snapshot.exchange,

    segment:
      context.segment ||
      snapshot.segment,

    isin:
      context.isin ||
      snapshot.isin,

    price:
      Number(
        snapshot.price
      ),

    source:
      snapshot.source ||
      "server-market-snapshot",

    marketStatus:
      snapshot.marketStatus ||
      marketStatus(),
  };
}

/* =========================================================
   ORDER VALIDATION
========================================================= */

function normalizeOrderType(
  value
) {
  const orderType =
    String(
      value || "MARKET"
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "MARKET",
      "LIMIT",
    ].includes(
      orderType
    )
  ) {
    return null;
  }

  return orderType;
}

function normalizeTransactionType(
  value
) {
  const transactionType =
    String(
      value || ""
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "BUY",
      "SELL",
    ].includes(
      transactionType
    )
  ) {
    return null;
  }

  return transactionType;
}

function normalizeProduct(
  value
) {
  const product =
    String(
      value || "CNC"
    )
      .trim()
      .toUpperCase();

  if (
    ![
      "CNC",
      "MIS",
    ].includes(
      product
    )
  ) {
    return null;
  }

  return product;
}

function parsePositiveQuantity(
  value
) {
  const quantity =
    Number(value);

  if (
    !Number.isInteger(
      quantity
    ) ||
    quantity <= 0 ||
    quantity > 1000000
  ) {
    return null;
  }

  return quantity;
}

/* =========================================================
   SIMULATED ORDER
========================================================= */

app.post(
  "/api/detail-stock/order",
  authenticateToken,
  validateBodyObject(
    (body) => body
  ),
  async (req, res) => {
    const idempotencyKey =
      String(
        req.get(
          "Idempotency-Key"
        ) || ""
      ).trim();

    if (
      !validIdempotencyKey(
        idempotencyKey
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_IDEMPOTENCY_KEY",

            message:
              "A valid Idempotency-Key header is required.",
          },

          requestId:
            req.requestId,
        });
    }

    const body =
      req.body || {};

    /*
     * Client-controlled userId is deliberately ignored.
     * The authenticated JWT is the only source of identity.
     */

    const userId =
      req.userId;

    if (!userId) {
      return res
        .status(401)
        .json({
          success: false,

          error: {
            code:
              "UNAUTHENTICATED",

            message:
              "Authentication is required.",
          },

          requestId:
            req.requestId,
        });
    }

    const instrumentKey =
      String(
        body.instrumentKey ||
          ""
      ).trim();

    if (
      !validKey(
        instrumentKey
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_INSTRUMENT_KEY",

            message:
              "A valid instrumentKey is required.",
          },

          requestId:
            req.requestId,
        });
    }

    const transactionType =
      normalizeTransactionType(
        body.transactionType ||
          body.side
      );

    if (!transactionType) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_TRANSACTION_TYPE",

            message:
              "transactionType must be BUY or SELL.",
          },

          requestId:
            req.requestId,
        });
    }

    const orderType =
      normalizeOrderType(
        body.orderType
      );

    if (!orderType) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_ORDER_TYPE",

            message:
              "orderType must be MARKET or LIMIT.",
          },

          requestId:
            req.requestId,
        });
    }

    const product =
      normalizeProduct(
        body.product
      );

    if (!product) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_PRODUCT",

            message:
              "product must be CNC or MIS.",
          },

          requestId:
            req.requestId,
        });
    }

    const quantity =
      parsePositiveQuantity(
        body.quantity
      );

    if (!quantity) {
      return res
        .status(400)
        .json({
          success: false,

          error: {
            code:
              "INVALID_QUANTITY",

            message:
              "quantity must be a positive whole number.",
          },

          requestId:
            req.requestId,
        });
    }

    /*
     * LIMIT orders may provide a requested limit price.
     * MARKET orders must never use a client-supplied price
     * as the execution price.
     */
    let limitPrice = null;

    if (
      orderType ===
      "LIMIT"
    ) {
      const parsedPrice =
        Number(
          body.price
        );

      if (
        !Number.isFinite(
          parsedPrice
        ) ||
        parsedPrice <= 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            error: {
              code:
                "INVALID_PRICE",

              message:
                "A positive limit price is required for LIMIT orders.",
            },

            requestId:
              req.requestId,
          });
      }

      limitPrice =
        Number(
          parsedPrice.toFixed(
            2
          )
        );
    }

    try {
      /*
       * Resolve instrument and server-side execution price.
       */
      const execution =
        await getExecutionSnapshot(
          instrumentKey
        );

      /*
       * Keep execution server-authoritative.
       *
       * For the simulated system the current server price is used.
       * A client price is never accepted as the execution price
       * for a MARKET order.
       */
      const executionPrice =
        Number(
          execution.price
        );

      if (
        !Number.isFinite(
          executionPrice
        ) ||
        executionPrice <= 0
      ) {
        return res
          .status(503)
          .json({
            success: false,

            error: {
              code:
                "EXECUTION_PRICE_UNAVAILABLE",

              message:
                "Unable to determine a valid execution price.",
            },

            requestId:
              req.requestId,
          });
      }

      /*
       * This calls simulateOrder().
       *
       * The service is responsible for:
       * - MongoDB transaction
       * - idempotency
       * - holdings update
       * - order creation
       * - audit records
       */
      const result =
        await simulateOrder({
          userId,

          instrumentKey,

          symbol:
            execution.symbol,

          instrumentName:
            execution.name,

          exchange:
            execution.exchange,

          transactionType,

          orderType,

          product,

          quantity,

          price:
            executionPrice,

          limitPrice,

          idempotencyKey,

          requestId:
            req.requestId,
        });

      return res.status(
        result?.replayed
          ? 200
          : 201
      ).json({
        success:
          result?.success !== false,

        data:
          result,

        requestId:
          req.requestId,
      });
    } catch (err) {
      logger.error(
        "Simulated order failed",
        {
          userId,

          instrumentKey,

          transactionType,

          orderType,

          quantity,

          error:
            errorMessage(err),
        }
      );

      const statusCode =
        err?.statusCode ||
        (
          err?.code ===
          "IDEMPOTENCY_KEY_REUSED"
            ? 409
            : err?.code ===
                "INSUFFICIENT_HOLDINGS"
              ? 409
              : err?.code ===
                  "INSTRUMENT_NOT_FOUND"
                ? 404
                : err?.code ===
                    "PRICE_UNAVAILABLE"
                  ? 503
                  : 500
        );

      return res
        .status(statusCode)
        .json({
          success: false,

          error: {
            code:
              err?.code ||
              "ORDER_FAILED",

            message:
              err?.clientMessage ||
              (
                statusCode >= 500
                  ? "Unable to place order."
                  : errorMessage(err)
              ),
          },

          requestId:
            req.requestId,
        });
    }
  }
);


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