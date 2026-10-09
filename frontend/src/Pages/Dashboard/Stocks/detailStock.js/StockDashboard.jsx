// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";

// import { useLocation, useParams } from "react-router-dom";

// import axios from "axios";

// import detailStockSocket from "./detailStockWebSocketConnection";

// import {
//   ENDPOINTS,
//   CHART_WIDTH,
//   CHART_HEIGHT,
//   CHART_PADDING_X,
//   CHART_PADDING_Y,
//   LIVE_TICK_THROTTLE_MS,
// } from "./config/stockConfig";

// import {
//   numberValue,
//   nullableNumber,
//   firstDefined,
//   getFinancialNumber,
// } from "./utils/formatters";

// import {
//   getIndiaDate,
//   getHistoryParams,
//   parseHistoryTimestamp,
//   indiaDateFromTimestamp,
//   isISTTradingTimestamp,
//   getMarketTimestamp,
//   getISTMarketProgress,
// } from "./utils/dateHelpers";

// import {
//   unwrapResponse,
//   normalizeStock,
//   normalizeFundamentals,
//   normalizeShareholding,
//   normalizeMutualFunds,
//   normalizeFinancialRows,
//   normalizeHistory,
//   normalizeMarketStatus,
//   normalizeAbout,
// } from "./utils/normalizers";

// /* UI Components */

// import { StockHeader } from "./components/stock/StockHeader";

// import { StockChart } from "./components/stock/StockChart";

// import { PerformanceSection } from "./components/stock/PerformanceSection";

// import { FundamentalsSection } from "./components/stock/FundamentalsSection";

// import { ShareholdingSection } from "./components/stock/ShareholdingSection";

// import { FinancialsSection } from "./components/stock/FinancialsSection";

// import { AboutSection } from "./components/stock/AboutSection";

// import { MutualFundsSection } from "./components/stock/MutualFundsSection";

// import { TradingPanel } from "./components/stock/TradingPanel";

// export default function StockDashboard({
//   instrumentKey: propInstrumentKey,

//   isin: propIsin,
// }) {
//   const { symbol: routeSymbol } = useParams();

//   const location = useLocation();

//   const initialStock = location.state || null;

//   const symbol =
//     routeSymbol || initialStock?.symbol || initialStock?.tradingSymbol || "";

//   // TEST MODE: allow simulated BUY/SELL even when the real market is closed.

//   // This changes only the simulator availability; market-data UI still uses real marketOpen.

//   const simulationMarketOpen = true;

//   /* STATE */

//   const [stockInfo, setStockInfo] = useState(initialStock);

//   const [snapshot, setSnapshot] = useState(null);

//   const [marketOpen, setMarketOpen] = useState(null);

//   // Official same-day EOD history becomes authoritative only after settlement.
//   const [officialSettlementReady, setOfficialSettlementReady] = useState(false);

//   const [marketLoading, setMarketLoading] = useState(true);

//   const [marketError, setMarketError] = useState("");

//   const [stockLoading, setStockLoading] = useState(true);

//   const [stockError, setStockError] = useState("");

//   const [history, setHistory] = useState([]);

//   const [chartRange, setChartRange] = useState("1D");

//   // Backend supplies the real prior-trading-day close for the selected range.

//   const [rangeBaseline, setRangeBaseline] = useState(null);

//   const chartSessionDateRef = useRef(getIndiaDate());

//   const lastLiveTickRef = useRef(0);

//   const pendingLiveTickRef = useRef(null);

//   const liveTickFlushTimerRef = useRef(null);

//   const wsGenerationRef = useRef(0);

//   // Prevent stale history responses from overwriting newer chart state.
//   const historyRequestGenerationRef = useRef(0);

//   // Tracks whether the socket has already connected once for this stock.
//   const socketHasConnectedRef = useRef(false);

//   const [week52Data, setWeek52Data] = useState(null);

//   /* 1D LIVE CHART STATE */

//   const chartRangeRef = useRef(chartRange);

//   const marketOpenRef = useRef(marketOpen);

//   const officialSettlementReadyRef = useRef(false);
//   const marketStatusKnownRef = useRef(false);

//   const liveDayHistoryRef = useRef([]);

//   // Official 1D REST candles are the authoritative history.
//   // Live ticks are kept separately and only overlay the in-progress minute
//   // (or temporarily fill a minute that REST has not published yet).
//   const historicalDayHistoryRef = useRef([]);
//   const provisionalLiveMinutesRef = useRef(new Map());
//   // Date of the trading session whose live ticks are currently driving 1D.
//   // This prevents yesterday's finalized candles from being mixed with the
//   // first live tick of the next trading session.
//   const liveSessionDateRef = useRef("");
//   const hasLiveTickRef = useRef(false);

//   const finalHistoryLoadedRef = useRef(false);

//   const [historyLoading, setHistoryLoading] = useState(false);

//   const [fundamentalData, setFundamentalData] = useState(null);

//   const [shareholdingData, setShareholdingData] = useState([]);

//   const [mutualFundData, setMutualFundData] = useState([]);

//   const [financialData, setFinancialData] = useState(null);

//   const [profileData, setProfileData] = useState(null);

//   const [fundamentalsLoading, setFundamentalsLoading] = useState(true);

//   const [fundamentalsError, setFundamentalsError] = useState("");

//   const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] =
//     useState("");

//   const [hoverData, setHoverData] = useState(null);

//   const [isAboutExpanded, setIsAboutExpanded] = useState(false);

//   const [orderType, setOrderType] = useState("BUY");

//   const [quantity, setQuantity] = useState("1");

//   const [priceLimit, setPriceLimit] = useState("");

//   const [isWatchlisted, setIsWatchlisted] = useState(false);

//   const [orderSubmitting, setOrderSubmitting] = useState(false);

//   const [orderMessage, setOrderMessage] = useState("");

//   const orderIdempotencyKeyRef = useRef(null);

//   const orderFingerprintRef = useRef("");

//   useEffect(() => {
//     chartRangeRef.current = chartRange;
//   }, [chartRange]);

//   /* SYNC SEARCH-BAR STOCK SELECTION */

//   // React Router may reuse this component when the search bar selects

//   // another stock. Sync the new location state and clear old-stock data.

//   useEffect(() => {
//     setStockInfo(initialStock || null);

//     setSnapshot(null);

//     setHistory([]);

//     setRangeBaseline(null);

//     setHoverData(null);

//     setMarketError("");

//     setStockError("");

//     setFundamentalData(null);

//     setShareholdingData([]);

//     setMutualFundData([]);

//     setFinancialData(null);

//     setProfileData(null);

//     setIsWatchlisted(false);

//     chartSessionDateRef.current = getIndiaDate();

//     lastLiveTickRef.current = 0;
//     pendingLiveTickRef.current = null;

//     liveDayHistoryRef.current = [];
//     historicalDayHistoryRef.current = [];
//     provisionalLiveMinutesRef.current = new Map();
//     liveSessionDateRef.current = "";
//     hasLiveTickRef.current = false;
//     finalHistoryLoadedRef.current = false;

//     // Every newly selected stock must open on a fresh 1D chart.
//     setChartRange("1D");

//     socketHasConnectedRef.current = false;
//     historyRequestGenerationRef.current += 1;

//     marketStatusKnownRef.current = false;

//     officialSettlementReadyRef.current = false;
//     setOfficialSettlementReady(false);

//     marketOpenRef.current = false;

//     // Market state is unknown until the new stock's status request completes.

//     setMarketOpen(null);

//     if (liveTickFlushTimerRef.current) {
//       window.clearInterval(liveTickFlushTimerRef.current);

//       liveTickFlushTimerRef.current = null;
//     }
//   }, [location.key, symbol]);

//   /* LOAD STOCK IDENTIFIER */

//   useEffect(() => {
//     const controller = new AbortController();

//     async function loadStock() {
//       if (!symbol) {
//         setStockLoading(false);

//         setStockError("Stock symbol is missing from the URL.");

//         return;
//       }

//       setStockLoading(true);

//       setStockError("");

//       try {
//         const response = await axios.get(ENDPOINTS.stock(symbol), {
//           timeout: 15000,

//           signal: controller.signal,
//         });

//         const stock = normalizeStock(response.data, symbol);

//         setStockInfo((previous) => ({ ...(previous || {}), ...stock }));
//       } catch (error) {
//         if (axios.isCancel(error) || error?.code === "ERR_CANCELED") return;

//         setStockError(
//           error?.response?.data?.message ||
//             error?.message ||
//             "Failed to load stock details.",
//         );
//       } finally {
//         if (!controller.signal.aborted) setStockLoading(false);
//       }
//     }

//     loadStock();

//     return () => controller.abort();
//   }, [symbol]);

//   const instrumentKey =
//     propInstrumentKey ||
//     initialStock?.instrumentKey ||
//     initialStock?.instrument_key ||
//     stockInfo?.instrumentKey ||
//     stockInfo?.instrument_key ||
//     "";

//   const isin =
//     propIsin ||
//     stockInfo?.isin ||
//     stockInfo?.ISIN ||
//     initialStock?.isin ||
//     initialStock?.ISIN ||
//     snapshot?.isin ||
//     "";

//   useEffect(() => {
//     if (!instrumentKey) return;

//     let cancelled = false;

//     const fetch52WeekData = async () => {
//       try {
//         const response = await axios.get(
//           `/api/detail-stock/52-week/${encodeURIComponent(instrumentKey)}`,
//         );

//         if (!cancelled && response.data?.success) {
//           setWeek52Data(response.data.data);
//         }
//       } catch (error) {
//         console.error("Failed to fetch 52-week high/low:", error);
//       }
//     };

//     fetch52WeekData();

//     return () => {
//       cancelled = true;
//     };
//   }, [instrumentKey]);

//   const [watchlistLoading, setWatchlistLoading] = useState(false);

//   useEffect(() => {
//     if (!instrumentKey) {
//       setIsWatchlisted(false);

//       return;
//     }

//     let cancelled = false;

//     const loadWatchlistStatus = async () => {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         if (!cancelled) {
//           setIsWatchlisted(false);
//         }

//         return;
//       }

//       try {
//         const response = await axios.get("/api/watchlist", {
//           timeout: 10000,

//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         });

//         // Watchlist service returns:

//         // { success: true, count, stocks: [...] }

//         const stocks =
//           response.data?.stocks ||
//           response.data?.watchlist ||
//           response.data?.data ||
//           [];

//         const currentKey = String(instrumentKey).trim();

//         const exists =
//           Array.isArray(stocks) &&
//           stocks.some((stock) => {
//             const stockKey = String(
//               stock?.instrument_key ||
//                 stock?.instrumentKey ||
//                 stock?.instrument ||
//                 "",
//             ).trim();

//             return stockKey === currentKey;
//           });

//         if (!cancelled) {
//           setIsWatchlisted(exists);
//         }
//       } catch (error) {
//         if (!cancelled) {
//           console.error(
//             "Failed to load watchlist status:",

//             error?.response?.data || error,
//           );

//           setIsWatchlisted(false);
//         }
//       }
//     };

//     loadWatchlistStatus();

//     return () => {
//       cancelled = true;
//     };
//   }, [instrumentKey]);

//   const handleToggleWatchlist = async () => {
//     if (!instrumentKey) {
//       console.error("Instrument key is missing");

//       return;
//     }

//     const token = localStorage.getItem("token");

//     if (!token) {
//       console.error("User is not authenticated");

//       alert("Please login first.");

//       return;
//     }

//     if (watchlistLoading) return;

//     setWatchlistLoading(true);

//     try {
//       if (isWatchlisted) {
//         // REMOVE

//         await axios.delete(
//           `/api/watchlist/${encodeURIComponent(instrumentKey)}`,

//           {
//             timeout: 10000,

//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           },
//         );

//         setIsWatchlisted(false);

//         console.log("Removed from watchlist:", instrumentKey);
//       } else {
//         // ADD

//         await axios.post(
//           "/api/watchlist",

//           {
//             instrumentKey,
//           },

//           {
//             timeout: 10000,

//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           },
//         );

//         setIsWatchlisted(true);

//         console.log("Added to watchlist:", instrumentKey);
//       }
//     } catch (error) {
//       console.error("Watchlist toggle failed:", error?.response?.data || error);
//     } finally {
//       setWatchlistLoading(false);
//     }
//   };

//   // Financials can use either an ISIN or the trading symbol.

//   // The backend resolves SYMBOL -> ISIN from instruments_master.

//   const financialIdentifier = String(isin || symbol || "")
//     .trim()

//     .toUpperCase();

//   /* LOAD MARKET STATUS & SNAPSHOT */

//   const loadMarketData = useCallback(async (key, signal) => {
//     if (!key) {
//       setMarketLoading(false);

//       return;
//     }

//     setMarketLoading(true);

//     setMarketError("");

//     try {
//       const [statusResult, snapshotResult] = await Promise.allSettled([
//         axios.get(ENDPOINTS.marketStatus(), { timeout: 8000, signal }),

//         axios.get(ENDPOINTS.snapshot(key), { timeout: 10000, signal }),
//       ]);

//       if (signal.aborted) return;

//       let isOpen = null;

//       let initialSnapshot = null;

//       if (statusResult.status === "fulfilled") {
//         const statusPayload = unwrapResponse(statusResult.value.data) || {};
//         isOpen = normalizeMarketStatus(statusPayload);

//         const settlementReady = Boolean(statusPayload.officialSettlementReady);
//         officialSettlementReadyRef.current = settlementReady;
//         setOfficialSettlementReady(settlementReady);

//         marketStatusKnownRef.current = true;

//         marketOpenRef.current = Boolean(isOpen);
//       }

//       if (snapshotResult.status === "fulfilled") {
//         initialSnapshot = unwrapResponse(snapshotResult.value.data);

//         if (typeof initialSnapshot?.officialSettlementReady === "boolean") {
//           officialSettlementReadyRef.current =
//             initialSnapshot.officialSettlementReady;
//           setOfficialSettlementReady(initialSnapshot.officialSettlementReady);
//         }

//         if (typeof initialSnapshot?.marketOpen === "boolean") {
//           isOpen = initialSnapshot.marketOpen;

//           marketStatusKnownRef.current = true;

//           marketOpenRef.current = initialSnapshot.marketOpen;
//         }
//       }

//       if (isOpen === null) isOpen = normalizeMarketStatus({});

//       marketStatusKnownRef.current = true;

//       marketOpenRef.current = Boolean(isOpen);

//       setMarketOpen(Boolean(isOpen));

//       if (initialSnapshot) setSnapshot(initialSnapshot);
//     } catch (error) {
//       if (
//         axios.isCancel(error) ||
//         error?.code === "ERR_CANCELED" ||
//         signal.aborted
//       )
//         return;

//       setMarketError(
//         error?.response?.data?.message ||
//           error?.message ||
//           "Unable to load market data.",
//       );

//       marketOpenRef.current = false;
//       marketStatusKnownRef.current = true;
//       officialSettlementReadyRef.current = false;
//       setOfficialSettlementReady(false);
//       setMarketOpen(false);
//     } finally {
//       if (!signal.aborted) setMarketLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     if (!instrumentKey) {
//       setMarketLoading(false);

//       return;
//     }

//     const controller = new AbortController();

//     loadMarketData(instrumentKey, controller.signal);

//     return () => controller.abort();
//   }, [instrumentKey, loadMarketData]);

//   /* LOAD STATIC DATA */

//   useEffect(() => {
//     const controller = new AbortController();

//     let timeoutId = null;

//     async function requestJson(url) {
//       const response = await axios.get(url, {
//         timeout: 15000,

//         signal: controller.signal,
//       });

//       return response.data;
//     }

//     async function loadAllStaticData() {
//       const identifier = financialIdentifier;

//       if (!identifier) {
//         setFundamentalsLoading(false);

//         setFundamentalsError("Stock identifier is missing.");

//         return;
//       }

//       setFundamentalsLoading(true);

//       setFundamentalsError("");

//       try {
//         const results = await Promise.allSettled([
//           isin
//             ? requestJson(ENDPOINTS.fundamentals(isin))
//             : Promise.reject(new Error("ISIN unavailable")),

//           isin
//             ? requestJson(ENDPOINTS.shareholding(isin))
//             : Promise.reject(new Error("ISIN unavailable")),

//           // IMPORTANT: financial endpoint accepts ISIN OR SYMBOL.

//           requestJson(ENDPOINTS.financials(identifier)),

//           isin
//             ? requestJson(ENDPOINTS.mutualFunds(isin))
//             : Promise.reject(new Error("ISIN unavailable")),

//           isin
//             ? requestJson(ENDPOINTS.profile(isin))
//             : Promise.reject(new Error("ISIN unavailable")),
//         ]);

//         if (controller.signal.aborted) return;

//         if (results[0].status === "fulfilled") {
//           const data = normalizeFundamentals(results[0].value);

//           setFundamentalData(data);

//           const combinedShareholding = normalizeShareholding(results[0].value);

//           const combinedMF = normalizeMutualFunds(results[0].value);

//           if (combinedShareholding.length) {
//             setShareholdingData(combinedShareholding);
//           }

//           if (combinedMF.length) {
//             setMutualFundData(combinedMF);
//           }
//         }

