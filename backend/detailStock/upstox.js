// const axios = require("axios");
// const Upstox = require("upstox-js-sdk");

// const env = require("./env");
// const logger = require("./logger");

// const V2 = "https://api.upstox.com/v2";
// const V3 = "https://api.upstox.com/v3";

// /*
//  * Official SDK authentication.
//  */
// const defaultClient =
//   Upstox.ApiClient.instance;

// defaultClient.authentications[
//   "OAUTH2"
// ].accessToken = env.upstoxAccessToken;

// let streamer = null;

// let connected = false;
// let connecting = false;

// let onTick = null;

// const subscribed = new Set();

// const fundamentalsCache = new Map();

// const FUNDAMENTALS_TTL =
//   15 * 60 * 1000;

// /*
//  * Do not hammer Upstox when a WebSocket
//  * authentication problem occurs.
//  */
// let websocketBlockedUntil = 0;

// const WS_RETRY_DELAY =
//   Number(env.upstoxWsRetryDelayMs) || 15000;

// const WS_MAX_RETRIES =
//   Number(env.upstoxWsMaxRetries) || 10;

// let websocketRetryCount = 0;

// function safeJson(data) {
//   if (data == null) {
//     return null;
//   }

//   if (
//     typeof data === "object" &&
//     !Buffer.isBuffer(data)
//   ) {
//     return data;
//   }

//   try {
//     return JSON.parse(
//       Buffer.isBuffer(data)
//         ? data.toString("utf8")
//         : String(data),
//     );
//   } catch {
//     return null;
//   }
// }

// function n(value, fallback = null) {
//   const number = Number(value);

//   return Number.isFinite(number)
//     ? number
//     : fallback;
// }

// function headers() {
//   return {
//     Accept: "application/json",

//     Authorization:
//       `Bearer ${env.upstoxAccessToken}`,
//   };
// }

// /* =========================================================
//    FEED NORMALIZATION
// ========================================================= */

// function findFeed(payload, key) {
//   return (
//     payload?.feeds?.[key] ||
//     payload?.feeds?.[
//       key?.replace("|", ":")
//     ] ||
//     payload?.data?.feeds?.[key] ||
//     payload?.data?.feeds?.[
//       key?.replace("|", ":")
//     ] ||
//     null
//   );
// }

// function normalizeFeed(
//   instrumentKey,
//   feed,
// ) {
//   if (!feed) {
//     return null;
//   }

//   const root =
//     feed?.fullFeed?.marketFF ||
//     feed?.fullFeed?.indexFF ||
//     feed?.marketFF ||
//     feed?.indexFF ||
//     feed?.ff ||
//     feed;

//   const ltpc =
//     root?.ltpc ||
//     feed?.ltpc ||
//     {};

//   const extended =
//     root?.eFeedDetails ||
//     root?.extendedFeedDetails ||
//     {};

//   const daily =
//     (
//       root?.marketOHLC?.ohlc ||
//       feed?.marketOHLC?.ohlc ||
//       []
//     ).find(
//       (item) =>
//         item.interval === "1d",
//     ) || {};

//   const ltp = n(
//     ltpc.ltp ??
//       root?.ltp ??
//       feed?.ltp,
//   );

//   const previousClose = n(
//     ltpc.cp ??
//       extended.lastClose ??
//       root?.lastClose,
//   );

//   const open = n(
//     daily.open ??
//       root?.open,
//   );

//   const high = n(
//     daily.high ??
//       root?.high,
//   );

//   const low = n(
//     daily.low ??
//       root?.low,
//   );

//   const volume = n(
//     daily.volume ??
//       extended.tv ??
//       root?.volume,
//   );

//   const lastTradedQuantity = n(
//     ltpc.ltq ??
//       root?.ltq,
//   );

//   const lastTradeTime =
//     n(
//       ltpc.ltt ??
//         root?.ltt,
//     ) || Date.now();

//   if (
//     ltp === null &&
//     previousClose === null
//   ) {
//     return null;
//   }

//   const change =
//     ltp !== null &&
//     previousClose !== null
//       ? ltp - previousClose
//       : null;

//   const changePercent =
//     previousClose
//       ? (change / previousClose) * 100
//       : null;

//   return {
//     instrumentKey,

//     ltp,
//     price: ltp,

//     previousClose,

//     change,
//     changePercent,

//     open,
//     high,
//     low,

//     volume,

//     lastTradedQuantity,

//     lastTradeTime,

//     timestamp: Date.now(),

//     source: "upstox-websocket",
//   };
// }

// /* =========================================================
//    WEBSOCKET
// ========================================================= */

// function scheduleReconnect() {
//   if (!subscribed.size) {
//     return;
//   }

//   if (
//     websocketRetryCount >=
//     WS_MAX_RETRIES
//   ) {
//     logger.error(
//       "Upstox WebSocket retry limit reached",
//       {
//         retries: websocketRetryCount,
//         subscribed:
//           subscribed.size,
//       },
//     );

//     return;
//   }

//   websocketRetryCount += 1;

