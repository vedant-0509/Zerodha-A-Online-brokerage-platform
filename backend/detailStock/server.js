// require("dotenv").config({
//   path: require("path").resolve(__dirname, "../.env"),
// });

// const express = require("express");
// const http = require("http");
// const cors = require("cors");
// const helmet = require("helmet");
// const compression = require("compression");
// const rateLimit = require("express-rate-limit");
// const cron = require("node-cron");
// const { Server } = require("socket.io");
// const { connectMongoDB, getMongoDB } = require("../config/mongodb");

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
//   }),
// );

// app.use(compression());
// app.use(cors(corsOptions));

// app.use(
//   express.json({
//     limit: "64kb",
//   }),
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
// const HISTORY_PREFIX = "detailstock:history:v5:";
// const FINAL_1D_PREFIX = "detailstock:finalized-1d:v1:";
// const WEEK52_PREFIX = "detailstock:52-week:v1:";

// const fundamentalsByIsin = new Map();
// const fundamentalsInflight = new Map();

// const FUNDAMENTALS_TTL = 15 * 60 * 1000;

// /* =========================================================
//    VALIDATION HELPERS
// ========================================================= */

// function validKey(key) {
//   return typeof key === "string" && key.length >= 5 && key.length <= 180;
// }

// function validIdempotencyKey(key) {
//   return (
//     typeof key === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(key.trim())
//   );
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

// function finalized1DKey(instrumentKey, tradingDate) {
//   return `${FINAL_1D_PREFIX}${instrumentKey}:${tradingDate}`;
// }

// function week52Key(instrumentKey, asOfDate) {
//   return `${WEEK52_PREFIX}${instrumentKey}:${asOfDate}`;
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
//   if (
//     !env.redisEnabled ||
//     !Array.isArray(payload?.candles) ||
//     !payload.candles.length
//   ) {
//     return;
//   }

//   await redis.set(
//     finalized1DKey(instrumentKey, tradingDate),
//     JSON.stringify(payload),
//     { EX: 3 * 24 * 60 * 60 },
//   );
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

//   if (value) {
//     return value;
//   }

//   if (key === "CLOSE_JOB_TIME" && env.closeJobTime) {
//     return env.closeJobTime;
//   }

//   if (key === "CLOSE_RETRY_TIME" && env.closeRetryTime) {
//     return env.closeRetryTime;
//   }

//   return fallback;
// }

// const closeJobTime = getCronTimeFromEnv("CLOSE_JOB_TIME", "15:45");

// const closeRetryTime = getCronTimeFromEnv("CLOSE_RETRY_TIME", "15:50");

// const closeCron = timeToWeekdayCron(closeJobTime, "15:45");

// const closeRetryCron = timeToWeekdayCron(closeRetryTime, "15:50");

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
//   if (!snapshot?.instrumentKey) {
//     return;
//   }

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
//   if (snapshots.has(key)) {
//     return snapshots.get(key);
//   }

//   if (!env.redisEnabled) {
//     return null;
//   }

//   const raw = await redis.get(snapshotKey(key));

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

// async function enrichWithStoredPreviousClose(snapshot) {
//   if (!snapshot) {
//     return snapshot;
//   }

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
//   const marketRow = await getMarketStockByInstrumentKey(instrumentKey);

//   const master = await getInstrumentMaster(instrumentKey);

//   if (!marketRow && !master) {
//     return null;
//   }

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

//     symbol: master?.tradingSymbol || marketRow?.symbol || null,

//     name: master?.name || marketRow?.name || null,

//     exchange: master?.exchange || marketRow?.master_exchange || "NSE",

//     segment: master?.segment || marketRow?.master_segment || null,
//   };
// }

// /* =========================================================
//    52-WEEK HIGH / LOW
// ========================================================= */

// async function get52WeekHighLow(instrumentKey, force = false) {
//   if (!validKey(instrumentKey)) {
//     throw new Error("Invalid instrumentKey");
//   }

//   const asOfDate = indiaDate();
//   const cacheKey = week52Key(instrumentKey, asOfDate);

//   if (env.redisEnabled && !force) {
//     try {
//       const cached = await redis.get(cacheKey);
//       if (cached) {
//         const parsed = JSON.parse(cached);
//         if (
//           parsed &&
//           Number.isFinite(Number(parsed.high)) &&
//           Number.isFinite(Number(parsed.low))
//         ) {
//           return {
//             ...parsed,
//             source: "redis-upstox",
//             cached: true,
//           };
//         }
//       }
//     } catch (err) {
//       logger.warn("52-week cache read failed", {
//         instrumentKey,
//         error: errorMessage(err),
//       });
//     }
//   }

//   /*
//    * 52 weeks = 364 calendar days. We fetch daily candles from Upstox and
//    * calculate the range from the actual daily HIGH/LOW values, not closes.
//    * Upstox may omit weekends/holidays, so the returned candles themselves
//    * define the available trading sessions.
//    */
//   const toDate = asOfDate;
//   const fromDate = shiftIndiaDate(toDate, -364);

//   try {
//     const candles = await upstox.fetchHistory(
//       instrumentKey,
//       "days",
//       "1",
//       toDate,
//       fromDate,
//     );

//     const validCandles = (Array.isArray(candles) ? candles : []).filter(
//       (candle) => {
//         const high = Number(candle?.high);
//         const low = Number(candle?.low);
//         const timestamp = Date.parse(candle?.timestamp);

//         return (
//           Number.isFinite(timestamp) &&
//           Number.isFinite(high) &&
//           high > 0 &&
//           Number.isFinite(low) &&
//           low > 0
//         );
//       },
//     );

//     if (!validCandles.length) {
//       throw new Error(`No daily candles returned for ${instrumentKey}`);
//     }

//     const highCandle = validCandles.reduce((best, candle) =>
//       Number(candle.high) > Number(best.high) ? candle : best,
//     );
//     const lowCandle = validCandles.reduce((best, candle) =>
//       Number(candle.low) < Number(best.low) ? candle : best,
//     );

//     const result = {
//       instrumentKey,
//       high: Number(highCandle.high),
//       low: Number(lowCandle.low),
//       highDate: indiaDate(new Date(highCandle.timestamp)),
//       lowDate: indiaDate(new Date(lowCandle.timestamp)),
//       fromDate,
//       toDate,
//       tradingSessions: validCandles.length,
//       source: "upstox",
//       cached: false,
//       updatedAt: new Date().toISOString(),
//     };

//     if (env.redisEnabled) {
//       try {
//         await redis.set(cacheKey, JSON.stringify(result), {
//           EX: env.week52CacheSeconds,
//         });
//       } catch (err) {
//         logger.warn("52-week cache write failed", {
//           instrumentKey,
//           error: errorMessage(err),
//         });
//       }
//     }

//     return result;
//   } catch (err) {
//     logger.warn("Upstox 52-week lookup failed; trying database fallback", {
//       instrumentKey,
//       error: errorMessage(err),
//     });

//     /*
//      * MongoDB is only a fallback. The normal/source-of-truth path above is
//      * always Upstox daily history.
//      */
//     try {
//       const dbData = await getDbHistory(
//         instrumentKey,
//         fromDate,
//         toDate,
//       );

//       const validDbCandles = (Array.isArray(dbData) ? dbData : []).filter(
//         (candle) => {
//           const high = Number(candle?.high);
//           const low = Number(candle?.low);
//           return (
//             Number.isFinite(high) &&
//             high > 0 &&
//             Number.isFinite(low) &&
//             low > 0
//           );
//         },
//       );

//       if (validDbCandles.length) {
//         const highCandle = validDbCandles.reduce((best, candle) =>
//           Number(candle.high) > Number(best.high) ? candle : best,
//         );
//         const lowCandle = validDbCandles.reduce((best, candle) =>
//           Number(candle.low) < Number(best.low) ? candle : best,
//         );

//         return {
//           instrumentKey,
//           high: Number(highCandle.high),
//           low: Number(lowCandle.low),
//           highDate: indiaDate(new Date(highCandle.timestamp)),
//           lowDate: indiaDate(new Date(lowCandle.timestamp)),
//           fromDate,
//           toDate,
//           tradingSessions: validDbCandles.length,
//           source: "database-fallback",
//           cached: false,
//           updatedAt: new Date().toISOString(),
//         };
//       }
//     } catch (dbErr) {
//       logger.warn("Database 52-week fallback failed", {
//         instrumentKey,
//         error: errorMessage(dbErr),
//       });
//     }

//     throw err;
//   }
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
//         existing?.source === "upstox-close-reconciliation");

//   if (existing && existingIsFresh) {
//     return existing;
//   }

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

// function parseMaybeJson(value) {
//   if (value === null || value === undefined) return null;
//   if (typeof value !== "string") return value;
//   const trimmed = value.trim();
//   if (!trimmed) return null;
//   if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
//   try {
//     return JSON.parse(trimmed);
//   } catch {
//     return value;
//   }
// }

// function firstPresent(source, keys) {
//   if (!source || typeof source !== "object") return null;
//   for (const key of keys) {
//     const value = source[key];
//     if (value !== undefined && value !== null && value !== "") {
//       return value;
//     }
//   }
//   return null;
// }

// function numericValue(value) {
//   const parsed = parseMaybeJson(value);

//   if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
//     const nested = firstPresent(parsed, [
//       "value",
//       "amount",
//       "number",
//       "numericValue",
//       "numeric_value",
//     ]);
//     if (nested !== null) return numericValue(nested);
//   }

//   if (typeof parsed === "number") {
//     return Number.isFinite(parsed) ? parsed : null;
//   }

//   if (typeof parsed === "string") {
//     const cleaned = parsed.replace(/,/g, "").replace(/%/g, "").trim();
//     if (!cleaned) return null;
//     const numeric = Number(cleaned);
//     return Number.isFinite(numeric) ? numeric : null;
//   }

//   return null;
// }

// function periodValue(source) {
//   const value = firstPresent(source, [
//     "quarter",
//     "period",
//     "reportPeriod",
//     "report_period",
//     "financialPeriod",
//     "financial_period",
//     "fiscalPeriod",
//     "fiscal_period",
//     "yearQuarter",
//     "year_quarter",
//     "quarterName",
//     "quarter_name",
//     "date",
//     "reportDate",
//     "report_date",
//     "asOf",
//     "as_of",
//     "periodLabel",
//     "period_label",
//     "periodDate",
//     "period_date",
//     "periodEndDate",
//     "period_end_date",
//     "year",
//   ]);

//   if (value instanceof Date) return value.toISOString().slice(0, 10);
//   if (value === null || value === undefined || value === "") return null;

//   return String(value).trim();
// }

// function normalizeIdentityValue(value) {
//   return String(value ?? "")
//     .trim()
//     .toUpperCase();
// }

// function expandIdentityValues(value) {
//   const raw = normalizeIdentityValue(value);
//   if (!raw) return [];

//   const values = new Set([raw]);

//   // Symbols may be stored as RELIANCE, RELIANCE.NS, or RELIANCE.BO.
//   if (raw.endsWith(".NS") || raw.endsWith(".BO")) {
//     values.add(raw.slice(0, -3));
//   }

//   if (raw.includes("|")) {
//     const [, right] = raw.split("|", 2);
//     if (right) values.add(right);
//   }

//   return [...values];
// }

// function identityFilterFromCandidates(candidates = {}) {
//   const values = new Set();

//   for (const value of [
//     candidates.isin,
//     candidates.symbol,
//     candidates.instrumentKey,
//     candidates.tradingSymbol,
//     candidates.name,
//     ...(Array.isArray(candidates.instrumentKeys)
//       ? candidates.instrumentKeys
//       : []),
//     ...(Array.isArray(candidates.symbols) ? candidates.symbols : []),
//   ]) {
//     for (const expanded of expandIdentityValues(value)) {
//       values.add(expanded);
//     }
//   }

//   const clauses = [];
//   const identityFields = [
//     "isin",
//     "ISIN",
//     "symbol",
//     "tradingSymbol",
//     "trading_symbol",
//     "stockSymbol",
//     "stock_symbol",
//     "companySymbol",
//     "company_symbol",
//     "ticker",
//     "tickerSymbol",
//     "ticker_symbol",
//     "instrumentKey",
//     "instrument_key",
//     "securityId",
//     "security_id",
//   ];

//   for (const value of values) {
//     for (const field of identityFields) {
//       clauses.push({ [field]: value });
//     }
//   }

//   if (candidates.name) {
//     const name = String(candidates.name).trim();
//     if (name) {
//       clauses.push({ name }, { companyName: name }, { company_name: name });
//     }
//   }

//   if (!clauses.length) return { _id: null };
//   return { $or: clauses };
// }

// function looksLikePeriodKey(value) {
//   const text = String(value || "").trim();
//   return (
//     /^(?:q[1-4]|fy\s*\d{2,4}|fy\s*\d{4}|\d{4})$/i.test(text) ||
//     /\b(?:q[1-4]|fy)\b/i.test(text) ||
//     /\b(?:19|20)\d{2}\b/.test(text) ||
//     /\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?/.test(text) ||
//     /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i.test(
//       text,
//     )
//   );
// }

// function metricName(value) {
//   return String(value || "")
//     .trim()
//     .toLowerCase()
//     .replace(/[._-]+/g, " ");
// }

// function metricKind(value) {
//   const text = metricName(value);
//   if (!text) return null;
//   if (
//     /(revenue|sales|turnover|operating income|total income|income from operations)/i.test(
//       text,
//     )
//   ) {
//     return "revenue";
//   }
//   if (
//     /(net profit|profit after tax|pat|net income|netprofit|profit)/i.test(text)
//   ) {
//     return "profit";
//   }
//   return null;
// }

// function normalizeStoredFinancialRows(documents, fallbackFundamentals = {}) {
//   const rows = [];
//   const visited = new WeakSet();

//   const add = (period, revenue, profit) => {
//     if (!period) return;
//     if (revenue === null && profit === null) return;

//     rows.push({
//       quarter: String(period).trim(),
//       period: String(period).trim(),
//       revenue: revenue ?? 0,
//       profit: profit ?? 0,
//     });
//   };

//   const walk = (
//     candidate,
//     inheritedPeriod = null,
//     inheritedMetric = null,
//     depth = 0,
//   ) => {
//     if (candidate === null || candidate === undefined || depth > 6) return;

//     const parsed = parseMaybeJson(candidate);

//     if (Array.isArray(parsed)) {
//       for (const item of parsed) {
//         walk(item, inheritedPeriod, inheritedMetric, depth + 1);
//       }
//       return;
//     }

//     if (!parsed || typeof parsed !== "object") return;
//     if (visited.has(parsed)) return;
//     visited.add(parsed);

//     const source = parsed;
//     const period = periodValue(source) || inheritedPeriod;
//     const metric =
//       firstPresent(source, [
//         "category",
//         "metric",
//         "particular",
//         "name",
//         "label",
//         "type",
//       ]) || inheritedMetric;

//     let revenue = numericValue(
//       firstPresent(source, [
//         "revenue",
//         "sales",
//         "totalRevenue",
//         "total_revenue",
//         "revenueValue",
//         "revenue_value",
//         "turnover",
//         "totalIncome",
//         "total_income",
//         "incomeFromOperations",
//         "income_from_operations",
//         "revenueCr",
//         "revenue_cr",
//         "salesCr",
//         "sales_cr",
//         "totalRevenueCr",
//         "total_revenue_cr",
//         "incomeCr",
//         "income_cr",
//       ]),
//     );

//     let profit = numericValue(
//       firstPresent(source, [
//         "profit",
//         "netProfit",
//         "net_profit",
//         "profitAfterTax",
//         "profit_after_tax",
//         "pat",
//         "operatingProfit",
//         "operating_profit",
//         "netIncome",
//         "net_income",
//         "profitForPeriod",
//         "profit_for_period",
//         "profitCr",
//         "profit_cr",
//         "netProfitCr",
//         "net_profit_cr",
//         "patCr",
//         "pat_cr",
//         "operatingProfitCr",
//         "operating_profit_cr",
//       ]),
//     );

//     const genericValue = numericValue(
//       firstPresent(source, [
//         "value",
//         "amount",
//         "number",
//         "numericValue",
//         "numeric_value",
//         "val",
//       ]),
//     );

