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
// const { getStockFinancials, parseMarketTick } = upstox;
// const jwt = require("jsonwebtoken");
// const { simulateOrder } = require("./simulatedOrderService");
// const JWT_SECRET = process.env.JWT_SECRET || "zerodha_secret_key";

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

//     if (Array.isArray(env.origins) && env.origins.includes(origin)) {
//       return callback(null, true);
//     }

//     try {
//       const parsed = new URL(origin);
//       const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(
//         parsed.hostname,
//       );

//       if (isLocalHost && ["http:", "https:"].includes(parsed.protocol)) {
//         return callback(null, true);
//       }
//     } catch {
//       // Fall through to normal CORS rejection
//     }

//     return callback(new Error("CORS origin not allowed"));
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

// app.use(helmet({ crossOriginResourcePolicy: false }));
// app.use(compression());
// app.use(cors(corsOptions));
// app.use(express.json({ limit: "64kb" }));

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
// const HISTORY_PREFIX = "detailstock:history:";

// const fundamentalsByIsin = new Map();
// const fundamentalsInflight = new Map();
// const FUNDAMENTALS_TTL = 15 * 60 * 1000;

// /* =========================================================
//    VALIDATION HELPERS
// ========================================================= */

// function validKey(key) {
//   return typeof key === "string" && key.length >= 5 && key.length <= 180;
// }

// function validIsin(isin) {
//   return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
// }

// function snapshotKey(key) {
//   return `${SNAP_PREFIX}${key}`;
// }

// function historyKey(key, unit, interval, from, to) {
//   return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ""}:${to}`;
// }

// function isinFromInstrumentKey(key) {
//   const candidate = String(key || "").split("|")[1] || "";
//   return validIsin(candidate) ? candidate : null;
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


// function authenticateToken(req, res, next) {
//   try {
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         success: false,
//         message: "Authorization token required",
//       });
//     }

//     if (!authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid authorization format",
//       });
//     }

//     const token = authHeader.slice(7).trim();

//     if (!token) {
//       return res.status(401).json({
//         success: false,
//         message: "Token missing",
//       });
//     }

//     const decoded = jwt.verify(token, JWT_SECRET);

//     if (!decoded.userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid token payload",
//       });
//     }

//     req.userId = decoded.userId;

//     next();
//   } catch (error) {
//     logger.warn("JWT authentication failed", {
//       error: error.message,
//     });

//     return res.status(401).json({
//       success: false,
//       message: "Invalid or expired token",
//     });
//   }
// }

// /* =========================================================
//    CRON HELPERS
// ========================================================= */

// function timeToWeekdayCron(value, fallback) {
//   const raw = String(value || fallback || "").trim();
//   const match = raw.match(/^(\d{1,2}):(\d{2})$/);

//   if (!match) {
//     throw new Error(
//       `Invalid cron time "${raw}". Expected HH:MM, for example 15:35`,
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
//       `Invalid cron time "${raw}". Expected HH:MM between 00:00 and 23:59`,
//     );
//   }

//   return `${minute} ${hour} * * 1-5`;
// }

// function getCronTimeFromEnv(key, fallback) {
//   const value = process.env[key];
//   if (value) return value;
//   if (key === "CLOSE_JOB_TIME" && env.closeJobTime) return env.closeJobTime;
//   if (key === "CLOSE_RETRY_TIME" && env.closeRetryTime)
//     return env.closeRetryTime;
//   return fallback;
// }

// const closeJobTime = getCronTimeFromEnv("CLOSE_JOB_TIME", "15:35");
// const closeRetryTime = getCronTimeFromEnv("CLOSE_RETRY_TIME", "15:45");
// const closeCron = timeToWeekdayCron(closeJobTime, "15:35");
// const closeRetryCron = timeToWeekdayCron(closeRetryTime, "15:45");

// logger.info("Cron configuration loaded", {
//   closeJobTime,
//   closeRetryTime,
//   closeCron,
//   closeRetryCron,
//   timezone: env.timezone,
// });

// /* =========================================================
//    SNAPSHOT CACHE
// ========================================================= */

// async function cacheSnapshot(snapshot) {
//   if (!snapshot?.instrumentKey) return;
//   snapshots.set(snapshot.instrumentKey, snapshot);

//   if (env.redisEnabled) {
//     await redis.set(
//       snapshotKey(snapshot.instrumentKey),
//       JSON.stringify(snapshot),
//       {
//         EX: env.snapshotCacheSeconds,
//       },
//     );
//   }
// }

// async function getSnapshot(key) {
//   if (snapshots.has(key)) return snapshots.get(key);
//   if (!env.redisEnabled) return null;

//   const raw = await redis.get(snapshotKey(key));
//   if (!raw) return null;

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

// async function enrichWithStoredPreviousClose(snapshot) {
//   if (!snapshot || Number(snapshot.previousClose) > 0) return snapshot;
//   if (!env.mysqlEnabled) return snapshot;