//         if (results[1].status === "fulfilled") {
//           const data = normalizeShareholding(results[1].value);

//           if (data.length) setShareholdingData(data);
//         }

//         if (results[2].status === "fulfilled") {
//           setFinancialData(unwrapResponse(results[2].value));
//         }

//         if (results[3].status === "fulfilled") {
//           const data = normalizeMutualFunds(results[3].value);

//           if (data.length) setMutualFundData(data);
//         }

//         if (results[4].status === "fulfilled") {
//           const data = unwrapResponse(results[4].value);

//           setProfileData(data?.profile || data);
//         }

//         const financialFailed = results[2].status === "rejected";

//         const fundamentalsFailed = results[0].status === "rejected";

//         if (financialFailed && fundamentalsFailed) {
//           setFundamentalsError(
//             results[2].reason?.response?.data?.message ||
//               results[2].reason?.message ||
//               results[0].reason?.response?.data?.message ||
//               results[0].reason?.message ||
//               "Unable to load company financial data.",
//           );
//         } else if (financialFailed) {
//           console.error(
//             "Financials failed:",

//             results[2].reason?.response?.data ||
//               results[2].reason?.message ||
//               results[2].reason,
//           );
//         }
//       } finally {
//         if (!controller.signal.aborted) {
//           setFundamentalsLoading(false);

//           timeoutId = setTimeout(loadAllStaticData, 15 * 60 * 1000);
//         }
//       }
//     }

//     loadAllStaticData();

//     return () => {
//       controller.abort();

//       if (timeoutId) clearTimeout(timeoutId);
//     };
//   }, [isin, financialIdentifier]);

//   /* LOAD CHART HISTORY */

//   const loadHistory = useCallback(async (key, range, signal, options = {}) => {
//     if (!key || signal?.aborted) return;

//     const { force = false } = options;
//     const requestGeneration = ++historyRequestGenerationRef.current;

//     setHistoryLoading(true);

//     if (range !== "1D" || (force && !marketOpenRef.current)) {
//       setRangeBaseline(null);
//     }

//     const params = getHistoryParams(range);
//     params.to = getIndiaDate();

//     if (force && range === "1D") {
//       params.refresh = true;
//     }

//     const minuteBucket = (timestamp) => {
//       if (!Number.isFinite(timestamp)) return NaN;
//       return Math.floor(timestamp / (60 * 1000)) * (60 * 1000);
//     };

//     const getPointTimestamp = (point) =>
//       parseHistoryTimestamp(
//         Array.isArray(point)
//           ? point[0]
//           : (point?.timestamp ??
//               point?.time ??
//               point?.date ??
//               point?.datetime ??
//               point?.dateTime),
//       );

//     const mergeOfficialWithLive = (officialPoints) => {
//       const official = Array.isArray(officialPoints) ? [...officialPoints] : [];
//       const officialBuckets = new Set();

//       for (const point of official) {
//         const ts = getPointTimestamp(point);
//         const bucket = minuteBucket(ts);
//         if (Number.isFinite(bucket)) officialBuckets.add(bucket);
//       }

//       const provisional = provisionalLiveMinutesRef.current;
//       const merged = [...official];

//       for (const [bucket, livePoint] of provisional.entries()) {
//         if (!Number.isFinite(bucket) || !livePoint) continue;

//         // Once REST has an official candle for a minute, the official candle
//         // wins. The only exception is the current in-progress minute, where
//         // the WebSocket LTP is the freshest value.
//         const currentMinute = minuteBucket(Date.now());
//         const isCurrentMinute = bucket === currentMinute;

//         if (officialBuckets.has(bucket) && !isCurrentMinute) {
//           provisional.delete(bucket);
//           continue;
//         }

//         const existingIndex = merged.findIndex((point) => {
//           const ts = getPointTimestamp(point);
//           return Number.isFinite(ts) && minuteBucket(ts) === bucket;
//         });

//         if (existingIndex >= 0) {
//           merged[existingIndex] = livePoint;
//         } else {
//           merged.push(livePoint);
//         }
//       }

//       merged.sort((a, b) => getPointTimestamp(a) - getPointTimestamp(b));
//       return merged;
//     };

//     try {
//       const response = await axios.get(ENDPOINTS.history(key, params), {
//         timeout: 20000,
//         signal,
//       });

//       if (
//         signal?.aborted ||
//         requestGeneration !== historyRequestGenerationRef.current
//       ) {
//         return;
//       }

//       const payload = unwrapResponse(response.data) || {};
//       const baseline = nullableNumber(
//         payload.baselineClose,
//         payload.baseline,
//         payload.previousClose,
//       );

//       if (Number.isFinite(baseline)) {
//         setRangeBaseline(baseline);
//       } else if (range !== "1D") {
//         setRangeBaseline(null);
//       }

//       const normalized = normalizeHistory(response.data, range);

//       if (range === "1D") {
//         const officialPoints = Array.isArray(normalized) ? normalized : [];
//         const openNow = Boolean(marketOpenRef.current);

//         // Keep official REST candles separate from live overlays. This is the
//         // key accuracy fix: completed minutes are never replaced by arbitrary
//         // WebSocket ticks, so the chart stays aligned with official 1-minute
//         // OHLC history while the current minute remains live.
//         historicalDayHistoryRef.current = officialPoints;

//         if (
//           !openNow &&
//           officialSettlementReadyRef.current &&
//           officialPoints.length
//         ) {
//           const lastPoint = officialPoints[officialPoints.length - 1];
//           const officialClose = Array.isArray(lastPoint)
//             ? nullableNumber(lastPoint[4], lastPoint[1])
//             : nullableNumber(
//                 lastPoint?.close,
//                 lastPoint?.c,
//                 lastPoint?.price,
//                 lastPoint?.ltp,
//               );

//           if (officialClose !== null) {
//             setSnapshot((previous) => ({
//               ...(previous || {}),
//               ltp: officialClose,
//               price: officialClose,
//               dayClose: officialClose,
//               marketOpen: false,
//               marketStatus: "CLOSED",
//               source: "upstox-finalized-intraday",
//               officialSettlementReady: true,
//             }));
//           }
//         }

//         if (openNow) {
//           const merged = mergeOfficialWithLive(officialPoints);
//           liveDayHistoryRef.current = merged;
//           hasLiveTickRef.current = provisionalLiveMinutesRef.current.size > 0;
//           finalHistoryLoadedRef.current = false;
//           setHistory(merged);
//         } else {
//           provisionalLiveMinutesRef.current = new Map();
//           liveDayHistoryRef.current = officialPoints;
//           hasLiveTickRef.current = false;
//           finalHistoryLoadedRef.current = true;
//           setHistory(officialPoints);
//         }

//         return;
//       }

//       setHistory(Array.isArray(normalized) ? normalized : []);
//     } catch (error) {
//       if (
//         axios.isCancel(error) ||
//         error?.code === "ERR_CANCELED" ||
//         signal?.aborted
//       ) {
//         return;
//       }

//       if (requestGeneration !== historyRequestGenerationRef.current) {
//         return;
//       }

//       console.error("History failed:", error);
//     } finally {
//       if (
//         !signal?.aborted &&
//         requestGeneration === historyRequestGenerationRef.current
//       ) {
//         setHistoryLoading(false);
//       }
//     }
//   }, []);

//   /*

//    * Non-1D ranges always use the historical API.

//    * For 1D:

//    * - wait until the real market status is known;

//    * - when OPEN, live WebSocket ticks own the chart;

//    * - when CLOSED, load the official historical 1D data.

//    */

//   /*

//    * LOAD CHART HISTORY

//    *

//    * Important:

//    * - Non-1D ranges always load historical API data.

//    * - 1D waits until market status is known.

//    * - If market is OPEN, 1D is owned exclusively by WebSocket ticks.

//    * - If market is CLOSED, 1D loads the official finalized history.

//    *

//    * `marketOpen` is intentionally included in the dependency list.

//    * Without it, the first 1D render can happen before market status is

//    * known, return early, and never load history until the user changes

//    * the chart range manually.

//    */

//   // useEffect(() => {

//   //   if (!instrumentKey) return;

//   //   // 1D must wait for the market-status request to finish.

//   //   if (chartRange === "1D") {

//   //     if (!marketStatusKnownRef.current) {

//   //       return;

//   //     }

//   //     // During market hours, WebSocket ticks exclusively own 1D.

//   //     if (marketOpen) {

//   //       return;

//   //     }

//   //   }

//   //   const controller = new AbortController();

//   //   loadHistory(instrumentKey, chartRange, controller.signal);

//   //   return () => {

//   //     controller.abort();

//   //   };

//   // }, [instrumentKey, chartRange, marketOpen, loadHistory]);

//   useEffect(() => {
//     if (!instrumentKey) return;

//     if (chartRange === "1D") {
//       if (!marketStatusKnownRef.current) return;

//       // Keep the just-finished live/provisional chart visible from 15:30
//       // through 15:45. Official history takes over only after settlement.
//       if (!marketOpen && !officialSettlementReadyRef.current) return;
//     }

//     const controller = new AbortController();

//     // First 1D load after Search -> Stock bypasses Redis once, preventing a
//     // stale intraday cache from producing the old flat/stale chart.
//     const forceFreshOpen1D =
//       chartRange === "1D" &&
//       Boolean(marketOpen) &&
//       historicalDayHistoryRef.current.length === 0;

//     loadHistory(instrumentKey, chartRange, controller.signal, {
//       force: forceFreshOpen1D,
//     });

//     return () => controller.abort();
//   }, [
//     instrumentKey,
//     chartRange,
//     marketOpen,
//     officialSettlementReady,
//     loadHistory,
//   ]);

//   const wasMarketOpenRef = useRef(marketOpen);

//   useEffect(() => {
//     const wasOpen = wasMarketOpenRef.current;
//     wasMarketOpenRef.current = marketOpen;

//     if (chartRange !== "1D" || !instrumentKey) return;

//     // 15:30 only changes market state. Keep the live/provisional chart.
//     // At 15:45, officialSettlementReady becomes true and the main history
//     // effect replaces it with finalized official candles.
//     if (wasOpen && !marketOpen && officialSettlementReadyRef.current) {
//       const controller = new AbortController();
//       finalHistoryLoadedRef.current = false;
//       loadHistory(instrumentKey, "1D", controller.signal, { force: true });
//       return () => controller.abort();
//     }
//   }, [
//     marketOpen,
//     officialSettlementReady,
//     chartRange,
//     instrumentKey,
//     loadHistory,
//   ]);

//   /*

//    * Poll market status so the 1D chart can hand over to official history at

//    * the close even when no websocket status event is emitted.

//    */

//   useEffect(() => {
//     if (!instrumentKey) return;

//     let alive = true;

//     const pollMarketStatus = async () => {
//       try {
//         const response = await axios.get(ENDPOINTS.marketStatus(), {
//           timeout: 8000,
//         });

//         if (!alive) return;

//         const statusPayload = unwrapResponse(response.data) || {};
//         const isOpen = normalizeMarketStatus(statusPayload);
//         const settlementReady = Boolean(statusPayload.officialSettlementReady);

//         marketStatusKnownRef.current = true;
//         marketOpenRef.current = Boolean(isOpen);

//         if (isOpen) {
//           finalHistoryLoadedRef.current = false;
//           officialSettlementReadyRef.current = false;
//         } else {
//           officialSettlementReadyRef.current = settlementReady;
//         }

//         setOfficialSettlementReady(Boolean(settlementReady));
//         setMarketOpen(Boolean(isOpen));
//       } catch (error) {
//         if (!alive || axios.isCancel(error) || error?.code === "ERR_CANCELED") {
//           return;
//         }

//         // Keep the last known state on a transient status-poll failure.

//         console.warn("Market status poll failed:", error?.message || error);
//       }
//     };

//     pollMarketStatus();

//     const intervalId = window.setInterval(pollMarketStatus, 30 * 1000);

//     return () => {
//       alive = false;

//       window.clearInterval(intervalId);
//     };
//   }, [instrumentKey]);

//   /*
//    * While the market is open, refresh official 1-minute candles once per
//    * minute. This replaces provisional/live minute points with provider OHLC
//    * as soon as the completed candle is available, while preserving the
//    * current minute's live LTP overlay.
//    */

//   useEffect(() => {
//     if (!instrumentKey || chartRange !== "1D" || !marketOpen) return;

//     const refreshOfficial1D = () => {
//       const controller = new AbortController();
//       loadHistory(instrumentKey, "1D", controller.signal, { force: false });
//       window.setTimeout(() => controller.abort(), 25000);
//     };

//     const intervalId = window.setInterval(refreshOfficial1D, 60 * 1000);

//     return () => {
//       window.clearInterval(intervalId);
//     };
//   }, [instrumentKey, chartRange, marketOpen, loadHistory]);

//   /*

//    * Reset the 1D live session at midnight in India.

//    * Do not fetch historical data here when the market is OPEN; the first

//    * WebSocket tick of the new session should start the live chart.

//    */

//   useEffect(() => {
//     if (chartRange !== "1D") return;

//     const checkSession = () => {
//       const today = getIndiaDate();

//       if (chartSessionDateRef.current === today) return;

//       chartSessionDateRef.current = today;

//       lastLiveTickRef.current = 0;

//       pendingLiveTickRef.current = null;

//       // Keep the finalized previous-session chart visible until the first
//       // valid live tick of the new session arrives. That matches the desired
//       // "persist until next tick" behavior.
//       liveDayHistoryRef.current = [];
//       provisionalLiveMinutesRef.current = new Map();
//       liveSessionDateRef.current = "";
//       hasLiveTickRef.current = false;

//       finalHistoryLoadedRef.current = false;

//       setHoverData(null);

//       setHistory([]);

//       if (!marketOpenRef.current && instrumentKey) {
//         const controller = new AbortController();

//         loadHistory(instrumentKey, "1D", controller.signal);

//         window.setTimeout(() => controller.abort(), 25000);
//       }
//     };

//     checkSession();

//     const intervalId = window.setInterval(checkSession, 30 * 1000);

//     return () => {
//       window.clearInterval(intervalId);
//     };
//   }, [chartRange, instrumentKey, loadHistory]);

//   /* WEBSOCKET CONNECTION & TICK HANDLING */

//   useEffect(() => {
//     if (!instrumentKey) return;

//     let alive = true;

//     let subscribed = false;
//     let subscribeRetryTimer = null;
//     let subscribeRetryAttempts = 0;

//     const generation = ++wsGenerationRef.current;

//     lastLiveTickRef.current = 0;

//     pendingLiveTickRef.current = null;

//     if (liveTickFlushTimerRef.current) {
//       window.clearInterval(liveTickFlushTimerRef.current);

//       liveTickFlushTimerRef.current = null;
//     }

//     const isStale = () => !alive || generation !== wsGenerationRef.current;

//     const belongsToStock = (data) => {
//       if (!data) return false;

//       const key = data.instrumentKey || data.instrument_key || data.instrument;

//       return !key || key === instrumentKey;
//     };

//     const commitPendingTick = () => {
//       const pending = pendingLiveTickRef.current;

//       if (!pending || isStale()) return;

//       pendingLiveTickRef.current = null;
//       lastLiveTickRef.current = Date.now();

//       const { timestamp, price } = pending;
//       const today = getIndiaDate();

//       if (
//         chartRangeRef.current !== "1D" ||
//         !marketOpenRef.current ||
//         finalHistoryLoadedRef.current
//       ) {
//         return;
//       }

//       if (
//         !Number.isFinite(timestamp) ||
//         indiaDateFromTimestamp(timestamp) !== today ||
//         !isISTTradingTimestamp(timestamp)
//       ) {
//         return;
//       }

//       // The first tick of a new trading day starts a new 1D session.
//       // Do not mix yesterday's finalized candles with today's live stream.
//       if (liveSessionDateRef.current !== today) {
//         liveSessionDateRef.current = today;
//         lastLiveTickRef.current = 0;
//         pendingLiveTickRef.current = null;
//         provisionalLiveMinutesRef.current = new Map();
//         hasLiveTickRef.current = false;

//         const officialPoints = Array.isArray(historicalDayHistoryRef.current)
//           ? historicalDayHistoryRef.current
//           : [];
//         const hasTodayHistory = officialPoints.some((point) => {
//           const ts = parseHistoryTimestamp(
//             Array.isArray(point)
//               ? point[0]
//               : (point?.timestamp ?? point?.time ?? point?.date),
//           );
//           return Number.isFinite(ts) && indiaDateFromTimestamp(ts) === today;
//         });

//         if (!hasTodayHistory) {
//           historicalDayHistoryRef.current = [];
//           liveDayHistoryRef.current = [];
//           setHistory([]);

//           // Fetch today's official 1-minute candles once, then merge the
//           // current live tick on top of them.
//           const controller = new AbortController();
//           loadHistory(instrumentKey, "1D", controller.signal, { force: true });
//           window.setTimeout(() => controller.abort(), 25000);
//         }
//       }

//       const minuteTimestamp = Math.floor(timestamp / (60 * 1000)) * (60 * 1000);

//       const minuteTime = new Intl.DateTimeFormat("en-IN", {
//         timeZone: "Asia/Kolkata",
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//       }).format(new Date(minuteTimestamp));

