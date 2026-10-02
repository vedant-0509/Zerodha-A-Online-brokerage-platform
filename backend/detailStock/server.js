// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const helmet = require("helmet");
// const compression = require("compression");
// const rateLimit = require("express-rate-limit");
// const cron = require("node-cron");
// const { Server } = require("socket.io");

// const env = require("./env");
// const logger = require("./logger");
// const { redis, connectRedis } = require("./redis");
// const upstox = require("./upstox");
// const { getStockFinancials } = upstox;

// const { simulateOrder } = require("./simulatedOrderService");

// const authenticateToken = require("../middleware/authenticateToken");

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

// const corsOptions = {
//   origin(origin, callback) {
//     if (!origin) {
//       return callback(null, true);
//     }

//     if (
//       Array.isArray(env.origins) &&
//       env.origins.includes(origin)
//     ) {
//       return callback(null, true);
//     }

//     try {
//       const parsed = new URL(origin);

//       const isLocalHost = [
//         "localhost",
//         "127.0.0.1",
//         "::1",
//       ].includes(parsed.hostname);

//       if (
//         isLocalHost &&
//         ["http:", "https:"].includes(parsed.protocol)
//       ) {
//         return callback(null, true);
//       }
//     } catch {
//       // Fall through to normal CORS rejection
//     }

//     return callback(
//       new Error("CORS origin not allowed")
//     );
//   },

//   credentials: true,
// };

// const io = new Server(server, {
//   cors: corsOptions,
//   transports: ["websocket", "polling"],
//   pingInterval: 25000,
//   pingTimeout: 20000,
//   maxHttpBufferSize: 1e6,
// });

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
//   standardHeaders: true,
//   legacyHeaders: false,
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
//    JWT AUTHENTICATION
// ========================================================= */

// // function authenticateToken(req, res, next) {
// //   try {
// //     const authHeader =
// //       req.headers.authorization;

// //     if (!authHeader) {
// //       return res.status(401).json({
// //         success: false,
// //         message:
// //           "Authorization token required",
// //       });
// //     }

// //     if (!authHeader.startsWith("Bearer ")) {
// //       return res.status(401).json({
// //         success: false,
// //         message:
// //           "Invalid authorization format",
// //       });
// //     }

// //     const token =
// //       authHeader.slice(7).trim();

// //     if (!token) {
// //       return res.status(401).json({
// //         success: false,
// //         message: "Token missing",
// //       });
// //     }

// //     const decoded = jwt.verify(
// //       token,
// //       JWT_SECRET
// //     );

// //     if (!decoded.userId) {
// //       return res.status(401).json({
// //         success: false,
// //         message:
// //           "Invalid token payload",
// //       });
// //     }

// //     req.userId = decoded.userId;

// //     next();
// //   } catch (error) {
// //     logger.warn(
// //       "JWT authentication failed",
// //       {
// //         error: error.message,
// //       }
// //     );

// //     return res.status(401).json({
// //       success: false,
// //       message:
// //         "Invalid or expired token",
// //     });
// //   }
// // }

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
//   const raw =
//     tradingDate === indiaDate()
//       ? await upstox.fetchHistory(
//           instrumentKey,
//           "minutes",
//           "1",
//           tradingDate,
//         )
//       : await upstox.fetchHistory(
//           instrumentKey,
//           "minutes",
//           "1",
//           tradingDate,
//           shiftIndiaDate(tradingDate, -7),
//         );

//   const candles = filterTradingSession(raw, tradingDate);

//   if (!candles.length) {
//     throw new Error(
//       `No official 1-minute candles returned for ${instrumentKey} on ${tradingDate}`,
//     );
//   }

//   return candles;
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
//   async (req, res) => {
//     const body =
//       req.body || {};

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
//      * Price validation
//      * ---------------------------------------------
//      */

//     const requestedPrice =
//       Number(body.price);

//     if (
//       body.price != null &&
//       body.price !== "" &&
//       (
//         !Number.isFinite(
//           requestedPrice
//         ) ||
//         requestedPrice <= 0
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Invalid price",
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

//           price:
//             Number.isFinite(
//               requestedPrice
//             ) &&
//             requestedPrice > 0
//               ? requestedPrice
//               : null,

//           orderType,

//           product:
//             "CNC",
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

//       return res.status(500).json({
//         success: false,

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
//    STARTUP & SHUTDOWN
// ========================================================= */

// async function startup() {
//   await connectRedis();

//   await initDb();

//   await reconcileOnStartup();

//   server.listen(
//     env.port,
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
const upstox = require("./upstox");
const { getStockFinancials } = upstox;

const { simulateOrder } = require("./simulatedOrderService");