//   try {
//     const previous = await getPreviousStoredClose(
//       snapshot.instrumentKey,
//       indiaDate(),
//     );

//     if (previous?.close != null) {
//       const close = Number(previous.close);
//       const price = Number(snapshot.price);

//       if (Number.isFinite(close) && close > 0) {
//         snapshot.previousClose = close;
//         if (Number.isFinite(price)) {
//           snapshot.change = price - close;
//           snapshot.changePercent = ((price - close) / close) * 100;
//         }
//         snapshot.previousCloseDate = previous.trading_date;
//         snapshot.previousCloseSource = "database-fallback";
//       }
//     }
//   } catch (err) {
//     logger.warn("Previous close fallback lookup failed", {
//       instrumentKey: snapshot.instrumentKey,
//       error: err.message,
//     });
//   }

//   return snapshot;
// }

// /* =========================================================
//    INSTRUMENT CONTEXT
// ========================================================= */

// async function getInstrumentContext(instrumentKey) {
//   if (!env.mysqlEnabled) return null;

//   const marketRow = await getMarketStockByInstrumentKey(instrumentKey);
//   const master = await getInstrumentMaster(instrumentKey);

//   if (!marketRow && !master) return null;

//   const isin = master?.isin || isinFromInstrumentKey(instrumentKey);
//   let bse = null;

//   if (isin) {
//     bse = await getBseInstrumentByIsin(isin);
//   }

//   return {
//     marketRow,
//     master,
//     bse,
//     isin,
//     symbol: master?.trading_symbol || marketRow?.symbol || null,
//     name: master?.name || marketRow?.name || null,
//     exchange: master?.exchange || "NSE",
//     segment: master?.segment || null,
//   };
// }

// /* =========================================================
//    PRIME SNAPSHOT
// ========================================================= */

// async function primeSnapshot(instrumentKey) {
//   const context = await getInstrumentContext(instrumentKey);
//   const today = indiaDate();
//   const marketOpen = isMarketOpen();

//   const existing = await getSnapshot(instrumentKey);

//   const existingIsFresh =
//     existing?.marketDate === today &&
//     (marketOpen
//       ? existing?.marketStatus !== "CLOSED"
//       : existing?.marketStatus === "CLOSED" &&
//       existing?.source === "upstox-close-reconciliation");

//   if (existing && existingIsFresh) return existing;

//   const snapshot = await upstox.fetchOhlc(instrumentKey);

//   if (context) {
//     snapshot.symbol = context.symbol;
//     snapshot.name = context.name;
//     snapshot.exchange = context.exchange;
//     snapshot.segment = context.segment;
//     snapshot.isin = context.isin;
//     snapshot.sector = context.marketRow?.sector || null;
//   }

//   snapshot.marketDate = today;
//   snapshot.marketOpen = marketOpen;
//   snapshot.marketStatus = marketOpen ? "OPEN" : "CLOSED";

//   await enrichWithStoredPreviousClose(snapshot);
//   await cacheSnapshot(snapshot);

//   return snapshot;
// }

// /* =========================================================
//    FUNDAMENTALS CACHE
// ========================================================= */

// async function getFundamentalsCached(isin) {
//   const cached = fundamentalsByIsin.get(isin);

//   if (cached && cached.expiresAt > Date.now()) {
//     return cached.data;
//   }

//   const inflight = fundamentalsInflight.get(isin);
//   if (inflight) {
//     return inflight;
//   }

//   const fetchPromise = (async () => {
//     try {
//       const data = await upstox.getFundamentals(isin);

//       fundamentalsByIsin.set(isin, {
//         data,
//         expiresAt: Date.now() + FUNDAMENTALS_TTL,
//       });

//       return data;
//     } catch (err) {
//       logger.error("getFundamentalsCached upstream fetch failed", {
//         isin,
//         error: err?.message,
//       });
//       throw err;
//     } finally {
//       fundamentalsInflight.delete(isin);
//     }
//   })();

//   fundamentalsInflight.set(isin, fetchPromise);

//   return fetchPromise;
// }

// /* =========================================================
//    MARKET DATE HELPERS
// ========================================================= */

// function isAfterMarketClose(date = new Date()) {
//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: env.timezone,
//     hour: "2-digit",
//     minute: "2-digit",
//     hourCycle: "h23",
//   }).formatToParts(date);

//   const hour = Number(parts.find((x) => x.type === "hour")?.value || 0);
//   const minute = Number(parts.find((x) => x.type === "minute")?.value || 0);
//   const [closeHour, closeMinute] = String(env.marketClose)
//     .split(":")
//     .map(Number);

//   return hour * 60 + minute >= closeHour * 60 + closeMinute;
// }

// function previousTradingDate(date = new Date()) {
//   const d = new Date(date);
//   d.setDate(d.getDate() - 1);
//   while (!isTradingDay(d)) {
//     d.setDate(d.getDate() - 1);
//   }
//   return indiaDate(d);
// }