//       const newPoint = {
//         timestamp: minuteTimestamp,
//         tickTimestamp: timestamp,
//         time: minuteTime,
//         price,
//         close: price,
//       };

//       const provisional = provisionalLiveMinutesRef.current;
//       const existing = provisional.get(minuteTimestamp);

//       if (
//         existing &&
//         Number.isFinite(Number(existing.tickTimestamp)) &&
//         timestamp < Number(existing.tickTimestamp)
//       ) {
//         return;
//       }

//       provisional.set(minuteTimestamp, newPoint);
//       hasLiveTickRef.current = true;

//       const official = Array.isArray(historicalDayHistoryRef.current)
//         ? historicalDayHistoryRef.current
//         : [];

//       const merged = (() => {
//         const output = [...official];
//         const currentMinute = minuteTimestamp;

//         for (const [bucket, livePoint] of provisional.entries()) {
//           const isCurrentMinute = bucket === currentMinute;
//           const existingIndex = output.findIndex((point) => {
//             const ts = parseHistoryTimestamp(
//               Array.isArray(point)
//                 ? point[0]
//                 : (point?.timestamp ?? point?.time),
//             );
//             return (
//               Number.isFinite(ts) &&
//               Math.floor(ts / (60 * 1000)) * (60 * 1000) === bucket
//             );
//           });

//           if (existingIndex >= 0) {
//             if (isCurrentMinute) {
//               output[existingIndex] = livePoint;
//             }
//             continue;
//           }

//           // The provider can lag by one minute. Keep a provisional point until
//           // the next history refresh supplies the official candle.
//           output.push(livePoint);
//         }

//         output.sort((a, b) => {
//           const ta = parseHistoryTimestamp(
//             Array.isArray(a) ? a[0] : (a?.timestamp ?? a?.time),
//           );
//           const tb = parseHistoryTimestamp(
//             Array.isArray(b) ? b[0] : (b?.timestamp ?? b?.time),
//           );
//           return ta - tb;
//         });

//         return output;
//       })();

//       liveDayHistoryRef.current = merged;
//       setHistory(merged);
//     };

//     const applyLiveData = (data) => {
//       if (isStale() || !belongsToStock(data)) return;

//       setSnapshot((previous) => ({ ...(previous || {}), ...data }));

//       if (typeof data.marketOpen === "boolean") {
//         marketStatusKnownRef.current = true;

//         marketOpenRef.current = data.marketOpen;

//         setMarketOpen(data.marketOpen);

//         if (data.marketOpen) {
//           finalHistoryLoadedRef.current = false;
//         }
//       }

//       const newPrice = nullableNumber(
//         data.ltp,

//         data.lastPrice,

//         data.last_price,
//       );

//       if (
//         newPrice !== null &&
//         chartRangeRef.current === "1D" &&
//         marketOpenRef.current &&
//         !finalHistoryLoadedRef.current
//       ) {
//         let timestamp = getMarketTimestamp(data);

//         if (!Number.isFinite(timestamp) && isISTTradingTimestamp(Date.now())) {
//           timestamp = Date.now();
//         }

//         if (Number.isFinite(timestamp)) {
//           const today = getIndiaDate();

//           if (
//             indiaDateFromTimestamp(timestamp) === today &&
//             isISTTradingTimestamp(timestamp)
//           ) {
//             const minuteBucket = (value) =>
//               Math.floor(value / (60 * 1000)) * (60 * 1000);

//             const previousPending = pendingLiveTickRef.current;

//             if (
//               previousPending &&
//               Number.isFinite(previousPending.timestamp) &&
//               minuteBucket(previousPending.timestamp) < minuteBucket(timestamp)
//             ) {
//               // Commit the previous minute before moving to the new minute.
//               commitPendingTick();
//             }

//             pendingLiveTickRef.current = { timestamp, price: newPrice };

//             const now = Date.now();

//             if (
//               lastLiveTickRef.current === 0 ||
//               now - lastLiveTickRef.current >= LIVE_TICK_THROTTLE_MS
//             ) {
//               commitPendingTick();
//             }
//           }
//         }
//       }

//       if (data.fundamentals)
//         setFundamentalData((prev) => ({
//           ...(prev || {}),

//           ...data.fundamentals,
//         }));

//       if (Array.isArray(data.shareholding))
//         setShareholdingData(normalizeShareholding(data.shareholding));

//       if (Array.isArray(data.mutualFunds)) setMutualFundData(data.mutualFunds);

//       setMarketLoading(false);
//     };

//     liveTickFlushTimerRef.current = window.setInterval(() => {
//       if (!isStale()) commitPendingTick();
//     }, LIVE_TICK_THROTTLE_MS);

//     const handleSnapshot = applyLiveData;

//     const handleTick = applyLiveData;

//     const handleMarketStatus = (data) => {
//       if (isStale() || !belongsToStock(data)) return;

//       if (typeof data.marketOpen !== "boolean") return;

//       const isOpen = data.marketOpen;

//       marketStatusKnownRef.current = true;

//       marketOpenRef.current = isOpen;

//       if (isOpen) {
//         finalHistoryLoadedRef.current = false;
//         officialSettlementReadyRef.current = false;
//         setOfficialSettlementReady(false);
//       }

//       setMarketOpen(isOpen);

//       setSnapshot((prev) => ({
//         ...(prev || {}),

//         marketOpen: isOpen,

//         marketStatus:
//           data.marketStatus || data.status || (isOpen ? "OPEN" : "CLOSED"),
//       }));
//     };

//     const scheduleSubscribeRetry = () => {
//       if (isStale() || subscribed || subscribeRetryTimer) return;

//       const delay = Math.min(
//         5000,
//         500 * Math.max(1, subscribeRetryAttempts + 1),
//       );
//       subscribeRetryTimer = window.setTimeout(() => {
//         subscribeRetryTimer = null;
//         subscribe();
//       }, delay);
//     };

//     const subscribe = () => {
//       if (isStale() || subscribed) return;

//       if (!detailStockSocket?.connected) {
//         scheduleSubscribeRetry();
//         return;
//       }

//       subscribeRetryAttempts += 1;

//       detailStockSocket.emit(
//         "detailStock:subscribe",

//         { instrumentKey, symbol },

//         (ack) => {
//           if (isStale()) {
//             if (ack?.success && detailStockSocket?.connected)
//               detailStockSocket.emit("detailStock:unsubscribe", {
//                 instrumentKey,
//               });

//             return;
//           }

//           if (!ack?.success) {
//             subscribed = false;

//             // The Render central gateway can connect to Detail Stock a moment
//             // after the browser socket. Retry the subscription instead of
//             // leaving the 1D chart stuck on its initial state until a tab
//             // switch/re-render happens.
//             scheduleSubscribeRetry();
//             return;
//           }

//           subscribeRetryAttempts = 0;
//           subscribed = true;
//           setMarketError("");

//           if (ack.snapshot) applyLiveData(ack.snapshot);

//           if (typeof ack.marketOpen === "boolean") {
//             marketStatusKnownRef.current = true;

//             marketOpenRef.current = ack.marketOpen;

//             if (ack.marketOpen) {
//               finalHistoryLoadedRef.current = false;
//               officialSettlementReadyRef.current = false;
//               setOfficialSettlementReady(false);
//             }

//             setMarketOpen(ack.marketOpen);
//           }
//         },
//       );
//     };

//     detailStockSocket?.on("detailStock:snapshot", handleSnapshot);

//     detailStockSocket?.on("detailStock:tick", handleTick);

//     detailStockSocket?.on("detailStock:market-status", handleMarketStatus);

//     const handleSocketConnect = () => {
//       if (isStale()) return;

//       const isReconnect = socketHasConnectedRef.current;
//       socketHasConnectedRef.current = true;

//       // Socket.IO reconnects with a fresh server-side connection/room.
//       // Allow the subscribe acknowledgement to rejoin the stock room.
//       if (isReconnect) {
//         subscribed = false;
//       }

//       subscribe();

//       if (
//         isReconnect &&
//         chartRangeRef.current === "1D" &&
//         marketOpenRef.current &&
//         instrumentKey
//       ) {
//         const controller = new AbortController();

//         loadHistory(instrumentKey, "1D", controller.signal, { force: false });

//         window.setTimeout(() => controller.abort(), 25000);
//       }
//     };

//     detailStockSocket?.on("connect", handleSocketConnect);

//     if (detailStockSocket?.connected) {
//       handleSocketConnect();
//     }

//     return () => {
//       alive = false;

//       if (subscribeRetryTimer) {
//         window.clearTimeout(subscribeRetryTimer);
//         subscribeRetryTimer = null;
//       }

//       if (liveTickFlushTimerRef.current)
//         window.clearInterval(liveTickFlushTimerRef.current);

//       if (detailStockSocket?.connected && subscribed)
//         detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });

//       detailStockSocket?.off("detailStock:snapshot", handleSnapshot);
//       detailStockSocket?.off("detailStock:tick", handleTick);
//       detailStockSocket?.off("detailStock:market-status", handleMarketStatus);
//       detailStockSocket?.off("connect", handleSocketConnect);
//       socketHasConnectedRef.current = false;
//     };
//   }, [instrumentKey, symbol]);

//   /* MARKET DATA EXTRACTORS */

//   const ltp = nullableNumber(
//     snapshot?.ltp,

//     snapshot?.lastPrice,

//     snapshot?.last_price,

//     snapshot?.price,

//     snapshot?.close,

//     stockInfo?.ltp,

//     stockInfo?.lastPrice,

//     stockInfo?.price,

//     initialStock?.ltp,

//     initialStock?.price,
//   );

//   const open = nullableNumber(
//     snapshot?.open,

//     snapshot?.openPrice,

//     stockInfo?.open,
//   );

//   const high = nullableNumber(
//     snapshot?.high,

//     snapshot?.dayHigh,

//     stockInfo?.high,
//   );

//   const low = nullableNumber(snapshot?.low, snapshot?.dayLow, stockInfo?.low);

//   // The live/finalized backend snapshot is authoritative. `stockInfo` can

//   // be an older search-card snapshot and may still contain yesterday's

//   // pre-settlement value, which would make the Performance section disagree

//   // with the chart return.

//   const previousClose = nullableNumber(
//     snapshot?.previousClose,

//     snapshot?.prevClose,

//     stockInfo?.previousClose,
//   );

//   const volume = nullableNumber(
//     snapshot?.volume,

//     snapshot?.totalVolume,

//     stockInfo?.volume,
//   );

//   const upperCircuit = nullableNumber(
//     snapshot?.upperCircuit,

//     snapshot?.upperLimit,

//     snapshot?.upperCircuitLimit,
//   );

//   const lowerCircuit = nullableNumber(
//     snapshot?.lowerCircuit,

//     snapshot?.lowerLimit,

//     snapshot?.lowerCircuitLimit,
//   );

//   function extractWeek52(sources, kind) {
//     const keys =
//       kind === "low"
//         ? [
//             "week52Low",

//             "week_52_low",

//             "yearLow",

//             "fiftyTwoWeekLow",

//             "fifty_two_week_low",

//             "52WeekLow",

//             "52_week_low",

//             "fiftyTwoWeekLowPrice",
//           ]
//         : [
//             "week52High",

//             "week_52_high",

//             "yearHigh",

//             "fiftyTwoWeekHigh",

//             "fifty_two_week_high",

//             "52WeekHigh",

//             "52_week_high",

//             "fiftyTwoWeekHighPrice",
//           ];

//     for (const source of sources) {
//       if (!source || typeof source !== "object") continue;

//       for (const key of keys) {
//         const val = source[key];

//         if (
//           val !== null &&
//           val !== undefined &&
//           val !== "" &&
//           Number.isFinite(Number(val))
//         )
//           return Number(val);
//       }
//     }

//     return null;
//   }

//   const calculated52WeekLow =
//     nullableNumber(week52Data?.low) ??
//     extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "low");

//   const calculated52WeekHigh =
//     nullableNumber(week52Data?.high) ??
//     extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "high");

//   const bsePrice = nullableNumber(
//     snapshot?.bsePrice,

//     snapshot?.bseLtp,

//     snapshot?.bseLastPrice,

//     snapshot?.bse,
//   );

//   const companyName =
//     snapshot?.name ||
//     stockInfo?.companyName ||
//     stockInfo?.name ||
//     symbol ||
//     "Stock";

//   const exchange = snapshot?.exchange || stockInfo?.exchange || "NSE";

//   /* CHART MAPPING & GEOMETRY */

//   const lineChartPreparedData = useMemo(() => {
//     const source = Array.isArray(history) ? history : [];

//     const parsed = source

//       .map((item) => {
//         let price = null;

//         let openPrice = null;

//         let rawTimestamp = NaN;

//         if (Array.isArray(item)) {
//           rawTimestamp = parseHistoryTimestamp(item[0]);

//           openPrice = nullableNumber(item[1]);

//           price = nullableNumber(item[4], item[1], item[2], item[3]);
//         } else if (item && typeof item === "object") {
//           rawTimestamp = parseHistoryTimestamp(
//             item.timestamp ??
//               item.time ??
//               item.date ??
//               item.datetime ??
//               item.dateTime ??
//               item.ts ??
//               item.epoch ??
//               item.t ??
//               item.ltt,
//           );

//           openPrice = nullableNumber(item.open, item.openPrice, item.o);

//           price = nullableNumber(
//             item.close,

//             item.c,

//             item.ltp,

//             item.lastPrice,

//             item.last_price,

//             item.price,

//             item.open,
//           );
//         } else if (typeof item === "number" || typeof item === "string") {
//           price = nullableNumber(item);
//         }

//         const dateObj = Number.isFinite(rawTimestamp)
//           ? new Date(rawTimestamp)
//           : null;

//         const timeStr = dateObj
//           ? chartRange === "1D" || chartRange === "1W"
//             ? new Intl.DateTimeFormat("en-IN", {
//                 timeZone: "Asia/Kolkata",

//                 hour: "2-digit",

//                 minute: "2-digit",

//                 hour12: true,
//               }).format(dateObj)
//             : new Intl.DateTimeFormat("en-IN", {
//                 timeZone: "Asia/Kolkata",

//                 day: "2-digit",

//                 month: "short",

//                 year: "numeric",
//               }).format(dateObj)
//           : "—";

//         return {
//           price,

//           openPrice,

//           rawTimestamp,

//           time: timeStr,
//         };
//       })

//       .filter(
//         (point) =>
//           point.price !== null &&
//           point.price > 0 &&
//           Number.isFinite(point.rawTimestamp),
//       )

//       .sort((a, b) => a.rawTimestamp - b.rawTimestamp);

//     if (chartRange !== "1D") {
//       return parsed;
//     }

//     const baseline = marketOpen
//       ? previousClose
//       : nullableNumber(rangeBaseline, previousClose);

//     // During an open session the line always begins at the previous

//     // trading day's official close at exactly 09:15 IST.

//     if (marketOpen && baseline !== null) {
//       const marketOpenTs = Date.parse(`${getIndiaDate()}T03:45:00.000Z`);

//       const livePoints = parsed.filter(
//         (point) => point.rawTimestamp >= marketOpenTs,
//       );

//       if (!livePoints.length) {
//         const now = Date.now();

//         const displayUntil = Math.max(
//           marketOpenTs,

//           Math.min(now, marketOpenTs + 375 * 60 * 1000),
//         );

//         return [
//           {
//             price: baseline,

//             openPrice: baseline,

//             rawTimestamp: marketOpenTs,

//             time: "09:15 AM",
//           },

//           {
//             price: baseline,

//             openPrice: baseline,

//             rawTimestamp: displayUntil,

//             time: new Intl.DateTimeFormat("en-IN", {
//               timeZone: "Asia/Kolkata",

//               hour: "2-digit",

//               minute: "2-digit",

//               hour12: true,
//             }).format(new Date(displayUntil)),
//           },
//         ];
//       }

//       return [
//         {
//           price: baseline,

//           openPrice: baseline,

//           rawTimestamp: marketOpenTs,

//           time: "09:15 AM",
//         },

//         ...livePoints,
//       ];
//     }

//     // After close/non-trading day, use only the official finalized session

//     // returned by the backend. If unavailable, show a baseline-only fallback

//     // rather than a stale live buffer.

//     if (parsed.length) {
//       return parsed;
//     }

//     if (baseline !== null) {
//       const todayStr = getIndiaDate();

//       const marketOpenTs = Date.parse(`${todayStr}T03:45:00.000Z`);

//       return [
//         {
//           price: baseline,

//           openPrice: baseline,

//           rawTimestamp: marketOpenTs,

//           time: "09:15 AM",
//         },

//         {
//           price: baseline,

//           openPrice: baseline,

//           rawTimestamp: marketOpenTs + 375 * 60 * 1000,

//           time: "03:30 PM",
//         },
//       ];
//     }

//     return [];
//   }, [history, previousClose, rangeBaseline, marketOpen, chartRange]);

//   const rangeStartPrice = useMemo(() => {
//     if (chartRange === "1D") {
//       return marketOpen
//         ? previousClose
//         : nullableNumber(rangeBaseline, previousClose);
//     }

//     // For non-1D ranges the backend returns the opening price of the first