//   const delay =
//     Math.min(
//       WS_RETRY_DELAY *
//         Math.pow(
//           2,
//           websocketRetryCount - 1,
//         ),
//       120000,
//     );

//   logger.warn(
//     "Scheduling Upstox WebSocket reconnect",
//     {
//       retry:
//         websocketRetryCount,
//       delayMs: delay,
//     },
//   );

//   setTimeout(() => {
//     if (!subscribed.size) {
//       return;
//     }

//     connectStreamer();
//   }, delay);
// }

// function createStreamer() {
//   /*
//    * Important:
//    *
//    * The official Node SDK constructor accepts
//    * instrumentKeys + mode.
//    *
//    * We start with no instruments and dynamically
//    * subscribe/unsubscribe.
//    */
//   streamer =
//     new Upstox.MarketDataStreamerV3();

//   /*
//    * We control reconnect ourselves.
//    * This prevents the previous implementation from
//    * continuously hitting Upstox after a 403.
//    */
//   streamer.autoReconnect(
//     false,
//   );

//   streamer.on(
//     "open",
//     () => {
//       connected = true;
//       connecting = false;

//       websocketRetryCount = 0;

//       websocketBlockedUntil = 0;

//       logger.info(
//         "Upstox MarketDataStreamerV3 connected",
//         {
//           subscriptions:
//             subscribed.size,
//         },
//       );

//       /*
//        * Re-subscribe everything after reconnect.
//        */
//       if (subscribed.size) {
//         try {
//           streamer.subscribe(
//             [...subscribed],
//             env.upstoxStreamMode ||
//               "full",
//           );
//         } catch (error) {
//           logger.error(
//             "Upstox resubscribe failed",
//             {
//               error:
//                 error.message,
//             },
//           );
//         }
//       }
//     },
//   );

//   streamer.on(
//     "close",
//     () => {
//       connected = false;
//       connecting = false;

//       logger.warn(
//         "Upstox MarketDataStreamerV3 closed",
//       );

//       scheduleReconnect();
//     },
//   );

//   streamer.on(
//     "reconnecting",
//     () => {
//       logger.info(
//         "Upstox MarketDataStreamerV3 reconnecting",
//       );
//     },
//   );

//   streamer.on(
//     "autoReconnectStopped",
//     () => {
//       logger.warn(
//         "Upstox automatic reconnect stopped",
//       );
//     },
//   );

//   streamer.on(
//     "error",
//     (error) => {
//       connected = false;
//       connecting = false;

//       const message =
//         error?.message ||
//         String(error);

//       logger.error(
//         "Upstox WebSocket error",
//         {
//           error: message,
//         },
//       );

//       /*
//        * A 403 should not cause a rapid retry loop.
//        */
//       if (
//         message.includes("403") ||
//         message.includes(
//           "Unexpected server response",
//         )
//       ) {
//         websocketBlockedUntil =
//           Date.now() + WS_RETRY_DELAY;

//         logger.error(
//           "Upstox WebSocket authentication rejected; retry delayed",
//           {
//             retryAfterMs:
//               WS_RETRY_DELAY,
//           },
//         );
//       }
//     },
//   );

//   streamer.on(
//     "message",
//     (raw) => {
//       const payload =
//         safeJson(raw);

//       if (!payload) {
//         return;
//       }

//       /*
//        * A message can contain multiple instruments.
//        */
//       for (const key of subscribed) {
//         const feed =
//           findFeed(
//             payload,
//             key,
//           );

//         const tick =
//           normalizeFeed(
//             key,
//             feed,
//           );

//         if (
//           tick &&
//           typeof onTick === "function"
//         ) {
//           try {
//             onTick(tick);
//           } catch (error) {
//             logger.error(
//               "Tick handler failed",
//               {
//                 instrumentKey:
//                   key,
//                 error:
//                   error.message,
//               },
//             );
//           }
//         }
//       }
//     },
//   );

//   return streamer;
// }

// function connectStreamer() {
//   if (!subscribed.size) {
//     return;
//   }

//   if (connected || connecting) {
//     return;
//   }

//   if (
//     Date.now() <
//     websocketBlockedUntil
//   ) {
//     return;
//   }

//   connecting = true;

//   if (!streamer) {
//     createStreamer();
//   }

//   try {
//     logger.info(
//       "Connecting to Upstox MarketDataStreamerV3",
//       {
//         subscriptionCount:
//           subscribed.size,
//       },
//     );

//     streamer.connect();
//   } catch (error) {
//     connected = false;
//     connecting = false;

//     logger.error(
//       "Upstox WebSocket connect failed",
//       {
//         error:
//           error.message,
//       },
//     );

//     scheduleReconnect();
//   }
// }

// /* =========================================================
//    SUBSCRIBE
// ========================================================= */

// async function subscribe(
//   instrumentKey,
// ) {
//   if (!instrumentKey) {
//     throw new Error(
//       "instrumentKey is required",
//     );
//   }

//   const wasSubscribed =
//     subscribed.has(
//       instrumentKey,
//     );