// function latestCompletedTradingDate(date = new Date()) {
//   if (isTradingDay(date) && isAfterMarketClose(date)) {
//     return indiaDate(date);
//   }
//   return previousTradingDate(date);
// }

// /* =========================================================
//    CLOSING SNAPSHOT NORMALIZATION
// ========================================================= */

// function normalizeClosingSnapshot(key, q, row) {
//   const ohlc = q?.ohlc || {};
//   const price = Number(q?.last_price);

//   if (!Number.isFinite(price)) return null;

//   const netChange = Number(q?.net_change);
//   let previousClose = Number.NaN;

//   if (Number.isFinite(netChange)) {
//     previousClose = price - netChange;
//   } else if (Number.isFinite(Number(q?.cp))) {
//     previousClose = Number(q.cp);
//   } else if (Number.isFinite(Number(q?.prev_close))) {
//     previousClose = Number(q.prev_close);
//   } else if (Number.isFinite(Number(q?.previous_close))) {
//     previousClose = Number(q.previous_close);
//   }

//   if (!Number.isFinite(previousClose) || previousClose <= 0) {
//     const fallback = Number(ohlc.close);
//     if (Number.isFinite(fallback) && fallback > 0) {
//       previousClose = fallback;
//     }
//   }

//   const change = Number.isFinite(previousClose) ? price - previousClose : null;

//   return {
//     instrumentKey: key,
//     symbol: row?.symbol || q?.symbol || null,
//     tradingSymbol: row?.symbol || q?.symbol || null,
//     name: row?.name || null,
//     companyName: row?.name || null,
//     exchange: env.marketStockExchange,
//     segment: env.marketStockSegment,
//     sector: row?.sector || null,
//     ltp: price,
//     price,
//     dayClose: price,
//     previousClose: Number.isFinite(previousClose) ? previousClose : null,
//     change,
//     changePercent:
//       Number.isFinite(previousClose) && previousClose
//         ? (change / previousClose) * 100
//         : null,
//     open: Number.isFinite(Number(ohlc.open)) ? Number(ohlc.open) : null,
//     high: Number.isFinite(Number(ohlc.high)) ? Number(ohlc.high) : null,
//     low: Number.isFinite(Number(ohlc.low)) ? Number(ohlc.low) : null,
//     volume: Number.isFinite(Number(q?.volume)) ? Number(q.volume) : null,
//     upperCircuit: Number.isFinite(Number(q?.upper_circuit_limit))
//       ? Number(q.upper_circuit_limit)
//       : null,
//     lowerCircuit: Number.isFinite(Number(q?.lower_circuit_limit))
//       ? Number(q.lower_circuit_limit)
//       : null,
//     lastTradeTime: Number.isFinite(Number(q?.last_trade_time))
//       ? Number(q.last_trade_time)
//       : null,
//     timestamp: Date.now(),
//     marketDate: indiaDate(),
//     marketOpen: false,
//     marketStatus: "CLOSED",
//     source: "upstox-close-reconciliation",
//   };
// }

// /* =========================================================
//    CLOSING RECONCILIATION
// ========================================================= */

// let closingSyncPromise = null;

// async function reconcileAllMarketStocks(
//   reason,
//   targetTradingDate = latestCompletedTradingDate(),
// ) {
//   if (!env.mysqlEnabled) {
//     logger.warn("Closing reconciliation skipped: MySQL disabled", { reason });
//     return { total: 0, saved: 0 };
//   }

//   if (closingSyncPromise) return closingSyncPromise;

//   closingSyncPromise = (async () => {
//     const tradingDate = targetTradingDate;
//     const rows = await getMarketStockInstruments();

//     if (!rows.length) {
//       logger.warn("No market stocks found for closing reconciliation");
//       return { total: 0, saved: 0 };
//     }

//     const rowByKey = new Map(rows.map((row) => [row.instrument_key, row]));
//     const keys = rows.map((row) => row.instrument_key).filter(Boolean);
//     let saved = 0;

//     for (let i = 0; i < keys.length; i += 500) {
//       const chunk = keys.slice(i, i + 500);

//       try {
//         const quotes = await upstox.fetchQuotes(chunk);

//         for (const key of chunk) {
//           const q =
//             quotes[key] ||
//             quotes[key.replace("|", ":")] ||
//             Object.values(quotes).find((x) => x?.instrument_token === key);

//           if (!q) continue;

//           const snapshot = normalizeClosingSnapshot(key, q, rowByKey.get(key));
//           if (!snapshot) continue;

//           // await saveDailyClose(snapshot, tradingDate);

//           const finalSnapshot = {
//             ...snapshot,
//             marketOpen: false,
//             marketStatus: "CLOSED",
//             marketDate: tradingDate,
//           };

//           await cacheSnapshot(finalSnapshot);

//           if (subscribers.has(key)) {
//             io.to(`stock:${key}`).emit("detailStock:snapshot", finalSnapshot);
//           }