//     // trading candle inside the selected range. This matches the range-return

//     // convention used by the stock detail UI.

//     return nullableNumber(rangeBaseline);
//   }, [chartRange, previousClose, rangeBaseline, marketOpen]);

//   const currentDisplayPrice = useMemo(() => {
//     const lastChartPrice =
//       lineChartPreparedData[lineChartPreparedData.length - 1]?.price ?? null;

//     // During the closed/finalized session, the official snapshot close is
//     // authoritative for the displayed 1D value. During market hours, the
//     // live LTP remains authoritative.
//     if (chartRange === "1D" && !marketOpen) {
//       return ltp ?? lastChartPrice ?? null;
//     }

//     return ltp ?? lastChartPrice ?? null;
//   }, [ltp, lineChartPreparedData, chartRange, marketOpen]);

//   const displayChange = useMemo(() => {
//     if (currentDisplayPrice !== null && rangeStartPrice !== null) {
//       return currentDisplayPrice - rangeStartPrice;
//     }

//     // For 1D the snapshot also uses the previous trading day's close.

//     // Never fall back to daily change for a non-1D range when its real

//     // range-start baseline is unavailable.

//     return chartRange === "1D"
//       ? (snapshot?.change ?? stockInfo?.change_points ?? null)
//       : null;
//   }, [snapshot, stockInfo, currentDisplayPrice, rangeStartPrice, chartRange]);

//   const displayChangePercent = useMemo(() => {
//     if (displayChange !== null && rangeStartPrice) {
//       return (displayChange / rangeStartPrice) * 100;
//     }

//     return chartRange === "1D"
//       ? (snapshot?.changePercent ?? stockInfo?.change_percent ?? null)
//       : null;
//   }, [snapshot, stockInfo, displayChange, rangeStartPrice, chartRange]);

//   const isPositive = displayChange !== null ? displayChange >= 0 : true;

//   const chartColor = isPositive ? "#00b28e" : "#e5484d";

//   const getChartX = useCallback(
//     (item, index, total) => {
//       if (chartRange === "1D")
//         return getISTMarketProgress(item?.rawTimestamp) * CHART_WIDTH;

//       if (total <= 1) return CHART_WIDTH / 2;

//       return (
//         CHART_PADDING_X +
//         (index / (total - 1)) * (CHART_WIDTH - CHART_PADDING_X * 2)
//       );
//     },

//     [chartRange],
//   );

//   const lineChartSvg = useMemo(() => {
//     const empty = {
//       line: "",

//       area: "",

//       min: 0,

//       max: 0,

//       baselineY: null,

//       lastPoint: null,
//     };

//     if (!lineChartPreparedData.length) return empty;

//     const baseline = rangeStartPrice;

//     const allValues = lineChartPreparedData

//       .map((d) => d.price)

//       .filter((v) => Number.isFinite(v));

//     if (Number.isFinite(baseline)) allValues.push(baseline);

//     if (!allValues.length) return empty;

//     let min = Math.min(...allValues);

//     let max = Math.max(...allValues);

//     const rawRange = max - min;

//     const padding = rawRange > 0 ? rawRange * 0.08 : Math.abs(min) * 0.02 || 1;

//     min -= padding;

//     max += padding;

//     const range = max - min;

//     const toY = (v) =>
//       CHART_HEIGHT -
//       CHART_PADDING_Y -
//       ((v - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

//     const total = lineChartPreparedData.length;

//     const mappedPoints = lineChartPreparedData

//       .map((item, index) => ({
//         x: getChartX(item, index, total),

//         y: toY(item.price),

//         price: item.price,

//         time: item.time,
//       }))

//       .filter(
//         (p) =>
//           Number.isFinite(p.x) &&
//           Number.isFinite(p.y) &&
//           Number.isFinite(p.price),
//       );

//     if (!mappedPoints.length) return empty;

//     const pathCoords = mappedPoints.map((p) => `${p.x},${p.y}`);

//     const lastPoint = mappedPoints[mappedPoints.length - 1];

//     const firstPoint = mappedPoints[0];

//     const baselineY = Number.isFinite(baseline) ? toY(baseline) : null;

//     return {
//       line: pathCoords.join(" "),

//       area: `M ${pathCoords[0]} L ${pathCoords.join(" L ")} L ${lastPoint.x},${CHART_HEIGHT} L ${firstPoint.x},${CHART_HEIGHT} Z`,

//       min,

//       max,

//       baselineY: Number.isFinite(baselineY) ? baselineY : null,

//       lastPoint,
//     };
//   }, [lineChartPreparedData, rangeStartPrice, getChartX]);

//   const handleMouseMove = useCallback(
//     (event) => {
//       if (!lineChartPreparedData.length) return;

//       const rect = event.currentTarget.getBoundingClientRect();

//       if (!rect || rect.width <= 0) return;

//       const mouseX = Math.max(
//         0,

//         Math.min(rect.width, event.clientX - rect.left),
//       );

//       const targetX = (mouseX / rect.width) * CHART_WIDTH;

//       const total = lineChartPreparedData.length;

//       const { min, max } = lineChartSvg;

//       const range = max - min || 1;

//       let point = null,
//         nearestDistance = Infinity;

//       lineChartPreparedData.forEach((candidate, idx) => {
//         const candidateX = getChartX(candidate, idx, total);

//         if (!Number.isFinite(candidateX)) return;

//         const dist = Math.abs(candidateX - targetX);

//         if (dist < nearestDistance) {
//           nearestDistance = dist;

//           point = candidate;
//         }
//       });

//       if (!point || !Number.isFinite(point.price)) return;

//       const idx = lineChartPreparedData.indexOf(point);

//       const x = getChartX(point, idx, total);

//       const y =
//         CHART_HEIGHT -
//         CHART_PADDING_Y -
//         ((point.price - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

//       if (!Number.isFinite(x) || !Number.isFinite(y)) return;

//       const percentX = (x / CHART_WIDTH) * 100;

//       setHoverData({
//         price: point.price,

//         time: point.time,

//         x,

//         y,

//         percentX,

//         transformX: percentX < 15 ? "0%" : percentX > 85 ? "-100%" : "-50%",
//       });
//     },

//     [lineChartPreparedData, lineChartSvg, getChartX],
//   );

//   function getRangePosition(current, lowValue, highValue) {
//     if (
//       current === null ||
//       lowValue === null ||
//       highValue === null ||
//       highValue <= lowValue
//     )
//       return "50%";

//     return `${Math.max(0, Math.min(100, ((current - lowValue) / (highValue - lowValue)) * 100))}%`;
//   }

//   const fundamentals = useMemo(() => {
//     const data = fundamentalData || snapshot?.fundamentals || {};

//     return [
//       ["Return on Equity", firstDefined(data.roe)],

//       ["Return on Assets", firstDefined(data.roa)],

//       ["Return on Capital Employed", firstDefined(data.roce)],

//       ["P/E Ratio (TTM)", firstDefined(data.peRatio, data.pe_ratio, data.pe)],

//       ["P/B Ratio", firstDefined(data.pbRatio, data.pb_ratio, data.pb)],

//       ["EBITDA", firstDefined(data.evEbitda, data.ev_ebitda)],

//       ["Earnings Per Share", firstDefined(data.eps, data.epsBasic)],

//       ["Revenue (Cr)", firstDefined(data.revenue)],

//       [
//         "Profit (Cr)",

//         firstDefined(data.operatingProfit, data.operating_profit),
//       ],

//       ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
//     ];
//   }, [fundamentalData, snapshot]);

//   const aboutInfo = useMemo(
//     () =>
//       normalizeAbout(
//         profileData || fundamentalData?.profile || snapshot?.profile,

//         fundamentalData,

//         snapshot?.symbol || symbol,
//       ),

//     [profileData, fundamentalData, snapshot, symbol],
//   );

//   const shareholdingPeriods = useMemo(() => {
//     const periodSet = new Set();

//     (Array.isArray(shareholdingData) ? shareholdingData : []).forEach(
//       (item) => {
//         (Array.isArray(item.history) ? item.history : []).forEach((row) => {
//           if (row?.period) periodSet.add(row.period);
//         });
//       },
//     );

//     const parsePeriod = (p) => {
//       const str = String(p).trim().toLowerCase();

//       const monthMap = {
//         jan: 1,

//         feb: 2,

//         mar: 3,

//         apr: 4,

//         may: 5,

//         jun: 6,

//         jul: 7,

//         aug: 8,

//         sep: 9,

//         oct: 10,

//         nov: 11,

//         dec: 12,

//         q1: 3,

//         q2: 6,

//         q3: 9,

//         q4: 12,
//       };

//       let month = 0;

//       for (const [k, m] of Object.entries(monthMap)) {
//         if (str.includes(k)) {
//           month = m;

//           break;
//         }
//       }

//       let year = 0;

//       const yearMatch = str.match(/(19|20)\d{2}/);

//       if (yearMatch) year = Number(yearMatch[0]);
//       else {
//         const digitRuns = str.match(/\d{1,2}/g);

//         if (digitRuns?.length)
//           year = 2000 + Number(digitRuns[digitRuns.length - 1]);
//       }

//       return year * 100 + month;
//     };

//     return Array.from(periodSet).sort(
//       (a, b) => parsePeriod(b) - parsePeriod(a),
//     );
//   }, [shareholdingData]);

//   useEffect(() => {
//     if (!selectedShareholdingPeriod && shareholdingPeriods.length)
//       setSelectedShareholdingPeriod(shareholdingPeriods[0]);
//   }, [selectedShareholdingPeriod, shareholdingPeriods]);

//   const selectedShareholding = useMemo(() => {
//     if (!selectedShareholdingPeriod) return [];

//     const idx = shareholdingPeriods.indexOf(selectedShareholdingPeriod);

//     const previousPeriod = idx >= 0 ? shareholdingPeriods[idx + 1] : undefined;

//     return shareholdingData

//       .map((item, index) => {
//         const historyRows = Array.isArray(item.history) ? item.history : [];

//         const selected = historyRows.find(
//           (row) => row.period === selectedShareholdingPeriod,
//         );

//         if (!selected) return null;

//         const previousRow = previousPeriod
//           ? historyRows.find((row) => row.period === previousPeriod)
//           : null;

//         const percentage = numberValue(selected.percentage, 0);

//         const previousPercentage = previousRow
//           ? numberValue(previousRow.percentage, 0)
//           : null;

//         return {
//           key: `${item.label || "unknown"}-${index}`,

//           label: item.label || "Unknown",

//           percentage,

//           change:
//             previousPercentage !== null
//               ? percentage - previousPercentage
//               : null,
//         };
//       })

//       .filter(Boolean);
//   }, [shareholdingData, selectedShareholdingPeriod, shareholdingPeriods]);

//   const mutualFunds = useMemo(() => {
//     return mutualFundData.map((fund, index) => ({
//       name:
//         fund.name ||
//         fund.fundName ||
//         fund.fund_name ||
//         fund.fund ||
//         `Fund ${index + 1}`,

//       percentage: nullableNumber(
//         fund.percentage,

//         fund.percent,

//         fund.aumPercentage,

//         fund.aum_percent,

//         fund.value,
//       ),

//       value: fund.marketValue || fund.market_value || fund.value || null,

//       logo: fund.logo || fund.icon || "",
//     }));
//   }, [mutualFundData]);

//   const financialRows = useMemo(() => {
//     const rows = normalizeFinancialRows(
//       financialData ||
//         fundamentalData?.incomeStatement ||
//         fundamentalData?.income_statement ||
//         fundamentalData,
//     );

//     if (rows?.length) return rows;

//     const data = {
//       ...(snapshot?.fundamentals || {}),

//       ...(financialData && typeof financialData === "object"
//         ? financialData
//         : {}),
//     };

//     const period = firstDefined(
//       data.period,

//       data.quarter,

//       data.reportPeriod,

//       data.report_period,

//       data.revenuePeriod,

//       data.revenue_period,

//       data.netProfitPeriod,

//       data.net_profit_period,

//       data.asOf,

//       data.as_of,

//       data.reportDate,

//       data.report_date,
//     );

//     if (period) {
//       const revenue = getFinancialNumber(
//         data.revenue,

//         data.sales,

//         data.totalRevenue,

//         data.total_revenue,

//         data.income,
//       );

//       const profit = getFinancialNumber(
//         data.netProfit,

//         data.net_profit,

//         data.profit,

//         data.pat,

//         data.profitAfterTax,

//         data.profit_after_tax,

//         data.operatingProfit,

//         data.operating_profit,

//         data.netIncome,
//       );

//       if (revenue !== null || profit !== null) {
//         return [
//           {
//             quarter: String(period),

//             revenue: revenue ?? 0,

//             profit: profit ?? 0,
//           },
//         ];
//       }
//     }

//     return [];
//   }, [financialData, fundamentalData, snapshot]);

//   const financialBarData = useMemo(() => {
//     const last5 = financialRows.slice(-5);

//     return last5.map((item, index, rows) => ({
//       ...item,

//       active: index === rows.length - 1,
//     }));
//   }, [financialRows]);

//   const maxFinancialValue = useMemo(() => {
//     if (!financialBarData.length) return 1;

//     const highest = Math.max(
//       ...financialBarData.flatMap((r) => [r.revenue, r.profit]),
//     );

//     return highest > 0 ? highest : 1;
//   }, [financialBarData]);

//   const effectivePrice =
//     numberValue(priceLimit, 0) > 0 ? numberValue(priceLimit) : ltp || 0;

//   const approximateRequired = numberValue(quantity) * effectivePrice;

//   const handlePlaceOrder = async (e) => {
//     e.preventDefault();

//     if (!simulationMarketOpen || !quantity || numberValue(quantity) <= 0)
//       return;

//     if (!instrumentKey) {
//       setOrderMessage("Instrument is missing.");

//       return;
//     }

//     setOrderSubmitting(true);

//     setOrderMessage("");

//     try {
//       const token = localStorage.getItem("token");

//       const normalizedQuantity = numberValue(quantity);

//       const normalizedOrderType =
//         numberValue(priceLimit, 0) > 0 ? "LIMIT" : "MARKET";

//       const normalizedLimitPrice =
//         normalizedOrderType === "LIMIT" ? numberValue(priceLimit) : null;

//       const fingerprint = JSON.stringify({
//         instrumentKey,

//         transactionType: orderType,

//         quantity: normalizedQuantity,

//         orderType: normalizedOrderType,

//         limitPrice: normalizedLimitPrice,

//         product: "CNC",
//       });

//       if (orderFingerprintRef.current !== fingerprint) {
//         orderFingerprintRef.current = fingerprint;

//         orderIdempotencyKeyRef.current =
//           window.crypto?.randomUUID?.() ||
//           `${Date.now()}-${Math.random().toString(36).slice(2)}`;
//       }

//       const idempotencyKey = orderIdempotencyKeyRef.current;

//       const isLimitOrder = numberValue(priceLimit, 0) > 0;

//       const payload = {
//         symbol: snapshot?.symbol || stockInfo?.symbol || symbol,

//         instrumentKey,

//         transactionType: String(orderType).toUpperCase(),

//         quantity: numberValue(quantity),

//         orderType: isLimitOrder ? "LIMIT" : "MARKET",

//         product: "CNC",
//       };

//       if (isLimitOrder) {
//         payload.limitPrice = numberValue(priceLimit);
//       }

//       const response = await axios.post(ENDPOINTS.order(), payload, {
//         timeout: 10000,

//         headers: {
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),

//           "Idempotency-Key": crypto.randomUUID(),
//         },
//       });

//       if (response.data?.success) {
//         const result = response.data?.data || {};

//         const executedQuantity = Number(result.quantity ?? quantity);

//         const executedPrice = Number(result.price ?? effectivePrice);

//         setOrderMessage(
//           `Success: ${orderType} order completed for ${executedQuantity} shares at ₹${executedPrice.toFixed(2)}.`,
//         );

//         setQuantity("");

//         setPriceLimit("");

//         orderIdempotencyKeyRef.current = null;

//         orderFingerprintRef.current = "";
//       } else {
//         setOrderMessage(
//           response.data?.message || "Order placement request failed.",
//         );
//       }
//     } catch (err) {
//       const code = err?.response?.data?.code;

//       if (code === "MARKET_CLOSED") {
//         setOrderMessage("Market is closed.");
//       } else {
//         setOrderMessage(
//           err?.response?.data?.message ||
//             err?.message ||
//             "Failed to place simulated order.",
//         );
//       }
//     } finally {
//       setOrderSubmitting(false);
//     }
//   };

//   if (stockLoading && !stockInfo) {
//     return (
//       <div className="precision-dashboard">
//         <main className="precision-main">
//           <div className="precision-content">
//             <div className="precision-left">
//               <section className="stock-card">Loading stock details…</section>
//             </div>
//           </div>
//         </main>
//       </div>
//     );
//   }

//   return (
//     <div className="home" style={{ paddingTop: "1.5rem" }}>
//       <div className="precision-dashboard">
//         <main className="precision-main">
//           <div className="precision-content">
//             {/* LEFT MAIN CONTENT */}