//     if (genericValue !== null) {
//       const kind = metricKind(metric);
//       if (kind === "revenue" && revenue === null) revenue = genericValue;
//       if (kind === "profit" && profit === null) profit = genericValue;
//     }

//     if (period && (revenue !== null || profit !== null)) {
//       add(period, revenue, profit);
//     }

//     // Handle Upstox-style income statements and legacy stored JSON.
//     for (const key of [
//       "incomeStatement",
//       "income_statement",
//       "fullStatement",
//       "full_statement",
//       "financials",
//       "financialData",
//       "financial_data",
//       "data",
//       "rows",
//       "history",
//       "values",
//       "categories",
//       "statement",
//       "statements",
//     ]) {
//       if (source[key] !== undefined) {
//         walk(source[key], period, metric, depth + 1);
//       }
//     }

//     // Handle schemas like { Revenue: { "Q1 FY26": 123 }, Net Profit: ... }
//     // and { "Q1 FY26": { revenue: 123, netProfit: 45 } }.
//     for (const [key, value] of Object.entries(source)) {
//       if (value === null || value === undefined || typeof value !== "object") {
//         continue;
//       }

//       if (
//         [
//           "incomeStatement",
//           "income_statement",
//           "fullStatement",
//           "full_statement",
//           "financials",
//           "financialData",
//           "financial_data",
//           "data",
//           "rows",
//           "history",
//           "values",
//           "categories",
//           "statement",
//           "statements",
//         ].includes(key)
//       ) {
//         continue;
//       }

//       const nextPeriod = looksLikePeriodKey(key) ? key : period;
//       const nextMetric = metricKind(key) ? key : metric;
//       walk(value, nextPeriod, nextMetric, depth + 1);
//     }
//   };

//   for (const document of documents || []) {
//     walk(document);
//   }

//   // Summary fallback. Even when the original row has no explicit period,
//   // expose a single "Latest" point so the UI does not become empty.
//   const fallbackPeriod =
//     periodValue(fallbackFundamentals) ||
//     firstPresent(fallbackFundamentals, [
//       "revenuePeriod",
//       "revenue_period",
//       "netProfitPeriod",
//       "net_profit_period",
//       "operatingProfitPeriod",
//       "operating_profit_period",
//     ]) ||
//     "Latest";

//   const fallbackRevenue = numericValue(
//     firstPresent(fallbackFundamentals, [
//       "revenue",
//       "sales",
//       "totalRevenue",
//       "total_revenue",
//       "turnover",
//       "totalIncome",
//       "total_income",
//     ]),
//   );

//   const fallbackProfit = numericValue(
//     firstPresent(fallbackFundamentals, [
//       "netProfit",
//       "net_profit",
//       "profit",
//       "operatingProfit",
//       "operating_profit",
//       "pat",
//       "netIncome",
//       "net_income",
//       "profitCr",
//       "profit_cr",
//       "netProfitCr",
//       "net_profit_cr",
//       "patCr",
//       "pat_cr",
//       "operatingProfitCr",
//       "operating_profit_cr",
//     ]),
//   );

//   if (fallbackRevenue !== null || fallbackProfit !== null) {
//     add(fallbackPeriod, fallbackRevenue, fallbackProfit);
//   }

//   const merged = new Map();
//   for (const row of rows) {
//     const key = String(row.quarter || row.period || "").trim();
//     if (!key) continue;

//     const existing = merged.get(key) || {
//       quarter: key,
//       period: key,
//       revenue: 0,
//       profit: 0,
//     };

//     if (Number.isFinite(row.revenue) && row.revenue !== 0) {
//       existing.revenue = row.revenue;
//     }
//     if (Number.isFinite(row.profit) && row.profit !== 0) {
//       existing.profit = row.profit;
//     }

//     merged.set(key, existing);
//   }

//   return Array.from(merged.values()).sort((a, b) => {
//     const av = Date.parse(a.period);
//     const bv = Date.parse(b.period);

//     if (Number.isFinite(av) && Number.isFinite(bv)) {
//       return av - bv;
//     }

//     return String(a.period).localeCompare(String(b.period), undefined, {
//       numeric: true,
//     });
//   });
// }

// function normalizeStoredShareholding(documents) {
//   const groups = new Map();
//   const labels = {
//     promoters: "Promoters",
//     fii: "FII",
//     fii_holding: "FII",
//     dii: "DII",
//     other_dii: "DII",
//     public: "Public",
//     mutual_funds: "Mutual Funds",
//     retail: "Retail",
//     retail_and_other: "Retail & Other",
//   };

//   for (const document of documents || []) {
//     const source = parseMaybeJson(document) || document;
//     if (!source || typeof source !== "object") continue;

//     const categoryRaw = firstPresent(source, [
//       "category",
//       "holderType",
//       "holder_type",
//       "type",
//       "name",
//       "label",
//     ]);
//     const category = String(categoryRaw || "other")
//       .trim()
//       .toLowerCase();
//     const period = periodValue(source);
//     const percentage = numericValue(
//       firstPresent(source, [
//         "percentage",
//         "percent",
//         "value",
//         "holding",
//         "holdingPercentage",
//         "holding_percentage",
//       ]),
//     );

//     if (!period || percentage === null) continue;

//     const key = category || "other";
//     if (!groups.has(key)) {
//       groups.set(key, {
//         category: key,
//         label: labels[key] || String(categoryRaw || "Other"),
//         history: [],
//       });
//     }

//     groups.get(key).history.push({
//       period,
//       percentage,
//     });
//   }

//   for (const row of groups.values()) {
//     row.history.sort((a, b) => {
//       const av = Date.parse(a.period);
//       const bv = Date.parse(b.period);
//       if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
//       return String(b.period).localeCompare(String(a.period));
//     });
//   }

//   return Array.from(groups.values()).filter((row) => row.history.length);
// }

// async function findFinancialDocuments(db, collectionName, candidates) {
//   const collection = db.collection(collectionName);
//   const filter = identityFilterFromCandidates(candidates);

//   const docs = await collection.find(filter).limit(500).toArray();

//   if (docs.length) return docs;

//   // Some legacy rows are keyed only by the old stock/instrument id.
//   const legacyIds = [
//     candidates.mysqlId,
//     candidates.stockId,
//     candidates.stock_id,
//     candidates.instrumentId,
//     candidates.instrument_id,
//   ]
//     .map((value) => numericValue(value))
//     .filter((value) => value !== null);

//   if (!legacyIds.length) return [];

//   const legacyFields = [
//     "mysqlId",
//     "stockId",
//     "stock_id",
//     "instrumentId",
//     "instrument_id",
//     "companyId",
//     "company_id",
//   ];

//   const legacyFilter = {
//     $or: legacyFields.flatMap((field) =>
//       legacyIds.map((value) => ({ [field]: value })),
//     ),
//   };

//   return collection.find(legacyFilter).limit(500).toArray();
// }

// async function getStoredFundamentals(isin) {
//   const db = getMongoDB();
//   if (!db || !isin) return null;

//   const normalizedIsin = normalizeIdentityValue(isin);
//   const candidates = {
//     isin: normalizedIsin,
//     instrumentKey: null,
//     symbol: null,
//     tradingSymbol: null,
//     name: null,
//     mysqlId: null,
//     instrumentKeys: [],
//     symbols: [],
//   };

//   try {
//     const instruments = await db
//       .collection("instruments")
//       .find({
//         $or: [{ isin: normalizedIsin }, { ISIN: normalizedIsin }],
//       })
//       .limit(20)
//       .toArray();

//     const instrument = instruments[0] || null;

//     if (instrument) {
//       candidates.instrumentKey = instrument.instrumentKey || null;
//       candidates.symbol = instrument.tradingSymbol || instrument.symbol || null;
//       candidates.tradingSymbol =
//         instrument.tradingSymbol || instrument.symbol || null;
//       candidates.name = instrument.name || instrument.companyName || null;
//       candidates.mysqlId = instrument.mysqlId || instrument.stockId || null;

//       candidates.instrumentKeys = instruments
//         .map((item) => item.instrumentKey)
//         .filter(Boolean);

//       candidates.symbols = instruments
//         .flatMap((item) => [item.tradingSymbol, item.symbol])
//         .filter(Boolean);
//     } else {
//       candidates.instrumentKeys = [];
//       candidates.symbols = [];
//     }
//   } catch (err) {
//     logger.warn("Instrument metadata lookup for fundamentals failed", {
//       isin: normalizedIsin,
//       error: err?.message,
//     });
//   }

//   // Resolve through marketStocks as a second source of truth.
//   if (candidates.instrumentKey) {
//     try {
//       const marketRow = await db.collection("marketStocks").findOne({
//         instrumentKey: candidates.instrumentKey,
//       });

//       if (marketRow) {
//         candidates.symbol =
//           candidates.symbol ||
//           marketRow.symbol ||
//           marketRow.tradingSymbol ||
//           null;
//         candidates.name =
//           candidates.name || marketRow.name || marketRow.companyName || null;
//         candidates.mysqlId =
//           candidates.mysqlId || marketRow.mysqlId || marketRow.stockId || null;
//       }
//     } catch (err) {
//       logger.warn("Market stock metadata lookup failed", {
//         isin: normalizedIsin,
//         error: err?.message,
//       });
//     }
//   }

//   // If the instrument master has no ISIN, derive it from the standard key.
//   if (!candidates.isin && candidates.instrumentKey?.includes("|")) {
//     candidates.isin = candidates.instrumentKey.split("|")[1] || null;
//   }

//   const [fundamentalDocs, financialDocs, shareholdingDocs] = await Promise.all([
//     findFinancialDocuments(db, "stockFundamentals", candidates),
//     findFinancialDocuments(db, "stockFinancials", candidates),
//     findFinancialDocuments(db, "stockShareholding", candidates),
//   ]);

//   if (
//     !fundamentalDocs.length &&
//     !financialDocs.length &&
//     !shareholdingDocs.length
//   ) {
//     return null;
//   }

//   const fundamentalDocsSorted = [...fundamentalDocs].sort((a, b) => {
//     const ad = new Date(
//       a.updatedAt || a.updated_at || a.migratedAt || 0,
//     ).getTime();
//     const bd = new Date(
//       b.updatedAt || b.updated_at || b.migratedAt || 0,
//     ).getTime();
//     return bd - ad;
//   });

//   const fund =
//     fundamentalDocsSorted
//       .map((doc) => parseMaybeJson(doc) || doc)
//       .find((doc) => doc && typeof doc === "object") || {};

//   const financialRows = normalizeStoredFinancialRows(financialDocs, fund);
//   const shareholding = normalizeStoredShareholding(shareholdingDocs);

//   const latestFinancial = financialRows.length
//     ? financialRows[financialRows.length - 1]
//     : null;

//   const fundamentals = {
//     marketCap: firstPresent(fund, ["marketCap", "market_cap"]),
//     sector: firstPresent(fund, ["sector"]),
//     peRatio: numericValue(firstPresent(fund, ["peRatio", "pe_ratio", "pe"])),
//     pbRatio: numericValue(firstPresent(fund, ["pbRatio", "pb_ratio", "pb"])),
//     roe: numericValue(
//       firstPresent(fund, ["roe", "returnOnEquity", "return_on_equity"]),
//     ),
//     roa: numericValue(
//       firstPresent(fund, ["roa", "returnOnAssets", "return_on_assets"]),
//     ),
//     roce: numericValue(
//       firstPresent(fund, [
//         "roce",
//         "returnOnCapitalEmployed",
//         "return_on_capital_employed",
//       ]),
//     ),
//     evEbitda: numericValue(
//       firstPresent(fund, ["evEbitda", "ev_ebitda", "evebitda"]),
//     ),
//     eps: numericValue(firstPresent(fund, ["eps", "epsBasic", "eps_basic"])),
//     revenue:
//       numericValue(
//         firstPresent(fund, [
//           "revenue",
//           "sales",
//           "totalRevenue",
//           "total_revenue",
//           "turnover",
//           "totalIncome",
//           "total_income",
//           "revenueCr",
//           "revenue_cr",
//           "salesCr",
//           "sales_cr",
//           "totalRevenueCr",
//           "total_revenue_cr",
//         ]),
//       ) ??
//       latestFinancial?.revenue ??
//       null,
//     revenuePeriod:
//       firstPresent(fund, [
//         "revenuePeriod",
//         "revenue_period",
//         "period",
//         "quarter",
//         "periodLabel",
//         "period_label",
//       ]) ||
//       latestFinancial?.period ||
//       null,
//     operatingProfit: numericValue(
//       firstPresent(fund, [
//         "operatingProfit",
//         "operating_profit",
//         "operatingIncome",
//         "operating_income",
//       ]),
//     ),
//     operatingProfitPeriod: firstPresent(fund, [
//       "operatingProfitPeriod",
//       "operating_profit_period",
//       "period",
//       "quarter",
//     ]),
//     netProfit:
//       numericValue(
//         firstPresent(fund, [
//           "netProfit",
//           "net_profit",
//           "profit",
//           "pat",
//           "netIncome",
//           "net_income",
//           "profitCr",
//           "profit_cr",
//           "netProfitCr",
//           "net_profit_cr",
//           "patCr",
//           "pat_cr",
//           "operatingProfitCr",
//           "operating_profit_cr",
//         ]),
//       ) ??
//       latestFinancial?.profit ??
//       null,
//     netProfitPeriod:
//       firstPresent(fund, [
//         "netProfitPeriod",
//         "net_profit_period",
//         "period",
//         "quarter",
//         "periodLabel",
//         "period_label",
//       ]) ||
//       latestFinancial?.period ||
//       null,
//     period:
//       periodValue(fund) ||
//       financialRows[financialRows.length - 1]?.period ||
//       "Latest",
//   };

//   const source =
//     financialRows.length ||
//     fundamentals.revenue !== null ||
//     fundamentals.netProfit !== null
//       ? "mongodb"
//       : "mongodb-partial";

//   return {
//     fundamentals,
//     profile:
//       fund.profile || fund.companyProfile || fund.company_profile || null,
//     ratios: Array.isArray(fund.ratios)
//       ? fund.ratios
//       : Array.isArray(fund.keyRatios)
//         ? fund.keyRatios
//         : [],
//     incomeStatement: financialRows,
//     balanceSheet:
//       fund.balanceSheet || fund.balance_sheet || fund.balanceSheetData || null,
//     cashFlow: fund.cashFlow || fund.cash_flow || fund.cashFlowData || null,
//     shareholding,
//     mutualFunds: shareholding
//       .filter((row) => row.category === "mutual_funds")
//       .flatMap((row) =>
//         row.history.map((item) => ({
//           name: "Mutual Funds",
//           percentage: item.percentage,
//           period: item.period,
//         })),
//       ),
//     corporateActions: fund.corporateActions || fund.corporate_actions || [],
//     competitors: fund.competitors || [],
//     financialRows,
//     source,
//     updatedAt:
//       fund.updatedAt ||
//       fund.updated_at ||
//       financialDocs[financialDocs.length - 1]?.updatedAt ||
//       financialDocs[financialDocs.length - 1]?.updated_at ||
//       new Date().toISOString(),
//   };
// }

// function hasUsableFinancialData(data) {
//   if (!data || typeof data !== "object") return false;
//   if (Array.isArray(data.financialRows) && data.financialRows.length)
//     return true;

//   const fundamentals = data.fundamentals || {};
//   return (
//     (fundamentals.revenue !== null && fundamentals.revenue !== undefined) ||
//     (fundamentals.netProfit !== null && fundamentals.netProfit !== undefined)
//   );
// }

// function mergeFinancialData(primary, secondary) {
//   if (!primary) return secondary || null;
//   if (!secondary) return primary;

//   const primaryRows = Array.isArray(primary.financialRows)
//     ? primary.financialRows
//     : [];
//   const secondaryRows = Array.isArray(secondary.financialRows)
//     ? secondary.financialRows
//     : [];

//   const rows = [];
//   const byPeriod = new Map();

//   for (const row of [...primaryRows, ...secondaryRows]) {
//     const key = String(row?.period || row?.quarter || "").trim();
//     if (!key) continue;

//     const existing = byPeriod.get(key) || {
//       quarter: key,
//       period: key,
//       revenue: 0,
//       profit: 0,
//     };