//           saved++;
//         }
//       } catch (err) {
//         logger.error("Closing quote batch failed", {
//           reason,
//           batchStart: i,
//           batchSize: chunk.length,
//           error: errorMessage(err),
//         });
//       }
//     }

//     logger.info("Market-stock closing reconciliation complete", {
//       reason,
//       tradingDate,
//       total: keys.length,
//       saved,
//     });

//     return { total: keys.length, saved };
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
//   if (!env.startupReconcileClosed || isMarketOpen()) return;

//   const rows = await getMarketStockInstruments();
//   if (!rows.length) return;

//   const date = latestCompletedTradingDate();
//   const totalStocks = rows.length;
//   const savedToday = await getDailyCloseCount(date);
//   const markerKey = `detailstock:close-reconciled:v2:${date}`;

//   let marker = null;

//   if (env.redisEnabled) {
//     try {
//       marker = await redis.get(markerKey);
//     } catch (err) {
//       logger.warn("Close reconciliation marker read failed", {
//         error: err.message,
//       });
//     }
//   }

//   const needsRepair = savedToday < totalStocks || marker !== "ok";

//   if (needsRepair) {
//     logger.info("Startup close reconciliation required", {
//       date,
//       totalStocks,
//       savedToday,
//       marker,
//     });
//     const result = await reconcileAllMarketStocks(
//       "startup-after-market-hours-v2",
//       date,
//     );

//     if (env.redisEnabled && result.saved > 0) {
//       try {
//         await redis.set(markerKey, "ok", { EX: 3 * 24 * 60 * 60 });
//       } catch (err) {
//         logger.warn("Close reconciliation marker write failed", {
//           error: err.message,
//         });
//       }
//     }
//   } else {
//     logger.info("Startup close reconciliation already complete", {
//       date,
//       totalStocks,
//       savedToday,
//     });
//   }
// }

// /* =========================================================
//    UPSTOX LIVE TICK HANDLER
// ========================================================= */

// upstox.setTickHandler((tick) => {
//   const previous = snapshots.get(tick.instrumentKey) || {};

//   const snapshot = {
//     ...previous,
//     ...tick,
//     instrumentKey: tick.instrumentKey,
//     marketDate: indiaDate(),
//     marketOpen: true,
//     marketStatus: "OPEN",
//     source: "upstox-websocket",
//   };

//   for (const field of [
//     "previousClose",
//     "open",
//     "high",
//     "low",
//     "volume",
//     "upperCircuit",
//     "lowerCircuit",
//     "lastTradeTime",
//   ]) {
//     if (snapshot[field] == null && previous[field] != null) {
//       snapshot[field] = previous[field];
//     }
//   }

//   if (snapshot.price != null && snapshot.previousClose != null) {
//     snapshot.change = Number(snapshot.price) - Number(snapshot.previousClose);
//     snapshot.changePercent = Number(snapshot.previousClose)
//       ? (snapshot.change / Number(snapshot.previousClose)) * 100
//       : null;
//   }

//   snapshots.set(tick.instrumentKey, snapshot);

//   if (env.redisEnabled) {
//     redis
//       .set(snapshotKey(tick.instrumentKey), JSON.stringify(snapshot), {
//         EX: env.snapshotCacheSeconds,
//       })
//       .catch((err) =>
//         logger.warn("Tick cache write failed", { error: err.message }),
//       );
//   }

//   io.to(`stock:${tick.instrumentKey}`).emit("detailStock:tick", snapshot);
// });

// /* =========================================================
//    SOCKET.IO
// ========================================================= */

// io.on("connection", (socket) => {
//   socket.on("detailStock:subscribe", async (payload, ack = () => { }) => {
//     const key = payload?.instrumentKey;

//     if (!validKey(key)) {
//       return ack({
//         success: false,
//         message: "Valid instrumentKey is required",
//       });
//     }

//     try {
//       const context = await getInstrumentContext(key);

//       if (!context?.master && env.mysqlEnabled) {
//         return ack({
//           success: false,
//           message: "Instrument is not in the stock universe",
//         });
//       }

//       socket.join(`stock:${key}`);

//       if (!subscribers.has(key)) {
//         subscribers.set(key, new Set());
//       }

//       const set = subscribers.get(key);
//       const first = set.size === 0;
//       set.add(socket.id);

//       if (first) {
//         await upstox.subscribe(key);
//       }

//       let snapshot = await primeSnapshot(key);

//       if (context) {
//         snapshot = {
//           ...snapshot,
//           instrumentKey: key,
//           symbol: context.symbol,
//           name: context.name,
//           exchange: context.exchange,
//           segment: context.segment,
//           isin: context.isin,
//           sector: context.marketRow?.sector || null,
//           bseInstrumentKey: context.bse?.instrument_key || null,
//         };
//       }

//       const isin = snapshot.isin || context?.isin;