//             <div className="precision-left">
//               <section className="stock-card">
//                 <StockHeader
//                   symbol={snapshot?.symbol || stockInfo?.symbol || symbol}
//                   exchange={exchange}
//                   companyName={companyName}
//                   ltp={ltp}
//                   isPositive={isPositive}
//                   displayChange={displayChange}
//                   displayChangePercent={displayChangePercent}
//                   chartRange={chartRange}
//                   marketError={marketError}
//                   stockError={stockError}
//                   isWatchlisted={isWatchlisted}
//                   onToggleWatchlist={handleToggleWatchlist}
//                 />

//                 <StockChart
//                   resetKey={`${instrumentKey}-${chartRange}`}
//                   historyLoading={historyLoading}
//                   lineChartPreparedData={lineChartPreparedData}
//                   marketOpen={marketOpen}
//                   hoverData={hoverData}
//                   onMouseMove={handleMouseMove}
//                   onMouseLeave={() => setHoverData(null)}
//                   lineChartSvg={lineChartSvg}
//                   chartColor={chartColor}
//                   chartRange={chartRange}
//                   onRangeChange={setChartRange}
//                 />
//               </section>

//               <PerformanceSection
//                 low={low}
//                 high={high}
//                 ltp={ltp}
//                 calculated52WeekLow={calculated52WeekLow}
//                 calculated52WeekHigh={calculated52WeekHigh}
//                 getRangePosition={getRangePosition}
//                 open={open}
//                 previousClose={previousClose}
//                 volume={volume}
//                 upperCircuit={upperCircuit}
//                 lowerCircuit={lowerCircuit}
//               />

//               <FundamentalsSection
//                 loading={fundamentalsLoading}
//                 error={fundamentalsError}
//                 fundamentals={fundamentals}
//               />

//               <ShareholdingSection
//                 isin={isin}
//                 shareholdingPeriods={shareholdingPeriods}
//                 selectedShareholdingPeriod={selectedShareholdingPeriod}
//                 setSelectedShareholdingPeriod={setSelectedShareholdingPeriod}
//                 selectedShareholding={selectedShareholding}
//               />

//               <FinancialsSection
//                 isin={isin}
//                 financialBarData={financialBarData}
//                 maxFinancialValue={maxFinancialValue}
//                 getFinancialNumber={getFinancialNumber}
//               />

//               <AboutSection
//                 aboutInfo={aboutInfo}
//                 isAboutExpanded={isAboutExpanded}
//                 setIsAboutExpanded={setIsAboutExpanded}
//               />

//               <MutualFundsSection mutualFunds={mutualFunds} />
//             </div>

//             {/* RIGHT TRADING PANEL */}

//             <TradingPanel
//               symbol={snapshot?.symbol || stockInfo?.symbol || symbol}
//               exchange={exchange}
//               ltp={ltp}
//               bsePrice={bsePrice}
//               isPositive={isPositive}
//               displayChangePercent={displayChangePercent}
//               orderType={orderType}
//               setOrderType={setOrderType}
//               handlePlaceOrder={handlePlaceOrder}
//               quantity={quantity}
//               setQuantity={setQuantity}
//               priceLimit={priceLimit}
//               setPriceLimit={setPriceLimit}
//               approximateRequired={approximateRequired}
//               orderMessage={orderMessage}
//               marketOpen={simulationMarketOpen}
//               orderSubmitting={orderSubmitting}
//               numberValue={numberValue}
//             />
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }

// export { StockDashboard as ShareholdingPattern };

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation, useParams } from "react-router-dom";

import axios from "axios";

import detailStockSocket from "./detailStockWebSocketConnection";

import {
  ENDPOINTS,
  CHART_WIDTH,
  CHART_HEIGHT,
  CHART_PADDING_X,
  CHART_PADDING_Y,
  LIVE_TICK_THROTTLE_MS,
} from "./config/stockConfig";

import {
  numberValue,
  nullableNumber,
  firstDefined,
  getFinancialNumber,
} from "./utils/formatters";

import {
  getIndiaDate,
  getHistoryParams,
  parseHistoryTimestamp,
  indiaDateFromTimestamp,
  isISTTradingTimestamp,
  getMarketTimestamp,
  getISTMarketProgress,
} from "./utils/dateHelpers";

import {
  unwrapResponse,
  normalizeStock,
  normalizeFundamentals,
  normalizeShareholding,
  normalizeMutualFunds,
  normalizeFinancialRows,
  normalizeHistory,
  normalizeMarketStatus,
  normalizeAbout,
} from "./utils/normalizers";

/* UI Components */

import { StockHeader } from "./components/stock/StockHeader";

import { StockChart } from "./components/stock/StockChart";

import { PerformanceSection } from "./components/stock/PerformanceSection";

import { FundamentalsSection } from "./components/stock/FundamentalsSection";

import { ShareholdingSection } from "./components/stock/ShareholdingSection";

import { FinancialsSection } from "./components/stock/FinancialsSection";

import { AboutSection } from "./components/stock/AboutSection";

import { MutualFundsSection } from "./components/stock/MutualFundsSection";

import { TradingPanel } from "./components/stock/TradingPanel";