//     if (Number.isFinite(Number(row?.revenue)) && Number(row.revenue) !== 0) {
//       existing.revenue = Number(row.revenue);
//     }
//     if (Number.isFinite(Number(row?.profit)) && Number(row.profit) !== 0) {
//       existing.profit = Number(row.profit);
//     }

//     byPeriod.set(key, existing);
//   }

//   rows.push(...byPeriod.values());
//   rows.sort((a, b) =>
//     String(a.period).localeCompare(String(b.period), undefined, {
//       numeric: true,
//     }),
//   );

//   return {
//     ...secondary,
//     ...primary,
//     fundamentals: {
//       ...(secondary.fundamentals || {}),
//       ...(primary.fundamentals || {}),
//     },
//     financialRows: rows.length
//       ? rows
//       : primaryRows.length
//         ? primaryRows
//         : secondaryRows,
//     incomeStatement: rows.length
//       ? rows
//       : primary.incomeStatement || secondary.incomeStatement || [],
//     shareholding: primary.shareholding?.length
//       ? primary.shareholding
//       : secondary.shareholding || [],
//     source: primary.source || secondary.source,
//     updatedAt: primary.updatedAt || secondary.updatedAt,
//   };
// }

// async function getFundamentalsCached(isin, force = false) {
//   const normalizedIsin = normalizeIdentityValue(isin);

//   // Normal requests use the application cache. A forced refresh bypasses it
//   // so the next request goes all the way to Upstox.
//   if (!force) {
//     const cached = fundamentalsByIsin.get(normalizedIsin);
//     if (cached && cached.expiresAt > Date.now()) {
//       return cached.data;
//     }

//     const inflight = fundamentalsInflight.get(normalizedIsin);
//     if (inflight) return inflight;
//   }

//   const fetchPromise = (async () => {
//     try {
//       // Upstox is the primary source for financial data. MongoDB contains the
//       // migrated reporting snapshot and is used only when the provider fails.
//       try {
//         const providerData = await upstox.getFundamentals(
//           normalizedIsin,
//           force,
//         );

//         if (providerData && hasUsableFinancialData(providerData)) {
//           const primary = {
//             ...providerData,
//             source: "upstox",
//             updatedAt: providerData.updatedAt || new Date().toISOString(),
//           };

//           fundamentalsByIsin.set(normalizedIsin, {
//             data: primary,
//             expiresAt: Date.now() + FUNDAMENTALS_TTL,
//           });

//           return primary;
//         }

//         throw new Error("Upstox returned no usable financial data");
//       } catch (providerError) {
//         logger.warn("Upstox financial data unavailable; using MongoDB fallback", {
//           isin: normalizedIsin,
//           error: providerError?.message || String(providerError),
//         });

//         const stored = await getStoredFundamentals(normalizedIsin);
//         if (stored) {
//           const fallback = {
//             ...stored,
//             source: stored.source || "mongodb-fallback",
//           };

//           fundamentalsByIsin.set(normalizedIsin, {
//             data: fallback,
//             expiresAt: Date.now() + FUNDAMENTALS_TTL,
//           });

//           return fallback;
//         }

//         throw providerError;
//       }
//     } catch (err) {
//       logger.error("getFundamentalsCached fetch failed", {
//         isin: normalizedIsin,
//         error: err?.message,
//       });
//       throw err;
//     } finally {
//       fundamentalsInflight.delete(normalizedIsin);
//     }
//   })();

//   fundamentalsInflight.set(normalizedIsin, fetchPromise);
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
//       .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

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
//   {
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
//     .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
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

// function buildOfficialCloseSnapshot(row, candles, previousClose, tradingDate) {
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
//     previousClose?.close != null ? close - Number(previousClose.close) : null;

//   return {
//     instrumentKey: row.instrument_key,
//     symbol: row.symbol || null,
//     tradingSymbol: row.symbol || null,
//     name: row.name || null,
//     companyName: row.name || null,
//     exchange:
//       row.master_exchange || row.exchange || env.marketStockExchange || "NSE",
//     segment:
//       row.master_segment || row.segment || env.marketStockSegment || "NSE_EQ",
//     sector: row.sector || null,
//     ltp: close,
//     price: close,
//     dayClose: close,
//     previousClose:
//       previousClose?.close != null ? Number(previousClose.close) : null,
//     previousCloseDate: previousClose?.tradingDate || null,
//     previousCloseSource: previousClose?.source || null,
//     change,
//     changePercent: previousClose?.close
//       ? (change / Number(previousClose.close)) * 100
//       : null,
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
//     const rows = await getMarketStockInstruments();

//     if (!rows.length) {
//       logger.warn("No market stocks available for official settlement", {
//         reason,
//         tradingDate: targetTradingDate,
//         database: "mongodb",
//       });
//       return { total: 0, saved: 0 };
//     }

//     const batchSize = Math.max(1, Number(env.closeBatchSize) || 5);
//     let saved = 0;

//     for (let i = 0; i < rows.length; i += batchSize) {
//       const batch = rows.slice(i, i + batchSize);

//       const results = await Promise.allSettled(
//         batch.map(async (row) => {
//           const key = row.instrument_key;
//           if (!validKey(key)) {
//             throw new Error("Invalid instrument key");
//           }

//           const cached = await getFinalized1D(key, targetTradingDate);
//           const hasClose = await hasDailyCloseForDate(key, targetTradingDate);

//           if (cached && hasClose) {
//             return { skipped: true };
//           }

//           // The settlement job owns the final official pull. If a cache was
//           // seeded by a client immediately after close, use it only together
//           // with a persisted close; otherwise fetch fresh official data.
//           const candles =
//             cached?.candles?.length && hasClose
//               ? cached.candles
//               : await fetchOfficialIntradaySession(key, targetTradingDate);

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

//           await saveDailyClose(snapshot, targetTradingDate);

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
//             io.to(`stock:${key}`).emit("detailStock:snapshot", snapshot);
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

//       if (i + batch.length < rows.length && Number(env.closeBatchDelayMs) > 0) {
//         await new Promise((resolve) =>
//           setTimeout(resolve, Number(env.closeBatchDelayMs)),
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
//   if (!env.startupReconcileClosed || isMarketOpen()) {
//     return;
//   }

//   const rows = await getMarketStockInstruments();

//   if (!rows.length) {
//     return;
//   }

//   const date = latestCompletedTradingDate();

//   const totalStocks = rows.length;

//   const savedToday = await getDailyCloseCount(date);

//   const markerKey = `detailstock:close-reconciled:v3:${date}`;

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

//     if (env.redisEnabled && result.total > 0 && result.saved >= result.total) {
//       try {
//         await redis.set(markerKey, "ok", {
//           EX: 3 * 24 * 60 * 60,
//         });
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
//   // Ignore late/out-of-order packets after the exchange has closed.
//   // Finalized historical data owns the 1D chart after close.
//   if (!isTradingDay() || !isMarketOpen()) {
//     return;
//   }

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
//         logger.warn("Tick cache write failed", {
//           error: err.message,
//         }),
//       );
//   }

//   io.to(`stock:${tick.instrumentKey}`).emit("detailStock:tick", snapshot);
// });

// /* =========================================================
//    SOCKET.IO
// ========================================================= */

// io.on("connection", (socket) => {
//   socket.on("detailStock:subscribe", async (payload, ack = () => {}) => {
//     const key = payload?.instrumentKey;

//     if (!validKey(key)) {
//       return ack({
//         success: false,
//         message: "Valid instrumentKey is required",
//       });
//     }

//     try {
//       const context = await getInstrumentContext(key);

//       if (!context?.master) {
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

//           bseInstrumentKey: context.bse?.instrumentKey || null,
//         };
//       }

//       const isin = snapshot.isin || context?.isin;

//       if (isin) {
//         try {
//           const fundamentals = await getFundamentalsCached(isin);

//           snapshot = {
//             ...snapshot,
//             ...fundamentals,
//             isin,
//           };
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

//       ack({
//         success: false,
//         message: errorMessage(err),
//       });
//     }
//   });

//   socket.on("detailStock:unsubscribe", async (payload, ack = () => {}) => {
//     const key = payload?.instrumentKey;

//     if (!validKey(key)) {
//       return ack({
//         success: false,
//       });
//     }

//     await release(key, socket.id);

//     socket.leave(`stock:${key}`);

//     ack({
//       success: true,
//     });
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

//   if (!set) {
//     return;
//   }

//   set.delete(socketId);

//   if (set.size === 0) {
//     subscribers.delete(key);

//     await upstox.unsubscribe(key, false);

//     logger.info("Stock room became empty", {
//       instrumentKey: key,
//     });
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

//     database: "mongodb",

//     upstoxConnected: upstox.isConnected(),

//     upstoxSubscribed: upstox.getSubscribed().length,

//     activeRooms: subscribers.size,

//     time: new Date().toISOString(),
//   });
// });

// app.get("/api/detail-stock/market-status", async (req, res) => {
//   res.json({
//     success: true,
//     ...marketStatus(),
//   });
// });

// app.get("/api/financials/:symbol", async (req, res) => {
//   try {
//     const { symbol } = req.params;

//     const financials = await getStockFinancials(symbol);

//     res.json({
//       success: true,
//       data: financials,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message || "Internal server error",
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
//   try {
//     const rows = await getMarketStockInstruments();

//     res.json({
//       success: true,
//       marketOpen: isMarketOpen(),

//       count: rows.length,

//       data: rows,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/instrument/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;

//   if (!validKey(key)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid instrumentKey",
//     });
//   }

//   try {
//     const context = await getInstrumentContext(key);

//     if (!context) {
//       return res.status(404).json({
//         success: false,
//         message: "Instrument not found",
//       });
//     }

//     res.json({
//       success: true,
//       data: context,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

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

//     res.json({
//       success: true,
//       marketOpen: isMarketOpen(),

//       data: snapshot,
//     });
//   } catch (err) {
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/52-week/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;
//   const forceRefresh = String(req.query.refresh || "") === "1";

//   if (!validKey(key)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid instrumentKey",
//     });
//   }

//   try {
//     const data = await get52WeekHighLow(key, forceRefresh);

//     return res.json({
//       success: true,
//       instrumentKey: key,
//       marketOpen: isMarketOpen(),
//       refreshed: forceRefresh,
//       data,
//     });
//   } catch (err) {
//     logger.error("52-week high/low request failed", {
//       instrumentKey: key,
//       forceRefresh,
//       error: errorMessage(err),
//     });

//     return res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/history/:instrumentKey", async (req, res) => {
//   const key = req.params.instrumentKey;

//   if (!validKey(key)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid instrumentKey",
//     });
//   }

//   const allowedUnits = new Set(["minutes", "hours", "days", "weeks", "months"]);

//   const unit = allowedUnits.has(req.query.unit) ? req.query.unit : "days";
//   const interval = String(req.query.interval || "1");
//   const to = String(req.query.to || indiaDate());
//   const from = req.query.from ? String(req.query.from) : "";
//   const forceRefresh = String(req.query.refresh || "") === "1";
//   const isOneDay = unit === "minutes" && interval === "1" && !from;

//   try {
//     /*
//      * After close, finalized settlement data is immutable for the session.
//      * refresh=1 is used only for the OPEN -> CLOSED handover when the final
//      * cache may not exist yet.
//      */
//     if (isOneDay && !isMarketOpen() && !forceRefresh) {
//       const sessionDate = latestCompletedTradingDate();
//       const finalized = await getFinalized1D(key, sessionDate);

//       if (finalized?.candles?.length) {
//         return res.json({
//           success: true,
//           source: "redis-finalized-1d",
//           marketOpen: false,
//           sessionDate,
//           baselineClose: finalized.baselineClose ?? null,
//           baselineDate: finalized.baselineDate ?? null,
//           data: {
//             candles: finalized.candles,
//             baselineClose: finalized.baselineClose ?? null,
//             baselineDate: finalized.baselineDate ?? null,
//           },
//         });
//       }
//     }

//     const cacheKey = historyKey(key, unit, interval, from, to);

//     if (env.redisEnabled && !forceRefresh) {
//       const cached = await redis.get(cacheKey);

//       if (cached) {
//         const parsed = JSON.parse(cached);

//         // Only accept v2 history objects. Older array-only cache entries
//         // did not contain a real prior-day baseline.
//         if (
//           parsed &&
//           !Array.isArray(parsed) &&
//           Object.prototype.hasOwnProperty.call(parsed, "baselineClose")
//         ) {
//           return res.json({
//             success: true,
//             source: "cache",
//             marketOpen: isMarketOpen(),
//             refreshed: false,
//             data: parsed,
//           });
//         }
//       }
//     }

//     let data;

//     if (isOneDay && !isMarketOpen()) {
//       const sessionDate = latestCompletedTradingDate();
//       data = await fetchOfficialIntradaySession(key, sessionDate);
//     } else {
//       data = await upstox.fetchHistory(
//         key,
//         unit,
//         interval,
//         to,
//         from || undefined,
//       );
//     }

//     let baselineClose = null;
//     let baselineDate = null;
//     let sessionDate = null;

//     if (isOneDay) {
//       sessionDate = !isMarketOpen() ? latestCompletedTradingDate() : to;

//       const previous = await resolvePreviousClose(key, sessionDate);

//       baselineClose = previous?.close ?? null;
//       baselineDate = previous?.tradingDate ?? null;

//       data = filterTradingSession(data, sessionDate);
//     } else {
//       /*
//        * Match the range-return convention used by the stock detail UI: the
//        * selected period starts at the first trading candle inside the range,
//        * and its opening price is the starting value. This is why a 1W range
//        * beginning on a trading day can differ from the prior-day-close
//        * convention. It also makes All work by using the first available
//        * historical candle rather than looking for a date before 2000.
//        */
//       const firstCandle = Array.isArray(data) && data.length ? data[0] : null;
//       const firstOpen = Number(
//         firstCandle?.open ?? firstCandle?.openPrice ?? firstCandle?.price,
//       );

//       if (Number.isFinite(firstOpen) && firstOpen > 0) {
//         baselineClose = firstOpen;
//         const firstTimestamp = Date.parse(firstCandle?.timestamp);
//         baselineDate = Number.isFinite(firstTimestamp)
//           ? indiaDate(new Date(firstTimestamp))
//           : from || null;
//       }
//     }

//     const payload = {
//       candles: Array.isArray(data) ? data : [],
//       baselineClose,
//       baselineDate,
//       source: "upstox",
//     };

//     if (!payload.candles.length) {
//       throw new Error(`No historical candles returned for ${key}`);
//     }

//     if (env.redisEnabled) {
//       await redis.set(cacheKey, JSON.stringify(payload), {
//         EX: env.historyCacheSeconds,
//       });
//     }

//     /*
//      * Seed the finalized session cache for after-close reads. The scheduled
//      * settlement still persists the official close and can retry safely.
//      */
//     if (isOneDay && !isMarketOpen() && sessionDate) {
//       const last = payload.candles[payload.candles.length - 1];

//       await cacheFinalized1D(key, sessionDate, {
//         tradingDate: sessionDate,
//         candles: payload.candles,
//         closePrice: Number(last?.close) || null,
//         baselineClose,
//         baselineDate,
//         source: "upstox-finalized-intraday",
//         finalizedAt: new Date().toISOString(),
//       });
//     }

//     return res.json({
//       success: true,
//       source: "upstox",
//       marketOpen: isMarketOpen(),
//       refreshed: forceRefresh,
//       sessionDate: sessionDate || undefined,
//       baselineClose,
//       baselineDate,
//       data: payload,
//     });
//   } catch (err) {
//     /*
//      * Keep the existing DB fallback for longer ranges. Baseline is resolved
//      * independently from the first candle, so weekends/holidays are safe.
//      */
//     if (!isOneDay && ["days", "weeks", "months"].includes(unit)) {
//       try {
//         const dbData = await getDbHistory(key, from || "2000-01-01", to);

//         if (dbData.length) {
//           const firstCandle = dbData[0];
//           const firstOpen = Number(
//             firstCandle?.open ?? firstCandle?.openPrice ?? firstCandle?.price,
//           );
//           const firstTimestamp = Date.parse(firstCandle?.timestamp);
//           const baselineClose =
//             Number.isFinite(firstOpen) && firstOpen > 0 ? firstOpen : null;
//           const baselineDate = Number.isFinite(firstTimestamp)
//             ? indiaDate(new Date(firstTimestamp))
//             : from || null;