//       if (isin) {
//         try {
//           const fundamentals = await getFundamentalsCached(isin);
//           snapshot = { ...snapshot, ...fundamentals, isin };
//         } catch (err) {
//           logger.warn("Fundamentals unavailable on subscribe", {
//             instrumentKey: key,
//             isin,
//             error: errorMessage(err),
//           });
//         }
//       }

//       await cacheSnapshot(snapshot);

//       socket.emit("detailStock:snapshot", {
//         ...snapshot,
//         marketOpen: isMarketOpen(),
//       });

//       ack({
//         success: true,
//         subscribed: true,
//         deduplicated: !first,
//         subscriberCount: set.size,
//         snapshot,
//       });
//     } catch (err) {
//       logger.error("Detail stock subscribe failed", {
//         instrumentKey: key,
//         socketId: socket.id,
//         error: errorMessage(err),
//       });

//       ack({ success: false, message: errorMessage(err) });
//     }
//   });

//   socket.on("detailStock:unsubscribe", async (payload, ack = () => { }) => {
//     const key = payload?.instrumentKey;
//     if (!validKey(key)) return ack({ success: false });

//     await release(key, socket.id);
//     socket.leave(`stock:${key}`);
//     ack({ success: true });
//   });

//   socket.on("disconnect", async () => {
//     for (const [key, set] of subscribers.entries()) {
//       if (set.has(socket.id)) {
//         await release(key, socket.id);
//       }
//     }
//   });
// });

// async function release(key, socketId) {
//   const set = subscribers.get(key);
//   if (!set) return;

//   set.delete(socketId);

//   if (set.size === 0) {
//     subscribers.delete(key);
//     await upstox.unsubscribe(key, false);
//     logger.info("Stock room became empty", { instrumentKey: key });
//   }
// }

// /* =========================================================
//    ROUTES
// ========================================================= */

// app.get("/health", async (req, res) => {
//   const status = marketStatus();
//   res.json({
//     success: true,
//     service: "detail-stock",
//     uptimeSeconds: Math.round(process.uptime()),
//     ...status,
//     redis: env.redisEnabled ? redis.isReady : false,
//     mysql: env.mysqlEnabled,
//     upstoxConnected: upstox.isConnected(),
//     upstoxSubscribed: upstox.getSubscribed().length,
//     activeRooms: subscribers.size,
//     time: new Date().toISOString(),
//   });
// });

// app.get("/api/financials/:symbol", async (req, res) => {
//   try {
//     const { symbol } = req.params;
//     const financials = await getStockFinancials(symbol);
    
//     res.json({ success: true, data: financials });
//   } catch (error) {
//     res.status(500).json({ 
//       success: false, 
//       message: error.message || "Internal server error" 
//     });
//   }
// });

// app.get("/api/stock/:symbol/financials", async (req, res) => {
//   try {
//     const { symbol } = req.params;

//     let isin = symbol;
//     if (!symbol.startsWith("INE") && !symbol.startsWith("IN0")) {
//       isin = await getIsinBySymbol(symbol);
//     }

//     if (!isin) {
//       return res.status(404).json({
//         success: false,
//         error: `Could not resolve ISIN for symbol: ${symbol}`,
//       });
//     }

//     const financials = await getStockFinancials(isin);

//     return res.json({
//       symbol,
//       isin,
//       ...financials,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       error: error.message || "Failed to fetch financials",
//     });
//   }
// });

// app.get("/api/detail-stock/market-stocks", async (req, res) => {
//   if (!env.mysqlEnabled) {
//     return res.status(503).json({ success: false, message: "MySQL disabled" });
//   }

//   try {
//     const rows = await getMarketStockInstruments();
//     res.json({
//       success: true,
//       marketOpen: isMarketOpen(),
//       count: rows.length,
//       data: rows,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/instrument/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;
//   if (!validKey(key)) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Invalid instrumentKey" });
//   }

//   try {
//     const context = await getInstrumentContext(key);
//     if (!context) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Instrument not found" });
//     }
//     res.json({ success: true, data: context });
//   } catch (err) {
//     res.status(500).json({ success: false, message: errorMessage(err) });
//   }
// }); 

// app.get("/api/detail-stock/snapshot/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;
//   if (!validKey(key)) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Invalid instrumentKey" });
//   }

//   try {
//     const snapshot = await primeSnapshot(key);
//     res.json({ success: true, marketOpen: isMarketOpen(), data: snapshot });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/history/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;
//   if (!validKey(key)) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Invalid instrumentKey" });
//   }

//   const allowedUnits = new Set(["minutes", "hours", "days", "weeks", "months"]);
//   const unit = allowedUnits.has(req.query.unit) ? req.query.unit : "days";
//   const interval = String(req.query.interval || "1");
//   const to = String(req.query.to || indiaDate());
//   const from = req.query.from ? String(req.query.from) : "";
//   const cacheKey = historyKey(key, unit, interval, from, to);