const authenticateToken = require("../middleware/authenticateToken");

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

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (
      Array.isArray(env.origins) &&
      env.origins.includes(origin)
    ) {
      return callback(null, true);
    }

    try {
      const parsed = new URL(origin);

      const isLocalHost = [
        "localhost",
        "127.0.0.1",
        "::1",
      ].includes(parsed.hostname);

      if (
        isLocalHost &&
        ["http:", "https:"].includes(parsed.protocol)
      ) {
        return callback(null, true);
      }
    } catch {
      // Fall through to normal CORS rejection
    }

    return callback(
      new Error("CORS origin not allowed")
    );
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
  standardHeaders: true,
  legacyHeaders: false,
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

function finalized1DKey(instrumentKey, tradingDate) {
  return `${FINAL_1D_PREFIX}${instrumentKey}:${tradingDate}`;
}

function shiftIndiaDate(dateString, days) {
  const value = new Date(`${dateString}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Number(days || 0));
  return value.toISOString().slice(0, 10);
}

function dateAtISTNoon(dateString) {
  return new Date(`${dateString}T12:00:00+05:30`);
}

async function getFinalized1D(instrumentKey, tradingDate) {
  if (!env.redisEnabled) return null;

  try {
    const raw = await redis.get(finalized1DKey(instrumentKey, tradingDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.candles) ? parsed : null;
  } catch (err) {
    logger.warn("Finalized 1D cache read failed", {
      instrumentKey,
      tradingDate,
      error: errorMessage(err),
    });
    return null;
  }
}

async function cacheFinalized1D(instrumentKey, tradingDate, payload) {
  if (!env.redisEnabled || !Array.isArray(payload?.candles) || !payload.candles.length) {
    return;
  }

  await redis.set(
    finalized1DKey(instrumentKey, tradingDate),
    JSON.stringify(payload),
    { EX: 3 * 24 * 60 * 60 },
  );
}

function isinFromInstrumentKey(key) {
  const candidate =
    String(key || "").split("|")[1] || "";

  return validIsin(candidate)
    ? candidate
    : null;
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
   JWT AUTHENTICATION
========================================================= */

// function authenticateToken(req, res, next) {
//   try {
//     const authHeader =
//       req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         success: false,
//         message:
//           "Authorization token required",
//       });
//     }

//     if (!authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message:
//           "Invalid authorization format",
//       });
//     }

//     const token =
//       authHeader.slice(7).trim();

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Token missing",
//       });
//     }

//     const decoded = jwt.verify(
//       token,
//       JWT_SECRET
//     );

//     if (!decoded.userId) {
//       return res.status(401).json({
//         success: false,
//         message:
//           "Invalid token payload",
//       });
//     }

//     req.userId = decoded.userId;

//     next();
//   } catch (error) {
//     logger.warn(
//       "JWT authentication failed",
//       {
//         error: error.message,
//       }
//     );

//     return res.status(401).json({
//       success: false,
//       message:
//         "Invalid or expired token",
//     });
//   }
// }

/* =========================================================
   CRON HELPERS
========================================================= */

function timeToWeekdayCron(
  value,
  fallback
) {
  const raw = String(
    value || fallback || ""
  ).trim();

  const match =
    raw.match(/^(\d{1,2}):(\d{2})$/);

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

function getCronTimeFromEnv(
  key,
  fallback
) {
  const value = process.env[key];

  if (value) {
    return value;
  }

  if (
    key === "CLOSE_JOB_TIME" &&
    env.closeJobTime
  ) {
    return env.closeJobTime;
  }

  if (
    key === "CLOSE_RETRY_TIME" &&
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
    timezone: env.timezone,
  }
);

/* =========================================================
   SNAPSHOT CACHE
========================================================= */

async function cacheSnapshot(
  snapshot
) {
  if (!snapshot?.instrumentKey) {
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

  const raw =
    await redis.get(snapshotKey(key));

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

async function enrichWithStoredPreviousClose(
  snapshot
) {
  if (!snapshot || !env.mysqlEnabled) {
    return snapshot;
  }

  try {
    const previous =
      await getPreviousStoredClose(
        snapshot.instrumentKey,
        indiaDate()
      );

    if (previous?.close != null) {
      const close =
        Number(previous.close);

      const price =
        Number(snapshot.price);

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
            ((price - close) / close) *
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
        error: err.message,
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

async function primeSnapshot(
  instrumentKey
) {
  const context =
    await getInstrumentContext(
      instrumentKey
    );

  const today = indiaDate();

  const marketOpen =
    isMarketOpen();

  const existing =
    await getSnapshot(
      instrumentKey
    );

  const existingIsFresh =
    existing?.marketDate === today &&
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
    fundamentalsByIsin.get(isin);

  if (
    cached &&
    cached.expiresAt > Date.now()
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
            error: err?.message,
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

function previousTradingDate(date = new Date()) {
  let candidate = shiftIndiaDate(indiaDate(date), -1);

  while (!isTradingDay(dateAtISTNoon(candidate))) {
    candidate = shiftIndiaDate(candidate, -1);
  }

  return candidate;
}

function latestCompletedTradingDate(date = new Date()) {
  if (isTradingDay(date) && isAfterMarketClose(date)) {
    return indiaDate(date);
  }

  return previousTradingDate(date);
}

/* =========================================================
   OFFICIAL INTRADAY SETTLEMENT
========================================================= */

async function resolvePreviousClose(instrumentKey, beforeDate) {
  if (!beforeDate) return null;

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
  const fetchTo = shiftIndiaDate(beforeDate, -1);
  const fetchFrom = shiftIndiaDate(beforeDate, -10);

  try {
    const candles = await upstox.fetchHistory(
      instrumentKey,
      "days",
      "1",
      fetchTo,
      fetchFrom,
    );

    const candidates = (Array.isArray(candles) ? candles : [])
      .filter((candle) => {
        const timestamp = Date.parse(candle?.timestamp);
        return (
          Number.isFinite(timestamp) &&
          indiaDate(new Date(timestamp)) < beforeDate &&
          Number(candle?.close) > 0
        );
      })
      .sort(
        (a, b) =>
          Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );

    const last = candidates[candidates.length - 1];
    if (last) {
      return {
        close: Number(last.close),
        tradingDate: indiaDate(new Date(last.timestamp)),
        source: "upstox-daily-history",
      };
    }
  } catch (err) {
    logger.warn("Upstox prior close lookup failed", {
      instrumentKey,
      beforeDate,
      error: errorMessage(err),
    });
  }

  // Only use persisted data if the authoritative Upstox lookup fails.
  if (env.mysqlEnabled) {
    try {
      const stored = await getPreviousStoredClose(instrumentKey, beforeDate);
      const close = Number(stored?.close);
      if (Number.isFinite(close) && close > 0) {
        return {
          close,
          tradingDate: stored.trading_date,
          source: "database-fallback",
        };
      }
    } catch (err) {
      logger.warn("Stored prior close fallback failed", {
        instrumentKey,
        beforeDate,
        error: errorMessage(err),
      });
    }
  }

  return null;
}

function filterTradingSession(candles, tradingDate) {
  return (Array.isArray(candles) ? candles : [])
    .filter((candle) => {
      const timestamp = Date.parse(candle?.timestamp);
      if (!Number.isFinite(timestamp)) return false;

      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(timestamp));
      const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      const minutes =
        Number(values.hour || 0) * 60 +
        Number(values.minute || 0) +
        Number(values.second || 0) / 60;

      return (
        indiaDate(new Date(timestamp)) === tradingDate &&
        minutes >= 9 * 60 + 15 &&
        minutes <= 15 * 60 + 30
      );
    })
    .sort(
      (a, b) =>
        Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
}

async function fetchOfficialIntradaySession(instrumentKey, tradingDate) {
  const raw =
    tradingDate === indiaDate()
      ? await upstox.fetchHistory(
          instrumentKey,
          "minutes",
          "1",
          tradingDate,
        )
      : await upstox.fetchHistory(
          instrumentKey,
          "minutes",
          "1",
          tradingDate,
          shiftIndiaDate(tradingDate, -7),
        );

  const candles = filterTradingSession(raw, tradingDate);

  if (!candles.length) {
    throw new Error(
      `No official 1-minute candles returned for ${instrumentKey} on ${tradingDate}`,
    );
  }

  return candles;
}

function buildOfficialCloseSnapshot(
  row,
  candles,
  previousClose,
  tradingDate,
) {
  const first = candles[0];
  const last = candles[candles.length - 1];
  const close = Number(last.close);

  if (!Number.isFinite(close) || close <= 0) {
    throw new Error(
      `Invalid official close for ${row?.instrument_key || "instrument"}`,
    );
  }

  const highs = candles
    .map((candle) => Number(candle.high))
    .filter((value) => Number.isFinite(value) && value > 0);
  const lows = candles
    .map((candle) => Number(candle.low))
    .filter((value) => Number.isFinite(value) && value > 0);

  const volume = candles.reduce((sum, candle) => {
    const value = Number(candle.volume);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  const change =
    previousClose?.close != null
      ? close - Number(previousClose.close)
      : null;

  return {
    instrumentKey: row.instrument_key,
    symbol: row.symbol || null,
    tradingSymbol: row.symbol || null,
    name: row.name || null,
    companyName: row.name || null,
    exchange: row.master_exchange || row.exchange || env.marketStockExchange || "NSE",
    segment: row.master_segment || row.segment || env.marketStockSegment || "NSE_EQ",
    sector: row.sector || null,
    ltp: close,
    price: close,
    dayClose: close,
    previousClose:
      previousClose?.close != null
        ? Number(previousClose.close)
        : null,
    previousCloseDate: previousClose?.tradingDate || null,
    previousCloseSource: previousClose?.source || null,
    change,
    changePercent:
      previousClose?.close
        ? (change / Number(previousClose.close)) * 100
        : null,
    open: Number(first.open),
    high: highs.length ? Math.max(...highs) : Number(first.high),
    low: lows.length ? Math.min(...lows) : Number(first.low),
    volume,
    lastTradeTime: Date.parse(last.timestamp) || null,
    timestamp: Date.now(),
    marketDate: tradingDate,
    marketOpen: false,
    marketStatus: "CLOSED",
    source: "upstox-finalized-intraday",
  };
}

let closingSyncPromise = null;

async function reconcileAllMarketStocks(
  reason,
  targetTradingDate = latestCompletedTradingDate(),
) {
  if (!isTradingDay(dateAtISTNoon(targetTradingDate))) {
    return { total: 0, saved: 0, skipped: true };
  }

  if (closingSyncPromise) return closingSyncPromise;

  closingSyncPromise = (async () => {
    const rows = env.mysqlEnabled
      ? await getMarketStockInstruments()
      : [];

    if (!rows.length) {
      logger.warn("No market stocks available for official settlement", {
        reason,
        tradingDate: targetTradingDate,
        mysqlEnabled: env.mysqlEnabled,
      });
      return { total: 0, saved: 0 };
    }

    const batchSize = Math.max(
      1,
      Number(env.closeBatchSize) || 5,
    );
    let saved = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const key = row.instrument_key;
          if (!validKey(key)) {
            throw new Error("Invalid instrument key");
          }

          const cached = await getFinalized1D(
            key,
            targetTradingDate,
          );
          const hasClose = env.mysqlEnabled
            ? await hasDailyCloseForDate(
                key,
                targetTradingDate,
              )
            : false;

          if (cached && hasClose) {
            return { skipped: true };
          }

          // The settlement job owns the final official pull. If a cache was
          // seeded by a client immediately after close, use it only together
          // with a persisted close; otherwise fetch fresh official data.
          const candles =
            cached?.candles?.length && hasClose
              ? cached.candles
              : await fetchOfficialIntradaySession(
                  key,
                  targetTradingDate,
                );

          const previousClose = await resolvePreviousClose(
            key,
            targetTradingDate,
          );

          const snapshot = buildOfficialCloseSnapshot(
            row,
            candles,
            previousClose,
            targetTradingDate,
          );

          await saveDailyClose(
            snapshot,
            targetTradingDate,
          );

          await cacheFinalized1D(key, targetTradingDate, {
            tradingDate: targetTradingDate,
            candles,
            closePrice: snapshot.dayClose,
            baselineClose: snapshot.previousClose,
            baselineDate: snapshot.previousCloseDate,
            source: "upstox-finalized-intraday",
            finalizedAt: new Date().toISOString(),
          });

          await cacheSnapshot(snapshot);

          if (subscribers.has(key)) {
            io.to(`stock:${key}`).emit(
              "detailStock:snapshot",
              snapshot,
            );
          }

          return { skipped: false };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          saved++;
        } else {
          logger.error("Official settlement instrument failed", {
            reason,
            tradingDate: targetTradingDate,
            error: errorMessage(result.reason),
          });
        }
      }

      if (
        i + batch.length < rows.length &&
        Number(env.closeBatchDelayMs) > 0
      ) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Number(env.closeBatchDelayMs),
          ),
        );
      }
    }

    logger.info("Official 1D settlement complete", {
      reason,
      tradingDate: targetTradingDate,
      total: rows.length,
      saved,
    });

    return {
      total: rows.length,
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
    `detailstock:close-reconciled:v3:${date}`;

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
    savedToday <
      totalStocks ||
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
      result.total > 0 &&
      result.saved >= result.total
    ) {
      try {
        await redis.set(
          markerKey,
          "ok",
          {
            EX:
              3 *
              24 *
              60 *
              60,
          }
        );
      } catch (err) {
        logger.warn(
          "Close reconciliation marker write failed",
          {
            error: err.message,
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
    // Ignore late/out-of-order packets after the exchange has closed.
    // Finalized historical data owns the 1D chart after close.
    if (!isTradingDay() || !isMarketOpen()) {
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

      marketDate:
        indiaDate(),

      marketOpen:
        true,

      marketStatus:
        "OPEN",

      source:
        "upstox-websocket",
    };

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
      snapshot.previousClose !=
        null
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
          ? (snapshot.change /
              Number(
                snapshot.previousClose
              )) *
            100
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
          JSON.stringify(snapshot),
          {
            EX:
              env.snapshotCacheSeconds,
          }
        )
        .catch((err) =>
          logger.warn(
            "Tick cache write failed",
            {
              error: err.message,
            }
          )
        );
    }

    io.to(
      `stock:${tick.instrumentKey}`
    ).emit(
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

          set.add(socket.id);

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
                errorMessage(err),
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

  if (set.size === 0) {
    subscribers.delete(
      key
    );

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
   ROUTES
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
        upstox.getSubscribed()
          .length,

      activeRooms:
        subscribers.size,

      time:
        new Date().toISOString(),
    });
  }
);

app.get(
  "/api/detail-stock/market-status",
  async (req, res) => {
    res.json({
      success: true,
      ...marketStatus(),
    });
  },
);

app.get(
  "/api/financials/:symbol",
  async (req, res) => {
    try {
      const {
        symbol,
      } = req.params;

      const financials =
        await getStockFinancials(
          symbol
        );

      res.json({
        success: true,
        data: financials,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Internal server error",
      });
    }
  }
);

app.get(
  "/api/stock/:symbol/financials",
  async (req, res) => {
    try {
      const {
        symbol,
      } = req.params;

      let isin =
        symbol;

      if (
        !symbol.startsWith("INE") &&
        !symbol.startsWith("IN0")
      ) {
        isin =
          await getIsinBySymbol(
            symbol
          );
      }

      if (!isin) {
        return res
          .status(404)
          .json({
            success: false,
            error:
              `Could not resolve ISIN for symbol: ${symbol}`,
          });
      }

      const financials =
        await getStockFinancials(
          isin
        );

      return res.json({
        symbol,
        isin,
        ...financials,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error.message ||
          "Failed to fetch financials",
      });
    }
  }
);

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

app.get(
  "/api/detail-stock/instrument/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    if (!validKey(key)) {
      return res
        .status(400)
        .json({
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
        return res
          .status(404)
          .json({
            success: false,
            message:
              "Instrument not found",
          });
      }

      res.json({
        success: true,
        data: context,
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

app.get(
  "/api/detail-stock/snapshot/:instrumentKey",
  async (req, res) => {
    const key =
      req.params.instrumentKey;

    if (!validKey(key)) {
      return res
        .status(400)
        .json({
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

app.get(
  "/api/detail-stock/history/:instrumentKey",
  async (req, res) => {
    const key = req.params.instrumentKey;

    if (!validKey(key)) {
      return res.status(400).json({
        success: false,
        message: "Invalid instrumentKey",
      });
    }

    const allowedUnits = new Set([
      "minutes",
      "hours",
      "days",
      "weeks",
      "months",
    ]);

    const unit = allowedUnits.has(req.query.unit)
      ? req.query.unit
      : "days";
    const interval = String(req.query.interval || "1");
    const to = String(req.query.to || indiaDate());
    const from = req.query.from ? String(req.query.from) : "";
    const forceRefresh =
      String(req.query.refresh || "") === "1";
    const isOneDay =
      unit === "minutes" &&
      interval === "1" &&
      !from;

    try {
      /*
       * After close, finalized settlement data is immutable for the session.
       * refresh=1 is used only for the OPEN -> CLOSED handover when the final
       * cache may not exist yet.
       */
      if (
        isOneDay &&
        !isMarketOpen() &&
        !forceRefresh
      ) {
        const sessionDate =
          latestCompletedTradingDate();
        const finalized =
          await getFinalized1D(
            key,
            sessionDate,
          );

        if (finalized?.candles?.length) {
          return res.json({
            success: true,
            source: "redis-finalized-1d",
            marketOpen: false,
            sessionDate,
            baselineClose:
              finalized.baselineClose ?? null,
            baselineDate:
              finalized.baselineDate ?? null,
            data: {
              candles: finalized.candles,
              baselineClose:
                finalized.baselineClose ?? null,
              baselineDate:
                finalized.baselineDate ?? null,
            },
          });
        }
      }

      const cacheKey = historyKey(
        key,
        unit,
        interval,
        from,
        to,
      );

      if (
        env.redisEnabled &&
        !forceRefresh
      ) {
        const cached =
          await redis.get(cacheKey);

        if (cached) {
          const parsed =
            JSON.parse(cached);

          // Only accept v2 history objects. Older array-only cache entries
          // did not contain a real prior-day baseline.
          if (
            parsed &&
            !Array.isArray(parsed) &&
            Object.prototype.hasOwnProperty.call(
              parsed,
              "baselineClose",
            )
          ) {
            return res.json({
              success: true,
              source: "cache",
              marketOpen:
                isMarketOpen(),
              refreshed: false,
              data: parsed,
            });
          }
        }
      }

      let data;

      if (
        isOneDay &&
        !isMarketOpen()
      ) {
        const sessionDate =
          latestCompletedTradingDate();
        data =
          await fetchOfficialIntradaySession(
            key,
            sessionDate,
          );
      } else {
        data =
          await upstox.fetchHistory(
            key,
            unit,
            interval,
            to,
            from || undefined,
          );
      }

      let baselineClose = null;
      let baselineDate = null;
      let sessionDate = null;

      if (isOneDay) {
        sessionDate =
          !isMarketOpen()
            ? latestCompletedTradingDate()
            : to;

        const previous =
          await resolvePreviousClose(
            key,
            sessionDate,
          );

        baselineClose =
          previous?.close ?? null;
        baselineDate =
          previous?.tradingDate ?? null;

        data =
          filterTradingSession(
            data,
            sessionDate,
          );
      } else {
        /*
         * Match the range-return convention used by the stock detail UI: the
         * selected period starts at the first trading candle inside the range,
         * and its opening price is the starting value. This is why a 1W range
         * beginning on a trading day can differ from the prior-day-close
         * convention. It also makes All work by using the first available
         * historical candle rather than looking for a date before 2000.
         */
        const firstCandle =
          Array.isArray(data) && data.length
            ? data[0]
            : null;
        const firstOpen = Number(
          firstCandle?.open ??
          firstCandle?.openPrice ??
          firstCandle?.price,
        );

        if (Number.isFinite(firstOpen) && firstOpen > 0) {
          baselineClose = firstOpen;
          const firstTimestamp = Date.parse(
            firstCandle?.timestamp,
          );
          baselineDate = Number.isFinite(firstTimestamp)
            ? indiaDate(new Date(firstTimestamp))
            : from || null;
        }
      }

      const payload = {
        candles:
          Array.isArray(data)
            ? data
            : [],
        baselineClose,
        baselineDate,
        source: "upstox",
      };

      if (!payload.candles.length) {
        throw new Error(
          `No historical candles returned for ${key}`,
        );
      }

      if (env.redisEnabled) {
        await redis.set(
          cacheKey,
          JSON.stringify(payload),
          {
            EX:
              env.historyCacheSeconds,
          },
        );
      }

      /*
       * Seed the finalized session cache for after-close reads. The scheduled
       * settlement still persists the official close and can retry safely.
       */
      if (
        isOneDay &&
        !isMarketOpen() &&
        sessionDate
      ) {
        const last =
          payload.candles[
            payload.candles.length - 1
          ];

        await cacheFinalized1D(
          key,
          sessionDate,
          {
            tradingDate:
              sessionDate,
            candles:
              payload.candles,
            closePrice:
              Number(last?.close) || null,
            baselineClose,
            baselineDate,
            source:
              "upstox-finalized-intraday",
            finalizedAt:
              new Date().toISOString(),
          },
        );
      }

      return res.json({
        success: true,
        source: "upstox",
        marketOpen:
          isMarketOpen(),
        refreshed:
          forceRefresh,
        sessionDate:
          sessionDate || undefined,
        baselineClose,
        baselineDate,
        data: payload,
      });
    } catch (err) {
      /*
       * Keep the existing DB fallback for longer ranges. Baseline is resolved
       * independently from the first candle, so weekends/holidays are safe.
       */
      if (
        !isOneDay &&
        env.mysqlEnabled &&
        ["days", "weeks", "months"].includes(
          unit,
        )
      ) {
        try {
          const dbData =
            await getDbHistory(
              key,
              from || "2000-01-01",
              to,
            );

          if (dbData.length) {
            const firstCandle = dbData[0];
            const firstOpen = Number(
              firstCandle?.open ??
              firstCandle?.openPrice ??
              firstCandle?.price,
            );
            const firstTimestamp = Date.parse(
              firstCandle?.timestamp,
            );
            const baselineClose =
              Number.isFinite(firstOpen) && firstOpen > 0
                ? firstOpen
                : null;
            const baselineDate =
              Number.isFinite(firstTimestamp)
                ? indiaDate(new Date(firstTimestamp))
                : from || null;

            const payload = {
              candles: dbData,
              baselineClose,
              baselineDate,
              source: "database",
            };

            if (env.redisEnabled) {
              await redis.set(
                historyKey(
                  key,
                  unit,
                  interval,
                  from,
                  to,
                ),
                JSON.stringify(
                  payload,
                ),
                {
                  EX:
                    env.historyCacheSeconds,
                },
              );
            }

            return res.json({
              success: true,
              source: "database",
              marketOpen:
                isMarketOpen(),
              refreshed: false,
              baselineClose,
              baselineDate,
              data: payload,
            });
          }
        } catch (dbError) {
          logger.warn(
            "Database history fallback failed",
            {
              instrumentKey: key,
              error:
                errorMessage(
                  dbError,
                ),
            },
          );
        }
      }

      logger.error(
        "History request failed",
        {
          instrumentKey: key,
          unit,
          interval,
          from,
          to,
          forceRefresh,
          error:
            errorMessage(err),
        },
      );

      return res.status(502).json({
        success: false,
        message:
          errorMessage(err),
      });
    }
  },
);

app.get(
  "/api/detail-stock/fundamentals/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res
        .status(400)
        .json({
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
      return res
        .status(400)
        .json({
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
          data?.shareholding ||
          [],

        mutualFunds:
          data?.mutualFunds ||
          [],

        updatedAt:
          data?.updatedAt,
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
      )
        .trim()
        .toUpperCase();

    if (!validIsin(isin)) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Invalid ISIN",
        });
    }

    try {
      const profile =
        await upstox.getProfile(
          isin
        );

      return res.json({
        success: true,

        isin,

        profile: {
          company_profile:
            profile?.company_profile ??
            null,

          sector:
            profile?.sector ??
            null,

          sector_market_cap_inr:
            {
              value:
                profile
                  ?.sector_market_cap_inr
                  ?.value ??
                null,

              unit:
                profile
                  ?.sector_market_cap_inr
                  ?.unit ??
                "crore",

              formatted:
                profile
                  ?.sector_market_cap_inr
                  ?.formatted ??
                null,
            },

          sector_market_cap_usd:
            {
              value:
                profile
                  ?.sector_market_cap_usd
                  ?.value ??
                null,

              unit:
                profile
                  ?.sector_market_cap_usd
                  ?.unit ??
                null,

              formatted:
                profile
                  ?.sector_market_cap_usd
                  ?.formatted ??
                null,
            },
        },
      });
    } catch (err) {
      logger.error(
        "Company profile fetch failed",
        {
          isin,

          error:
            errorMessage(err),
        }
      );

      return res.status(502).json({
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
      return res
        .status(400)
        .json({
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
          data?.ratios ||
          [],

        updatedAt:
          data?.updatedAt,
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
  "/api/detail-stock/corporate-actions/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res
        .status(400)
        .json({
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

app.get(
  "/api/detail-stock/competitors/:isin",
  async (req, res) => {
    const isin =
      String(
        req.params.isin ||
          ""
      ).toUpperCase();

    if (!validIsin(isin)) {
      return res
        .status(400)
        .json({
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

app.get(
  "/api/detail-stock/financial-performance/:identifier",
  async (req, res) => {
    try {
      const identifier = String(
        req.params.identifier || ""
      ).trim().toUpperCase();

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: "Stock identifier is required",
        });
      }

      let isin = identifier;

      // If identifier is a SYMBOL, resolve it from DB
      if (!validIsin(isin)) {
        isin = await getIsinBySymbol(identifier);
      }

      if (!isin || !validIsin(isin)) {
        return res.status(404).json({
          success: false,
          message: `Could not resolve ISIN for ${identifier}`,
        });
      }

      const data = await getFundamentalsCached(isin);

      return res.json({
        success: true,
        symbol: identifier,
        isin,

        incomeStatement:
          data?.incomeStatement || null,

        balanceSheet:
          data?.balanceSheet || null,

        cashFlow:
          data?.cashFlow || null,

        fundamentals:
          data?.fundamentals || null,

        ratios:
          data?.ratios || [],

        updatedAt:
          data?.updatedAt || Date.now(),
      });

    } catch (error) {
      logger.error("Failed to fetch financial performance", {
        error: error?.message || String(error),
      });

      return res.status(502).json({
        success: false,
        message:
          error?.message ||
          "Failed to fetch financial performance",
      });
    }
  }
);

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
   SIMULATED BUY / SELL
========================================================= */

app.post(
  "/api/detail-stock/order",
  authenticateToken,
  async (req, res) => {
    const body =
      req.body || {};

    /*
     * ---------------------------------------------
     * Validate instrument
     * ---------------------------------------------
     */

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

    /*
     * ---------------------------------------------
     * Validate quantity
     * ---------------------------------------------
     */

    const quantity =
      Number(body.quantity);

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

    /*
     * ---------------------------------------------
     * BUY / SELL
     * ---------------------------------------------
     */

    const transactionType =
      String(
        body.transactionType ||
          body.orderType ||
          ""
      ).toUpperCase();

    if (
      !["BUY", "SELL"].includes(
        transactionType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "transactionType must be BUY or SELL",
      });
    }

    /*
     * ---------------------------------------------
     * MARKET / LIMIT
     * ---------------------------------------------
     */

    const orderType =
      String(
        body.orderType ||
          "MARKET"
      ).toUpperCase();

    /*
     * orderType is simulation-only.
     * It is NEVER sent to Upstox.
     */

    if (
      !["MARKET", "LIMIT"].includes(
        orderType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid orderType",
      });
    }

    /*
     * ---------------------------------------------
     * TEST MODE
     * ---------------------------------------------
     *
     * For now BUY/SELL is allowed even
     * when the real market is closed.
     *
     * This is ONLY for testing.
     *
     * No real Upstox order is sent.
     */

    const marketOpen =
      true;

    /*
     * When testing is finished, replace
     * the above with:
     *
     * const marketOpen =
     *   isMarketOpen();
     *
     * if (!marketOpen) {
     *   return res.status(403).json({
     *     success: false,
     *     code: "MARKET_CLOSED",
     *     marketOpen: false,
     *     message: "Market is closed",
     *   });
     * }
     */

    /*
     * ---------------------------------------------
     * Price validation
     * ---------------------------------------------
     */

    const requestedPrice =
      Number(body.price);

    if (
      body.price != null &&
      body.price !== "" &&
      (
        !Number.isFinite(
          requestedPrice
        ) ||
        requestedPrice <= 0
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid price",
      });
    }

    try {
      /*
       * ---------------------------------------------
       * SIMULATION ONLY
       * ---------------------------------------------
       *
       * This calls simulateOrder().
       *
       * It NEVER calls:
       *
       * upstox.placeOrder()
       *
       * or any broker order API.
       */

      const result =
        await simulateOrder({
          userId:
            req.userId,

          instrumentKey:
            body.instrumentKey,

          transactionType,

          quantity,

          price:
            Number.isFinite(
              requestedPrice
            ) &&
            requestedPrice > 0
              ? requestedPrice
              : null,

          orderType,

          product:
            "CNC",
        });

      /*
       * Failed simulated order,
       * for example insufficient
       * holdings on SELL.
       */

      if (!result.success) {
        return res.status(400).json(
          result
        );
      }

      /*
       * Successful simulated order
       */

      return res.json({
        success: true,

        simulated:
          true,

        marketOpen:
          true,

        data:
          result,
      });
    } catch (err) {
      logger.error(
        "Simulated order failed",
        {
          userId:
            req.userId,

          instrumentKey:
            body.instrumentKey,

          transactionType,

          error:
            errorMessage(err),
        }
      );

      return res.status(500).json({
        success: false,

        message:
          err?.message ||
          "Unable to complete simulated order",
      });
    }
  }
);

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
   PERSISTENCE & CRON
========================================================= */

async function persistClosingPrices(
  reason = "scheduled-settlement",
) {
  if (!isTradingDay()) {
    logger.info("EOD settlement skipped on non-trading day", {
      date: indiaDate(),
      reason,
    });
    return { total: 0, saved: 0, skipped: true };
  }

  if (!isAfterMarketClose()) {
    logger.warn("EOD settlement skipped because market is still open", {
      date: indiaDate(),
      reason,
    });
    return { total: 0, saved: 0, skipped: true };
  }

  const tradingDate = indiaDate();
  const result = await reconcileAllMarketStocks(
    reason,
    tradingDate,
  );

  if (
    env.redisEnabled &&
    result.total > 0 &&
    result.saved >= result.total
  ) {
    try {
      await redis.set(
        `detailstock:close-reconciled:v3:${tradingDate}`,
        "ok",
        { EX: 3 * 24 * 60 * 60 },
      );
    } catch (err) {
      logger.warn("EOD settlement marker write failed", {
        date: tradingDate,
        error: errorMessage(err),
      });
    }
  }

  return result;
}

const closeTask = cron.schedule(
  closeCron,
  () => {
    persistClosingPrices("scheduled-settlement").catch((err) => {
      logger.error("Scheduled EOD settlement failed", {
        error: errorMessage(err),
      });
    });
  },
  { timezone: env.timezone },
);

const closeRetryTask = cron.schedule(
  closeRetryCron,
  () => {
    persistClosingPrices("scheduled-settlement-retry").catch((err) => {
      logger.error("Scheduled EOD settlement retry failed", {
        error: errorMessage(err),
      });
    });
  },
  { timezone: env.timezone },
);

function getNextCronRun(task) {
  try {
    const next = task?.getNextRun?.();
    return next instanceof Date
      ? next.toISOString()
      : String(next || "unknown");
  } catch {
    return "unknown";
  }
}

logger.info("EOD settlement cron jobs registered", {
  closeJobTime,
  closeRetryTime,
  timezone: env.timezone,
  nextSettlementRun:
    getNextCronRun(closeTask),
  nextRetryRun:
    getNextCronRun(closeRetryTask),
});

/* =========================================================
   STARTUP & SHUTDOWN
========================================================= */

async function startup() {
  await connectRedis();

  await initDb();

  await reconcileOnStartup();

  server.listen(
    env.port,
    "127.0.0.1",
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

let shuttingDown =
  false;

async function shutdown(
  signal
) {
  if (shuttingDown) {
    return;
  }

  shuttingDown =
    true;

  logger.info(
    "Shutdown requested",
    {
      signal,
    }
  );

  try {
    for (
      const key of
        upstox.getSubscribed()
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
    if (
      env.redisEnabled
    ) {
      await redis.quit();
    }
  } catch {}

  process.exit(0);
}

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