//           const payload = {
//             candles: dbData,
//             baselineClose,
//             baselineDate,
//             source: "database",
//           };

//           if (env.redisEnabled) {
//             await redis.set(
//               historyKey(key, unit, interval, from, to),
//               JSON.stringify(payload),
//               {
//                 EX: env.historyCacheSeconds,
//               },
//             );
//           }

//           return res.json({
//             success: true,
//             source: "database",
//             marketOpen: isMarketOpen(),
//             refreshed: false,
//             baselineClose,
//             baselineDate,
//             data: payload,
//           });
//         }
//       } catch (dbError) {
//         logger.warn("Database history fallback failed", {
//           instrumentKey: key,
//           error: errorMessage(dbError),
//         });
//       }
//     }

//     logger.error("History request failed", {
//       instrumentKey: key,
//       unit,
//       interval,
//       from,
//       to,
//       forceRefresh,
//       error: errorMessage(err),
//     });

//     return res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/fundamentals/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     const data = await getFundamentalsCached(isin);

//     res.json({
//       success: true,
//       isin,
//       ...data,
//     });
//   } catch (err) {
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/shareholding/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
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
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/about/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "")
//     .trim()
//     .toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
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

//     return res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/ratios/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
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
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/corporate-actions/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     res.json({
//       success: true,

//       isin,

//       data: await upstox.getCorporateActions(isin),

//       updatedAt: Date.now(),
//     });
//   } catch (err) {
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get("/api/detail-stock/competitors/:isin", async (req, res) => {
//   const isin = String(req.params.isin || "").toUpperCase();

//   if (!validIsin(isin)) {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid ISIN",
//     });
//   }

//   try {
//     res.json({
//       success: true,

//       isin,

//       data: await upstox.getCompetitors(isin),

//       updatedAt: Date.now(),
//     });
//   } catch (err) {
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

// app.get(
//   "/api/detail-stock/financial-performance/:identifier",
//   async (req, res) => {
//     try {
//       const identifier = String(req.params.identifier || "")
//         .trim()
//         .toUpperCase();

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

//       const forceRefresh = ["1", "true", "yes"].includes(
//         String(req.query.refresh || "").toLowerCase(),
//       );

//       const data = await getFundamentalsCached(isin, forceRefresh);

//       return res.json({
//         success: true,
//         symbol: identifier,
//         isin,

//         // The frontend can consume this directly through unwrapResponse().
//         data: data?.financialRows || data?.incomeStatement || [],

//         incomeStatement: data?.incomeStatement || [],

//         financialRows: data?.financialRows || data?.incomeStatement || [],

//         balanceSheet: data?.balanceSheet || null,

//         cashFlow: data?.cashFlow || null,

//         fundamentals: data?.fundamentals || null,

//         ratios: data?.ratios || [],

//         source: data?.source || "provider",

//         updatedAt: data?.updatedAt || Date.now(),
//       });
//     } catch (error) {
//       logger.error("Failed to fetch financial performance", {
//         error: error?.message || String(error),
//       });

//       return res.status(502).json({
//         success: false,
//         message: error?.message || "Failed to fetch financial performance",
//       });
//     }
//   },
// );

// app.get("/api/detail-stock/funds", async (req, res) => {
//   try {
//     const data = await upstox.getFunds();

//     res.json({
//       success: true,
//       data,
//     });
//   } catch (err) {
//     res.status(502).json({
//       success: false,
//       message: errorMessage(err),
//     });
//   }
// });

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
//     requiredFields: [
//       "instrumentKey",
//       "transactionType",
//       "quantity",
//       "orderType",
//       "product",
//     ],
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
//     const body = req.body || {};

//     const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();

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
//      * BUY / SELL
//      * ---------------------------------------------
//      */

//     const transactionType = String(
//       body.transactionType || body.orderType || "",
//     ).toUpperCase();

//     if (!["BUY", "SELL"].includes(transactionType)) {
//       return res.status(400).json({
//         success: false,
//         message: "transactionType must be BUY or SELL",
//       });
//     }

//     /*
//      * ---------------------------------------------
//      * MARKET / LIMIT
//      * ---------------------------------------------
//      */

//     const orderType = String(body.orderType || "MARKET").toUpperCase();

//     /*
//      * orderType is simulation-only.
//      * It is NEVER sent to Upstox.
//      */

//     if (!["MARKET", "LIMIT"].includes(orderType)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid orderType",
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

//     const marketOpen = true;

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
//       (!Number.isFinite(requestedLimitPrice) || requestedLimitPrice <= 0)
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

//       const result = await simulateOrder({
//         userId: req.userId,

//         instrumentKey: body.instrumentKey,

//         transactionType,

//         quantity,

//         orderType,

//         product: "CNC",

//         limitPrice: requestedLimitPrice,

//         idempotencyKey,
//       });

//       /*
//        * Failed simulated order,
//        * for example insufficient
//        * holdings on SELL.
//        */

//       if (!result.success) {
//         return res.status(400).json(result);
//       }

//       /*
//        * Successful simulated order
//        */

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

//       const status =
//         Number.isInteger(err?.httpStatus) &&
//         err.httpStatus >= 400 &&
//         err.httpStatus < 500
//           ? err.httpStatus
//           : 500;

//       return res.status(status).json({
//         success: false,
//         code: err?.code || "SIMULATED_ORDER_FAILED",
//         message: err?.message || "Unable to complete simulated order",
//       });
//     }
//   },
// );

// app.get("/api/detail-stock/market-stocks-count", async (req, res) => {
//   try {
//     res.json({
//       success: true,

//       count: await getMarketStockCount(),
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: errorMessage(err),
//     });
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

// async function persistClosingPrices(reason = "scheduled-settlement") {
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
//   const result = await reconcileAllMarketStocks(reason, tradingDate);

//   if (env.redisEnabled && result.total > 0 && result.saved >= result.total) {
//     try {
//       await redis.set(`detailstock:close-reconciled:v3:${tradingDate}`, "ok", {
//         EX: 3 * 24 * 60 * 60,
//       });
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
//   nextSettlementRun: getNextCronRun(closeTask),
//   nextRetryRun: getNextCronRun(closeRetryTask),
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

//   server.listen(env.port, "127.0.0.1", () => {
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
//   if (shuttingDown) {
//     return;
//   }

//   shuttingDown = true;

//   logger.info("Shutdown requested", {
//     signal,
//   });

//   try {
//     for (const key of upstox.getSubscribed()) {
//       await upstox.unsubscribe(key, true);
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
//     if (env.redisEnabled) {
//       await redis.quit();
//     }
//   } catch {}

//   process.exit(0);
// }

// process.on("SIGTERM", () => shutdown("SIGTERM"));

// process.on("SIGINT", () => shutdown("SIGINT"));

// process.on("uncaughtException", (err) => {
//   logger.error("Uncaught exception", {
//     error: err.stack || err.message,
//   });
// });

// process.on("unhandledRejection", (err) => {
//   logger.error("Unhandled rejection", {
//     error: err?.stack || String(err),
//   });
// });

// startup().catch((err) => {
//   logger.error("Startup failed", {
//     error: err.stack || err.message,
//   });

//   process.exit(1);
// });























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
const { connectMongoDB, getMongoDB } = require("../config/mongodb");

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
  getFinalizedDailySession,
  hasFinalizedDailySession,
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
  isOfficialSettlementReady,
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
  }),
);

app.use(compression());
app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "64kb",
  }),
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
const WEEK52_PREFIX = "detailstock:52-week:v1:";

const fundamentalsByIsin = new Map();
const fundamentalsInflight = new Map();

const FUNDAMENTALS_TTL = 15 * 60 * 1000;

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function validKey(key) {
  return typeof key === "string" && key.length >= 5 && key.length <= 180;
}

function validIdempotencyKey(key) {
  return (
    typeof key === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(key.trim())
  );
}

function validIsin(isin) {
  return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin);
}

function snapshotKey(key) {
  return `${SNAP_PREFIX}${key}`;
}

function historyKey(key, unit, interval, from, to) {
  // Prevent a pre-close cache from surviving into the finalized session.
  // The same closed-session key is reusable overnight until the next session.
  const sessionState = isMarketOpen()
    ? `open:${indiaDate()}`
    : `closed:${latestCompletedTradingDate()}`;

  return `${HISTORY_PREFIX}${key}:${unit}:${interval}:${from || ""}:${to}:${sessionState}`;
}

function finalized1DKey(instrumentKey, tradingDate) {
  return `${FINAL_1D_PREFIX}${instrumentKey}:${tradingDate}`;
}

function week52Key(instrumentKey, asOfDate) {
  return `${WEEK52_PREFIX}${instrumentKey}:${asOfDate}`;
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
  // MongoDB is the durable source of truth. Redis is only a fast cache.
  try {
    const persisted = await getFinalizedDailySession(instrumentKey, tradingDate);
    if (persisted?.candles?.length) {
      if (env.redisEnabled) {
        await redis.set(
          finalized1DKey(instrumentKey, tradingDate),
          JSON.stringify(persisted),
          { EX: 3 * 24 * 60 * 60 },
        );
      }
      return persisted;
    }
  } catch (err) {
    logger.warn("Finalized 1D MongoDB read failed", {
      instrumentKey,
      tradingDate,
      error: errorMessage(err),
    });
  }

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
  if (
    !env.redisEnabled ||
    !Array.isArray(payload?.candles) ||
    !payload.candles.length
  ) {
    return;
  }

  await redis.set(
    finalized1DKey(instrumentKey, tradingDate),
    JSON.stringify(payload),
    { EX: 3 * 24 * 60 * 60 },
  );
}

function isinFromInstrumentKey(key) {
  const candidate = String(key || "").split("|")[1] || "";

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

function timeToWeekdayCron(value, fallback) {
  const raw = String(value || fallback || "").trim();

  const match = raw.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    throw new Error(
      `Invalid cron time "${raw}". Expected HH:MM, for example 15:35`,
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
      `Invalid cron time "${raw}". Expected HH:MM between 00:00 and 23:59`,
    );
  }

  return `${minute} ${hour} * * 1-5`;
}

function getCronTimeFromEnv(key, fallback) {
  const value = process.env[key];

  if (value) {
    return value;
  }

  if (key === "CLOSE_JOB_TIME" && env.closeJobTime) {
    return env.closeJobTime;
  }

  if (key === "CLOSE_RETRY_TIME" && env.closeRetryTime) {
    return env.closeRetryTime;
  }

  return fallback;
}

const closeJobTime = getCronTimeFromEnv("CLOSE_JOB_TIME", "15:45");

const closeRetryTime = getCronTimeFromEnv("CLOSE_RETRY_TIME", "15:50");

const closeCron = timeToWeekdayCron(closeJobTime, "15:45");