//   try {
//     if (env.redisEnabled) {
//       const cached = await redis.get(cacheKey);
//       if (cached) {
//         return res.json({
//           success: true,
//           source: "cache",
//           marketOpen: isMarketOpen(),
//           data: JSON.parse(cached),
//         });
//       }
//     }

//     const data = await upstox.fetchHistory(
//       key,
//       unit,
//       interval,
//       to,
//       from || undefined,
//     );

//     if (env.redisEnabled) {
//       await redis.set(cacheKey, JSON.stringify(data), {
//         EX: env.historyCacheSeconds,
//       });
//     }

//     res.json({
//       success: true,
//       source: "upstox",
//       marketOpen: isMarketOpen(),
//       data,
//     });
//   } catch (err) {
//     if (env.mysqlEnabled && ["days", "weeks", "months"].includes(unit)) {
//       try {
//         const dbData = await getDbHistory(key, from || "2000-01-01", to);
//         if (dbData.length) {
//           return res.json({
//             success: true,
//             source: "database",
//             marketOpen: isMarketOpen(),
//             data: dbData,
//           });
//         }
//       } catch { }
//     }

//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/fundamentals/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
  
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);
//     res.json({ success: true, isin, ...data });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/shareholding/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);
//     res.json({
//       success: true,
//       isin,
//       shareholding: data?.shareholding || [],
//       mutualFunds: data?.mutualFunds || [],
//       updatedAt: data?.updatedAt,
//     });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/about/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "")
//     .trim()
//     .toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     const profile = await upstox.getProfile(isin);
//     return res.json({
//       success: true,
//       isin,
//       profile: {
//         company_profile: profile?.company_profile ?? null,
//         sector: profile?.sector ?? null,
//         sector_market_cap_inr: {
//           value: profile?.sector_market_cap_inr?.value ?? null,
//           unit: profile?.sector_market_cap_inr?.unit ?? "crore",
//           formatted: profile?.sector_market_cap_inr?.formatted ?? null,
//         },
//         sector_market_cap_usd: {
//           value: profile?.sector_market_cap_usd?.value ?? null,
//           unit: profile?.sector_market_cap_usd?.unit ?? null,
//           formatted: profile?.sector_market_cap_usd?.formatted ?? null,
//         },
//       },
//     });
//   } catch (err) {
//     logger.error("Company profile fetch failed", {
//       isin,
//       error: errorMessage(err),
//     });
//     return res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/ratios/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);
//     res.json({
//       success: true,
//       isin,
//       ratios: data?.ratios || [],
//       updatedAt: data?.updatedAt,
//     });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/corporate-actions/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     res.json({
//       success: true,
//       isin,
//       data: await upstox.getCorporateActions(isin),
//       updatedAt: Date.now(),
//     });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/competitors/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     res.json({
//       success: true,
//       isin,
//       data: await upstox.getCompetitors(isin),
//       updatedAt: Date.now(),
//     });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/financial-performance/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();
//   if (!validIsin(isin)) {
//     return res.status(400).json({ success: false, message: "Invalid ISIN" });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);
//     res.json({
//       success: true,
//       isin,
//       incomeStatement: data?.incomeStatement || null,
//       balanceSheet: data?.balanceSheet || null,
//       cashFlow: data?.cashFlow || null,
//       updatedAt: data?.updatedAt || Date.now(),
//     });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/funds", async (req, res) => {
//   try {
//     const data = await upstox.getFunds();
//     res.json({ success: true, data });
//   } catch (err) {
//     res.status(502).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.post(
//   "/api/detail-stock/order",
//   authenticateToken,
//   async (req, res) => {
//     const body = req.body || {};

//     /*
//      * ---------------------------------------------
//      * Validate instrument
//      * ---------------------------------------------
//      */
//     if (!validKey(body.instrumentKey)) {
//       return res.status(400).json({
//         success: false,
//         message: "Valid instrumentKey is required",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * Validate quantity
//      * ---------------------------------------------
//      */
//     const quantity = Number(body.quantity);

//     if (!Number.isInteger(quantity) || quantity <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Quantity must be a positive integer",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * Accept transactionType from frontend
//      * ---------------------------------------------
//      */
//     const transactionType =
//       String(
//         body.transactionType || body.orderType || ""
//       ).toUpperCase();

//     if (!["BUY", "SELL"].includes(transactionType)) {
//       return res.status(400).json({
//         success: false,
//         message: "transactionType must be BUY or SELL",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * Validate order type
//      * ---------------------------------------------
//      */
//     const orderType =
//       String(body.orderType || "MARKET").toUpperCase();

//     /*
//      * The simulation supports the UI's MARKET/LIMIT concept.
//      * It is NOT sent to Upstox.
//      */
//     if (!["MARKET", "LIMIT"].includes(orderType)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid orderType",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * IMPORTANT:
//      * Server-side market-hours check
//      *
//      * Frontend disabling is NOT enough.
//      * ---------------------------------------------
//      */
//     // if (!isMarketOpen()) {
//     //   return res.status(403).json({
//     //     success: false,
//     //     code: "MARKET_CLOSED",
//     //     marketOpen: false,
//     //     message: "Market is closed",
//     //   });
//     // }
//     const marketOpen = true;