//   /*
//    * This is the critical duplicate protection.
//    *
//    * 100 users clicking Reliance:
//    *
//    * subscribed.has(...) === true
//    *
//    * therefore only ONE provider subscription.
//    */
//   subscribed.add(
//     instrumentKey,
//   );

//   /*
//    * Only create/connect the provider socket
//    * when the first active subscription exists.
//    */
//   if (!wasSubscribed) {
//     if (!connected) {
//       connectStreamer();
//     } else {
//       try {
//         streamer.subscribe(
//           [instrumentKey],
//           env.upstoxStreamMode ||
//             "full",
//         );
//       } catch (error) {
//         logger.error(
//           "Upstox subscribe failed",
//           {
//             instrumentKey,
//             error:
//               error.message,
//           },
//         );

//         throw error;
//       }
//     }
//   }

//   return {
//     subscribed: true,
//     alreadySubscribed:
//       wasSubscribed,
//     connected,
//   };
// }

// /* =========================================================
//    UNSUBSCRIBE
// ========================================================= */

// async function unsubscribe(
//   instrumentKey,
// ) {
//   if (
//     !subscribed.has(
//       instrumentKey,
//     )
//   ) {
//     return;
//   }

//   subscribed.delete(
//     instrumentKey,
//   );

//   if (
//     streamer &&
//     connected
//   ) {
//     try {
//       streamer.unsubscribe([
//         instrumentKey,
//       ]);
//     } catch (error) {
//       logger.warn(
//         "Upstox unsubscribe failed",
//         {
//           instrumentKey,
//           error:
//             error.message,
//         },
//       );
//     }
//   }

//   /*
//    * If nobody is viewing anything anymore,
//    * disconnect the provider WebSocket.
//    */
//   if (!subscribed.size) {
//     disconnect();
//   }
// }

// /* =========================================================
//    DISCONNECT
// ========================================================= */

// function disconnect() {
//   if (!streamer) {
//     connected = false;
//     connecting = false;
//     return;
//   }

//   try {
//     streamer.autoReconnect(false);

//     streamer.disconnect();
//   } catch (error) {
//     logger.warn(
//       "Upstox disconnect failed",
//       {
//         error:
//           error.message,
//       },
//     );
//   }

//   connected = false;
//   connecting = false;
// }

// /* =========================================================
//    REST - OHLC
// ========================================================= */

// async function fetchOhlc(
//   instrumentKey,
// ) {
//   const response =
//     await axios.get(
//       `${V3}/market-quote/ohlc`,
//       {
//         params: {
//           instrument_key:
//             instrumentKey,
//           interval: "1d",
//         },

//         headers: headers(),

//         timeout: 10000,
//       },
//     );

//   const data =
//     response.data?.data || {};

//   const q =
//     Object.values(data)[0];

//   if (!q) {
//     throw new Error(
//       "No OHLC data returned by Upstox",
//     );
//   }

//   const ltp =
//     n(q.last_price);

//   const previousClose =
//     n(q.prev_ohlc?.close);

//   const change =
//     ltp !== null &&
//     previousClose !== null
//       ? ltp - previousClose
//       : null;

//   return {
//     instrumentKey,

//     ltp,
//     price: ltp,

//     previousClose,

//     change,

//     changePercent:
//       previousClose
//         ? (change /
//             previousClose) *
//           100
//         : null,

//     open: n(
//       q.live_ohlc?.open ??
//         q.prev_ohlc?.open,
//     ),

//     high: n(
//       q.live_ohlc?.high ??
//         q.prev_ohlc?.high,
//     ),

//     low: n(
//       q.live_ohlc?.low ??
//         q.prev_ohlc?.low,
//     ),

//     volume: n(
//       q.live_ohlc?.volume,
//     ),

//     lastTradeTime:
//       n(q.last_trade_time) ||
//       null,

//     timestamp: Date.now(),

//     source:
//       "upstox-rest",
//   };
// }

// /* =========================================================
//    REST - QUOTES
// ========================================================= */

// async function fetchQuotes(
//   instrumentKeys,
// ) {
//   const keys = [
//     ...new Set(
//       (instrumentKeys || [])
//         .filter(Boolean),
//     ),
//   ];

//   if (!keys.length) {
//     return {};
//   }

//   /*
//    * Do not make one request per stock.
//    *
//    * Batch them.
//    */
//   const response =
//     await axios.get(
//       `${V2}/market-quote/quotes`,
//       {
//         params: {
//           instrument_key:
//             keys.join(","),
//         },

//         headers: headers(),

//         timeout: 20000,
//       },
//     );

//   return (
//     response.data?.data ||
//     {}
//   );
// }

// /* =========================================================
//    HISTORY
// ========================================================= */

// async function fetchHistory(
//   instrumentKey,
//   unit,
//   interval,
//   to,
//   from,
// ) {
//   const path =
//     `${V3}/historical-candle/` +
//     `${encodeURIComponent(
//       instrumentKey,
//     )}/` +
//     `${unit}/` +
//     `${interval}/` +
//     `${to}` +
//     `${
//       from
//         ? `/${from}`
//         : ""
//     }`;