export default function StockDashboard({
  instrumentKey: propInstrumentKey,

  isin: propIsin,
}) {
  const { symbol: routeSymbol } = useParams();

  const location = useLocation();

  const initialStock = location.state || null;

  const symbol =
    routeSymbol || initialStock?.symbol || initialStock?.tradingSymbol || "";

  // TEST MODE: allow simulated BUY/SELL even when the real market is closed.

  // This changes only the simulator availability; market-data UI still uses real marketOpen.

  const simulationMarketOpen = true;

  /* STATE */

  const [stockInfo, setStockInfo] = useState(initialStock);

  const [snapshot, setSnapshot] = useState(null);

  const [marketOpen, setMarketOpen] = useState(null);

  // Official same-day EOD history becomes authoritative only after settlement.
  const [officialSettlementReady, setOfficialSettlementReady] = useState(false);

  const [marketLoading, setMarketLoading] = useState(true);

  const [marketError, setMarketError] = useState("");

  const [stockLoading, setStockLoading] = useState(true);

  const [stockError, setStockError] = useState("");

  const [history, setHistory] = useState([]);

  const [chartRange, setChartRange] = useState("1D");

  // Backend supplies the real prior-trading-day close for the selected range.

  const [rangeBaseline, setRangeBaseline] = useState(null);

  const chartSessionDateRef = useRef(getIndiaDate());

  const lastLiveTickRef = useRef(0);

  const pendingLiveTickRef = useRef(null);

  const liveTickFlushTimerRef = useRef(null);

  const wsGenerationRef = useRef(0);

  // Prevent stale history responses from overwriting newer chart state.
  const historyRequestGenerationRef = useRef(0);

  // Tracks whether the socket has already connected once for this stock.
  const socketHasConnectedRef = useRef(false);

  const [week52Data, setWeek52Data] = useState(null);

  /* 1D LIVE CHART STATE */

  const chartRangeRef = useRef(chartRange);

  const marketOpenRef = useRef(marketOpen);

  const officialSettlementReadyRef = useRef(false);
  const marketStatusKnownRef = useRef(false);

  const liveDayHistoryRef = useRef([]);

  // Official 1D REST candles are the authoritative history.
  // Live ticks are kept separately and only overlay the in-progress minute
  // (or temporarily fill a minute that REST has not published yet).
  const historicalDayHistoryRef = useRef([]);
  const provisionalLiveMinutesRef = useRef(new Map());
  // Date of the trading session whose live ticks are currently driving 1D.
  // This prevents yesterday's finalized candles from being mixed with the
  // first live tick of the next trading session.
  const liveSessionDateRef = useRef("");
  const hasLiveTickRef = useRef(false);

  const finalHistoryLoadedRef = useRef(false);

  const [historyLoading, setHistoryLoading] = useState(false);

  const [fundamentalData, setFundamentalData] = useState(null);

  const [shareholdingData, setShareholdingData] = useState([]);

  const [mutualFundData, setMutualFundData] = useState([]);

  const [financialData, setFinancialData] = useState(null);

  const [profileData, setProfileData] = useState(null);

  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);

  const [fundamentalsError, setFundamentalsError] = useState("");

  const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] =
    useState("");

  const [hoverData, setHoverData] = useState(null);

  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  const [orderType, setOrderType] = useState("BUY");

  const [quantity, setQuantity] = useState("1");

  const [priceLimit, setPriceLimit] = useState("");

  const [isWatchlisted, setIsWatchlisted] = useState(false);

  const [orderSubmitting, setOrderSubmitting] = useState(false);

  const [orderMessage, setOrderMessage] = useState("");

  const orderIdempotencyKeyRef = useRef(null);

  const orderFingerprintRef = useRef("");

  useEffect(() => {
    chartRangeRef.current = chartRange;
  }, [chartRange]);

  /* SYNC SEARCH-BAR STOCK SELECTION */

  // React Router may reuse this component when the search bar selects

  // another stock. Sync the new location state and clear old-stock data.

  useEffect(() => {
    setStockInfo(initialStock || null);

    setSnapshot(null);

    setHistory([]);

    setRangeBaseline(null);

    setHoverData(null);

    setMarketError("");

    setStockError("");

    setFundamentalData(null);

    setShareholdingData([]);

    setMutualFundData([]);

    setFinancialData(null);

    setProfileData(null);

    setIsWatchlisted(false);

    chartSessionDateRef.current = getIndiaDate();

    lastLiveTickRef.current = 0;
    pendingLiveTickRef.current = null;

    liveDayHistoryRef.current = [];
    historicalDayHistoryRef.current = [];
    provisionalLiveMinutesRef.current = new Map();
    liveSessionDateRef.current = "";
    hasLiveTickRef.current = false;
    finalHistoryLoadedRef.current = false;

    // Every newly selected stock must open on a fresh 1D chart.
    setChartRange("1D");

    socketHasConnectedRef.current = false;
    historyRequestGenerationRef.current += 1;

    marketStatusKnownRef.current = false;

    officialSettlementReadyRef.current = false;
    setOfficialSettlementReady(false);

    marketOpenRef.current = false;

    // Market state is unknown until the new stock's status request completes.

    setMarketOpen(null);

    if (liveTickFlushTimerRef.current) {
      window.clearInterval(liveTickFlushTimerRef.current);

      liveTickFlushTimerRef.current = null;
    }
  }, [location.key, symbol]);

  /* LOAD STOCK IDENTIFIER */

  useEffect(() => {
    const controller = new AbortController();

    async function loadStock() {
      if (!symbol) {
        setStockLoading(false);

        setStockError("Stock symbol is missing from the URL.");

        return;
      }

      setStockLoading(true);

      setStockError("");

      try {
        const response = await axios.get(ENDPOINTS.stock(symbol), {
          timeout: 15000,

          signal: controller.signal,
        });

        const stock = normalizeStock(response.data, symbol);

        setStockInfo((previous) => ({ ...(previous || {}), ...stock }));
      } catch (error) {
        if (axios.isCancel(error) || error?.code === "ERR_CANCELED") return;

        setStockError(
          error?.response?.data?.message ||
          error?.message ||
          "Failed to load stock details.",
        );
      } finally {
        if (!controller.signal.aborted) setStockLoading(false);
      }
    }

    loadStock();

    return () => controller.abort();
  }, [symbol]);

  const instrumentKey =
    propInstrumentKey ||
    initialStock?.instrumentKey ||
    initialStock?.instrument_key ||
    stockInfo?.instrumentKey ||
    stockInfo?.instrument_key ||
    "";

  const isin =
    propIsin ||
    stockInfo?.isin ||
    stockInfo?.ISIN ||
    initialStock?.isin ||
    initialStock?.ISIN ||
    snapshot?.isin ||
    "";

  useEffect(() => {
    if (!instrumentKey) return;

    let cancelled = false;

    const fetch52WeekData = async () => {
      try {
        const response = await axios.get(
          `/api/detail-stock/52-week/${encodeURIComponent(instrumentKey)}`,
        );

        if (!cancelled && response.data?.success) {
          setWeek52Data(response.data.data);
        }
      } catch (error) {
        console.error("Failed to fetch 52-week high/low:", error);
      }
    };

    fetch52WeekData();

    return () => {
      cancelled = true;
    };
  }, [instrumentKey]);

  const [watchlistLoading, setWatchlistLoading] = useState(false);

  useEffect(() => {
    if (!instrumentKey) {
      setIsWatchlisted(false);

      return;
    }

    let cancelled = false;

    const loadWatchlistStatus = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        if (!cancelled) {
          setIsWatchlisted(false);
        }

        return;
      }

      try {
        const response = await axios.get("/api/watchlist", {
          timeout: 10000,

          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Watchlist service returns:

        // { success: true, count, stocks: [...] }

        const stocks =
          response.data?.stocks ||
          response.data?.watchlist ||
          response.data?.data ||
          [];

        const currentKey = String(instrumentKey).trim();

        const exists =
          Array.isArray(stocks) &&
          stocks.some((stock) => {
            const stockKey = String(
              stock?.instrument_key ||
              stock?.instrumentKey ||
              stock?.instrument ||
              "",
            ).trim();

            return stockKey === currentKey;
          });

        if (!cancelled) {
          setIsWatchlisted(exists);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to load watchlist status:",

            error?.response?.data || error,
          );

          setIsWatchlisted(false);
        }
      }
    };

    loadWatchlistStatus();

    return () => {
      cancelled = true;
    };
  }, [instrumentKey]);

  const handleToggleWatchlist = async () => {
    if (!instrumentKey) {
      console.error("Instrument key is missing");

      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      console.error("User is not authenticated");

      alert("Please login first.");

      return;
    }

    if (watchlistLoading) return;

    setWatchlistLoading(true);

    try {
      if (isWatchlisted) {
        // REMOVE

        await axios.delete(
          `/api/watchlist/${encodeURIComponent(instrumentKey)}`,

          {
            timeout: 10000,

            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setIsWatchlisted(false);

        console.log("Removed from watchlist:", instrumentKey);
      } else {
        // ADD

        await axios.post(
          "/api/watchlist",

          {
            instrumentKey,
          },

          {
            timeout: 10000,

            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        setIsWatchlisted(true);

        console.log("Added to watchlist:", instrumentKey);
      }
    } catch (error) {
      console.error("Watchlist toggle failed:", error?.response?.data || error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  // Financials can use either an ISIN or the trading symbol.

  // The backend resolves SYMBOL -> ISIN from instruments_master.

  const financialIdentifier = String(isin || symbol || "")
    .trim()

    .toUpperCase();

  /* LOAD MARKET STATUS & SNAPSHOT */

  const loadMarketData = useCallback(async (key, signal) => {
    if (!key) {
      setMarketLoading(false);

      return;
    }

    setMarketLoading(true);

    setMarketError("");

    try {
      const [statusResult, snapshotResult] = await Promise.allSettled([
        axios.get(ENDPOINTS.marketStatus(), { timeout: 8000, signal }),

        axios.get(ENDPOINTS.snapshot(key), { timeout: 10000, signal }),
      ]);

      if (signal.aborted) return;

      let isOpen = null;

      let initialSnapshot = null;

      if (statusResult.status === "fulfilled") {
        const statusPayload = unwrapResponse(statusResult.value.data) || {};
        isOpen = normalizeMarketStatus(statusPayload);

        const settlementReady = Boolean(statusPayload.officialSettlementReady);
        officialSettlementReadyRef.current = settlementReady;
        setOfficialSettlementReady(settlementReady);

        marketStatusKnownRef.current = true;

        marketOpenRef.current = Boolean(isOpen);
      }

      if (snapshotResult.status === "fulfilled") {
        initialSnapshot = unwrapResponse(snapshotResult.value.data);

        if (typeof initialSnapshot?.officialSettlementReady === "boolean") {
          officialSettlementReadyRef.current =
            initialSnapshot.officialSettlementReady;
          setOfficialSettlementReady(initialSnapshot.officialSettlementReady);
        }

        if (typeof initialSnapshot?.marketOpen === "boolean") {
          isOpen = initialSnapshot.marketOpen;

          marketStatusKnownRef.current = true;

          marketOpenRef.current = initialSnapshot.marketOpen;
        }
      }

      if (isOpen === null) isOpen = normalizeMarketStatus({});

      marketStatusKnownRef.current = true;

      marketOpenRef.current = Boolean(isOpen);

      setMarketOpen(Boolean(isOpen));

      if (initialSnapshot) setSnapshot(initialSnapshot);
    } catch (error) {
      if (
        axios.isCancel(error) ||
        error?.code === "ERR_CANCELED" ||
        signal.aborted
      )
        return;

      setMarketError(
        error?.response?.data?.message ||
        error?.message ||
        "Unable to load market data.",
      );

      marketOpenRef.current = false;
      marketStatusKnownRef.current = true;
      officialSettlementReadyRef.current = false;
      setOfficialSettlementReady(false);
      setMarketOpen(false);
    } finally {
      if (!signal.aborted) setMarketLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!instrumentKey) {
      setMarketLoading(false);

      return;
    }

    const controller = new AbortController();

    loadMarketData(instrumentKey, controller.signal);

    return () => controller.abort();
  }, [instrumentKey, loadMarketData]);

  /* LOAD STATIC DATA */

  useEffect(() => {
    const controller = new AbortController();

    let timeoutId = null;

    async function requestJson(url) {
      const response = await axios.get(url, {
        timeout: 15000,

        signal: controller.signal,
      });

      return response.data;
    }

    async function loadAllStaticData() {
      const identifier = financialIdentifier;

      if (!identifier) {
        setFundamentalsLoading(false);

        setFundamentalsError("Stock identifier is missing.");

        return;
      }

      setFundamentalsLoading(true);

      setFundamentalsError("");

      try {
        const results = await Promise.allSettled([
          isin
            ? requestJson(ENDPOINTS.fundamentals(isin))
            : Promise.reject(new Error("ISIN unavailable")),

          isin
            ? requestJson(ENDPOINTS.shareholding(isin))
            : Promise.reject(new Error("ISIN unavailable")),

          // IMPORTANT: financial endpoint accepts ISIN OR SYMBOL.

          requestJson(ENDPOINTS.financials(identifier)),

          isin
            ? requestJson(ENDPOINTS.mutualFunds(isin))
            : Promise.reject(new Error("ISIN unavailable")),

          isin
            ? requestJson(ENDPOINTS.profile(isin))
            : Promise.reject(new Error("ISIN unavailable")),
        ]);

        if (controller.signal.aborted) return;

        if (results[0].status === "fulfilled") {
          const data = normalizeFundamentals(results[0].value);

          setFundamentalData(data);

          const combinedShareholding = normalizeShareholding(results[0].value);

          const combinedMF = normalizeMutualFunds(results[0].value);

          if (combinedShareholding.length) {
            setShareholdingData(combinedShareholding);
          }

          if (combinedMF.length) {
            setMutualFundData(combinedMF);
          }
        }

        if (results[1].status === "fulfilled") {
          const data = normalizeShareholding(results[1].value);

          if (data.length) setShareholdingData(data);
        }

        if (results[2].status === "fulfilled") {
          setFinancialData(unwrapResponse(results[2].value));
        }

        if (results[3].status === "fulfilled") {
          const data = normalizeMutualFunds(results[3].value);

          if (data.length) setMutualFundData(data);
        }

        if (results[4].status === "fulfilled") {
          const data = unwrapResponse(results[4].value);

          setProfileData(data?.profile || data);
        }

        const financialFailed = results[2].status === "rejected";

        const fundamentalsFailed = results[0].status === "rejected";

        if (financialFailed && fundamentalsFailed) {
          setFundamentalsError(
            results[2].reason?.response?.data?.message ||
            results[2].reason?.message ||
            results[0].reason?.response?.data?.message ||
            results[0].reason?.message ||
            "Unable to load company financial data.",
          );
        } else if (financialFailed) {
          console.error(
            "Financials failed:",

            results[2].reason?.response?.data ||
            results[2].reason?.message ||
            results[2].reason,
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setFundamentalsLoading(false);

          timeoutId = setTimeout(loadAllStaticData, 15 * 60 * 1000);
        }
      }
    }

    loadAllStaticData();

    return () => {
      controller.abort();

      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isin, financialIdentifier]);

  /* LOAD CHART HISTORY */

  const loadHistory = useCallback(async (key, range, signal, options = {}) => {
    if (!key || signal?.aborted) return;

    const { force = false } = options;
    const requestGeneration = ++historyRequestGenerationRef.current;

    setHistoryLoading(true);

    if (range !== "1D" || (force && !marketOpenRef.current)) {
      setRangeBaseline(null);
    }

    const params = getHistoryParams(range);
    params.to = getIndiaDate();

    if (force && range === "1D") {
      params.refresh = true;
    }

    const minuteBucket = (timestamp) => {
      if (!Number.isFinite(timestamp)) return NaN;
      return Math.floor(timestamp / (60 * 1000)) * (60 * 1000);
    };

    const getPointTimestamp = (point) =>
      parseHistoryTimestamp(
        Array.isArray(point)
          ? point[0]
          : (point?.timestamp ??
            point?.time ??
            point?.date ??
            point?.datetime ??
            point?.dateTime),
      );

    const mergeOfficialWithLive = (officialPoints) => {
      const official = Array.isArray(officialPoints) ? [...officialPoints] : [];
      const officialBuckets = new Set();

      for (const point of official) {
        const timestamp = getPointTimestamp(point);
        const bucket = minuteBucket(timestamp);
        if (Number.isFinite(bucket)) officialBuckets.add(bucket);
      }

      const provisional = provisionalLiveMinutesRef.current;
      const merged = [...official];
      const currentMinute = minuteBucket(Date.now());

      for (const [bucket, livePoint] of provisional.entries()) {
        if (!Number.isFinite(bucket) || !livePoint) continue;

        // REST candles are authoritative for completed minutes. Keep the live
        // WebSocket value only for the current minute; discard stale overlays.
        if (officialBuckets.has(bucket) && bucket !== currentMinute) {
          provisional.delete(bucket);
          continue;
        }

        const existingIndex = merged.findIndex((point) => {
          const timestamp = getPointTimestamp(point);
          return (
            Number.isFinite(timestamp) && minuteBucket(timestamp) === bucket
          );
        });

        if (existingIndex >= 0) merged[existingIndex] = livePoint;
        else merged.push(livePoint);
      }

      merged.sort((a, b) => getPointTimestamp(a) - getPointTimestamp(b));
      return merged;
    };

    try {
      const response = await axios.get(ENDPOINTS.history(key, params), {
        timeout: 20000,
        signal,
      });

      if (
        signal?.aborted ||
        requestGeneration !== historyRequestGenerationRef.current
      ) {
        return;
      }

      const payload = unwrapResponse(response.data) || {};
      const baseline = nullableNumber(
        payload.baselineClose,
        payload.baseline,
        payload.previousClose,
      );

      if (Number.isFinite(baseline)) {
        setRangeBaseline(baseline);
      } else if (range !== "1D") {
        setRangeBaseline(null);
      }

      const normalized = normalizeHistory(response.data, range);

      if (range === "1D") {
        const officialPoints = Array.isArray(normalized) ? normalized : [];
        const openNow = Boolean(marketOpenRef.current);

        // Keep official REST candles separate from live overlays. This is the
        // key accuracy fix: completed minutes are never replaced by arbitrary
        // WebSocket ticks, so the chart stays aligned with official 1-minute
        // OHLC history while the current minute remains live.
        historicalDayHistoryRef.current = officialPoints;

        if (
          !openNow &&
          officialSettlementReadyRef.current &&
          officialPoints.length
        ) {
          const lastPoint = officialPoints[officialPoints.length - 1];
          const officialClose = Array.isArray(lastPoint)
            ? nullableNumber(lastPoint[4], lastPoint[1])
            : nullableNumber(
              lastPoint?.close,
              lastPoint?.c,
              lastPoint?.price,
              lastPoint?.ltp,
            );

          if (officialClose !== null) {
            setSnapshot((previous) => ({
              ...(previous || {}),
              ltp: officialClose,
              price: officialClose,
              dayClose: officialClose,
              marketOpen: false,
              marketStatus: "CLOSED",
              source: "upstox-finalized-intraday",
              officialSettlementReady: true,
            }));
          }
        }

        if (openNow) {
          const merged = mergeOfficialWithLive(officialPoints);
          liveDayHistoryRef.current = merged;
          hasLiveTickRef.current = provisionalLiveMinutesRef.current.size > 0;
          finalHistoryLoadedRef.current = false;
          setHistory(merged);
        } else {
          provisionalLiveMinutesRef.current = new Map();
          liveDayHistoryRef.current = officialPoints;
          hasLiveTickRef.current = false;
          finalHistoryLoadedRef.current = true;
          setHistory(officialPoints);
        }

        return;
      }

      setHistory(Array.isArray(normalized) ? normalized : []);
    } catch (error) {
      if (
        axios.isCancel(error) ||
        error?.code === "ERR_CANCELED" ||
        signal?.aborted
      ) {
        return;
      }

      if (requestGeneration !== historyRequestGenerationRef.current) {
        return;
      }

      console.error("History failed:", error);
    } finally {
      if (
        !signal?.aborted &&
        requestGeneration === historyRequestGenerationRef.current
      ) {
        setHistoryLoading(false);
      }
    }
  }, []);

  /*

   * Non-1D ranges always use the historical API.

   * For 1D:

   * - wait until the real market status is known;

   * - when OPEN, live WebSocket ticks own the chart;

   * - when CLOSED, load the official historical 1D data.

   */

  /*

   * LOAD CHART HISTORY

   *

   * Important:

   * - Non-1D ranges always load historical API data.

   * - 1D waits until market status is known.

   * - If market is OPEN, 1D is owned exclusively by WebSocket ticks.

   * - If market is CLOSED, 1D loads the official finalized history.

   *

   * `marketOpen` is intentionally included in the dependency list.

   * Without it, the first 1D render can happen before market status is

   * known, return early, and never load history until the user changes

   * the chart range manually.

   */

  // useEffect(() => {

  //   if (!instrumentKey) return;

  //   // 1D must wait for the market-status request to finish.

  //   if (chartRange === "1D") {

  //     if (!marketStatusKnownRef.current) {

  //       return;

  //     }

  //     // During market hours, WebSocket ticks exclusively own 1D.

  //     if (marketOpen) {

  //       return;

  //     }

  //   }

  //   const controller = new AbortController();

  //   loadHistory(instrumentKey, chartRange, controller.signal);

  //   return () => {

  //     controller.abort();

  //   };

  // }, [instrumentKey, chartRange, marketOpen, loadHistory]);

  useEffect(() => {
    if (!instrumentKey) return;

    if (chartRange === "1D") {
      if (!marketStatusKnownRef.current) return;

      // Keep the just-finished live/provisional chart visible from 15:30
      // through 15:45. Official history takes over only after settlement.
      if (!marketOpen && !officialSettlementReadyRef.current) return;
    }

    const controller = new AbortController();

    // First 1D load after Search -> Stock bypasses Redis once, preventing a
    // stale intraday cache from producing the old flat/stale chart.
    const forceFreshOpen1D =
      chartRange === "1D" &&
      Boolean(marketOpen) &&
      historicalDayHistoryRef.current.length === 0;

    loadHistory(instrumentKey, chartRange, controller.signal, {
      force: forceFreshOpen1D,
    });

    return () => controller.abort();
  }, [
    instrumentKey,
    chartRange,
    marketOpen,
    officialSettlementReady,
    loadHistory,
  ]);

  const wasMarketOpenRef = useRef(marketOpen);

  useEffect(() => {
    const wasOpen = wasMarketOpenRef.current;
    wasMarketOpenRef.current = marketOpen;

    if (chartRange !== "1D" || !instrumentKey) return;

    // 15:30 only changes market state. Keep the live/provisional chart.
    // At 15:45, officialSettlementReady becomes true and the main history
    // effect replaces it with finalized official candles.
    if (wasOpen && !marketOpen && officialSettlementReadyRef.current) {
      const controller = new AbortController();
      finalHistoryLoadedRef.current = false;
      loadHistory(instrumentKey, "1D", controller.signal, { force: true });
      return () => controller.abort();
    }
  }, [
    marketOpen,
    officialSettlementReady,
    chartRange,
    instrumentKey,
    loadHistory,
  ]);

  /*

   * Poll market status so the 1D chart can hand over to official history at

   * the close even when no websocket status event is emitted.

   */

  useEffect(() => {
    if (!instrumentKey) return;

    let alive = true;

    const pollMarketStatus = async () => {
      try {
        const response = await axios.get(ENDPOINTS.marketStatus(), {
          timeout: 8000,
        });

        if (!alive) return;

        const statusPayload = unwrapResponse(response.data) || {};
        const isOpen = normalizeMarketStatus(statusPayload);
        const settlementReady = Boolean(statusPayload.officialSettlementReady);

        marketStatusKnownRef.current = true;
        marketOpenRef.current = Boolean(isOpen);

        if (isOpen) {
          finalHistoryLoadedRef.current = false;
          officialSettlementReadyRef.current = false;
        } else {
          officialSettlementReadyRef.current = settlementReady;
        }

        setOfficialSettlementReady(Boolean(settlementReady));
        setMarketOpen(Boolean(isOpen));
      } catch (error) {
        if (!alive || axios.isCancel(error) || error?.code === "ERR_CANCELED") {
          return;
        }

        // Keep the last known state on a transient status-poll failure.

        console.warn("Market status poll failed:", error?.message || error);
      }
    };

    pollMarketStatus();

    const intervalId = window.setInterval(pollMarketStatus, 30 * 1000);

    return () => {
      alive = false;

      window.clearInterval(intervalId);
    };
  }, [instrumentKey]);

  /*
   * While the market is open, refresh official 1-minute candles once per
   * minute. This replaces provisional/live minute points with provider OHLC
   * as soon as the completed candle is available, while preserving the
   * current minute's live LTP overlay.
   */

  useEffect(() => {
    if (!instrumentKey || chartRange !== "1D" || !marketOpen) return;

    const refreshOfficial1D = () => {
      const controller = new AbortController();
      loadHistory(instrumentKey, "1D", controller.signal, { force: false });
      window.setTimeout(() => controller.abort(), 25000);
    };

    const intervalId = window.setInterval(refreshOfficial1D, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [instrumentKey, chartRange, marketOpen, loadHistory]);

  /*

   * Reset the 1D live session at midnight in India.

   * Do not fetch historical data here when the market is OPEN; the first

   * WebSocket tick of the new session should start the live chart.

   */

  useEffect(() => {
    if (chartRange !== "1D") return;

    const checkSession = () => {
      const today = getIndiaDate();

      if (chartSessionDateRef.current === today) return;

      chartSessionDateRef.current = today;

      lastLiveTickRef.current = 0;

      pendingLiveTickRef.current = null;

      // Keep the finalized previous-session chart visible until the first
      // valid live tick of the new session arrives. That matches the desired
      // "persist until next tick" behavior.
      liveDayHistoryRef.current = [];
      provisionalLiveMinutesRef.current = new Map();
      liveSessionDateRef.current = "";
      hasLiveTickRef.current = false;

      finalHistoryLoadedRef.current = false;

      setHoverData(null);

      setHistory([]);

      if (!marketOpenRef.current && instrumentKey) {
        const controller = new AbortController();

        loadHistory(instrumentKey, "1D", controller.signal);

        window.setTimeout(() => controller.abort(), 25000);
      }
    };

    checkSession();

    const intervalId = window.setInterval(checkSession, 30 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [chartRange, instrumentKey, loadHistory]);

  /* WEBSOCKET CONNECTION & TICK HANDLING */

  useEffect(() => {
    if (!instrumentKey) return;

    let alive = true;

    let subscribed = false;
    let subscribeRetryTimer = null;
    let subscribeRetryAttempts = 0;

    const generation = ++wsGenerationRef.current;

    lastLiveTickRef.current = 0;

    pendingLiveTickRef.current = null;

    if (liveTickFlushTimerRef.current) {
      window.clearInterval(liveTickFlushTimerRef.current);

      liveTickFlushTimerRef.current = null;
    }

    const isStale = () => !alive || generation !== wsGenerationRef.current;

    const belongsToStock = (data) => {
      if (!data) return false;

      const key = data.instrumentKey || data.instrument_key || data.instrument;

      return !key || key === instrumentKey;
    };

    const commitPendingTick = () => {
      const pending = pendingLiveTickRef.current;

      if (!pending || isStale()) return;

      pendingLiveTickRef.current = null;
      lastLiveTickRef.current = Date.now();

      const { timestamp, price } = pending;
      const today = getIndiaDate();

      if (chartRangeRef.current !== "1D" || finalHistoryLoadedRef.current) {
        return;
      }

      if (
        !Number.isFinite(timestamp) ||
        indiaDateFromTimestamp(timestamp) !== today ||
        !isISTTradingTimestamp(timestamp)
      ) {
        return;
      }

      // The first tick of a new trading day starts a new 1D session.
      // Do not mix yesterday's finalized candles with today's live stream.
      if (liveSessionDateRef.current !== today) {
        liveSessionDateRef.current = today;
        lastLiveTickRef.current = 0;
        pendingLiveTickRef.current = null;
        provisionalLiveMinutesRef.current = new Map();
        hasLiveTickRef.current = false;

        const officialPoints = Array.isArray(historicalDayHistoryRef.current)
          ? historicalDayHistoryRef.current
          : [];
        const hasTodayHistory = officialPoints.some((point) => {
          const ts = parseHistoryTimestamp(
            Array.isArray(point)
              ? point[0]
              : (point?.timestamp ?? point?.time ?? point?.date),
          );
          return Number.isFinite(ts) && indiaDateFromTimestamp(ts) === today;
        });

        if (!hasTodayHistory) {
          historicalDayHistoryRef.current = [];
          liveDayHistoryRef.current = [];
          setHistory([]);

          // Fetch today's official 1-minute candles once, then merge the
          // current live tick on top of them.
          const controller = new AbortController();
          loadHistory(instrumentKey, "1D", controller.signal, { force: true });
          window.setTimeout(() => controller.abort(), 25000);
        }
      }

      const minuteTimestamp = Math.floor(timestamp / (60 * 1000)) * (60 * 1000);

      const minuteTime = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(minuteTimestamp));

      const newPoint = {
        timestamp: minuteTimestamp,
        tickTimestamp: timestamp,
        time: minuteTime,
        price,
        close: price,
      };

      const provisional = provisionalLiveMinutesRef.current;
      const existing = provisional.get(minuteTimestamp);

      if (
        existing &&
        Number.isFinite(Number(existing.tickTimestamp)) &&
        timestamp < Number(existing.tickTimestamp)
      ) {
        return;
      }

      provisional.set(minuteTimestamp, newPoint);
      hasLiveTickRef.current = true;

      const official = Array.isArray(historicalDayHistoryRef.current)
        ? historicalDayHistoryRef.current
        : [];

      const merged = (() => {
        const output = [...official];
        const currentMinute = minuteTimestamp;

        for (const [bucket, livePoint] of provisional.entries()) {
          const isCurrentMinute = bucket === currentMinute;
          const existingIndex = output.findIndex((point) => {
            const ts = parseHistoryTimestamp(
              Array.isArray(point)
                ? point[0]
                : (point?.timestamp ?? point?.time),
            );
            return (
              Number.isFinite(ts) &&
              Math.floor(ts / (60 * 1000)) * (60 * 1000) === bucket
            );
          });

          if (existingIndex >= 0) {
            // For every minute observed through WebSocket, the last tick of
            // that minute is the chart value. Do not replace a completed
            // live bucket with the provider's OHLC close during the session.
            output[existingIndex] = livePoint;
            continue;
          }

          // Upstox history can lag behind the live stream. Keep the last tick
          // for each minute until official end-of-day settlement arrives.
          output.push(livePoint);
        }

        output.sort((a, b) => {
          const ta = parseHistoryTimestamp(
            Array.isArray(a) ? a[0] : (a?.timestamp ?? a?.time),
          );
          const tb = parseHistoryTimestamp(
            Array.isArray(b) ? b[0] : (b?.timestamp ?? b?.time),
          );
          return ta - tb;
        });

        return output;
      })();

      liveDayHistoryRef.current = merged;
      setHistory(merged);
    };

    const applyLiveData = (data) => {
      if (isStale() || !belongsToStock(data)) return;

      setSnapshot((previous) => ({ ...(previous || {}), ...data }));

      if (typeof data.marketOpen === "boolean") {
        marketStatusKnownRef.current = true;

        marketOpenRef.current = data.marketOpen;

        setMarketOpen(data.marketOpen);

        if (data.marketOpen) {
          finalHistoryLoadedRef.current = false;
        }
      }

      const newPrice = nullableNumber(
        data.ltp,

        data.lastPrice,

        data.last_price,
      );

      if (
        newPrice !== null &&
        chartRangeRef.current === "1D" &&
        marketOpenRef.current &&
        !finalHistoryLoadedRef.current
      ) {
        let timestamp = getMarketTimestamp(data);

        if (!Number.isFinite(timestamp) && isISTTradingTimestamp(Date.now())) {
          timestamp = Date.now();
        }

        if (Number.isFinite(timestamp)) {
          const today = getIndiaDate();

          if (
            indiaDateFromTimestamp(timestamp) === today &&
            isISTTradingTimestamp(timestamp)
          ) {
            const minuteBucket = (value) =>
              Math.floor(value / (60 * 1000)) * (60 * 1000);

            const previousPending = pendingLiveTickRef.current;

            if (
              previousPending &&
              Number.isFinite(previousPending.timestamp) &&
              minuteBucket(previousPending.timestamp) < minuteBucket(timestamp)
            ) {
              // Commit the previous minute before moving to the new minute.
              commitPendingTick();
            }

            pendingLiveTickRef.current = { timestamp, price: newPrice };

            const now = Date.now();

            if (
              lastLiveTickRef.current === 0 ||
              now - lastLiveTickRef.current >= LIVE_TICK_THROTTLE_MS
            ) {
              commitPendingTick();
            }
          }
        }
      }

      if (data.fundamentals)
        setFundamentalData((prev) => ({
          ...(prev || {}),

          ...data.fundamentals,
        }));

      if (Array.isArray(data.shareholding))
        setShareholdingData(normalizeShareholding(data.shareholding));

      if (Array.isArray(data.mutualFunds)) setMutualFundData(data.mutualFunds);

      setMarketLoading(false);
    };

    liveTickFlushTimerRef.current = window.setInterval(() => {
      if (!isStale()) commitPendingTick();
    }, LIVE_TICK_THROTTLE_MS);

    const handleSnapshot = applyLiveData;

    const handleTick = applyLiveData;

    const handleMarketStatus = (data) => {
      if (isStale() || !belongsToStock(data)) return;

      if (typeof data.marketOpen !== "boolean") return;

      const isOpen = data.marketOpen;
      const wasOpen = marketOpenRef.current;

      marketStatusKnownRef.current = true;

      if (isOpen) {
        finalHistoryLoadedRef.current = false;
        officialSettlementReadyRef.current = false;
        setOfficialSettlementReady(false);
      } else if (wasOpen) {
        // Flush the last valid in-session tick before freezing the provisional
        // chart while the official closing price is being published.
        // Check the previous status before updating the ref below.
        commitPendingTick();
      }

      marketOpenRef.current = isOpen;
      setMarketOpen(isOpen);

      setSnapshot((prev) => ({
        ...(prev || {}),

        marketOpen: isOpen,

        marketStatus:
          data.marketStatus || data.status || (isOpen ? "OPEN" : "CLOSED"),
      }));
    };

    const scheduleSubscribeRetry = () => {
      if (isStale() || subscribed || subscribeRetryTimer) return;

      const delay = Math.min(
        5000,
        500 * Math.max(1, subscribeRetryAttempts + 1),
      );
      subscribeRetryTimer = window.setTimeout(() => {
        subscribeRetryTimer = null;
        subscribe();
      }, delay);
    };

    const subscribe = () => {
      if (isStale() || subscribed) return;

      if (!detailStockSocket?.connected) {
        scheduleSubscribeRetry();
        return;
      }

      subscribeRetryAttempts += 1;

      detailStockSocket.emit(
        "detailStock:subscribe",

        { instrumentKey, symbol },

        (ack) => {
          if (isStale()) {
            if (ack?.success && detailStockSocket?.connected)
              detailStockSocket.emit("detailStock:unsubscribe", {
                instrumentKey,
              });

            return;
          }

          if (!ack?.success) {
            subscribed = false;

            // The Render central gateway can connect to Detail Stock a moment
            // after the browser socket. Retry the subscription instead of
            // leaving the 1D chart stuck on its initial state until a tab
            // switch/re-render happens.
            scheduleSubscribeRetry();
            return;
          }

          subscribeRetryAttempts = 0;
          subscribed = true;
          setMarketError("");

          if (ack.snapshot) applyLiveData(ack.snapshot);

          if (typeof ack.marketOpen === "boolean") {
            marketStatusKnownRef.current = true;

            marketOpenRef.current = ack.marketOpen;

            if (ack.marketOpen) {
              finalHistoryLoadedRef.current = false;
              officialSettlementReadyRef.current = false;
              setOfficialSettlementReady(false);
            }

            setMarketOpen(ack.marketOpen);
          }
        },
      );
    };

    detailStockSocket?.on("detailStock:snapshot", handleSnapshot);

    detailStockSocket?.on("detailStock:tick", handleTick);

    detailStockSocket?.on("detailStock:market-status", handleMarketStatus);

    const handleSocketConnect = () => {
      if (isStale()) return;

      const isReconnect = socketHasConnectedRef.current;
      socketHasConnectedRef.current = true;

      // Socket.IO reconnects with a fresh server-side connection/room.
      // Allow the subscribe acknowledgement to rejoin the stock room.
      if (isReconnect) {
        subscribed = false;
      }

      subscribe();

      if (
        isReconnect &&
        chartRangeRef.current === "1D" &&
        marketOpenRef.current &&
        instrumentKey
      ) {
        const controller = new AbortController();

        loadHistory(instrumentKey, "1D", controller.signal, { force: false });

        window.setTimeout(() => controller.abort(), 25000);
      }
    };

    detailStockSocket?.on("connect", handleSocketConnect);

    if (detailStockSocket?.connected) {
      handleSocketConnect();
    }

    return () => {
      alive = false;

      if (subscribeRetryTimer) {
        window.clearTimeout(subscribeRetryTimer);
        subscribeRetryTimer = null;
      }

      if (liveTickFlushTimerRef.current)
        window.clearInterval(liveTickFlushTimerRef.current);

      if (detailStockSocket?.connected && subscribed)
        detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });

      detailStockSocket?.off("detailStock:snapshot", handleSnapshot);
      detailStockSocket?.off("detailStock:tick", handleTick);
      detailStockSocket?.off("detailStock:market-status", handleMarketStatus);
      detailStockSocket?.off("connect", handleSocketConnect);
      socketHasConnectedRef.current = false;
    };
  }, [instrumentKey, symbol]);

  /* MARKET DATA EXTRACTORS */

  const ltp = nullableNumber(
    snapshot?.ltp,

    snapshot?.lastPrice,

    snapshot?.last_price,

    snapshot?.price,

    snapshot?.close,

    stockInfo?.ltp,

    stockInfo?.lastPrice,

    stockInfo?.price,

    initialStock?.ltp,

    initialStock?.price,
  );

  const open = nullableNumber(
    snapshot?.open,

    snapshot?.openPrice,

    stockInfo?.open,
  );

  const high = nullableNumber(
    snapshot?.high,

    snapshot?.dayHigh,

    stockInfo?.high,
  );

  const low = nullableNumber(snapshot?.low, snapshot?.dayLow, stockInfo?.low);

  // The live/finalized backend snapshot is authoritative. `stockInfo` can

  // be an older search-card snapshot and may still contain yesterday's

  // pre-settlement value, which would make the Performance section disagree

  // with the chart return.

  const previousClose = nullableNumber(
    snapshot?.previousClose,

    snapshot?.prevClose,

    stockInfo?.previousClose,
  );

  const volume = nullableNumber(
    snapshot?.volume,

    snapshot?.totalVolume,

    stockInfo?.volume,
  );

  const upperCircuit = nullableNumber(
    snapshot?.upperCircuit,

    snapshot?.upperLimit,

    snapshot?.upperCircuitLimit,
  );

  const lowerCircuit = nullableNumber(
    snapshot?.lowerCircuit,

    snapshot?.lowerLimit,

    snapshot?.lowerCircuitLimit,
  );

  function extractWeek52(sources, kind) {
    const keys =
      kind === "low"
        ? [
          "week52Low",

          "week_52_low",

          "yearLow",

          "fiftyTwoWeekLow",

          "fifty_two_week_low",

          "52WeekLow",

          "52_week_low",

          "fiftyTwoWeekLowPrice",
        ]
        : [
          "week52High",

          "week_52_high",

          "yearHigh",

          "fiftyTwoWeekHigh",

          "fifty_two_week_high",

          "52WeekHigh",

          "52_week_high",

          "fiftyTwoWeekHighPrice",
        ];

    for (const source of sources) {
      if (!source || typeof source !== "object") continue;

      for (const key of keys) {
        const val = source[key];

        if (
          val !== null &&
          val !== undefined &&
          val !== "" &&
          Number.isFinite(Number(val))
        )
          return Number(val);
      }
    }

    return null;
  }

  const calculated52WeekLow =
    nullableNumber(week52Data?.low) ??
    extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "low");

  const calculated52WeekHigh =
    nullableNumber(week52Data?.high) ??
    extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "high");

  const bsePrice = nullableNumber(
    snapshot?.bsePrice,

    snapshot?.bseLtp,

    snapshot?.bseLastPrice,

    snapshot?.bse,
  );

  const companyName =
    snapshot?.name ||
    stockInfo?.companyName ||
    stockInfo?.name ||
    symbol ||
    "Stock";

  const exchange = snapshot?.exchange || stockInfo?.exchange || "NSE";

  /* CHART MAPPING & GEOMETRY */

  const lineChartPreparedData = useMemo(() => {
    const source = Array.isArray(history) ? history : [];

    const parsed = source

      .map((item) => {
        let price = null;

        let openPrice = null;

        let rawTimestamp = NaN;

        if (Array.isArray(item)) {
          rawTimestamp = parseHistoryTimestamp(item[0]);

          openPrice = nullableNumber(item[1]);

          price = nullableNumber(item[4], item[1], item[2], item[3]);
        } else if (item && typeof item === "object") {
          rawTimestamp = parseHistoryTimestamp(
            item.timestamp ??
            item.time ??
            item.date ??
            item.datetime ??
            item.dateTime ??
            item.ts ??
            item.epoch ??
            item.t ??
            item.ltt,
          );

          openPrice = nullableNumber(item.open, item.openPrice, item.o);

          price = nullableNumber(
            item.close,

            item.c,

            item.ltp,

            item.lastPrice,

            item.last_price,

            item.price,

            item.open,
          );
        } else if (typeof item === "number" || typeof item === "string") {
          price = nullableNumber(item);
        }

        const dateObj = Number.isFinite(rawTimestamp)
          ? new Date(rawTimestamp)
          : null;

        const timeStr = dateObj
          ? chartRange === "1D" || chartRange === "1W"
            ? new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",

              hour: "2-digit",

              minute: "2-digit",

              hour12: true,
            }).format(dateObj)
            : new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",

              day: "2-digit",

              month: "short",

              year: "numeric",
            }).format(dateObj)
          : "—";

        return {
          price,

          openPrice,

          rawTimestamp,

          time: timeStr,
        };
      })

      .filter(
        (point) =>
          point.price !== null &&
          point.price > 0 &&
          Number.isFinite(point.rawTimestamp),
      )

      .sort((a, b) => a.rawTimestamp - b.rawTimestamp);

    if (chartRange !== "1D") {
      return parsed;
    }

    const baseline = marketOpen
      ? previousClose
      : nullableNumber(rangeBaseline, previousClose);

    // During an open session the line always begins at the previous

    // trading day's official close at exactly 09:15 IST.

    if (marketOpen && baseline !== null) {
      const marketOpenTs = Date.parse(`${getIndiaDate()}T03:45:00.000Z`);

      const livePoints = parsed.filter(
        (point) => point.rawTimestamp >= marketOpenTs,
      );

      if (!livePoints.length) {
        const now = Date.now();

        const displayUntil = Math.max(
          marketOpenTs,

          Math.min(now, marketOpenTs + 375 * 60 * 1000),
        );

        return [
          {
            price: baseline,

            openPrice: baseline,

            rawTimestamp: marketOpenTs,

            time: "09:15 AM",
          },

          {
            price: baseline,

            openPrice: baseline,

            rawTimestamp: displayUntil,

            time: new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",

              hour: "2-digit",

              minute: "2-digit",

              hour12: true,
            }).format(new Date(displayUntil)),
          },
        ];
      }

      return [
        {
          price: baseline,

          openPrice: baseline,

          rawTimestamp: marketOpenTs,

          time: "09:15 AM",
        },

        ...livePoints,
      ];
    }

    // After close/non-trading day, use only the official finalized session

    // returned by the backend. If unavailable, show a baseline-only fallback

    // rather than a stale live buffer.

    if (parsed.length) {
      return parsed;
    }

    if (baseline !== null) {
      const todayStr = getIndiaDate();

      const marketOpenTs = Date.parse(`${todayStr}T03:45:00.000Z`);

      return [
        {
          price: baseline,

          openPrice: baseline,

          rawTimestamp: marketOpenTs,

          time: "09:15 AM",
        },

        {
          price: baseline,

          openPrice: baseline,

          rawTimestamp: marketOpenTs + 375 * 60 * 1000,

          time: "03:30 PM",
        },
      ];
    }

    return [];
  }, [history, previousClose, rangeBaseline, marketOpen, chartRange]);

  const rangeStartPrice = useMemo(() => {
    if (chartRange === "1D") {
      return marketOpen
        ? previousClose
        : nullableNumber(rangeBaseline, previousClose);
    }

    // For non-1D ranges the backend returns the opening price of the first

    // trading candle inside the selected range. This matches the range-return

    // convention used by the stock detail UI.

    return nullableNumber(rangeBaseline);
  }, [chartRange, previousClose, rangeBaseline, marketOpen]);

  const currentDisplayPrice = useMemo(() => {
    const lastChartPrice =
  lineChartPreparedData[lineChartPreparedData.length - 1]?.price ?? null;

    // After market close, use the historical chart endpoint for every range.
    // During market hours, continue using the live LTP.
    if (!marketOpen && lastChartPrice !== null) {
      return lastChartPrice;
    }

    return ltp ?? lastChartPrice ?? null;
  }, [ltp, lineChartPreparedData, marketOpen]);

  const displayChange = useMemo(() => {
    if (currentDisplayPrice !== null && rangeStartPrice !== null) {
      return currentDisplayPrice - rangeStartPrice;
    }

    // For 1D the snapshot also uses the previous trading day's close.

    // Never fall back to daily change for a non-1D range when its real

    // range-start baseline is unavailable.

    return chartRange === "1D"
      ? (snapshot?.change ?? stockInfo?.change_points ?? null)
      : null;
  }, [snapshot, stockInfo, currentDisplayPrice, rangeStartPrice, chartRange]);

  const displayChangePercent = useMemo(() => {
    if (displayChange !== null && rangeStartPrice) {
      return (displayChange / rangeStartPrice) * 100;
    }

    return chartRange === "1D"
      ? (snapshot?.changePercent ?? stockInfo?.change_percent ?? null)
      : null;
  }, [snapshot, stockInfo, displayChange, rangeStartPrice, chartRange]);

  const isPositive = displayChange !== null ? displayChange >= 0 : true;

  const chartColor = isPositive ? "#00b28e" : "#e5484d";

  const getChartX = useCallback(
    (item, index, total) => {
      if (chartRange === "1D")
        return getISTMarketProgress(item?.rawTimestamp) * CHART_WIDTH;

      if (total <= 1) return CHART_WIDTH / 2;

      return (
        CHART_PADDING_X +
        (index / (total - 1)) * (CHART_WIDTH - CHART_PADDING_X * 2)
      );
    },

    [chartRange],
  );

  const lineChartSvg = useMemo(() => {
    const empty = {
      line: "",

      area: "",

      min: 0,

      max: 0,

      baselineY: null,

      lastPoint: null,
    };

    if (!lineChartPreparedData.length) return empty;

    const baseline = rangeStartPrice;

    const allValues = lineChartPreparedData

      .map((d) => d.price)

      .filter((v) => Number.isFinite(v));

    if (Number.isFinite(baseline)) allValues.push(baseline);

    if (!allValues.length) return empty;

    let min = Math.min(...allValues);

    let max = Math.max(...allValues);

    const rawRange = max - min;

    const padding = rawRange > 0 ? rawRange * 0.08 : Math.abs(min) * 0.02 || 1;

    min -= padding;

    max += padding;

    const range = max - min;

    const toY = (v) =>
      CHART_HEIGHT -
      CHART_PADDING_Y -
      ((v - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

    const total = lineChartPreparedData.length;

    const mappedPoints = lineChartPreparedData

      .map((item, index) => ({
        x: getChartX(item, index, total),

        y: toY(item.price),

        price: item.price,

        time: item.time,
      }))

      .filter(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          Number.isFinite(p.price),
      );

    if (!mappedPoints.length) return empty;

    const pathCoords = mappedPoints.map((p) => `${p.x},${p.y}`);

    const lastPoint = mappedPoints[mappedPoints.length - 1];

    const firstPoint = mappedPoints[0];

    const baselineY = Number.isFinite(baseline) ? toY(baseline) : null;

    return {
      line: pathCoords.join(" "),

      area: `M ${pathCoords[0]} L ${pathCoords.join(" L ")} L ${lastPoint.x},${CHART_HEIGHT} L ${firstPoint.x},${CHART_HEIGHT} Z`,

      min,

      max,

      baselineY: Number.isFinite(baselineY) ? baselineY : null,

      lastPoint,
    };
  }, [lineChartPreparedData, rangeStartPrice, getChartX]);

  const handleMouseMove = useCallback(
    (event) => {
      if (!lineChartPreparedData.length) return;

      const rect = event.currentTarget.getBoundingClientRect();

      if (!rect || rect.width <= 0) return;

      const mouseX = Math.max(
        0,

        Math.min(rect.width, event.clientX - rect.left),
      );

      const targetX = (mouseX / rect.width) * CHART_WIDTH;

      const total = lineChartPreparedData.length;

      const { min, max } = lineChartSvg;

      const range = max - min || 1;

      let point = null,
        nearestDistance = Infinity;

      lineChartPreparedData.forEach((candidate, idx) => {
        const candidateX = getChartX(candidate, idx, total);

        if (!Number.isFinite(candidateX)) return;

        const dist = Math.abs(candidateX - targetX);

        if (dist < nearestDistance) {
          nearestDistance = dist;

          point = candidate;
        }
      });

      if (!point || !Number.isFinite(point.price)) return;

      const idx = lineChartPreparedData.indexOf(point);

      const x = getChartX(point, idx, total);

      const y =
        CHART_HEIGHT -
        CHART_PADDING_Y -
        ((point.price - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      const percentX = (x / CHART_WIDTH) * 100;

      setHoverData({
        price: point.price,

        time: point.time,

        x,

        y,

        percentX,

        transformX: percentX < 15 ? "0%" : percentX > 85 ? "-100%" : "-50%",
      });
    },

    [lineChartPreparedData, lineChartSvg, getChartX],
  );

  function getRangePosition(current, lowValue, highValue) {
    if (
      current === null ||
      lowValue === null ||
      highValue === null ||
      highValue <= lowValue
    )
      return "50%";

    return `${Math.max(0, Math.min(100, ((current - lowValue) / (highValue - lowValue)) * 100))}%`;
  }

  const fundamentals = useMemo(() => {
    const data = fundamentalData || snapshot?.fundamentals || {};

    return [
      ["Return on Equity", firstDefined(data.roe)],

      ["Return on Assets", firstDefined(data.roa)],

      ["Return on Capital Employed", firstDefined(data.roce)],

      ["P/E Ratio (TTM)", firstDefined(data.peRatio, data.pe_ratio, data.pe)],

      ["P/B Ratio", firstDefined(data.pbRatio, data.pb_ratio, data.pb)],

      ["EBITDA", firstDefined(data.evEbitda, data.ev_ebitda)],

      ["Earnings Per Share", firstDefined(data.eps, data.epsBasic)],

      ["Revenue (Cr)", firstDefined(data.revenue)],

      [
        "Profit (Cr)",

        firstDefined(data.operatingProfit, data.operating_profit),
      ],

      ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
    ];
  }, [fundamentalData, snapshot]);

  const aboutInfo = useMemo(
    () =>
      normalizeAbout(
        profileData || fundamentalData?.profile || snapshot?.profile,

        fundamentalData,

        snapshot?.symbol || symbol,
      ),

    [profileData, fundamentalData, snapshot, symbol],
  );

  const shareholdingPeriods = useMemo(() => {
    const periodSet = new Set();

    (Array.isArray(shareholdingData) ? shareholdingData : []).forEach(
      (item) => {
        (Array.isArray(item.history) ? item.history : []).forEach((row) => {
          if (row?.period) periodSet.add(row.period);
        });
      },
    );

    const parsePeriod = (p) => {
      const str = String(p).trim().toLowerCase();

      const monthMap = {
        jan: 1,

        feb: 2,

        mar: 3,

        apr: 4,

        may: 5,

        jun: 6,

        jul: 7,

        aug: 8,

        sep: 9,

        oct: 10,

        nov: 11,

        dec: 12,

        q1: 3,

        q2: 6,

        q3: 9,

        q4: 12,
      };

      let month = 0;

      for (const [k, m] of Object.entries(monthMap)) {
        if (str.includes(k)) {
          month = m;

          break;
        }
      }

      let year = 0;

      const yearMatch = str.match(/(19|20)\d{2}/);

      if (yearMatch) year = Number(yearMatch[0]);
      else {
        const digitRuns = str.match(/\d{1,2}/g);

        if (digitRuns?.length)
          year = 2000 + Number(digitRuns[digitRuns.length - 1]);
      }

      return year * 100 + month;
    };

    return Array.from(periodSet).sort(
      (a, b) => parsePeriod(b) - parsePeriod(a),
    );
  }, [shareholdingData]);

  useEffect(() => {
    if (!selectedShareholdingPeriod && shareholdingPeriods.length)
      setSelectedShareholdingPeriod(shareholdingPeriods[0]);
  }, [selectedShareholdingPeriod, shareholdingPeriods]);

  const selectedShareholding = useMemo(() => {
    if (!selectedShareholdingPeriod) return [];

    const idx = shareholdingPeriods.indexOf(selectedShareholdingPeriod);

    const previousPeriod = idx >= 0 ? shareholdingPeriods[idx + 1] : undefined;

    return shareholdingData

      .map((item, index) => {
        const historyRows = Array.isArray(item.history) ? item.history : [];

        const selected = historyRows.find(
          (row) => row.period === selectedShareholdingPeriod,
        );

        if (!selected) return null;

        const previousRow = previousPeriod
          ? historyRows.find((row) => row.period === previousPeriod)
          : null;

        const percentage = numberValue(selected.percentage, 0);

        const previousPercentage = previousRow
          ? numberValue(previousRow.percentage, 0)
          : null;

        return {
          key: `${item.label || "unknown"}-${index}`,

          label: item.label || "Unknown",

          percentage,

          change:
            previousPercentage !== null
              ? percentage - previousPercentage
              : null,
        };
      })

      .filter(Boolean);
  }, [shareholdingData, selectedShareholdingPeriod, shareholdingPeriods]);

  const mutualFunds = useMemo(() => {
    return mutualFundData.map((fund, index) => ({
      name:
        fund.name ||
        fund.fundName ||
        fund.fund_name ||
        fund.fund ||
        `Fund ${index + 1}`,

      percentage: nullableNumber(
        fund.percentage,

        fund.percent,

        fund.aumPercentage,

        fund.aum_percent,

        fund.value,
      ),

      value: fund.marketValue || fund.market_value || fund.value || null,

      logo: fund.logo || fund.icon || "",
    }));
  }, [mutualFundData]);

  const financialRows = useMemo(() => {
    const rows = normalizeFinancialRows(
      financialData ||
      fundamentalData?.incomeStatement ||
      fundamentalData?.income_statement ||
      fundamentalData,
    );

    if (rows?.length) return rows;

    const data = {
      ...(snapshot?.fundamentals || {}),

      ...(financialData && typeof financialData === "object"
        ? financialData
        : {}),
    };

    const period = firstDefined(
      data.period,

      data.quarter,

      data.reportPeriod,

      data.report_period,

      data.revenuePeriod,

      data.revenue_period,

      data.netProfitPeriod,

      data.net_profit_period,

      data.asOf,

      data.as_of,

      data.reportDate,

      data.report_date,
    );

    if (period) {
      const revenue = getFinancialNumber(
        data.revenue,

        data.sales,

        data.totalRevenue,

        data.total_revenue,

        data.income,
      );

      const profit = getFinancialNumber(
        data.netProfit,

        data.net_profit,

        data.profit,

        data.pat,

        data.profitAfterTax,

        data.profit_after_tax,

        data.operatingProfit,

        data.operating_profit,

        data.netIncome,
      );

      if (revenue !== null || profit !== null) {
        return [
          {
            quarter: String(period),

            revenue: revenue ?? 0,

            profit: profit ?? 0,
          },
        ];
      }
    }

    return [];
  }, [financialData, fundamentalData, snapshot]);

  const financialBarData = useMemo(() => {
    const last5 = financialRows.slice(-5);

    return last5.map((item, index, rows) => ({
      ...item,

      active: index === rows.length - 1,
    }));
  }, [financialRows]);

  const maxFinancialValue = useMemo(() => {
    if (!financialBarData.length) return 1;

    const highest = Math.max(
      ...financialBarData.flatMap((r) => [r.revenue, r.profit]),
    );

    return highest > 0 ? highest : 1;
  }, [financialBarData]);

  const effectivePrice =
    numberValue(priceLimit, 0) > 0 ? numberValue(priceLimit) : ltp || 0;

  const approximateRequired = numberValue(quantity) * effectivePrice;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!simulationMarketOpen || !quantity || numberValue(quantity) <= 0)
      return;

    if (!instrumentKey) {
      setOrderMessage("Instrument is missing.");

      return;
    }

    setOrderSubmitting(true);

    setOrderMessage("");

    try {
      const token = localStorage.getItem("token");

      const normalizedQuantity = numberValue(quantity);

      const normalizedOrderType =
        numberValue(priceLimit, 0) > 0 ? "LIMIT" : "MARKET";

      const normalizedLimitPrice =
        normalizedOrderType === "LIMIT" ? numberValue(priceLimit) : null;

      const fingerprint = JSON.stringify({
        instrumentKey,

        transactionType: orderType,

        quantity: normalizedQuantity,

        orderType: normalizedOrderType,

        limitPrice: normalizedLimitPrice,

        product: "CNC",
      });

      if (orderFingerprintRef.current !== fingerprint) {
        orderFingerprintRef.current = fingerprint;

        orderIdempotencyKeyRef.current =
          window.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }

      const idempotencyKey = orderIdempotencyKeyRef.current;

      const isLimitOrder = numberValue(priceLimit, 0) > 0;

      const payload = {
        symbol: snapshot?.symbol || stockInfo?.symbol || symbol,

        instrumentKey,

        transactionType: String(orderType).toUpperCase(),

        quantity: numberValue(quantity),

        orderType: isLimitOrder ? "LIMIT" : "MARKET",

        product: "CNC",
      };

      if (isLimitOrder) {
        payload.limitPrice = numberValue(priceLimit);
      }

      const response = await axios.post(ENDPOINTS.order(), payload, {
        timeout: 10000,

        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),

          "Idempotency-Key": crypto.randomUUID(),
        },
      });

      if (response.data?.success) {
        const result = response.data?.data || {};

        const executedQuantity = Number(result.quantity ?? quantity);

        const executedPrice = Number(result.price ?? effectivePrice);

        setOrderMessage(
          `Success: ${orderType} order completed for ${executedQuantity} shares at ₹${executedPrice.toFixed(2)}.`,
        );

        setQuantity("");

        setPriceLimit("");

        orderIdempotencyKeyRef.current = null;

        orderFingerprintRef.current = "";
      } else {
        setOrderMessage(
          response.data?.message || "Order placement request failed.",
        );
      }
    } catch (err) {
      const code = err?.response?.data?.code;

      if (code === "MARKET_CLOSED") {
        setOrderMessage("Market is closed.");
      } else {
        setOrderMessage(
          err?.response?.data?.message ||
          err?.message ||
          "Failed to place simulated order.",
        );
      }
    } finally {
      setOrderSubmitting(false);
    }
  };

  if (stockLoading && !stockInfo) {
    return (
      <div className="precision-dashboard">
        <main className="precision-main">
          <div className="precision-content">
            <div className="precision-left">
              <section className="stock-card">Loading stock details…</section>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="home" style={{ paddingTop: "1.5rem" }}>
      <div className="precision-dashboard">
        <main className="precision-main">
          <div className="precision-content">
            {/* LEFT MAIN CONTENT */}

            <div className="precision-left">
              <section className="stock-card">
                <StockHeader
                  symbol={snapshot?.symbol || stockInfo?.symbol || symbol}
                  exchange={exchange}
                  companyName={companyName}
                  ltp={ltp}
                  isPositive={isPositive}
                  displayChange={displayChange}
                  displayChangePercent={displayChangePercent}
                  chartRange={chartRange}
                  marketError={marketError}
                  stockError={stockError}
                  isWatchlisted={isWatchlisted}
                  onToggleWatchlist={handleToggleWatchlist}
                />

                <StockChart
                  resetKey={`${instrumentKey}-${chartRange}`}
                  historyLoading={historyLoading}
                  lineChartPreparedData={lineChartPreparedData}
                  marketOpen={marketOpen}
                  hoverData={hoverData}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverData(null)}
                  lineChartSvg={lineChartSvg}
                  chartColor={chartColor}
                  chartRange={chartRange}
                  onRangeChange={setChartRange}
                />
              </section>

              <PerformanceSection
                low={low}
                high={high}
                ltp={ltp}
                calculated52WeekLow={calculated52WeekLow}
                calculated52WeekHigh={calculated52WeekHigh}
                getRangePosition={getRangePosition}
                open={open}
                previousClose={previousClose}
                volume={volume}
                upperCircuit={upperCircuit}
                lowerCircuit={lowerCircuit}
              />

              <FundamentalsSection
                loading={fundamentalsLoading}
                error={fundamentalsError}
                fundamentals={fundamentals}
              />

              <ShareholdingSection
                isin={isin}
                shareholdingPeriods={shareholdingPeriods}
                selectedShareholdingPeriod={selectedShareholdingPeriod}
                setSelectedShareholdingPeriod={setSelectedShareholdingPeriod}
                selectedShareholding={selectedShareholding}
              />

              <FinancialsSection
                isin={isin}
                financialBarData={financialBarData}
                maxFinancialValue={maxFinancialValue}
                getFinancialNumber={getFinancialNumber}
              />

              <AboutSection
                aboutInfo={aboutInfo}
                isAboutExpanded={isAboutExpanded}
                setIsAboutExpanded={setIsAboutExpanded}
              />

              <MutualFundsSection mutualFunds={mutualFunds} />
            </div>

            {/* RIGHT TRADING PANEL */}

            <TradingPanel
              symbol={snapshot?.symbol || stockInfo?.symbol || symbol}
              exchange={exchange}
              ltp={ltp}
              bsePrice={bsePrice}
              isPositive={isPositive}
              displayChangePercent={displayChangePercent}
              orderType={orderType}
              setOrderType={setOrderType}
              handlePlaceOrder={handlePlaceOrder}
              quantity={quantity}
              setQuantity={setQuantity}
              priceLimit={priceLimit}
              setPriceLimit={setPriceLimit}
              approximateRequired={approximateRequired}
              orderMessage={orderMessage}
              marketOpen={simulationMarketOpen}
              orderSubmitting={orderSubmitting}
              numberValue={numberValue}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export { StockDashboard as ShareholdingPattern };