//     /*
//      * ---------------------------------------------
//      * Price validation
//      * ---------------------------------------------
//      */
//     const requestedPrice = Number(body.price);

//     if (
//       body.price != null &&
//       body.price !== "" &&
//       (!Number.isFinite(requestedPrice) || requestedPrice <= 0)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid price",
//       });
//     }

//     try {
//       /*
//        * IMPORTANT:
//        *
//        * This calls our simulation service.
//        * It NEVER calls upstox.placeOrder().
//        */
//       const result = await simulateOrder({
//         userId: req.userId,
//         instrumentKey: body.instrumentKey,
//         transactionType,
//         quantity,
//         price:
//           Number.isFinite(requestedPrice) &&
//           requestedPrice > 0
//             ? requestedPrice
//             : null,
//         orderType,
//         product: "CNC",
//       });

//       if (!result.success) {
//         return res.status(400).json(result);
//       }

//       return res.json({
//         success: true,
//         simulated: true,
//         marketOpen: true,
//         data: result,
//       });
//     } catch (err) {
//       logger.error("Simulated order failed", {
//         userId: req.userId,
//         instrumentKey: body.instrumentKey,
//         transactionType,
//         error: errorMessage(err),
//       });

//       return res.status(500).json({
//         success: false,
//         message:
//           err?.message ||
//           "Unable to complete simulated order",
//       });
//     }
//   }
// );

// app.get("/api/detail-stock/market-stocks-count", async (req, res) => {
//   try {
//     res.json({
//       success: true,
//       count: env.mysqlEnabled ? await getMarketStockCount() : 0,
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: errorMessage(err) });
//   }
// });

// app.get("/api/detail-stock/status/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;
//   res.json({
//     success: true,
//     instrumentKey: key,
//     marketOpen: isMarketOpen(),
//     subscriberCount: subscribers.get(key)?.size || 0,
//     subscribed: upstox.getSubscribed().includes(key),
//     snapshot: await getSnapshot(key),
//   });
// });

// /* =========================================================
//    PERSISTENCE & CRON
// ========================================================= */

// async function persistClosingPrices(reason = "scheduled-close") {
//   if (!isTradingDay()) {
//     logger.info("Close persistence skipped on non-trading day", {
//       date: indiaDate(),
//       reason,
//     });
//     return;
//   }

//   if (!isMarketOpen()) {
//     const result = await reconcileAllMarketStocks(reason, indiaDate());

//     if (env.redisEnabled && result.saved > 0) {
//       try {
//         await redis.set(
//           `detailstock:close-reconciled:v2:${indiaDate()}`,
//           "ok",
//           {
//             EX: 3 * 24 * 60 * 60,
//           },
//         );
//       } catch (err) {
//         logger.warn("Close reconciliation marker write failed", {
//           error: err.message,
//         });
//       }
//     }
//   } else {
//     logger.warn("Closing persistence job ran while market was open", {
//       reason,
//     });
//   }
// }

// // cron.schedule(
// //   closeCron,
// //   () => {
// //     persistClosingPrices("scheduled-close").catch((err) => {
// //       logger.error("Scheduled close persistence failed", {
// //         error: errorMessage(err),
// //       });
// //     });
// //   },
// //   { timezone: env.timezone },
// // );

// // cron.schedule(
// //   closeRetryCron,
// //   () => {
// //     persistClosingPrices("scheduled-close-retry").catch((err) => {
// //       logger.error("Scheduled close retry failed", {
// //         error: errorMessage(err),
// //       });
// //     });
// //   },
// //   { timezone: env.timezone },
// // );

// /* =========================================================
//    STARTUP & SHUTDOWN
// ========================================================= */

// async function startup() {
//   await connectRedis();
//   await initDb();
//   await reconcileOnStartup();

//   server.listen(env.port, () => {
//     logger.info("detail-stock server started", {
//       port: env.port,
//       nodeEnv: env.nodeEnv,
//       marketOpen: isMarketOpen(),
//       origins: env.origins,
//       closeJobTime,
//       closeRetryTime,
//       closeCron,
//       closeRetryCron,
//       timezone: env.timezone,
//     });
//   });
// }

// let shuttingDown = false;

// async function shutdown(signal) {
//   if (shuttingDown) return;
//   shuttingDown = true;

//   logger.info("Shutdown requested", { signal });

//   try {
//     for (const key of upstox.getSubscribed()) {
//       await upstox.unsubscribe(key, true);
//     }
//   } catch { }

//   try {
//     io.close();
//   } catch { }
//   try {
//     server.close();
//   } catch { }
//   try {
//     await closeDb();
//   } catch { }
//   try {
//     if (env.redisEnabled) await redis.quit();
//   } catch { }