//   const response =
//     await axios.get(
//       path,
//       {
//         headers: headers(),
//         timeout: 15000,
//       },
//     );

//   return (
//     response.data?.data?.candles ||
//     []
//   )
//     .map((candle) => ({
//       timestamp: candle[0],

//       open: n(
//         candle[1],
//         0,
//       ),

//       high: n(
//         candle[2],
//         0,
//       ),

//       low: n(
//         candle[3],
//         0,
//       ),

//       close: n(
//         candle[4],
//         0,
//       ),

//       volume: n(
//         candle[5],
//         0,
//       ),

//       openInterest: n(
//         candle[6],
//         0,
//       ),
//     }))
//     .sort(
//       (a, b) =>
//         new Date(a.timestamp) -
//         new Date(b.timestamp),
//     );
// }

// /* =========================================================
//    FUNDAMENTALS
// ========================================================= */

// async function fundamentalsRequest(
//   isin,
//   endpoint,
//   params = {},
// ) {
//   const response =
//     await axios.get(
//       `${V2}/fundamentals/` +
//         `${encodeURIComponent(
//           isin,
//         )}/` +
//         `${endpoint}`,
//       {
//         params,

//         headers: headers(),

//         timeout: 15000,
//       },
//     );

//   return response.data?.data;
// }

// function ratioMap(rows) {
//   const result = {};

//   for (const row of rows || []) {
//     const key =
//       String(row.name || "")
//         .toLowerCase()
//         .replace(
//           /[^a-z0-9]/g,
//           "",
//         );

//     result[key] =
//       row.company_value;

//     result[
//       `${key}Sector`
//     ] = row.sector_value;
//   }

//   return result;
// }

// function latestCategory(
//   data,
//   category,
// ) {
//   return (
//     data?.income_statement?.find(
//       (item) =>
//         item.category ===
//         category,
//     )?.history?.[0] ||
//     null
//   );
// }

// function latestParticular(
//   data,
//   regex,
// ) {
//   return (
//     data?.full_statement?.find(
//       (item) =>
//         regex.test(
//           String(
//             item.particular ||
//               "",
//           ),
//         ),
//     )?.history?.[0] ||
//     null
//   );
// }

// function normalizeShareholding(
//   rows,
// ) {
//   const labels = {
//     promoters: "Promoters",
//     fii: "FII",
//     other_dii: "DII",
//     mutual_funds:
//       "Mutual Funds",
//     retail_and_other:
//       "Retail & Other",
//   };

//   return (rows || []).map(
//     (row) => ({
//       category:
//         row.category,

//       label:
//         labels[
//           row.category
//         ] ||
//         row.category,

//       history: (
//         row.history || []
//       ).map((history) => ({
//         period:
//           history.period,

//         percentage:
//           n(
//             history.value,
//             0,
//           ),
//       })),
//     }),
//   );
// }

// function mutualFundAggregate(
//   shareholding,
// ) {
//   const row =
//     shareholding.find(
//       (item) =>
//         item.category ===
//         "mutual_funds",
//     );

//   if (!row) {
//     return [];
//   }

//   return [
//     {
//       name: "Mutual Funds",

//       type: "aggregate",

//       percentage:
//         row.history?.[0]
//           ?.percentage ?? 0,

//       period:
//         row.history?.[0]
//           ?.period ?? null,

//       history:
//         row.history || [],
//     },
//   ];
// }

// async function getFundamentals(
//   isin,
//   force = false,
// ) {
//   const cached =
//     fundamentalsCache.get(
//       isin,
//     );

//   if (
//     !force &&
//     cached &&
//     cached.expiresAt >
//       Date.now()
//   ) {
//     return cached.value;
//   }

//   const results =
//     await Promise.allSettled([
//       fundamentalsRequest(
//         isin,
//         "profile",
//       ),

//       fundamentalsRequest(
//         isin,
//         "key-ratios",
//       ),

//       fundamentalsRequest(
//         isin,
//         "income-statement",
//         {
//           type:
//             "consolidated",

//           time_period:
//             "yearly",

//           fs: true,
//         },
//       ),

//       fundamentalsRequest(
//         isin,
//         "balance-sheet",
//         {
//           type:
//             "consolidated",

//           fs: true,
//         },
//       ),

//       fundamentalsRequest(
//         isin,
//         "cash-flow",
//         {
//           type:
//             "consolidated",

//           fs: true,
//         },
//       ),

//       fundamentalsRequest(
//         isin,
//         "share-holdings",
//       ),

//       fundamentalsRequest(
//         isin,
//         "corporate-actions",
//       ),

//       fundamentalsRequest(
//         isin,
//         "competitors",
//       ),
//     ]);

//   const get =
//     (index) =>
//       results[index]
//         .status ===
//       "fulfilled"
//         ? results[index].value
//         : null;

//   const profile = get(0);

//   const ratioRows =
//     get(1) || [];

//   const income =
//     get(2);

//   const balanceSheet =
//     get(3);

//   const cashFlow =
//     get(4);

//   const shareholding =
//     normalizeShareholding(
//       get(5),
//     );

//   const corporateActions =
//     get(6) || [];