const closeRetryCron = timeToWeekdayCron(closeRetryTime, "15:50");

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

  snapshots.set(snapshot.instrumentKey, snapshot);

  if (env.redisEnabled) {
    await redis.set(
      snapshotKey(snapshot.instrumentKey),
      JSON.stringify(snapshot),
      {
        EX: env.snapshotCacheSeconds,
      },
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

  const raw = await redis.get(snapshotKey(key));

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
  if (!snapshot) {
    return snapshot;
  }

  try {
    const previous = await getPreviousStoredClose(
      snapshot.instrumentKey,
      indiaDate(),
    );

    if (previous?.close != null) {
      const close = Number(previous.close);

      const price = Number(snapshot.price);

      if (Number.isFinite(close) && close > 0) {
        snapshot.previousClose = close;

        if (Number.isFinite(price)) {
          snapshot.change = price - close;

          snapshot.changePercent = ((price - close) / close) * 100;
        }

        snapshot.previousCloseDate = previous.trading_date;

        snapshot.previousCloseSource = "database-fallback";
      }
    }
  } catch (err) {
    logger.warn("Previous close fallback lookup failed", {
      instrumentKey: snapshot.instrumentKey,
      error: err.message,
    });
  }

  return snapshot;
}

/* =========================================================
   INSTRUMENT CONTEXT
========================================================= */

async function getInstrumentContext(instrumentKey) {
  const marketRow = await getMarketStockByInstrumentKey(instrumentKey);

  const master = await getInstrumentMaster(instrumentKey);

  if (!marketRow && !master) {
    return null;
  }

  const isin = master?.isin || isinFromInstrumentKey(instrumentKey);

  let bse = null;

  if (isin) {
    bse = await getBseInstrumentByIsin(isin);
  }

  return {
    marketRow,
    master,
    bse,
    isin,

    symbol: master?.tradingSymbol || marketRow?.symbol || null,

    name: master?.name || marketRow?.name || null,

    exchange: master?.exchange || marketRow?.master_exchange || "NSE",

    segment: master?.segment || marketRow?.master_segment || null,
  };
}

/* =========================================================
   52-WEEK HIGH / LOW
========================================================= */

async function get52WeekHighLow(instrumentKey, force = false) {
  if (!validKey(instrumentKey)) {
    throw new Error("Invalid instrumentKey");
  }

  const asOfDate = indiaDate();
  const cacheKey = week52Key(instrumentKey, asOfDate);

  if (env.redisEnabled && !force) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          Number.isFinite(Number(parsed.high)) &&
          Number.isFinite(Number(parsed.low))
        ) {
          return {
            ...parsed,
            source: "redis-upstox",
            cached: true,
          };
        }
      }
    } catch (err) {
      logger.warn("52-week cache read failed", {
        instrumentKey,
        error: errorMessage(err),
      });
    }
  }

  /*
   * 52 weeks = 364 calendar days. We fetch daily candles from Upstox and
   * calculate the range from the actual daily HIGH/LOW values, not closes.
   * Upstox may omit weekends/holidays, so the returned candles themselves
   * define the available trading sessions.
   */
  const toDate = asOfDate;
  const fromDate = shiftIndiaDate(toDate, -364);

  try {
    const candles = await upstox.fetchHistory(
      instrumentKey,
      "days",
      "1",
      toDate,
      fromDate,
    );

    const validCandles = (Array.isArray(candles) ? candles : []).filter(
      (candle) => {
        const high = Number(candle?.high);
        const low = Number(candle?.low);
        const timestamp = Date.parse(candle?.timestamp);

        return (
          Number.isFinite(timestamp) &&
          Number.isFinite(high) &&
          high > 0 &&
          Number.isFinite(low) &&
          low > 0
        );
      },
    );

    if (!validCandles.length) {
      throw new Error(`No daily candles returned for ${instrumentKey}`);
    }

    const highCandle = validCandles.reduce((best, candle) =>
      Number(candle.high) > Number(best.high) ? candle : best,
    );
    const lowCandle = validCandles.reduce((best, candle) =>
      Number(candle.low) < Number(best.low) ? candle : best,
    );

    const result = {
      instrumentKey,
      high: Number(highCandle.high),
      low: Number(lowCandle.low),
      highDate: indiaDate(new Date(highCandle.timestamp)),
      lowDate: indiaDate(new Date(lowCandle.timestamp)),
      fromDate,
      toDate,
      tradingSessions: validCandles.length,
      source: "upstox",
      cached: false,
      updatedAt: new Date().toISOString(),
    };

    if (env.redisEnabled) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), {
          EX: env.week52CacheSeconds,
        });
      } catch (err) {
        logger.warn("52-week cache write failed", {
          instrumentKey,
          error: errorMessage(err),
        });
      }
    }

    return result;
  } catch (err) {
    logger.warn("Upstox 52-week lookup failed; trying database fallback", {
      instrumentKey,
      error: errorMessage(err),
    });

    /*
     * MongoDB is only a fallback. The normal/source-of-truth path above is
     * always Upstox daily history.
     */
    try {
      const dbData = await getDbHistory(
        instrumentKey,
        fromDate,
        toDate,
      );

      const validDbCandles = (Array.isArray(dbData) ? dbData : []).filter(
        (candle) => {
          const high = Number(candle?.high);
          const low = Number(candle?.low);
          return (
            Number.isFinite(high) &&
            high > 0 &&
            Number.isFinite(low) &&
            low > 0
          );
        },
      );

      if (validDbCandles.length) {
        const highCandle = validDbCandles.reduce((best, candle) =>
          Number(candle.high) > Number(best.high) ? candle : best,
        );
        const lowCandle = validDbCandles.reduce((best, candle) =>
          Number(candle.low) < Number(best.low) ? candle : best,
        );

        return {
          instrumentKey,
          high: Number(highCandle.high),
          low: Number(lowCandle.low),
          highDate: indiaDate(new Date(highCandle.timestamp)),
          lowDate: indiaDate(new Date(lowCandle.timestamp)),
          fromDate,
          toDate,
          tradingSessions: validDbCandles.length,
          source: "database-fallback",
          cached: false,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (dbErr) {
      logger.warn("Database 52-week fallback failed", {
        instrumentKey,
        error: errorMessage(dbErr),
      });
    }

    throw err;
  }
}

/* =========================================================
   PRIME SNAPSHOT
========================================================= */

async function primeSnapshot(instrumentKey) {
  const context = await getInstrumentContext(instrumentKey);

  const today = indiaDate();
  const marketOpen = isMarketOpen();
  const settlementReady = isOfficialSettlementReady();
  const latestFinalizedDate = latestCompletedTradingDate();

  let existing = await getSnapshot(instrumentKey);

  const finalizedSources = new Set([
    "upstox-close-reconciliation",
    "upstox-finalized-intraday",
    "upstox-finalized-history",
  ]);

  const existingIsFinalized =
    !marketOpen &&
    existing?.marketDate === latestFinalizedDate &&
    existing?.marketStatus === "CLOSED" &&
    finalizedSources.has(existing?.source);

  // After the 15-minute settlement window, an official 1D candle pull is
  // authoritative even when the background all-stocks settlement job has not
  // reached this stock yet. This makes a user clicking a stock immediately
  // after 15:45 see the official close, not a provisional quote.
  if (!marketOpen && settlementReady && !existingIsFinalized) {
    try {
      const tradingDate = latestCompletedTradingDate();
      const candles = await fetchOfficialIntradaySession(
        instrumentKey,
        tradingDate,
      );
      const previousClose = await resolvePreviousClose(
        instrumentKey,
        tradingDate,
      );

      const row = {
        instrument_key: instrumentKey,
        symbol: context?.symbol || context?.marketRow?.symbol || null,
        name: context?.name || context?.marketRow?.name || null,
        master_exchange:
          context?.exchange || context?.marketRow?.master_exchange || null,
        master_segment:
          context?.segment || context?.marketRow?.master_segment || null,
        exchange: context?.exchange || null,
        segment: context?.segment || null,
        sector: context?.marketRow?.sector || null,
      };

      const official = buildOfficialCloseSnapshot(
        row,
        candles,
        previousClose,
        tradingDate,
        existing,
      );

      official.finalizedAt = new Date().toISOString();
      official.officialSettlementReady = true;
      official.settlementStatus = "finalized";
      official.candles = candles;

      await saveDailyClose(official, tradingDate);
      await cacheSnapshot(official);

      await cacheFinalized1D(instrumentKey, tradingDate, {
        tradingDate,
        candles,
        closePrice: Number(official.dayClose || official.close || official.price),
        baselineClose: previousClose?.close ?? null,
        baselineDate: previousClose?.tradingDate ?? null,
        source: "upstox-finalized-intraday",
        finalizedAt: official.finalizedAt,
      });

      return official;
    } catch (error) {
      logger.warn("Per-stock official settlement fetch failed", {
        instrumentKey,
        error: errorMessage(error),
      });
      // Fall through to a fresh quote so the detail page still has a usable
      // snapshot while the scheduled reconciliation retries the official pull.
    }
  }

  if (existingIsFinalized) {
    const hasUpper = Number.isFinite(Number(existing.upperCircuit));
    const hasLower = Number.isFinite(Number(existing.lowerCircuit));

    if (!hasUpper || !hasLower) {
      try {
        const quote = await upstox.fetchOhlc(instrumentKey);

        existing = {
          ...existing,
          upperCircuit:
            quote?.upperCircuit ??
            quote?.upperCircuitLimit ??
            existing.upperCircuit ??
            null,
          lowerCircuit:
            quote?.lowerCircuit ??
            quote?.lowerCircuitLimit ??
            existing.lowerCircuit ??
            null,
          upperCircuitLimit:
            quote?.upperCircuitLimit ??
            quote?.upperCircuit ??
            existing.upperCircuitLimit ??
            null,
          lowerCircuitLimit:
            quote?.lowerCircuitLimit ??
            quote?.lowerCircuit ??
            existing.lowerCircuitLimit ??
            null,
        };

        await cacheSnapshot(existing);
      } catch (error) {
        logger.warn("Circuit limit refresh failed", {
          instrumentKey,
          error: errorMessage(error),
        });
      }
    }

    existing.officialSettlementReady = settlementReady;
    return existing;
  }

  // OPEN market (or a non-finalized post-close window): never reuse a stale
  // same-day cache. Fetch a fresh Upstox quote, then let WebSocket ticks own
  // the live price.
  const snapshot = await upstox.fetchOhlc(instrumentKey);

  if (context) {
    snapshot.symbol = context.symbol;
    snapshot.name = context.name;
    snapshot.exchange = context.exchange;
    snapshot.segment = context.segment;
    snapshot.isin = context.isin;
    snapshot.sector = context.marketRow?.sector || null;
  }

  snapshot.marketDate = today;
  snapshot.marketOpen = marketOpen;
  snapshot.marketStatus = marketOpen ? "OPEN" : "CLOSED";
  snapshot.officialSettlementReady = settlementReady;

  // A closed-but-not-yet-finalized snapshot is explicitly provisional.
  if (!marketOpen && !settlementReady) {
    snapshot.source = "upstox-provisional-close";
  }

  await enrichWithStoredPreviousClose(snapshot);
  await cacheSnapshot(snapshot);

  return snapshot;
}

/* =========================================================
   FUNDAMENTALS CACHE
========================================================= */

function parseMaybeJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function firstPresent(source, keys) {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function numericValue(value) {
  const parsed = parseMaybeJson(value);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const nested = firstPresent(parsed, [
      "value",
      "amount",
      "number",
      "numericValue",
      "numeric_value",
    ]);
    if (nested !== null) return numericValue(nested);
  }

  if (typeof parsed === "number") {
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof parsed === "string") {
    const cleaned = parsed.replace(/,/g, "").replace(/%/g, "").trim();
    if (!cleaned) return null;
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function periodValue(source) {
  const value = firstPresent(source, [
    "quarter",
    "period",
    "reportPeriod",
    "report_period",
    "financialPeriod",
    "financial_period",
    "fiscalPeriod",
    "fiscal_period",
    "yearQuarter",
    "year_quarter",
    "quarterName",
    "quarter_name",
    "date",
    "reportDate",
    "report_date",
    "asOf",
    "as_of",
    "periodLabel",
    "period_label",
    "periodDate",
    "period_date",
    "periodEndDate",
    "period_end_date",
    "year",
  ]);

  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value === null || value === undefined || value === "") return null;

  return String(value).trim();
}

function normalizeIdentityValue(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function expandIdentityValues(value) {
  const raw = normalizeIdentityValue(value);
  if (!raw) return [];

  const values = new Set([raw]);

  // Symbols may be stored as RELIANCE, RELIANCE.NS, or RELIANCE.BO.
  if (raw.endsWith(".NS") || raw.endsWith(".BO")) {
    values.add(raw.slice(0, -3));
  }

  if (raw.includes("|")) {
    const [, right] = raw.split("|", 2);
    if (right) values.add(right);
  }

  return [...values];
}

function identityFilterFromCandidates(candidates = {}) {
  const values = new Set();

  for (const value of [
    candidates.isin,
    candidates.symbol,
    candidates.instrumentKey,
    candidates.tradingSymbol,
    candidates.name,
    ...(Array.isArray(candidates.instrumentKeys)
      ? candidates.instrumentKeys
      : []),
    ...(Array.isArray(candidates.symbols) ? candidates.symbols : []),
  ]) {
    for (const expanded of expandIdentityValues(value)) {
      values.add(expanded);
    }
  }

  const clauses = [];
  const identityFields = [
    "isin",
    "ISIN",
    "symbol",
    "tradingSymbol",
    "trading_symbol",
    "stockSymbol",
    "stock_symbol",
    "companySymbol",
    "company_symbol",
    "ticker",
    "tickerSymbol",
    "ticker_symbol",
    "instrumentKey",
    "instrument_key",
    "securityId",
    "security_id",
  ];

  for (const value of values) {
    for (const field of identityFields) {
      clauses.push({ [field]: value });
    }
  }

  if (candidates.name) {
    const name = String(candidates.name).trim();
    if (name) {
      clauses.push({ name }, { companyName: name }, { company_name: name });
    }
  }

  if (!clauses.length) return { _id: null };
  return { $or: clauses };
}

function looksLikePeriodKey(value) {
  const text = String(value || "").trim();
  return (
    /^(?:q[1-4]|fy\s*\d{2,4}|fy\s*\d{4}|\d{4})$/i.test(text) ||
    /\b(?:q[1-4]|fy)\b/i.test(text) ||
    /\b(?:19|20)\d{2}\b/.test(text) ||
    /\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?/.test(text) ||
    /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}$/i.test(
      text,
    )
  );
}

function metricName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ");
}

function metricKind(value) {
  const text = metricName(value);
  if (!text) return null;
  if (
    /(revenue|sales|turnover|operating income|total income|income from operations)/i.test(
      text,
    )
  ) {
    return "revenue";
  }
  if (
    /(net profit|profit after tax|pat|net income|netprofit|profit)/i.test(text)
  ) {
    return "profit";
  }
  return null;
}

function normalizeStoredFinancialRows(documents, fallbackFundamentals = {}) {
  const rows = [];
  const visited = new WeakSet();

  const add = (period, revenue, profit) => {
    if (!period) return;
    if (revenue === null && profit === null) return;

    rows.push({
      quarter: String(period).trim(),
      period: String(period).trim(),
      revenue: revenue ?? 0,
      profit: profit ?? 0,
    });
  };

  const walk = (
    candidate,
    inheritedPeriod = null,
    inheritedMetric = null,
    depth = 0,
  ) => {
    if (candidate === null || candidate === undefined || depth > 6) return;

    const parsed = parseMaybeJson(candidate);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        walk(item, inheritedPeriod, inheritedMetric, depth + 1);
      }
      return;
    }

    if (!parsed || typeof parsed !== "object") return;
    if (visited.has(parsed)) return;
    visited.add(parsed);

    const source = parsed;
    const period = periodValue(source) || inheritedPeriod;
    const metric =
      firstPresent(source, [
        "category",
        "metric",
        "particular",
        "name",
        "label",
        "type",
      ]) || inheritedMetric;

    let revenue = numericValue(
      firstPresent(source, [
        "revenue",
        "sales",
        "totalRevenue",
        "total_revenue",
        "revenueValue",
        "revenue_value",
        "turnover",
        "totalIncome",
        "total_income",
        "incomeFromOperations",
        "income_from_operations",
        "revenueCr",
        "revenue_cr",
        "salesCr",
        "sales_cr",
        "totalRevenueCr",
        "total_revenue_cr",
        "incomeCr",
        "income_cr",
      ]),
    );

    let profit = numericValue(
      firstPresent(source, [
        "profit",
        "netProfit",
        "net_profit",
        "profitAfterTax",
        "profit_after_tax",
        "pat",
        "operatingProfit",
        "operating_profit",
        "netIncome",
        "net_income",
        "profitForPeriod",
        "profit_for_period",
        "profitCr",
        "profit_cr",
        "netProfitCr",
        "net_profit_cr",
        "patCr",
        "pat_cr",
        "operatingProfitCr",
        "operating_profit_cr",
      ]),
    );

    const genericValue = numericValue(
      firstPresent(source, [
        "value",
        "amount",
        "number",
        "numericValue",
        "numeric_value",
        "val",
      ]),
    );

    if (genericValue !== null) {
      const kind = metricKind(metric);
      if (kind === "revenue" && revenue === null) revenue = genericValue;
      if (kind === "profit" && profit === null) profit = genericValue;
    }

    if (period && (revenue !== null || profit !== null)) {
      add(period, revenue, profit);
    }

    // Handle Upstox-style income statements and legacy stored JSON.
    for (const key of [
      "incomeStatement",
      "income_statement",
      "fullStatement",
      "full_statement",
      "financials",
      "financialData",
      "financial_data",
      "data",
      "rows",
      "history",
      "values",
      "categories",
      "statement",
      "statements",
    ]) {
      if (source[key] !== undefined) {
        walk(source[key], period, metric, depth + 1);
      }
    }

    // Handle schemas like { Revenue: { "Q1 FY26": 123 }, Net Profit: ... }
    // and { "Q1 FY26": { revenue: 123, netProfit: 45 } }.
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined || typeof value !== "object") {
        continue;
      }

      if (
        [
          "incomeStatement",
          "income_statement",
          "fullStatement",
          "full_statement",
          "financials",
          "financialData",
          "financial_data",
          "data",
          "rows",
          "history",
          "values",
          "categories",
          "statement",
          "statements",
        ].includes(key)
      ) {
        continue;
      }

      const nextPeriod = looksLikePeriodKey(key) ? key : period;
      const nextMetric = metricKind(key) ? key : metric;
      walk(value, nextPeriod, nextMetric, depth + 1);
    }
  };

  for (const document of documents || []) {
    walk(document);
  }

  // Summary fallback. Even when the original row has no explicit period,
  // expose a single "Latest" point so the UI does not become empty.
  const fallbackPeriod =
    periodValue(fallbackFundamentals) ||
    firstPresent(fallbackFundamentals, [
      "revenuePeriod",
      "revenue_period",
      "netProfitPeriod",
      "net_profit_period",
      "operatingProfitPeriod",
      "operating_profit_period",
    ]) ||
    "Latest";

  const fallbackRevenue = numericValue(
    firstPresent(fallbackFundamentals, [
      "revenue",
      "sales",
      "totalRevenue",
      "total_revenue",
      "turnover",
      "totalIncome",
      "total_income",
    ]),
  );

  const fallbackProfit = numericValue(
    firstPresent(fallbackFundamentals, [
      "netProfit",
      "net_profit",
      "profit",
      "operatingProfit",
      "operating_profit",
      "pat",
      "netIncome",
      "net_income",
      "profitCr",
      "profit_cr",
      "netProfitCr",
      "net_profit_cr",
      "patCr",
      "pat_cr",
      "operatingProfitCr",
      "operating_profit_cr",
    ]),
  );

  if (fallbackRevenue !== null || fallbackProfit !== null) {
    add(fallbackPeriod, fallbackRevenue, fallbackProfit);
  }

  const merged = new Map();
  for (const row of rows) {
    const key = String(row.quarter || row.period || "").trim();
    if (!key) continue;

    const existing = merged.get(key) || {
      quarter: key,
      period: key,
      revenue: 0,
      profit: 0,
    };

    if (Number.isFinite(row.revenue) && row.revenue !== 0) {
      existing.revenue = row.revenue;
    }
    if (Number.isFinite(row.profit) && row.profit !== 0) {
      existing.profit = row.profit;
    }

    merged.set(key, existing);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const av = Date.parse(a.period);
    const bv = Date.parse(b.period);

    if (Number.isFinite(av) && Number.isFinite(bv)) {
      return av - bv;
    }

    return String(a.period).localeCompare(String(b.period), undefined, {
      numeric: true,
    });
  });
}

function normalizeStoredShareholding(documents) {
  const groups = new Map();
  const labels = {
    promoters: "Promoters",
    fii: "FII",
    fii_holding: "FII",
    dii: "DII",
    other_dii: "DII",
    public: "Public",
    mutual_funds: "Mutual Funds",
    retail: "Retail",
    retail_and_other: "Retail & Other",
  };

  for (const document of documents || []) {
    const source = parseMaybeJson(document) || document;
    if (!source || typeof source !== "object") continue;

    const categoryRaw = firstPresent(source, [
      "category",
      "holderType",
      "holder_type",
      "type",
      "name",
      "label",
    ]);
    const category = String(categoryRaw || "other")
      .trim()
      .toLowerCase();
    const period = periodValue(source);
    const percentage = numericValue(
      firstPresent(source, [
        "percentage",
        "percent",
        "value",
        "holding",
        "holdingPercentage",
        "holding_percentage",
      ]),
    );

    if (!period || percentage === null) continue;

    const key = category || "other";
    if (!groups.has(key)) {
      groups.set(key, {
        category: key,
        label: labels[key] || String(categoryRaw || "Other"),
        history: [],
      });
    }

    groups.get(key).history.push({
      period,
      percentage,
    });
  }

  for (const row of groups.values()) {
    row.history.sort((a, b) => {
      const av = Date.parse(a.period);
      const bv = Date.parse(b.period);
      if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
      return String(b.period).localeCompare(String(a.period));
    });
  }

  return Array.from(groups.values()).filter((row) => row.history.length);
}