//   process.exit(0);
// }

// process.on("SIGTERM", () => shutdown("SIGTERM"));
// process.on("SIGINT", () => shutdown("SIGINT"));

// process.on("uncaughtException", (err) => {
//   logger.error("Uncaught exception", { error: err.stack || err.message });
// });

// process.on("unhandledRejection", (err) => {
//   logger.error("Unhandled rejection", { error: err?.stack || String(err) });
// });

// startup().catch((err) => {
//   logger.error("Startup failed", { error: err.stack || err.message });
//   process.exit(1);
// });


















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
const { getStockFinancials, parseMarketTick } = upstox;
const jwt = require("jsonwebtoken");
const { simulateOrder } = require("./simulatedOrderService");

const JWT_SECRET =
  process.env.JWT_SECRET || "zerodha_secret_key";

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
const HISTORY_PREFIX = "detailstock:history:";

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

function authenticateToken(req, res, next) {
  try {
    const authHeader =
      req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization token required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format",
      });
    }

    const token =
      authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid token payload",
      });
    }

    req.userId = decoded.userId;

    next();
  } catch (error) {
    logger.warn(
      "JWT authentication failed",
      {
        error: error.message,
      }
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired token",
    });
  }
}

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
    "15:35"
  );

const closeRetryTime =
  getCronTimeFromEnv(
    "CLOSE_RETRY_TIME",
    "15:45"
  );

const closeCron =
  timeToWeekdayCron(
    closeJobTime,
    "15:35"
  );

const closeRetryCron =
  timeToWeekdayCron(
    closeRetryTime,
    "15:45"
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

  const hour =
    Number(
      parts.find(
        (x) => x.type === "hour"
      )?.value || 0
    );

  const minute =
    Number(
      parts.find(
        (x) => x.type === "minute"
      )?.value || 0
    );

  const [
    closeHour,
    closeMinute,
  ] =
    String(env.marketClose)
      .split(":")
      .map(Number);

  return (
    hour * 60 + minute >=
    closeHour * 60 +
      closeMinute
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

  return previousTradingDate(
    date
  );
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
      Number.isFinite(
        previousClose
      )
        ? previousClose
        : null,

    change,

    changePercent:
      Number.isFinite(
        previousClose
      ) &&
      previousClose
        ? (change /
            previousClose) *
          100
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
        Number(q?.upper_circuit_limit)
      )
        ? Number(
            q.upper_circuit_limit
          )
        : null,

    lowerCircuit:
      Number.isFinite(
        Number(q?.lower_circuit_limit)
      )
        ? Number(
            q.lower_circuit_limit
          )
        : null,

    lastTradeTime:
      Number.isFinite(
        Number(q?.last_trade_time)
      )
        ? Number(
            q.last_trade_time
          )
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

let closingSyncPromise =
  null;

async function reconcileAllMarketStocks(
  reason,
  targetTradingDate =
    latestCompletedTradingDate()
) {
  if (!env.mysqlEnabled) {
    logger.warn(
      "Closing reconciliation skipped: MySQL disabled",
      {
        reason,
      }
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

            // await saveDailyClose(snapshot, tradingDate);

            const finalSnapshot = {
              ...snapshot,

              marketOpen:
                false,

              marketStatus:
                "CLOSED",

              marketDate:
                tradingDate,
            };

            await cacheSnapshot(
              finalSnapshot
            );

            if (
              subscribers.has(key)
            ) {
              io.to(
                `stock:${key}`
              ).emit(
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
          total:
            keys.length,
          saved,
        }
      );

      return {
        total:
          keys.length,
        saved,
      };
    })();

  try {
    return await closingSyncPromise;
  } finally {
    closingSyncPromise =
      null;
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
      result.saved > 0
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
      if (
        env.redisEnabled
      ) {
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

      if (
        env.redisEnabled
      ) {
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

        data,
      });
    } catch (err) {
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

          if (dbData.length) {
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
  "/api/detail-stock/financial-performance/:isin",
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

        incomeStatement:
          data?.incomeStatement ||
          null,

        balanceSheet:
          data?.balanceSheet ||
          null,

        cashFlow:
          data?.cashFlow ||
          null,

        updatedAt:
          data?.updatedAt ||
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

// cron.schedule(
//   closeCron,
//   () => {
//     persistClosingPrices("scheduled-close").catch((err) => {
//       logger.error("Scheduled close persistence failed", {
//         error: errorMessage(err),
//       });
//     });
//   },
//   { timezone: env.timezone },
// );

// cron.schedule(
//   closeRetryCron,
//   () => {
//     persistClosingPrices("scheduled-close-retry").catch((err) => {
//       logger.error("Scheduled close retry failed", {
//         error: errorMessage(err),
//       });
//     });
//   },
//   { timezone: env.timezone },
// );

/* =========================================================
   STARTUP & SHUTDOWN
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