//   const competitors =
//     get(7) || [];

//   const ratios =
//     ratioMap(
//       ratioRows,
//     );

//   const revenue =
//     latestCategory(
//       income,
//       "revenue",
//     );

//   const operatingProfit =
//     latestCategory(
//       income,
//       "operating_profit",
//     );

//   const netProfit =
//     latestCategory(
//       income,
//       "net_profit",
//     );

//   const eps =
//     latestParticular(
//       income,
//       /^EPS\s*-\s*Basic$/i,
//     );

//   const fundamentals = {
//     marketCap: null,

//     sector:
//       profile?.sector ||
//       null,

//     sectorMarketCap:
//       profile
//         ?.sector_market_cap_inr
//         ?.formatted ||
//       null,

//     peRatio:
//       ratios.pe ??
//       null,

//     pbRatio:
//       ratios.pb ??
//       null,

//     roe:
//       ratios.roe ??
//       null,

//     roa:
//       ratios.roa ??
//       null,

//     roce:
//       ratios.roce ??
//       null,

//     evEbitda:
//       ratios.evebitda ??
//       null,

//     eps:
//       eps?.value ??
//       null,

//     revenue:
//       revenue?.value ??
//       null,

//     revenuePeriod:
//       revenue?.period ??
//       null,

//     operatingProfit:
//       operatingProfit?.value ??
//       null,

//     operatingProfitPeriod:
//       operatingProfit?.period ??
//       null,

//     netProfit:
//       netProfit?.value ??
//       null,

//     netProfitPeriod:
//       netProfit?.period ??
//       null,
//   };

//   const value = {
//     fundamentals,

//     profile,

//     ratios:
//       ratioRows,

//     incomeStatement:
//       income,

//     balanceSheet,

//     cashFlow,

//     shareholding,

//     mutualFunds:
//       mutualFundAggregate(
//         shareholding,
//       ),

//     corporateActions,

//     competitors,

//     updatedAt:
//       Date.now(),
//   };

//   fundamentalsCache.set(
//     isin,
//     {
//       value,

//       expiresAt:
//         Date.now() +
//         FUNDAMENTALS_TTL,
//     },
//   );

//   return value;
// }

// /* =========================================================
//    FUNDAMENTAL HELPERS
// ========================================================= */

// async function getCorporateActions(
//   isin,
// ) {
//   return (
//     (await fundamentalsRequest(
//       isin,
//       "corporate-actions",
//     )) || []
//   );
// }

// async function getCompetitors(
//   isin,
// ) {
//   return (
//     (await fundamentalsRequest(
//       isin,
//       "competitors",
//     )) || []
//   );
// }

// async function getBalanceSheet(
//   isin,
//   type = "consolidated",
// ) {
//   return fundamentalsRequest(
//     isin,
//     "balance-sheet",
//     {
//       type,
//       fs: true,
//     },
//   );
// }

// async function getProfile(
//   isin,
// ) {
//   return fundamentalsRequest(
//     isin,
//     "profile",
//   );
// }

// /* =========================================================
//    STATE
// ========================================================= */

// function setTickHandler(
//   handler,
// ) {
//   onTick = handler;
// }

// function getSubscribed() {
//   return [
//     ...subscribed,
//   ];
// }

// function isConnected() {
//   return connected;
// }

// function isConnecting() {
//   return connecting;
// }

// /* =========================================================
//    SHUTDOWN
// ========================================================= */

// async function shutdown() {
//   subscribed.clear();

//   disconnect();

//   streamer = null;

//   connected = false;

//   connecting = false;
// }

// /* =========================================================
//    EXPORT
// ========================================================= */

// module.exports = {
//   subscribe,
//   unsubscribe,

//   fetchOhlc,
//   fetchQuotes,
//   fetchHistory,

//   getFundamentals,
//   getCorporateActions,
//   getCompetitors,
//   getBalanceSheet,
//   getProfile,

//   setTickHandler,

//   getSubscribed,
//   isConnected,
//   isConnecting,

//   shutdown,
// };





















































const axios = require("axios");
const Upstox = require("upstox-js-sdk");
const env = require("./env");
const logger = require("./logger");

const V2 = "https://api.upstox.com/v2";
const V3 = "https://api.upstox.com/v3";

if (!env.upstoxAccessToken) {
  logger.warn("UPSTOX_ACCESS_TOKEN is empty");
}

const defaultClient = Upstox.ApiClient.instance;
defaultClient.authentications["OAUTH2"].accessToken = env.upstoxAccessToken;

let streamer = null;
let connected = false;
let onTick = null;

const subscribed = new Set();
const pendingUnsubscribe = new Map();

const fundamentalsCache = new Map();
const FUNDAMENTALS_TTL = 15 * 60 * 1000;

function safeJson(data) {
  if (data == null) return null;
  if (typeof data === "object" && !Buffer.isBuffer(data)) return data;
  try {
    return JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data));
  } catch {
    return null;
  }
}