async function findFinancialDocuments(db, collectionName, candidates) {
  const collection = db.collection(collectionName);
  const filter = identityFilterFromCandidates(candidates);

  const docs = await collection.find(filter).limit(500).toArray();

  if (docs.length) return docs;

  // Some legacy rows are keyed only by the old stock/instrument id.
  const legacyIds = [
    candidates.mysqlId,
    candidates.stockId,
    candidates.stock_id,
    candidates.instrumentId,
    candidates.instrument_id,
  ]
    .map((value) => numericValue(value))
    .filter((value) => value !== null);

  if (!legacyIds.length) return [];

  const legacyFields = [
    "mysqlId",
    "stockId",
    "stock_id",
    "instrumentId",
    "instrument_id",
    "companyId",
    "company_id",
  ];

  const legacyFilter = {
    $or: legacyFields.flatMap((field) =>
      legacyIds.map((value) => ({ [field]: value })),
    ),
  };

  return collection.find(legacyFilter).limit(500).toArray();
}

async function getStoredFundamentals(isin) {
  const db = getMongoDB();
  if (!db || !isin) return null;

  const normalizedIsin = normalizeIdentityValue(isin);
  const candidates = {
    isin: normalizedIsin,
    instrumentKey: null,
    symbol: null,
    tradingSymbol: null,
    name: null,
    mysqlId: null,
    instrumentKeys: [],
    symbols: [],
  };

  try {
    const instruments = await db
      .collection("instruments")
      .find({
        $or: [{ isin: normalizedIsin }, { ISIN: normalizedIsin }],
      })
      .limit(20)
      .toArray();

    const instrument = instruments[0] || null;

    if (instrument) {
      candidates.instrumentKey = instrument.instrumentKey || null;
      candidates.symbol = instrument.tradingSymbol || instrument.symbol || null;
      candidates.tradingSymbol =
        instrument.tradingSymbol || instrument.symbol || null;
      candidates.name = instrument.name || instrument.companyName || null;
      candidates.mysqlId = instrument.mysqlId || instrument.stockId || null;

      candidates.instrumentKeys = instruments
        .map((item) => item.instrumentKey)
        .filter(Boolean);

      candidates.symbols = instruments
        .flatMap((item) => [item.tradingSymbol, item.symbol])
        .filter(Boolean);
    } else {
      candidates.instrumentKeys = [];
      candidates.symbols = [];
    }
  } catch (err) {
    logger.warn("Instrument metadata lookup for fundamentals failed", {
      isin: normalizedIsin,
      error: err?.message,
    });
  }

  // Resolve through marketStocks as a second source of truth.
  if (candidates.instrumentKey) {
    try {
      const marketRow = await db.collection("marketStocks").findOne({
        instrumentKey: candidates.instrumentKey,
      });

      if (marketRow) {
        candidates.symbol =
          candidates.symbol ||
          marketRow.symbol ||
          marketRow.tradingSymbol ||
          null;
        candidates.name =
          candidates.name || marketRow.name || marketRow.companyName || null;
        candidates.mysqlId =
          candidates.mysqlId || marketRow.mysqlId || marketRow.stockId || null;
      }
    } catch (err) {
      logger.warn("Market stock metadata lookup failed", {
        isin: normalizedIsin,
        error: err?.message,
      });
    }
  }

  // If the instrument master has no ISIN, derive it from the standard key.
  if (!candidates.isin && candidates.instrumentKey?.includes("|")) {
    candidates.isin = candidates.instrumentKey.split("|")[1] || null;
  }

  const [fundamentalDocs, financialDocs, shareholdingDocs] = await Promise.all([
    findFinancialDocuments(db, "stockFundamentals", candidates),
    findFinancialDocuments(db, "stockFinancials", candidates),
    findFinancialDocuments(db, "stockShareholding", candidates),
  ]);

  if (
    !fundamentalDocs.length &&
    !financialDocs.length &&
    !shareholdingDocs.length
  ) {
    return null;
  }

  const fundamentalDocsSorted = [...fundamentalDocs].sort((a, b) => {
    const ad = new Date(
      a.updatedAt || a.updated_at || a.migratedAt || 0,
    ).getTime();
    const bd = new Date(
      b.updatedAt || b.updated_at || b.migratedAt || 0,
    ).getTime();
    return bd - ad;
  });

  const fund =
    fundamentalDocsSorted
      .map((doc) => parseMaybeJson(doc) || doc)
      .find((doc) => doc && typeof doc === "object") || {};

  const financialRows = normalizeStoredFinancialRows(financialDocs, fund);
  const shareholding = normalizeStoredShareholding(shareholdingDocs);

  const latestFinancial = financialRows.length
    ? financialRows[financialRows.length - 1]
    : null;

  const fundamentals = {
    marketCap: firstPresent(fund, ["marketCap", "market_cap"]),
    sector: firstPresent(fund, ["sector"]),
    peRatio: numericValue(firstPresent(fund, ["peRatio", "pe_ratio", "pe"])),
    pbRatio: numericValue(firstPresent(fund, ["pbRatio", "pb_ratio", "pb"])),
    roe: numericValue(
      firstPresent(fund, ["roe", "returnOnEquity", "return_on_equity"]),
    ),
    roa: numericValue(
      firstPresent(fund, ["roa", "returnOnAssets", "return_on_assets"]),
    ),
    roce: numericValue(
      firstPresent(fund, [
        "roce",
        "returnOnCapitalEmployed",
        "return_on_capital_employed",
      ]),
    ),
    evEbitda: numericValue(
      firstPresent(fund, ["evEbitda", "ev_ebitda", "evebitda"]),
    ),
    eps: numericValue(firstPresent(fund, ["eps", "epsBasic", "eps_basic"])),
    revenue:
      numericValue(
        firstPresent(fund, [
          "revenue",
          "sales",
          "totalRevenue",
          "total_revenue",
          "turnover",
          "totalIncome",
          "total_income",
          "revenueCr",
          "revenue_cr",
          "salesCr",
          "sales_cr",
          "totalRevenueCr",
          "total_revenue_cr",
        ]),
      ) ??
      latestFinancial?.revenue ??
      null,
    revenuePeriod:
      firstPresent(fund, [
        "revenuePeriod",
        "revenue_period",
        "period",
        "quarter",
        "periodLabel",
        "period_label",
      ]) ||
      latestFinancial?.period ||
      null,
    operatingProfit: numericValue(
      firstPresent(fund, [
        "operatingProfit",
        "operating_profit",
        "operatingIncome",
        "operating_income",
      ]),
    ),
    operatingProfitPeriod: firstPresent(fund, [
      "operatingProfitPeriod",
      "operating_profit_period",
      "period",
      "quarter",
    ]),
    netProfit:
      numericValue(
        firstPresent(fund, [
          "netProfit",
          "net_profit",
          "profit",
          "pat",
          "netIncome",
          "net_income",
          "profitCr",
          "profit_cr",
          "netProfitCr",
          "net_profit_cr",
          "patCr",
          "pat_cr",
          "operatingProfitCr",
          "operating_profit_cr",
        ]),
      ) ??
      latestFinancial?.profit ??
      null,
    netProfitPeriod:
      firstPresent(fund, [
        "netProfitPeriod",
        "net_profit_period",
        "period",
        "quarter",
        "periodLabel",
        "period_label",
      ]) ||
      latestFinancial?.period ||
      null,
    period:
      periodValue(fund) ||
      financialRows[financialRows.length - 1]?.period ||
      "Latest",
  };

  const source =
    financialRows.length ||
    fundamentals.revenue !== null ||
    fundamentals.netProfit !== null
      ? "mongodb"
      : "mongodb-partial";

  return {
    fundamentals,
    profile:
      fund.profile || fund.companyProfile || fund.company_profile || null,
    ratios: Array.isArray(fund.ratios)
      ? fund.ratios
      : Array.isArray(fund.keyRatios)
        ? fund.keyRatios
        : [],
    incomeStatement: financialRows,
    balanceSheet:
      fund.balanceSheet || fund.balance_sheet || fund.balanceSheetData || null,
    cashFlow: fund.cashFlow || fund.cash_flow || fund.cashFlowData || null,
    shareholding,
    mutualFunds: shareholding
      .filter((row) => row.category === "mutual_funds")
      .flatMap((row) =>
        row.history.map((item) => ({
          name: "Mutual Funds",
          percentage: item.percentage,
          period: item.period,
        })),
      ),
    corporateActions: fund.corporateActions || fund.corporate_actions || [],
    competitors: fund.competitors || [],
    financialRows,
    source,
    updatedAt:
      fund.updatedAt ||
      fund.updated_at ||
      financialDocs[financialDocs.length - 1]?.updatedAt ||
      financialDocs[financialDocs.length - 1]?.updated_at ||
      new Date().toISOString(),
  };
}

function hasUsableFinancialData(data) {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data.financialRows) && data.financialRows.length)
    return true;

  const fundamentals = data.fundamentals || {};
  return (
    (fundamentals.revenue !== null && fundamentals.revenue !== undefined) ||
    (fundamentals.netProfit !== null && fundamentals.netProfit !== undefined)
  );
}

function mergeFinancialData(primary, secondary) {
  if (!primary) return secondary || null;
  if (!secondary) return primary;

  const primaryRows = Array.isArray(primary.financialRows)
    ? primary.financialRows
    : [];
  const secondaryRows = Array.isArray(secondary.financialRows)
    ? secondary.financialRows
    : [];

  const rows = [];
  const byPeriod = new Map();

  for (const row of [...primaryRows, ...secondaryRows]) {
    const key = String(row?.period || row?.quarter || "").trim();
    if (!key) continue;

    const existing = byPeriod.get(key) || {
      quarter: key,
      period: key,
      revenue: 0,
      profit: 0,
    };

    if (Number.isFinite(Number(row?.revenue)) && Number(row.revenue) !== 0) {
      existing.revenue = Number(row.revenue);
    }
    if (Number.isFinite(Number(row?.profit)) && Number(row.profit) !== 0) {
      existing.profit = Number(row.profit);
    }

    byPeriod.set(key, existing);
  }

  rows.push(...byPeriod.values());
  rows.sort((a, b) =>
    String(a.period).localeCompare(String(b.period), undefined, {
      numeric: true,
    }),
  );

  return {
    ...secondary,
    ...primary,
    fundamentals: {
      ...(secondary.fundamentals || {}),
      ...(primary.fundamentals || {}),
    },
    financialRows: rows.length
      ? rows
      : primaryRows.length
        ? primaryRows
        : secondaryRows,
    incomeStatement: rows.length
      ? rows
      : primary.incomeStatement || secondary.incomeStatement || [],
    shareholding: primary.shareholding?.length
      ? primary.shareholding
      : secondary.shareholding || [],
    source: primary.source || secondary.source,
    updatedAt: primary.updatedAt || secondary.updatedAt,
  };
}

async function getFundamentalsCached(isin, force = false) {
  const normalizedIsin = normalizeIdentityValue(isin);

  // Normal requests use the application cache. A forced refresh bypasses it
  // so the next request goes all the way to Upstox.
  if (!force) {
    const cached = fundamentalsByIsin.get(normalizedIsin);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const inflight = fundamentalsInflight.get(normalizedIsin);
    if (inflight) return inflight;
  }

  const fetchPromise = (async () => {
    try {
      // Upstox is the primary source for financial data. MongoDB contains the
      // migrated reporting snapshot and is used only when the provider fails.
      try {
        const providerData = await upstox.getFundamentals(
          normalizedIsin,
          force,
        );

        if (providerData && hasUsableFinancialData(providerData)) {
          const primary = {
            ...providerData,
            source: "upstox",
            updatedAt: providerData.updatedAt || new Date().toISOString(),
          };

          fundamentalsByIsin.set(normalizedIsin, {
            data: primary,
            expiresAt: Date.now() + FUNDAMENTALS_TTL,
          });

          return primary;
        }

        throw new Error("Upstox returned no usable financial data");
      } catch (providerError) {
        logger.warn("Upstox financial data unavailable; using MongoDB fallback", {
          isin: normalizedIsin,
          error: providerError?.message || String(providerError),
        });

        const stored = await getStoredFundamentals(normalizedIsin);
        if (stored) {
          const fallback = {
            ...stored,
            source: stored.source || "mongodb-fallback",
          };

          fundamentalsByIsin.set(normalizedIsin, {
            data: fallback,
            expiresAt: Date.now() + FUNDAMENTALS_TTL,
          });

          return fallback;
        }

        throw providerError;
      }
    } catch (err) {
      logger.error("getFundamentalsCached fetch failed", {
        isin: normalizedIsin,
        error: err?.message,
      });
      throw err;
    } finally {
      fundamentalsInflight.delete(normalizedIsin);
    }
  })();

  fundamentalsInflight.set(normalizedIsin, fetchPromise);
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


function indiaMinutesOfDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour || 0) * 60 + Number(values.minute || 0);
}

function candleTradingDate(candle) {
  const timestamp = Date.parse(candle?.timestamp);
  return Number.isFinite(timestamp) ? indiaDate(new Date(timestamp)) : null;
}

function candleOpen(candle) {
  const value = Number(candle?.open ?? candle?.o);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function candleClose(candle) {
  const value = Number(candle?.close ?? candle?.c ?? candle?.price);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function currentISTMarketMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const minutes = Number(values.hour || 0) * 60 + Number(values.minute || 0);
  return Math.max(9 * 60 + 15, Math.min(15 * 60 + 30, minutes));
}

function istMinutesFromTimestamp(timestamp) {
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour || 0) * 60 + Number(values.minute || 0);
}

function nearestTradingCandle(candles, targetDate, targetMinutes) {
  const rows = (Array.isArray(candles) ? candles : [])
    .filter((candle) => candleTradingDate(candle) === targetDate && candleClose(candle) !== null)
    .sort((a, b) => {
      const am = istMinutesFromTimestamp(a.timestamp);
      const bm = istMinutesFromTimestamp(b.timestamp);
      return Math.abs((am ?? 0) - targetMinutes) - Math.abs((bm ?? 0) - targetMinutes);
    });

  return rows[0] || null;
}

async function resolveRangeStartPrice(instrumentKey, unit, interval, from, data) {
  if (!from) return null;

  try {
    /*
     * The period-return number is not the OHLC OPEN of the first daily/weekly
     * candle. It is the market price around the same clock time at the start
     * of the selected period. This is why the earlier versions could be off
     * by a few rupees even when the chart itself looked correct.
     *
     * Upstox V3 supports minute history from Jan-2022. For intervals above
     * 15 minutes, a quarter-sized request is allowed, so a 30-minute candle
     * is enough to resolve the reference point for 3M/6M/1Y/3Y when the
     * starting date is inside the provider's intraday history.
     */
    const today = indiaDate();
    const targetMinutes = currentISTMarketMinutes();
    const yearsSince2022 = Number(from.slice(0, 4)) >= 2022;

    // The All range begins at 2000 in the UI, but the return anchor is the
    // last quoted price immediately before that boundary. For Reliance this
    // is the Dec-1999 close (19.84), which is also why using the Jan-2000
    // monthly OPEN produced a large All-range mismatch.
    if (unit === "months" && from === "2000-01-01") {
      const previousWindowFrom = shiftIndiaDate(from, -62);
      const previousCandles = await upstox.fetchHistory(
        instrumentKey,
        "months",
        "1",
        from,
        previousWindowFrom,
      );
      const previousRows = (Array.isArray(previousCandles) ? previousCandles : [])
        .filter((candle) => candleTradingDate(candle) < from && candleClose(candle) !== null)
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      const previous = previousRows[previousRows.length - 1];
      if (previous) {
        return {
          close: candleClose(previous),
          tradingDate: candleTradingDate(previous),
          source: "upstox-pre-range-close",
        };
      }
    }

    if (yearsSince2022) {
      const intradayInterval =
        unit === "minutes" ? Math.max(1, Math.min(Number(interval) || 5, 15)) :
        from >= shiftIndiaDate(today, -31) ? 5 : 30;

      // Ask for a small window beginning at the range start. Upstox requires
      // to_date >= from_date; the previous implementation got this direction
      // wrong for the short-range lookup.
      const intradayTo = shiftIndiaDate(from, 3);
      const intradayCandles = await upstox.fetchHistory(
        instrumentKey,
        "minutes",
        String(intradayInterval),
        intradayTo,
        from,
      );

      // If the exact calendar start is a holiday/weekend, use the first
      // trading session on/after the requested start date.
      const valid = (Array.isArray(intradayCandles) ? intradayCandles : [])
        .filter((candle) => candleClose(candle) !== null)
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

      if (valid.length) {
        const firstTradingDate = candleTradingDate(valid[0]);
        const sameDay = nearestTradingCandle(valid, firstTradingDate, targetMinutes);
        if (sameDay) {
          return {
            close: candleClose(sameDay),
            tradingDate: firstTradingDate,
            source: `upstox-period-start-${intradayInterval}m-same-time`,
          };
        }
      }
    }

    /*
     * For dates before the intraday provider window, use the first plotted
     * candle's OPEN. This is the closest stable equivalent to the start-time
     * price and is also what our long-range chart already plots.
     */
    const rows = (Array.isArray(data) ? data : [])
      .filter((candle) => {
        const date = candleTradingDate(candle);
        return date && date >= from;
      })
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const first = rows[0];
    const open = candleOpen(first);
    const close = candleClose(first);

    if (open !== null || close !== null) {
      return {
        close: open ?? close,
        tradingDate: candleTradingDate(first),
        source: open !== null ? "upstox-range-start-open" : "upstox-range-start-close",
      };
    }
  } catch (err) {
    logger.warn("Range start price resolution failed", {
      instrumentKey,
      unit,
      interval,
      from,
      error: errorMessage(err),
    });
  }

  return null;
}

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
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

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
  {
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
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

async function fetchOfficialIntradaySession(instrumentKey, tradingDate) {
  /*
   * A requested date can be a market holiday even when it is a weekday.
   * Upstox correctly returns no candles for such a date. Instead of making
   * the 1D chart fail, walk backwards to the latest session for which
   * official 1-minute candles actually exist.
   */
  const requestedDate = String(tradingDate || indiaDate());
  let lastProviderError = null;

  for (let offset = 0; offset <= 10; offset += 1) {
    const candidateDate = shiftIndiaDate(requestedDate, -offset);

    if (!isTradingDay(dateAtISTNoon(candidateDate))) {
      continue;
    }

    try {
      const raw =
        candidateDate === indiaDate()
          ? await upstox.fetchHistory(
              instrumentKey,
              "minutes",
              "1",
              candidateDate,
            )
          : await upstox.fetchHistory(
              instrumentKey,
              "minutes",
              "1",
              candidateDate,
              shiftIndiaDate(candidateDate, -7),
            );

      const candles = filterTradingSession(raw, candidateDate);

      if (candles.length) {
        if (candidateDate !== requestedDate) {
          logger.info("Using latest available intraday session", {
            instrumentKey,
            requestedDate,
            actualTradingDate: candidateDate,
          });
        }
        return candles;
      }
    } catch (err) {
      lastProviderError = err;
      logger.warn("Intraday session lookup failed", {
        instrumentKey,
        candidateDate,
        error: errorMessage(err),
      });
    }
  }

  throw new Error(
    `No official 1-minute candles available for ${instrumentKey} on or before ${requestedDate}` +
      (lastProviderError ? `: ${errorMessage(lastProviderError)}` : ""),
  );
}

async function fetchOfficialIntradaySessionWithRetry(
  instrumentKey,
  tradingDate,
  attempts = 3,
) {
  let lastError = null;

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await fetchOfficialIntradaySession(instrumentKey, tradingDate);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;

      const delayMs = Math.min(5000, 1000 * attempt);
      logger.warn("Official intraday settlement retry", {
        instrumentKey,
        tradingDate,
        attempt,
        nextRetryMs: delayMs,
        error: errorMessage(error),
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error(`Official settlement failed for ${instrumentKey}`);
}

function buildOfficialCloseSnapshot(row, candles, previousClose, tradingDate, priorSnapshot = null) {
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
    previousClose?.close != null ? close - Number(previousClose.close) : null;

  return {
    instrumentKey: row.instrument_key,
    symbol: row.symbol || null,
    tradingSymbol: row.symbol || null,
    name: row.name || null,
    companyName: row.name || null,
    exchange:
      row.master_exchange || row.exchange || env.marketStockExchange || "NSE",
    segment:
      row.master_segment || row.segment || env.marketStockSegment || "NSE_EQ",
    sector: row.sector || null,
    ltp: close,
    price: close,
    dayClose: close,
    previousClose:
      previousClose?.close != null ? Number(previousClose.close) : null,
    previousCloseDate: previousClose?.tradingDate || null,
    previousCloseSource: previousClose?.source || null,
    change,
    changePercent: previousClose?.close
      ? (change / Number(previousClose.close)) * 100
      : null,
    open: Number(first.open),
    high: highs.length ? Math.max(...highs) : Number(first.high),
    low: lows.length ? Math.min(...lows) : Number(first.low),
    volume,
    upperCircuit: Number(
      priorSnapshot?.upperCircuit ??
      priorSnapshot?.upperCircuitLimit ??
      row?.upperCircuit ??
      row?.upperCircuitLimit ??
      NaN,
    ),
    lowerCircuit: Number(
      priorSnapshot?.lowerCircuit ??
      priorSnapshot?.lowerCircuitLimit ??
      row?.lowerCircuit ??
      row?.lowerCircuitLimit ??
      NaN,
    ),
    upperCircuitLimit: Number(
      priorSnapshot?.upperCircuitLimit ??
      priorSnapshot?.upperCircuit ??
      row?.upperCircuitLimit ??
      row?.upperCircuit ??
      NaN,
    ),
    lowerCircuitLimit: Number(
      priorSnapshot?.lowerCircuitLimit ??
      priorSnapshot?.lowerCircuit ??
      row?.lowerCircuitLimit ??
      row?.lowerCircuit ??
      NaN,
    ),
    lastTradeTime: Date.parse(last.timestamp) || null,
    timestamp: Date.now(),
    marketDate: tradingDate,
    marketOpen: false,
    marketStatus: "CLOSED",
    source: "upstox-finalized-intraday",
    settlementStatus: "finalized",
    officialSettlementReady: true,
    finalizedAt: new Date().toISOString(),
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
    const rows = await getMarketStockInstruments();

    if (!rows.length) {
      logger.warn("No market stocks available for official settlement", {
        reason,
        tradingDate: targetTradingDate,
        database: "mongodb",
      });
      return { total: 0, saved: 0 };
    }

    const batchSize = Math.max(1, Number(env.closeBatchSize) || 5);
    let saved = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (row) => {
          const key = row.instrument_key;
          if (!validKey(key)) {
            throw new Error("Invalid instrument key");
          }

          // A successful finalized session is immutable. On the first run of
          // this version, older daily-close rows do not have settlementStatus,
          // so they are deliberately re-settled from official history.
          const alreadyFinalized = await hasFinalizedDailySession(
            key,
            targetTradingDate,
          );

          if (alreadyFinalized) {
            const persisted = await getFinalized1D(key, targetTradingDate);
            if (persisted?.candles?.length) {
              const existing = await getSnapshot(key);
              if (existing?.settlementStatus === "finalized") {
                return { skipped: true };
              }
            }
          }

          // The scheduled settlement always fetches official 1-minute history
          // rather than trusting a live Redis snapshot.
          const candles = await fetchOfficialIntradaySessionWithRetry(
            key,
            targetTradingDate,
            3,
          );

          const previousClose = await resolvePreviousClose(
            key,
            targetTradingDate,
          );

          const priorSnapshot = snapshots.get(key) || null;
          let officialQuote = null;
          try {
            officialQuote = await upstox.fetchOhlc(key);
          } catch (quoteError) {
            logger.warn("Official settlement quote enrichment failed", {
              instrumentKey: key,
              error: errorMessage(quoteError),
            });
          }

          const snapshot = buildOfficialCloseSnapshot(
            {
              ...row,
              upperCircuit: officialQuote?.upperCircuit ?? row.upperCircuit,
              lowerCircuit: officialQuote?.lowerCircuit ?? row.lowerCircuit,
              upperCircuitLimit: officialQuote?.upperCircuitLimit ?? row.upperCircuitLimit,
              lowerCircuitLimit: officialQuote?.lowerCircuitLimit ?? row.lowerCircuitLimit,
            },
            candles,
            previousClose,
            targetTradingDate,
            {
              ...(priorSnapshot || {}),
              ...(officialQuote || {}),
            },
          );
          snapshot.candles = candles;

          await saveDailyClose(snapshot, targetTradingDate);

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
            io.to(`stock:${key}`).emit("detailStock:snapshot", snapshot);
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

      if (i + batch.length < rows.length && Number(env.closeBatchDelayMs) > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, Number(env.closeBatchDelayMs)),
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
  if (!env.startupReconcileClosed || isMarketOpen()) {
    return;
  }

  const rows = await getMarketStockInstruments();

  if (!rows.length) {
    return;
  }

  const date = latestCompletedTradingDate();

  const totalStocks = rows.length;

  const savedToday = await getDailyCloseCount(date);

  const markerKey = `detailstock:close-reconciled:v3:${date}`;

  let marker = null;

  if (env.redisEnabled) {
    try {
      marker = await redis.get(markerKey);
    } catch (err) {
      logger.warn("Close reconciliation marker read failed", {
        error: err.message,
      });
    }
  }

  const needsRepair = savedToday < totalStocks || marker !== "ok";

  if (needsRepair) {
    logger.info("Startup close reconciliation required", {
      date,
      totalStocks,
      savedToday,
      marker,
    });

    const result = await reconcileAllMarketStocks(
      "startup-after-market-hours-v2",
      date,
    );

    if (env.redisEnabled && result.total > 0 && result.saved >= result.total) {
      try {
        await redis.set(markerKey, "ok", {
          EX: 3 * 24 * 60 * 60,
        });
      } catch (err) {
        logger.warn("Close reconciliation marker write failed", {
          error: err.message,
        });
      }
    }
  } else {
    logger.info("Startup close reconciliation already complete", {
      date,
      totalStocks,
      savedToday,
    });
  }
}

/* =========================================================
   UPSTOX LIVE TICK HANDLER
========================================================= */

upstox.setTickHandler((tick) => {
  // Ignore late/out-of-order packets after the exchange has closed.
  // Finalized historical data owns the 1D chart after close.
  if (!isTradingDay() || !isMarketOpen()) {
    return;
  }

  const today = indiaDate();
  const previous = snapshots.get(tick.instrumentKey) || {};
  const newTradingSession =
    previous.marketDate !== today || previous.marketStatus === "CLOSED";

  // Never carry yesterday's day OHLC/volume into the new session. The first
  // valid tick owns the new session state; previousClose intentionally comes
  // from the finalized prior session when the feed does not provide it.
  const snapshot = {
    ...(newTradingSession
      ? {
          instrumentKey: tick.instrumentKey,
          previousClose:
            previous.dayClose ?? previous.price ?? previous.previousClose ?? null,
          previousCloseDate: previous.marketDate ?? null,
        }
      : previous),
    ...tick,

    instrumentKey: tick.instrumentKey,

    marketDate: today,

    marketOpen: true,

    marketStatus: "OPEN",

    source: "upstox-websocket",
  };

  const carryFields = newTradingSession
    ? ["previousClose", "previousCloseDate", "upperCircuit", "lowerCircuit", "lastTradeTime"]
    : [
        "previousClose",
        "open",
        "high",
        "low",
        "volume",
        "upperCircuit",
        "lowerCircuit",
        "lastTradeTime",
      ];

  for (const field of carryFields) {
    if (snapshot[field] == null && previous[field] != null) {
      snapshot[field] = previous[field];
    }
  }

  if (snapshot.price != null && snapshot.previousClose != null) {
    snapshot.change = Number(snapshot.price) - Number(snapshot.previousClose);

    snapshot.changePercent = Number(snapshot.previousClose)
      ? (snapshot.change / Number(snapshot.previousClose)) * 100
      : null;
  }

  snapshots.set(tick.instrumentKey, snapshot);

  if (env.redisEnabled) {
    redis
      .set(snapshotKey(tick.instrumentKey), JSON.stringify(snapshot), {
        EX: env.snapshotCacheSeconds,
      })
      .catch((err) =>
        logger.warn("Tick cache write failed", {
          error: err.message,
        }),
      );
  }

  io.to(`stock:${tick.instrumentKey}`).emit("detailStock:tick", snapshot);
});

/* =========================================================
   SOCKET.IO
========================================================= */

io.on("connection", (socket) => {
  socket.on("detailStock:subscribe", async (payload, ack = () => {}) => {
    const key = payload?.instrumentKey;

    if (!validKey(key)) {
      return ack({
        success: false,
        message: "Valid instrumentKey is required",
      });
    }

    try {
      const context = await getInstrumentContext(key);

      if (!context?.master) {
        return ack({
          success: false,
          message: "Instrument is not in the stock universe",
        });
      }

      socket.join(`stock:${key}`);

      if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
      }

      const set = subscribers.get(key);

      const first = set.size === 0;

      set.add(socket.id);

      if (first) {
        await upstox.subscribe(key);
      }

      let snapshot = await primeSnapshot(key);

      if (context) {
        snapshot = {
          ...snapshot,

          instrumentKey: key,

          symbol: context.symbol,

          name: context.name,

          exchange: context.exchange,

          segment: context.segment,

          isin: context.isin,

          sector: context.marketRow?.sector || null,

          bseInstrumentKey: context.bse?.instrumentKey || null,
        };
      }

      const isin = snapshot.isin || context?.isin;

      if (isin) {
        try {
          const fundamentals = await getFundamentalsCached(isin);

          snapshot = {
            ...snapshot,
            ...fundamentals,
            isin,
          };
        } catch (err) {
          logger.warn("Fundamentals unavailable on subscribe", {
            instrumentKey: key,

            isin,

            error: errorMessage(err),
          });
        }
      }

      await cacheSnapshot(snapshot);

      socket.emit("detailStock:snapshot", {
        ...snapshot,
        marketOpen: isMarketOpen(),
      });

      ack({
        success: true,
        subscribed: true,
        deduplicated: !first,
        subscriberCount: set.size,
        snapshot,
      });
    } catch (err) {
      logger.error("Detail stock subscribe failed", {
        instrumentKey: key,

        socketId: socket.id,

        error: errorMessage(err),
      });

      ack({
        success: false,
        message: errorMessage(err),
      });
    }
  });

  socket.on("detailStock:unsubscribe", async (payload, ack = () => {}) => {
    const key = payload?.instrumentKey;

    if (!validKey(key)) {
      return ack({
        success: false,
      });
    }

    await release(key, socket.id);

    socket.leave(`stock:${key}`);

    ack({
      success: true,
    });
  });

  socket.on("disconnect", async () => {
    for (const [key, set] of subscribers.entries()) {
      if (set.has(socket.id)) {
        await release(key, socket.id);
      }
    }
  });
});

async function release(key, socketId) {
  const set = subscribers.get(key);

  if (!set) {
    return;
  }

  set.delete(socketId);

  if (set.size === 0) {
    subscribers.delete(key);

    await upstox.unsubscribe(key, false);

    logger.info("Stock room became empty", {
      instrumentKey: key,
    });
  }
}

/* =========================================================
   ROUTES
========================================================= */

app.get("/health", async (req, res) => {
  const status = marketStatus();

  res.json({
    success: true,
    service: "detail-stock",

    uptimeSeconds: Math.round(process.uptime()),

    ...status,

    redis: env.redisEnabled ? redis.isReady : false,

    database: "mongodb",

    upstoxConnected: upstox.isConnected(),

    upstoxSubscribed: upstox.getSubscribed().length,

    activeRooms: subscribers.size,

    time: new Date().toISOString(),
  });
});

app.get("/api/detail-stock/market-status", async (req, res) => {
  res.json({
    success: true,
    ...marketStatus(),
  });
});

app.get("/api/financials/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;

    const financials = await getStockFinancials(symbol);

    res.json({
      success: true,
      data: financials,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
});

app.get("/api/stock/:symbol/financials", async (req, res) => {
  try {
    const { symbol } = req.params;

    let isin = symbol;

    if (!symbol.startsWith("INE") && !symbol.startsWith("IN0")) {
      isin = await getIsinBySymbol(symbol);
    }

    if (!isin) {
      return res.status(404).json({
        success: false,
        error: `Could not resolve ISIN for symbol: ${symbol}`,
      });
    }

    const financials = await getStockFinancials(isin);

    return res.json({
      symbol,
      isin,
      ...financials,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch financials",
    });
  }
});

app.get("/api/detail-stock/market-stocks", async (req, res) => {
  try {
    const rows = await getMarketStockInstruments();

    res.json({
      success: true,
      marketOpen: isMarketOpen(),

      count: rows.length,

      data: rows,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/instrument/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  if (!validKey(key)) {
    return res.status(400).json({
      success: false,
      message: "Invalid instrumentKey",
    });
  }

  try {
    const context = await getInstrumentContext(key);

    if (!context) {
      return res.status(404).json({
        success: false,
        message: "Instrument not found",
      });
    }

    res.json({
      success: true,
      data: context,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

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

    res.json({
      success: true,
      marketOpen: isMarketOpen(),

      data: snapshot,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/52-week/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;
  const forceRefresh = String(req.query.refresh || "") === "1";

  if (!validKey(key)) {
    return res.status(400).json({
      success: false,
      message: "Invalid instrumentKey",
    });
  }

  try {
    const data = await get52WeekHighLow(key, forceRefresh);

    return res.json({
      success: true,
      instrumentKey: key,
      marketOpen: isMarketOpen(),
      refreshed: forceRefresh,
      data,
    });
  } catch (err) {
    logger.error("52-week high/low request failed", {
      instrumentKey: key,
      forceRefresh,
      error: errorMessage(err),
    });

    return res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/history/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  if (!validKey(key)) {
    return res.status(400).json({
      success: false,
      message: "Invalid instrumentKey",
    });
  }

  const allowedUnits = new Set(["minutes", "hours", "days", "weeks", "months"]);

  const unit = allowedUnits.has(req.query.unit) ? req.query.unit : "days";
  const interval = String(req.query.interval || "1");
  const to = String(req.query.to || indiaDate());
  const from = req.query.from ? String(req.query.from) : "";
  const forceRefresh = String(req.query.refresh || "") === "1";
  const isOneDay = unit === "minutes" && interval === "1" && !from;

  try {
    /*
     * After close, finalized settlement data is immutable for the session.
     * refresh=1 is used only for the OPEN -> CLOSED handover when the final
     * cache may not exist yet.
     */
    if (isOneDay && !isMarketOpen() && !forceRefresh) {
      const sessionDate = latestCompletedTradingDate();
      const finalized = await getFinalized1D(key, sessionDate);

      if (finalized?.candles?.length) {
        return res.json({
          success: true,
          source: "finalized-1d",
          marketOpen: false,
          sessionDate,
          baselineClose: finalized.baselineClose ?? null,
          baselineDate: finalized.baselineDate ?? null,
          data: {
            candles: finalized.candles,
            baselineClose: finalized.baselineClose ?? null,
            baselineDate: finalized.baselineDate ?? null,
          },
        });
      }
    }

    const cacheKey = historyKey(key, unit, interval, from, to);

    if (env.redisEnabled && !forceRefresh) {
      const cached = await redis.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);

        // Only accept v2 history objects. Older array-only cache entries
        // did not contain a real prior-day baseline.
        if (
          parsed &&
          !Array.isArray(parsed) &&
          Object.prototype.hasOwnProperty.call(parsed, "baselineClose")
        ) {
          return res.json({
            success: true,
            source: "cache",
            marketOpen: isMarketOpen(),
            refreshed: false,
            data: parsed,
          });
        }
      }
    }

    let data;

    if (isOneDay && !isMarketOpen()) {
      const sessionDate = latestCompletedTradingDate();
      data = await fetchOfficialIntradaySession(key, sessionDate);
    } else {
      /*
       * Keep chart candles and displayed period return separate. The return
       * baseline is resolved at the beginning of the selected range using
       * the older working Detail Stock range-anchor logic.
       */
      const rangeStart = await resolveRangeStartPrice(
        key,
        unit,
        interval,
        from,
        data,
      );

      if (rangeStart?.close != null) {
        baselineClose = Number(rangeStart.close);
        baselineDate = rangeStart.tradingDate || from || null;
      }
    }

    const payload = {
      candles: Array.isArray(data) ? data : [],
      baselineClose,
      baselineDate,
      source: "upstox",
    };

    if (!payload.candles.length) {
      throw new Error(`No historical candles returned for ${key}`);
    }

    if (env.redisEnabled) {
      await redis.set(cacheKey, JSON.stringify(payload), {
        EX: env.historyCacheSeconds,
      });
    }

    /*
     * Seed the finalized session cache for after-close reads. The scheduled
     * settlement still persists the official close and can retry safely.
     */
    if (isOneDay && !isMarketOpen() && sessionDate) {
      const last = payload.candles[payload.candles.length - 1];

      await cacheFinalized1D(key, sessionDate, {
        tradingDate: sessionDate,
        candles: payload.candles,
        closePrice: Number(last?.close) || null,
        baselineClose,
        baselineDate,
        source: "upstox-finalized-intraday",
        finalizedAt: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      source: "upstox",
      marketOpen: isMarketOpen(),
      refreshed: forceRefresh,
      sessionDate: sessionDate || undefined,
      baselineClose,
      baselineDate,
      data: payload,
    });
  } catch (err) {
    /*
     * Keep the existing DB fallback for longer ranges. Baseline is resolved
     * independently from the first candle, so weekends/holidays are safe.
     */
    if (!isOneDay && ["days", "weeks", "months"].includes(unit)) {
      try {
        const dbData = await getDbHistory(key, from || "2000-01-01", to);

        if (dbData.length) {
          const firstCandle = dbData[0];
          const firstClose = Number(
            firstCandle?.close ?? firstCandle?.c ?? firstCandle?.price,
          );
          const firstTimestamp = Date.parse(firstCandle?.timestamp);
          const baselineClose =
            Number.isFinite(firstClose) && firstClose > 0 ? firstClose : null;
          const baselineDate = Number.isFinite(firstTimestamp)
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
              historyKey(key, unit, interval, from, to),
              JSON.stringify(payload),
              {
                EX: env.historyCacheSeconds,
              },
            );
          }

          return res.json({
            success: true,
            source: "database",
            marketOpen: isMarketOpen(),
            refreshed: false,
            baselineClose,
            baselineDate,
            data: payload,
          });
        }
      } catch (dbError) {
        logger.warn("Database history fallback failed", {
          instrumentKey: key,
          error: errorMessage(dbError),
        });
      }
    }

    logger.error("History request failed", {
      instrumentKey: key,
      unit,
      interval,
      from,
      to,
      forceRefresh,
      error: errorMessage(err),
    });

    return res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/fundamentals/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    res.json({
      success: true,
      isin,
      ...data,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/shareholding/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    res.json({
      success: true,

      isin,

      shareholding: data?.shareholding || [],

      mutualFunds: data?.mutualFunds || [],

      updatedAt: data?.updatedAt,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/about/:isin", async (req, res) => {
  const isin = String(req.params.isin || "")
    .trim()
    .toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    const profile = await upstox.getProfile(isin);

    return res.json({
      success: true,

      isin,

      profile: {
        company_profile: profile?.company_profile ?? null,

        sector: profile?.sector ?? null,

        sector_market_cap_inr: {
          value: profile?.sector_market_cap_inr?.value ?? null,

          unit: profile?.sector_market_cap_inr?.unit ?? "crore",

          formatted: profile?.sector_market_cap_inr?.formatted ?? null,
        },

        sector_market_cap_usd: {
          value: profile?.sector_market_cap_usd?.value ?? null,

          unit: profile?.sector_market_cap_usd?.unit ?? null,

          formatted: profile?.sector_market_cap_usd?.formatted ?? null,
        },
      },
    });
  } catch (err) {
    logger.error("Company profile fetch failed", {
      isin,

      error: errorMessage(err),
    });

    return res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/ratios/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    const data = await getFundamentalsCached(isin);

    res.json({
      success: true,

      isin,

      ratios: data?.ratios || [],

      updatedAt: data?.updatedAt,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/corporate-actions/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    res.json({
      success: true,

      isin,

      data: await upstox.getCorporateActions(isin),

      updatedAt: Date.now(),
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/competitors/:isin", async (req, res) => {
  const isin = String(req.params.isin || "").toUpperCase();

  if (!validIsin(isin)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ISIN",
    });
  }

  try {
    res.json({
      success: true,

      isin,

      data: await upstox.getCompetitors(isin),

      updatedAt: Date.now(),
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get(
  "/api/detail-stock/financial-performance/:identifier",
  async (req, res) => {
    try {
      const identifier = String(req.params.identifier || "")
        .trim()
        .toUpperCase();

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

      const forceRefresh = ["1", "true", "yes"].includes(
        String(req.query.refresh || "").toLowerCase(),
      );

      const data = await getFundamentalsCached(isin, forceRefresh);

      return res.json({
        success: true,
        symbol: identifier,
        isin,

        // The frontend can consume this directly through unwrapResponse().
        data: data?.financialRows || data?.incomeStatement || [],

        incomeStatement: data?.incomeStatement || [],

        financialRows: data?.financialRows || data?.incomeStatement || [],

        balanceSheet: data?.balanceSheet || null,

        cashFlow: data?.cashFlow || null,

        fundamentals: data?.fundamentals || null,

        ratios: data?.ratios || [],

        source: data?.source || "provider",

        updatedAt: data?.updatedAt || Date.now(),
      });
    } catch (error) {
      logger.error("Failed to fetch financial performance", {
        error: error?.message || String(error),
      });

      return res.status(502).json({
        success: false,
        message: error?.message || "Failed to fetch financial performance",
      });
    }
  },
);

app.get("/api/detail-stock/funds", async (req, res) => {
  try {
    const data = await upstox.getFunds();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

/* =========================================================
   SIMULATED BUY / SELL
========================================================= */

app.post(
  "/api/detail-stock/order",
  authenticateToken,
  validateBodyObject({
    allowEmpty: false,
    allowedFields: [
      "symbol",
      "instrumentKey",
      "transactionType",
      "quantity",
      "limitPrice",
      "orderType",
      "product",
    ],
    requiredFields: [
      "instrumentKey",
      "transactionType",
      "quantity",
      "orderType",
      "product",
    ],
    fieldRules: {
      symbol: { type: "string", maxLength: 100 },
      instrumentKey: { type: "string", maxLength: 255 },
      transactionType: { type: "string", maxLength: 10 },
      quantity: { type: "number" },
      limitPrice: { type: "number" },
      orderType: { type: "string", maxLength: 10 },
      product: { type: "string", maxLength: 10 },
    },
  }),
  async (req, res) => {
    const body = req.body || {};

    const idempotencyKey = String(req.get("Idempotency-Key") || "").trim();

    if (!validIdempotencyKey(idempotencyKey)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_IDEMPOTENCY_KEY",
        message:
          "A valid Idempotency-Key header is required (16-128 characters).",
      });
    }

    /*
     * ---------------------------------------------
     * Validate instrument
     * ---------------------------------------------
     */

    if (!validKey(body.instrumentKey)) {
      return res.status(400).json({
        success: false,
        message: "Valid instrumentKey is required",
      });
    }

    /*
     * ---------------------------------------------
     * Validate quantity
     * ---------------------------------------------
     */

    const quantity = Number(body.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    /*
     * ---------------------------------------------
     * BUY / SELL
     * ---------------------------------------------
     */

    const transactionType = String(
      body.transactionType || body.orderType || "",
    ).toUpperCase();

    if (!["BUY", "SELL"].includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message: "transactionType must be BUY or SELL",
      });
    }

    /*
     * ---------------------------------------------
     * MARKET / LIMIT
     * ---------------------------------------------
     */

    const orderType = String(body.orderType || "MARKET").toUpperCase();

    /*
     * orderType is simulation-only.
     * It is NEVER sent to Upstox.
     */

    if (!["MARKET", "LIMIT"].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderType",
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

    const marketOpen = true;

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
     * LIMIT price validation
     * ---------------------------------------------
     *
     * The client price is treated only as a LIMIT condition.
     * The execution price always comes from the locked database row.
     */

    const requestedLimitPrice =
      body.limitPrice != null && body.limitPrice !== ""
        ? Number(body.limitPrice)
        : body.price != null && body.price !== ""
          ? Number(body.price)
          : null;

    if (
      orderType === "LIMIT" &&
      (!Number.isFinite(requestedLimitPrice) || requestedLimitPrice <= 0)
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LIMIT_PRICE",
        message: "A positive limitPrice is required for LIMIT orders.",
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

      const result = await simulateOrder({
        userId: req.userId,

        instrumentKey: body.instrumentKey,

        transactionType,

        quantity,

        orderType,

        product: "CNC",

        limitPrice: requestedLimitPrice,

        idempotencyKey,
      });

      /*
       * Failed simulated order,
       * for example insufficient
       * holdings on SELL.
       */

      if (!result.success) {
        return res.status(400).json(result);
      }

      /*
       * Successful simulated order
       */

      return res.json({
        success: true,

        simulated: true,

        marketOpen: true,

        data: result,
      });
    } catch (err) {
      logger.error("Simulated order failed", {
        userId: req.userId,

        instrumentKey: body.instrumentKey,

        transactionType,

        error: errorMessage(err),
      });

      const status =
        Number.isInteger(err?.httpStatus) &&
        err.httpStatus >= 400 &&
        err.httpStatus < 500
          ? err.httpStatus
          : 500;

      return res.status(status).json({
        success: false,
        code: err?.code || "SIMULATED_ORDER_FAILED",
        message: err?.message || "Unable to complete simulated order",
      });
    }
  },
);

app.get("/api/detail-stock/market-stocks-count", async (req, res) => {
  try {
    res.json({
      success: true,

      count: await getMarketStockCount(),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: errorMessage(err),
    });
  }
});

app.get("/api/detail-stock/status/:instrumentKey", async (req, res) => {
  const key = req.params.instrumentKey;

  res.json({
    success: true,

    instrumentKey: key,

    marketOpen: isMarketOpen(),

    subscriberCount: subscribers.get(key)?.size || 0,

    subscribed: upstox.getSubscribed().includes(key),

    snapshot: await getSnapshot(key),
  });
});

/* =========================================================
   PERSISTENCE & CRON
========================================================= */

async function persistClosingPrices(reason = "scheduled-settlement") {
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
  const result = await reconcileAllMarketStocks(reason, tradingDate);

  if (env.redisEnabled && result.total > 0 && result.saved >= result.total) {
    try {
      await redis.set(`detailstock:close-reconciled:v3:${tradingDate}`, "ok", {
        EX: 3 * 24 * 60 * 60,
      });
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
  nextSettlementRun: getNextCronRun(closeTask),
  nextRetryRun: getNextCronRun(closeRetryTask),
});

/* =========================================================
   FINAL ERROR HANDLING
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "Route not found.",
    },
    requestId: req.requestId,
  });
});

app.use(errorHandler);

/* =========================================================
   STARTUP & SHUTDOWN
========================================================= */

async function startup() {
  await connectMongoDB();

  await connectRedis();

  await initDb();

  await reconcileOnStartup();

  server.listen(env.port, "127.0.0.1", () => {
    logger.info("detail-stock server started", {
      port: env.port,

      nodeEnv: env.nodeEnv,

      marketOpen: isMarketOpen(),

      origins: env.origins,

      closeJobTime,

      closeRetryTime,

      closeCron,

      closeRetryCron,

      timezone: env.timezone,
    });
  });
}

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  logger.info("Shutdown requested", {
    signal,
  });

  try {
    for (const key of upstox.getSubscribed()) {
      await upstox.unsubscribe(key, true);
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

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", {
    error: err.stack || err.message,
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled rejection", {
    error: err?.stack || String(err),
  });
});

startup().catch((err) => {
  logger.error("Startup failed", {
    error: err.stack || err.message,
  });

  process.exit(1);
});