function n(value, fallback = null) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function headers() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.upstoxAccessToken}`,
  };
}

function normalizeFeed(instrumentKey, feed) {
  if (!feed) return null;

  const root =
    feed?.fullFeed?.marketFF ||
    feed?.fullFeed?.indexFF ||
    feed?.marketFF ||
    feed?.indexFF ||
    feed?.ff ||
    feed;

  const ltpc = root?.ltpc || feed?.ltpc || {};
  const ext = root?.eFeedDetails || root?.extendedFeedDetails || {};

  const day =
    (root?.marketOHLC?.ohlc || feed?.marketOHLC?.ohlc || []).find(
      (x) => x.interval === "1d"
    ) || {};

  const ltp = n(ltpc.ltp ?? root?.ltp ?? feed?.ltp);
  const previousClose = n(
    ltpc.cp ?? ext.cp ?? ext.lastClose ?? root?.lastClose
  );

  const open = n(day.open ?? root?.open);
  const high = n(day.high ?? root?.high);
  const low = n(day.low ?? root?.low);
  const volume = n(
    day.vol ?? day.volume ?? ext.vtt ?? ext.tv ?? root?.volume
  );

  const upperCircuit = n(ext.uc ?? ext.upperCircuit ?? root?.upperCircuit);
  const lowerCircuit = n(ext.lc ?? ext.lowerCircuit ?? root?.lowerCircuit);
  const yearHigh = n(ext.yh ?? ext.yearHigh ?? root?.yearHigh);
  const yearLow = n(ext.yl ?? ext.yearLow ?? root?.yearLow);

  const lastTradeTime = n(ltpc.ltt);
  const ltq = n(ltpc.ltq);

  if (ltp === null && previousClose === null) return null;

  const change =
    ltp !== null && previousClose !== null ? ltp - previousClose : null;

  const changePercent =
    previousClose ? (change / previousClose) * 100 : null;

  return {
    instrumentKey,
    ltp,
    price: ltp,
    previousClose,
    change,
    changePercent,
    open,
    high,
    low,
    volume,
    totalVolume: volume,
    upperCircuit,
    lowerCircuit,
    upperCircuitLimit: upperCircuit,
    lowerCircuitLimit: lowerCircuit,
    yearHigh,
    yearLow,
    week52High: yearHigh,
    week52Low: yearLow,
    lastTradedQuantity: ltq,
    lastTradeTime,
    timestamp: Date.now(),
    source: "upstox-websocket",
  };
}

function findFeed(payload, key) {
  return (
    payload?.feeds?.[key] ||
    payload?.feeds?.[key?.replace("|", ":")] ||
    payload?.data?.feeds?.[key] ||
    null
  );
}

function ensureStreamer() {
  if (streamer) return streamer;

  streamer = new Upstox.MarketDataStreamerV3();
  streamer.autoReconnect(true, 10, 1000000);

  streamer.on("open", () => {
    connected = true;
    logger.info("Upstox MarketDataStreamerV3 connected", {
      subscriptions: subscribed.size,
    });

    if (subscribed.size) {
      streamer.subscribe([...subscribed], env.upstoxStreamMode);
    }
  });

  streamer.on("close", () => {
    connected = false;
    logger.warn("Upstox market websocket closed");
  });

  streamer.on("reconnecting", () => {
    logger.info("Upstox market websocket reconnecting");
  });

  streamer.on("error", (err) => {
    logger.error("Upstox market websocket error", {
      error: err?.message || String(err),
    });
  });

  streamer.on("message", (raw) => {
    const payload = safeJson(raw);
    if (!payload) return;

    // Do not loop over all subscriptions for every tick.
    // The feed contains the changed instrument key(s), so dispatch only those.
    const feeds = payload?.feeds || payload?.data?.feeds || {};
    for (const [key, feed] of Object.entries(feeds)) {
      const instrumentKey =
        subscribed.has(key)
          ? key
          : [...subscribed].find(
              (x) => x.replace("|", ":") === key || x === key
            );

      if (!instrumentKey) continue;

      const tick = normalizeFeed(instrumentKey, feed);
      if (tick && onTick) onTick(tick);
    }
  });

  streamer.connect();
  return streamer;
}

async function subscribe(key) {
  if (!key) return;
  if (subscribed.has(key)) {
    const timer = pendingUnsubscribe.get(key);
    if (timer) {
      clearTimeout(timer);
      pendingUnsubscribe.delete(key);
    }
    return { alreadySubscribed: true };
  }

  if (subscribed.size >= env.upstoxMaxUniqueSubscriptions) {
    throw new Error(
      `Live subscription capacity reached (${env.upstoxMaxUniqueSubscriptions}).`
    );
  }

  const s = ensureStreamer();
  subscribed.add(key);

  const timer = pendingUnsubscribe.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingUnsubscribe.delete(key);
  }

  if (connected) {
    s.subscribe([key], env.upstoxStreamMode);
  }

  return { alreadySubscribed: false };
}

async function unsubscribe(key, immediate = false) {
  if (!subscribed.has(key)) return;

  const previous = pendingUnsubscribe.get(key);
  if (previous) clearTimeout(previous);

  const run = () => {
    pendingUnsubscribe.delete(key);
    if (!subscribed.has(key)) return;

    subscribed.delete(key);
    if (streamer && connected) {
      try {
        streamer.unsubscribe([key]);
      } catch (err) {
        logger.warn("Upstox unsubscribe failed", {
          key,
          error: err?.message || String(err),
        });
      }
    }
  };

  if (immediate || env.unsubscribeGraceMs <= 0) run();
  else {
    const timer = setTimeout(run, env.unsubscribeGraceMs);
    pendingUnsubscribe.set(key, timer);
  }
}

function extractQuoteObject(data, key) {
  if (!data) return null;
  return (
    data[key] ||
    data[key.replace("|", ":")] ||
    Object.values(data).find(
      (x) => x?.instrument_token === key || x?.instrument_key === key
    ) ||
    null
  );
}

function normalizeQuote(instrumentKey, q) {
  const ohlc = q?.ohlc || {};
  const price = n(q?.last_price);

  const netChange = n(q?.net_change);
  let previousClose = null;

  if (price !== null && netChange !== null) {
    previousClose = price - netChange;
  } else {
    previousClose = n(q?.cp ?? q?.prev_close ?? q?.previous_close);
  }

  const change =
    price !== null && previousClose !== null
      ? price - previousClose
      : null;

  return {
    instrumentKey,
    ltp: price,
    price,
    previousClose,
    change,
    changePercent: previousClose ? (change / previousClose) * 100 : null,
    open: n(ohlc.open),
    high: n(ohlc.high),
    low: n(ohlc.low),
    volume: n(q?.volume),
    totalVolume: n(q?.volume),
    upperCircuit: n(q?.upper_circuit_limit),
    lowerCircuit: n(q?.lower_circuit_limit),
    upperCircuitLimit: n(q?.upper_circuit_limit),
    lowerCircuitLimit: n(q?.lower_circuit_limit),
    lastTradeTime: n(q?.last_trade_time),
    timestamp: n(q?.timestamp, Date.now()),
    source: "upstox-rest",
  };
}

async function fetchOhlc(instrumentKey) {
  // Use the Full Market Quote endpoint for the authoritative snapshot.
  // It provides today's OHLC/volume and net_change, so the previous close is
  // reconstructed as: last_price - net_change. This avoids treating an OHLC
  // field representing the current/latest candle as yesterday's close.
  const response = await axios.get(`${V2}/market-quote/quotes`, {
    params: { instrument_key: instrumentKey },
    headers: headers(),
    timeout: 10000,
  });

  const q = extractQuoteObject(response.data?.data, instrumentKey);
  if (!q) throw new Error("No market quote returned by Upstox");

  return normalizeQuote(instrumentKey, q);
}

async function fetchQuotes(instrumentKeys) {
  const keys = [...new Set((instrumentKeys || []).filter(Boolean))];
  if (!keys.length) return {};

  const out = {};
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const response = await axios.get(`${V2}/market-quote/quotes`, {
      params: { instrument_key: chunk.join(",") },
      headers: headers(),
      timeout: 20000,
    });
    Object.assign(out, response.data?.data || {});
  }
  return out;
}

async function fetchHistory(instrumentKey, unit, interval, to, from) {
  let response;

  if (unit === "minutes" || unit === "hours" || unit === "days") {
    // During the current trading day, use the V3 intraday endpoint for 1D.
    if (!from && unit === "minutes") {
      response = await axios.get(
        `${V3}/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/${unit}/${interval}`,
        { headers: headers(), timeout: 15000 }
      );
    } else {
      const path =
        `${V3}/historical-candle/${encodeURIComponent(instrumentKey)}` +
        `/${unit}/${interval}/${to}${from ? `/${from}` : ""}`;
      response = await axios.get(path, {
        headers: headers(),
        timeout: 15000,
      });
    }
  } else {
    const path =
      `${V3}/historical-candle/${encodeURIComponent(instrumentKey)}` +
      `/${unit}/${interval}/${to}${from ? `/${from}` : ""}`;
    response = await axios.get(path, {
      headers: headers(),
      timeout: 15000,
    });
  }

  return (response.data?.data?.candles || [])
    .map((c) => ({
      timestamp: c[0],
      open: n(c[1], 0),
      high: n(c[2], 0),
      low: n(c[3], 0),
      close: n(c[4], 0),
      volume: n(c[5], 0),
      openInterest: n(c[6], 0),
    }))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function fundamentalsRequest(isin, endpoint, params = {}) {
  const response = await axios.get(
    `${V2}/fundamentals/${encodeURIComponent(isin)}/${endpoint}`,
    { params, headers: headers(), timeout: 15000 }
  );
  return response.data?.data;
}

function ratioMap(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = String(row.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    out[key] = row.company_value;
    out[`${key}Sector`] = row.sector_value;
  }
  return out;
}

function latestCategory(data, category) {
  return data?.income_statement?.find((x) => x.category === category)?.history?.[0] || null;
}

function latestParticular(data, regex) {
  return data?.full_statement?.find((x) => regex.test(String(x.particular || "")))?.history?.[0] || null;
}

function normalizeShareholding(rows) {
  const labels = {
    promoters: "Promoters",
    fii: "FII",
    other_dii: "DII",
    public: "Public",
    mutual_funds: "Mutual Funds",
    retail_and_other: "Retail & Other",
  };

  return (rows || []).map((row) => ({
    category: row.category,
    label: labels[row.category] || row.category,
    history: (row.history || []).map((h) => ({
      period: h.period,
      percentage: n(h.value, 0),
    })),
  }));
}

async function getFundamentals(isin, force = false) {
  const cached = fundamentalsCache.get(isin);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;

  const results = await Promise.allSettled([
    fundamentalsRequest(isin, "profile"),
    fundamentalsRequest(isin, "key-ratios"),
    fundamentalsRequest(isin, "income-statement", {
      type: "consolidated",
      time_period: "quarterly",
      fs: true,
    }),
    fundamentalsRequest(isin, "balance-sheet", {
      type: "consolidated",
      fs: true,
    }),
    fundamentalsRequest(isin, "cash-flow", {
      type: "consolidated",
      fs: true,
    }),
    fundamentalsRequest(isin, "share-holdings"),
    fundamentalsRequest(isin, "corporate-actions"),
    fundamentalsRequest(isin, "competitors"),
  ]);

  const get = (i) => (results[i].status === "fulfilled" ? results[i].value : null);

  const profile = get(0);
  const ratioRows = get(1) || [];
  const income = get(2);
  const balanceSheet = get(3);
  const cashFlow = get(4);
  const shareholding = normalizeShareholding(get(5));
  const corporateActions = get(6) || [];
  const competitors = get(7) || [];

  const ratios = ratioMap(ratioRows);
  const rev = latestCategory(income, "revenue");
  const op = latestCategory(income, "operating_profit");
  const np = latestCategory(income, "net_profit");
  const eps = latestParticular(income, /^EPS\s*-\s*Basic$/i);

  const fundamentals = {
    marketCap: null,
    sector: profile?.sector || null,
    sectorMarketCap: profile?.sector_market_cap_inr?.formatted || null,
    peRatio: ratios.pe ?? null,
    pbRatio: ratios.pb ?? null,
    roe: ratios.roe ?? null,
    roa: ratios.roa ?? null,
    roce: ratios.roce ?? null,
    evEbitda: ratios.evebitda ?? null,
    eps: eps?.value ?? null,
    revenue: rev?.value ?? null,
    revenuePeriod: rev?.period ?? null,
    operatingProfit: op?.value ?? null,
    operatingProfitPeriod: op?.period ?? null,
    netProfit: np?.value ?? null,
    netProfitPeriod: np?.period ?? null,
  };

  const value = {
    fundamentals,
    profile,
    ratios: ratioRows,
    incomeStatement: income,
    balanceSheet,
    cashFlow,
    shareholding,
    mutualFunds: [],
    corporateActions,
    competitors,
    updatedAt: Date.now(),
  };

  fundamentalsCache.set(isin, {
    value,
    expiresAt: Date.now() + FUNDAMENTALS_TTL,
  });

  return value;
}

async function getCorporateActions(isin) {
  return fundamentalsRequest(isin, "corporate-actions") || [];
}

async function getCompetitors(isin) {
  return fundamentalsRequest(isin, "competitors") || [];
}

async function getBalanceSheet(isin, type = "consolidated") {
  return fundamentalsRequest(isin, "balance-sheet", { type, fs: true });
}

async function getProfile(isin) {
  return fundamentalsRequest(isin, "profile");
}

async function getFunds() {
  const response = await axios.get(`${V3}/user/get-funds-and-margin`, {
    headers: { ...headers(), "Api-Version": "3.0" },
    timeout: 10000,
  });
  return response.data?.data || response.data;
}

async function placeOrder(order) {
  const payload = {
    quantity: Number(order.quantity),
    product: order.product || "D",
    validity: order.validity || "DAY",
    price: Number(order.price || 0),
    tag: order.tag || undefined,
    instrument_token: order.instrumentKey,
    order_type: order.orderType || "LIMIT",
    transaction_type: order.transactionType,
    disclosed_quantity: Number(order.disclosedQuantity || 0),
    trigger_price: Number(order.triggerPrice || 0),
    is_amo: Boolean(order.isAmo),
    slice: order.slice !== false,
    market_protection: Number(order.marketProtection || 0),
  };

  const response = await axios.post(
    "https://api-hft.upstox.com/v3/order/place",
    payload,
    { headers: headers(), timeout: 15000 }
  );

  return response.data;
}

function setTickHandler(fn) {
  onTick = fn;
}

function getSubscribed() {
  return [...subscribed];
}

function isConnected() {
  return connected;
}

module.exports = {
  subscribe,
  unsubscribe,
  fetchOhlc,
  fetchQuotes,
  fetchHistory,
  getFundamentals,
  getCorporateActions,
  getCompetitors,
  getBalanceSheet,
  getProfile,
  getFunds,
  placeOrder,
  setTickHandler,
  getSubscribed,
  isConnected,
};
