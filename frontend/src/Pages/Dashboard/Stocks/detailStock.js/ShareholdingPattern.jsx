// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useLocation, useParams } from "react-router-dom";
// import axios from "axios";
// import detailStockSocket from "./detailStockWebSocketConnection";

// /* API CONFIG */
// const DETAIL_API = process.env.REACT_APP_DETAIL_STOCK_API || "http://localhost:3011";
// const STOCK_API = process.env.REACT_APP_STOCK_API || "http://localhost:3001";

// /* FALLBACK SYMBOL TO ISIN MAP */
// const SYMBOL_ISIN_MAP = {
//   RELIANCE: "INE002A01018",
//   PFC: "INE134E01011",
//   TCS: "INE467B01029",
//   INFY: "INE009A01021",
//   HDFCBANK: "INE040A01034",
//   ICICIBANK: "INE090A01021",
//   BHARTIARTL: "INE397D01024",
//   ITC: "INE154A01025",
//   LTIM: "INE214T01019",
//   ADANIPORTS: "INE742F01042",
// };

// const ENDPOINTS = {
//   stock: (symbol) => `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,
//   marketStatus: () => `${DETAIL_API}/api/detail-stock/market-status`,
//   snapshot: (instrumentKey) =>
//     `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(instrumentKey)}`,
//   history: (instrumentKey, params) =>
//     `${DETAIL_API}/api/detail-stock/history/${encodeURIComponent(
//       instrumentKey,
//     )}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(
//       params.interval,
//     )}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(params.to)}`,
//   fundamentals: (isin) =>
//     `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,
//   shareholding: (isin) =>
//     `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(isin)}`,
//   financials: (isin) =>
//     `${DETAIL_API}/api/detail-stock/financial-performance/${encodeURIComponent(isin)}`,
//   mutualFunds: (isin) =>
//     `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(isin)}`,
//   profile: (isin) =>
//     `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(isin)}`,
//   order: () => `${DETAIL_API}/api/detail-stock/order`,
// };

// const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];

// /* CHART GEOMETRY */
// const CHART_WIDTH = 1000;
// const CHART_HEIGHT = 300;
// const CHART_PADDING_X = 10;
// const CHART_PADDING_Y = 20;

// /* Live-tick throttle */
// const LIVE_TICK_THROTTLE_MS = 300;

// /* HELPERS */
// function numberValue(value, fallback = 0) {
//   if (value === null || value === undefined || value === "") return fallback;
//   const n = Number(value);
//   return Number.isFinite(n) ? n : fallback;
// }

// function nullableNumber(...values) {
//   for (const value of values) {
//     if (
//       value !== null &&
//       value !== undefined &&
//       value !== "" &&
//       Number.isFinite(Number(value))
//     ) {
//       return Number(value);
//     }
//   }
//   return null;
// }

// function firstDefined(...values) {
//   for (const value of values) {
//     if (value !== undefined && value !== null && value !== "") {
//       return value;
//     }
//   }
//   return null;
// }

// function formatNumber(value, digits = 2) {
//   if (value === null || value === undefined || value === "") return "—";
//   const n = Number(value);
//   if (!Number.isFinite(n)) return String(value);
//   return n.toLocaleString("en-IN", {
//     minimumFractionDigits: digits,
//     maximumFractionDigits: digits,
//   });
// }

// function formatCurrency(value) {
//   if (value === null || value === undefined || value === "") return "—";
//   const n = Number(value);
//   if (!Number.isFinite(n)) return "—";
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(n);
// }

// function formatCompact(value) {
//   if (value === null || value === undefined || value === "") return "—";
//   const n = Number(value);
//   if (!Number.isFinite(n)) return String(value);
//   return n.toLocaleString("en-IN");
// }

// function formatPercent(value) {
//   if (value === null || value === undefined || value === "") return "—";
//   const n = Number(value);
//   if (!Number.isFinite(n)) return String(value);
//   return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
// }

// function getIndiaDate() {
//   return new Intl.DateTimeFormat("en-CA", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//   }).format(new Date());
// }

// function getDateDaysAgo(days) {
//   const date = new Date();
//   date.setDate(date.getDate() - days);
//   return date.toISOString().slice(0, 10);
// }

// function getHistoryParams(range) {
//   switch (range) {
//     case "1D":
//       return { unit: "minutes", interval: "1", from: getDateDaysAgo(7) };
//     case "1W":
//       return { unit: "minutes", interval: "5", from: getDateDaysAgo(7) };
//     case "1M":
//       return { unit: "days", interval: "1", from: getDateDaysAgo(31) };
//     case "3M":
//       return { unit: "days", interval: "1", from: getDateDaysAgo(92) };
//     case "6M":
//       return { unit: "days", interval: "1", from: getDateDaysAgo(183) };
//     case "1Y":
//       return { unit: "days", interval: "1", from: getDateDaysAgo(365) };
//     case "3Y":
//       return { unit: "weeks", interval: "1", from: getDateDaysAgo(1095) };
//     case "5Y":
//       return { unit: "weeks", interval: "1", from: getDateDaysAgo(1825) };
//     case "All":
//       return { unit: "months", interval: "1", from: "2000-01-01" };
//     default:
//       return { unit: "minutes", interval: "1", from: getDateDaysAgo(7) };
//   }
// }

// function parseHistoryTimestamp(value) {
//   if (value === null || value === undefined || value === "") return NaN;
//   const numeric = Number(value);
//   if (Number.isFinite(numeric)) {
//     if (numeric < 1e11) return numeric * 1000;
//     if (numeric < 1e14) return numeric;
//     if (numeric < 1e17) return numeric / 1000;
//     return numeric / 1000000;
//   }
//   const parsed = Date.parse(String(value));
//   return Number.isFinite(parsed) ? parsed : NaN;
// }

// function indiaDateFromTimestamp(value) {
//   const timestamp = parseHistoryTimestamp(value);
//   if (!Number.isFinite(timestamp)) return "";
//   return new Intl.DateTimeFormat("en-CA", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//   }).format(new Date(timestamp));
// }

// function getIndiaTimeParts(value = Date.now()) {
//   const timestamp = parseHistoryTimestamp(value);
//   if (!Number.isFinite(timestamp)) return null;
//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hourCycle: "h23",
//   }).formatToParts(new Date(timestamp));
//   const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
//   return {
//     date: `${values.year}-${values.month}-${values.day}`,
//     minutes: Number(values.hour) * 60 + Number(values.minute) + Number(values.second) / 60,
//   };
// }

// function isISTTradingTimestamp(value) {
//   const parts = getIndiaTimeParts(value);
//   if (!parts) return false;
//   return parts.minutes >= 9 * 60 + 15 && parts.minutes <= 15 * 60 + 30;
// }

// function getMarketTimestamp(data) {
//   if (!data) return NaN;
//   return parseHistoryTimestamp(
//     data.timestamp ??
//     data.time ??
//     data.lastTradeTime ??
//     data.last_trade_time ??
//     data.tradeTime ??
//     data.trade_time ??
//     data.t ??
//     data.ltt,
//   );
// }

// function getISTMarketProgress(rawTime) {
//   const ts = parseHistoryTimestamp(rawTime);
//   if (!Number.isFinite(ts)) return 0;

//   const parts = getIndiaTimeParts(ts);
//   if (!parts) return 0;

//   const marketOpenMinutes = 9 * 60 + 15;
//   const marketCloseMinutes = 15 * 60 + 30;
//   const progress = (parts.minutes - marketOpenMinutes) / (marketCloseMinutes - marketOpenMinutes);
//   return Math.max(0, Math.min(1, progress));
// }

// function unwrapResponse(json) {
//   if (!json) return null;
//   if (json.data !== undefined) return unwrapResponse(json.data);
//   if (json.result !== undefined) return unwrapResponse(json.result);
//   if (json.payload !== undefined) return unwrapResponse(json.payload);
//   return json;
// }

// function getArray(...values) {
//   for (const value of values) {
//     if (Array.isArray(value)) return value;
//   }
//   return [];
// }

// function normalizeStock(json, fallbackSymbol) {
//   const data = unwrapResponse(json) || {};
//   return {
//     ...data,
//     symbol: data.symbol || data.tradingSymbol || data.trading_symbol || fallbackSymbol,
//     companyName: data.companyName || data.company_name || data.name || fallbackSymbol,
//     name: data.name || data.companyName || data.company_name || fallbackSymbol,
//     exchange: data.exchange || data.exchangeName || data.exchange_name || "NSE",
//     instrumentKey: data.instrumentKey || data.instrument_key || data.instrumentkey || data.instrument,
//     isin: data.isin || data.ISIN || data.isin_code || data.isinCode,
//   };
// }

// function normalizeFundamentals(json) {
//   const data = unwrapResponse(json) || {};
//   if (data && typeof data === "object" && !Array.isArray(data)) {
//     return {
//       ...data,
//       ...(data.fundamentals && typeof data.fundamentals === "object" ? data.fundamentals : {}),
//     };
//   }
//   return data;
// }

// function normalizeShareholding(json) {
//   const data = unwrapResponse(json) || {};

//   const list = getArray(
//     data.shareholding,
//     data.shareholdingPattern,
//     data.shareholding_pattern,
//     data.holdings,
//     data.data,
//     Array.isArray(data) ? data : null,
//   );

//   if (list.length > 0) {
//     return list.map((item) => {
//       const label = item.category || item.label || item.name || item.type || "Other";

//       if (Array.isArray(item.history)) {
//         return {
//           label,
//           history: item.history.map((h) => ({
//             period: h.period || h.quarter || h.date || h.quarterName || h.label || h.year || "",
//             percentage: numberValue(h.percentage ?? h.percent ?? h.value ?? h.holding, 0),
//           })),
//         };
//       }

//       const period = item.period || item.quarter || item.date || item.quarterName || item.label || item.year || "";
//       return {
//         label,
//         history: period
//           ? [
//             {
//               period,
//               percentage: numberValue(item.percentage ?? item.percent ?? item.value, 0),
//             },
//           ]
//           : [],
//       };
//     });
//   }

//   if (data && typeof data === "object" && !Array.isArray(data)) {
//     const categoryMap = {};

//     Object.entries(data).forEach(([period, holdings]) => {
//       if (holdings && typeof holdings === "object" && !Array.isArray(holdings)) {
//         Object.entries(holdings).forEach(([category, val]) => {
//           if (!categoryMap[category]) categoryMap[category] = [];
//           categoryMap[category].push({
//             period,
//             percentage: numberValue(val, 0),
//           });
//         });
//       }
//     });

//     return Object.entries(categoryMap).map(([label, history]) => ({
//       label,
//       history,
//     }));
//   }

//   return [];
// }

// function normalizeMutualFunds(json) {
//   const data = unwrapResponse(json) || {};
//   return getArray(
//     data.mutualFunds,
//     data.mutual_funds,
//     data.mutualFundHoldings,
//     data.mfHoldings,
//     data.data,
//     Array.isArray(data) ? data : null,
//   );
// }

// function getFinancialNumber(...values) {
//   for (const value of values) {
//     if (value === null || value === undefined || value === "") continue;
//     if (typeof value === "number") return Number.isFinite(value) ? value : null;

//     const cleaned = String(value)
//       .replace(/,/g, "")
//       .replace(/₹/g, "")
//       .replace(/%/g, "")
//       .trim();
//     const match = cleaned.match(/[-+]?\d*\.?\d+/);
//     if (match) {
//       const num = Number(match[0]);
//       if (Number.isFinite(num)) return num;
//     }
//   }
//   return null;
// }

// function sortFinancialRowsChronologically(rows) {
//   const parsePeriod = (p) => {
//     if (!p) return 0;
//     const str = String(p).trim();
//     const yearMatch = str.match(/(20\d\d|\b\d\d\b)/);
//     const year = yearMatch
//       ? yearMatch[0].length === 2
//         ? Number("20" + yearMatch[0])
//         : Number(yearMatch[0])
//       : 0;

//     const monthMap = {
//       jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
//       jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
//       q1: 3, q2: 6, q3: 9, q4: 12,
//     };
//     let month = 0;
//     for (const [key, m] of Object.entries(monthMap)) {
//       if (str.toLowerCase().includes(key)) {
//         month = m;
//         break;
//       }
//     }
//     return year * 100 + month;
//   };

//   return [...rows].sort((a, b) => {
//     const scoreA = parsePeriod(a.quarter);
//     const scoreB = parsePeriod(b.quarter);
//     if (scoreA !== scoreB) return scoreA - scoreB;
//     return String(a.quarter).localeCompare(String(b.quarter), undefined, { numeric: true });
//   });
// }

// function normalizeFinancialRows(source) {
//   if (!source) return [];

//   let raw = unwrapResponse(source) || source;
//   if (raw && typeof raw === "object") {
//     if (raw.financials) raw = raw.financials;
//     if (raw.financialPerformance) raw = raw.financialPerformance;
//     if (raw.financial_performance) raw = raw.financial_performance;
//   }

//   let statement = raw?.incomeStatement || raw?.income_statement || raw?.statement || raw;
//   if (statement && typeof statement === "object" && !Array.isArray(statement)) {
//     if (statement.incomeStatement) statement = statement.incomeStatement;
//     else if (statement.income_statement) statement = statement.income_statement;
//   }

//   const categoryList = getArray(
//     statement?.income_statement,
//     statement?.incomeStatement,
//     statement?.categories,
//     statement?.full_statement,
//     Array.isArray(statement) ? statement : null,
//   );

//   if (
//     categoryList.length > 0 &&
//     categoryList.some(
//       (item) => item && Array.isArray(item.history || item.values || item.data),
//     )
//   ) {
//     const periodMap = {};

//     for (const catObj of categoryList) {
//       if (!catObj) continue;
//       const historyArr = getArray(catObj.history, catObj.values, catObj.data);
//       if (!historyArr.length) continue;

//       const catName = String(catObj.category || catObj.particular || catObj.name || "").toLowerCase();
//       const isRevenue = /revenue|sales|income|turnover|earned/i.test(catName);
//       const isNetProfit = /net_profit|net profit|pat|profit after tax|net income|net_income/i.test(catName);
//       const isOperatingProfit = /operating_profit|operating profit|ebitda|ebit/i.test(catName);
//       const isGeneralProfit = /profit/i.test(catName);

//       if (!isRevenue && !isNetProfit && !isOperatingProfit && !isGeneralProfit) continue;

//       for (const point of historyArr) {
//         if (!point || typeof point !== "object") continue;
//         const period = String(
//           point.period || point.quarter || point.quarterName || point.quarter_name || point.date || point.year || point.label || "",
//         ).trim();
//         if (!period) continue;

//         if (!periodMap[period]) {
//           periodMap[period] = { quarter: period, revenue: null, profit: null, profitPriority: 0 };
//         }

//         const val = getFinancialNumber(point.value, point.amount, point.val);
//         if (val !== null) {
//           if (isRevenue && periodMap[period].revenue === null) {
//             periodMap[period].revenue = val;
//           }

//           let priority = 0;
//           if (isNetProfit) priority = 3;
//           else if (isOperatingProfit) priority = 2;
//           else if (isGeneralProfit) priority = 1;

//           if (priority > periodMap[period].profitPriority) {
//             periodMap[period].profit = val;
//             periodMap[period].profitPriority = priority;
//           }
//         }
//       }
//     }

//     const rows = Object.values(periodMap)
//       .filter((row) => row.revenue !== null || row.profit !== null)
//       .map((row) => ({
//         quarter: row.quarter,
//         revenue: row.revenue ?? 0,
//         profit: row.profit ?? 0,
//       }));

//     if (rows.length > 0) {
//       return sortFinancialRowsChronologically(rows);
//     }
//   }

//   const arrayCandidates = [];
//   function collectArrays(obj, depth = 0) {
//     if (!obj || typeof obj !== "object" || depth > 3) return;
//     if (Array.isArray(obj)) {
//       arrayCandidates.push(obj);
//       return;
//     }
//     for (const k of Object.keys(obj)) {
//       if (Array.isArray(obj[k])) {
//         arrayCandidates.push(obj[k]);
//       } else if (typeof obj[k] === "object" && obj[k] !== null) {
//         collectArrays(obj[k], depth + 1);
//       }
//     }
//   }

//   collectArrays(raw);

//   for (const candidate of arrayCandidates) {
//     if (!Array.isArray(candidate) || !candidate.length) continue;

//     const rows = candidate
//       .map((row) => {
//         if (!row || typeof row !== "object") return null;

//         const period = String(
//           row.quarter || row.period || row.date || row.year || row.label || row.quarterName || row.quarter_name || "",
//         ).trim();

//         if (!period) return null;

//         const revenue = getFinancialNumber(row.revenue, row.totalRevenue, row.total_revenue, row.sales, row.income, row.totalIncome, row.total_income);
//         const profit = getFinancialNumber(row.profit, row.netProfit, row.net_profit, row.pat, row.profitAfterTax, row.profit_after_tax, row.netIncome, row.operatingProfit);

//         if (revenue === null && profit === null) return null;

//         return { quarter: period, revenue: revenue ?? 0, profit: profit ?? 0 };
//       })
//       .filter(Boolean);

//     if (rows.length > 0) {
//       return sortFinancialRowsChronologically(rows);
//     }
//   }

//   return [];
// }

// function normalizeHistory(json, range = "1D") {
//   const data = unwrapResponse(json);
//   let rows = [];

//   if (Array.isArray(data)) rows = data;
//   else if (Array.isArray(data?.candles)) rows = data.candles;
//   else if (Array.isArray(data?.history)) rows = data.history;
//   else if (Array.isArray(data?.prices)) rows = data.prices;
//   else if (Array.isArray(data?.data)) rows = data.data;

//   if (!rows.length) return [];

//   const withTimestamps = rows
//     .map((row) => {
//       const rawTime = Array.isArray(row)
//         ? row[0]
//         : row?.timestamp ??
//         row?.time ??
//         row?.date ??
//         row?.datetime ??
//         row?.dateTime ??
//         row?.ts ??
//         row?.epoch ??
//         row?.t ??
//         row?.ltt;
//       return {
//         row,
//         timestamp: parseHistoryTimestamp(rawTime),
//         session: indiaDateFromTimestamp(rawTime),
//       };
//     })
//     .filter((item) => Number.isFinite(item.timestamp));

//   if (range === "1D") {
//     const today = getIndiaDate();
//     const todayRows = withTimestamps
//       .filter(
//         (item) =>
//           item.session === today && isISTTradingTimestamp(item.timestamp),
//       )
//       .sort((a, b) => a.timestamp - b.timestamp);

//     if (todayRows.length) return todayRows.map((item) => item.row);

//     const sessions = new Map();
//     withTimestamps.forEach((item) => {
//       if (!isISTTradingTimestamp(item.timestamp)) return;
//       if (!sessions.has(item.session)) sessions.set(item.session, []);
//       sessions.get(item.session).push(item);
//     });

//     const latestSession = [...sessions.keys()].sort().pop();
//     return latestSession
//       ? sessions
//         .get(latestSession)
//         .sort((a, b) => a.timestamp - b.timestamp)
//         .map((item) => item.row)
//       : [];
//   }

//   return withTimestamps
//     .sort((a, b) => a.timestamp - b.timestamp)
//     .map((item) => item.row);
// }

// function normalizeMarketStatus(json) {
//   const data = unwrapResponse(json) || {};
//   if (typeof data === "boolean") return data;
//   if (typeof data.marketOpen === "boolean") return data.marketOpen;
//   if (typeof data.isOpen === "boolean") return data.isOpen;
//   if (typeof data.open === "boolean") return data.open;

//   const status = String(
//     data.marketStatus || data.status || data.market_status || "",
//   ).toLowerCase();
//   if (status === "open" || status === "market_open" || status === "live")
//     return true;
//   if (status === "closed" || status === "market_closed") return false;

//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "Asia/Kolkata",
//     hour: "2-digit",
//     minute: "2-digit",
//     hourCycle: "h23",
//   })
//     .format(new Date())
//     .split(":");

//   const hour = Number(parts[0]);
//   const minute = Number(parts[1]);
//   const totalMinutes = hour * 60 + minute;

//   return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
// }

// function normalizeAbout(profile, fundamentals, fallbackSymbol) {
//   const p = profile || {};
//   const f = fundamentals || {};

//   return {
//     description:
//       p.company_profile ||
//       p.description ||
//       p.about ||
//       p.business_description ||
//       p.businessDescription ||
//       f.about ||
//       f.description ||
//       "Company profile information is not available from the backend.",
//     sector: p.sector || f.sector || "N/A",
//     sectorMarketCapInr: p.sector_market_cap_inr || null,
//     sectorMarketCapUsd: p.sector_market_cap_usd || null,
//     ceo: p.ceo || p.ceo_name || p.ceoName || p.management?.ceo || "N/A",
//     founded:
//       p.foundedIn || p.founded_in || p.founded || p.incorporation_date || "N/A",
//     nseSymbol:
//       p.nseSymbol || p.nse_symbol || p.symbol || fallbackSymbol || "N/A",
//   };
// }

// /* ERROR BOUNDARY */
// class ErrorBoundary extends React.Component {
//   constructor(props) {
//     super(props);
//     this.state = { hasError: false };
//   }

//   static getDerivedStateFromError() {
//     return { hasError: true };
//   }

//   componentDidCatch(error, info) {
//     console.error("Section crashed:", error, info);
//   }

//   componentDidUpdate(prevProps) {
//     if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
//       this.setState({ hasError: false });
//     }
//   }

//   render() {
//     if (this.state.hasError) {
//       return (
//         this.props.fallback || (
//           <div style={{ padding: "1rem", color: "#64748b" }}>
//             This section couldn't be displayed right now.
//           </div>
//         )
//       );
//     }
//     return this.props.children;
//   }
// }

// /* MAIN DASHBOARD COMPONENT */
// export default function StockDashboard({ instrumentKey: propInstrumentKey, isin: propIsin }) {
//   const { symbol: routeSymbol } = useParams();
//   const location = useLocation();
//   const initialStock = location.state || null;
//   const symbol = routeSymbol || initialStock?.symbol || initialStock?.tradingSymbol || "";

//   /* STATE */
//   const [stockInfo, setStockInfo] = useState(initialStock);
//   const [snapshot, setSnapshot] = useState(null);
//   const [marketOpen, setMarketOpen] = useState(false);
//   const [marketLoading, setMarketLoading] = useState(true);
//   const [marketError, setMarketError] = useState("");
//   const [stockLoading, setStockLoading] = useState(true);
//   const [stockError, setStockError] = useState("");
//   const [history, setHistory] = useState([]);
//   const [chartRange, setChartRange] = useState("1D");
//   const chartSessionDateRef = useRef(getIndiaDate());
//   const lastLiveTickRef = useRef(0);
//   const pendingLiveTickRef = useRef(null);
//   const liveTickFlushTimerRef = useRef(null);
//   const wsGenerationRef = useRef(0);
//   const [historyLoading, setHistoryLoading] = useState(false);
//   const [fundamentalData, setFundamentalData] = useState(null);
//   const [shareholdingData, setShareholdingData] = useState([]);
//   const [mutualFundData, setMutualFundData] = useState([]);
//   const [financialData, setFinancialData] = useState(null);
//   const [profileData, setProfileData] = useState(null);
//   const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
//   const [fundamentalsError, setFundamentalsError] = useState("");
//   const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] = useState("");
//   const [hoverData, setHoverData] = useState(null);
//   const [isAboutExpanded, setIsAboutExpanded] = useState(false);
//   const [orderType, setOrderType] = useState("BUY");
//   const [quantity, setQuantity] = useState("");
//   const [priceLimit, setPriceLimit] = useState("");
//   const [isWatchlisted, setIsWatchlisted] = useState(false);
//   const [orderSubmitting, setOrderSubmitting] = useState(false);
//   const [orderMessage, setOrderMessage] = useState("");

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
//         console.error("Stock details failed:", error);
//         setStockError(
//           error?.response?.data?.message ||
//           error?.message ||
//           "Failed to load stock details.",
//         );
//       } finally {
//         if (!controller.signal.aborted) setStockLoading(false);
//       }
//     }

//     loadStock();
//     return () => {
//       controller.abort();
//     };
//   }, [symbol]);

//   const instrumentKey =
//     propInstrumentKey ||
//     stockInfo?.instrumentKey ||
//     stockInfo?.instrument_key ||
//     initialStock?.instrumentKey ||
//     initialStock?.instrument_key ||
//     "";

//   const isin =
//     propIsin ||
//     stockInfo?.isin ||
//     stockInfo?.ISIN ||
//     initialStock?.isin ||
//     initialStock?.ISIN ||
//     SYMBOL_ISIN_MAP[symbol?.toUpperCase()] ||
//     "";

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
//         isOpen = normalizeMarketStatus(statusResult.value.data);
//       }

//       if (snapshotResult.status === "fulfilled") {
//         initialSnapshot = unwrapResponse(snapshotResult.value.data);
//         if (typeof initialSnapshot?.marketOpen === "boolean") {
//           isOpen = initialSnapshot.marketOpen;
//         }
//       }

//       if (isOpen === null) isOpen = normalizeMarketStatus({});

//       setMarketOpen(Boolean(isOpen));
//       if (initialSnapshot) setSnapshot(initialSnapshot);
//     } catch (error) {
//       if (
//         axios.isCancel(error) ||
//         error?.code === "ERR_CANCELED" ||
//         signal.aborted
//       )
//         return;
//       console.error("Market data failed:", error);
//       setMarketError(
//         error?.response?.data?.message ||
//         error?.message ||
//         "Unable to load market data.",
//       );
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
//     return () => {
//       controller.abort();
//     };
//   }, [instrumentKey, loadMarketData]);

//   /* LOAD STATIC DATA VIA ISIN */
//   useEffect(() => {
//     if (!isin) {
//       setFundamentalsLoading(false);
//       return;
//     }

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
//       setFundamentalsLoading(true);
//       setFundamentalsError("");

//       try {
//         const results = await Promise.allSettled([
//           requestJson(ENDPOINTS.fundamentals(isin)),
//           requestJson(ENDPOINTS.shareholding(isin)),
//           requestJson(ENDPOINTS.financials(isin)),
//           requestJson(ENDPOINTS.mutualFunds(isin)),
//           requestJson(ENDPOINTS.profile(isin)),
//         ]);

//         if (controller.signal.aborted) return;

//         if (results[0].status === "fulfilled") {
//           const data = normalizeFundamentals(results[0].value);
//           setFundamentalData(data);

//           const combinedShareholding = normalizeShareholding(results[0].value);
//           const combinedMF = normalizeMutualFunds(results[0].value);

//           if (combinedShareholding.length) setShareholdingData(combinedShareholding);
//           if (combinedMF.length) setMutualFundData(combinedMF);
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

//         if (
//           results[0].status === "rejected" &&
//           results[2].status === "rejected"
//         ) {
//           setFundamentalsError(
//             results[0].reason?.response?.data?.message ||
//             results[0].reason?.message ||
//             "Unable to load static company data.",
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
//   }, [isin]);

//   /* LOAD CHART HISTORY */
//   const loadHistory = useCallback(
//     async (key, range, signal) => {
//       if (!key) return;
//       setHistoryLoading(true);
//       const params = getHistoryParams(range);
//       params.to = getIndiaDate();

//       try {
//         const response = await axios.get(ENDPOINTS.history(key, params), {
//           timeout: 20000,
//           signal,
//         });
//         if (!signal.aborted) {
//           setHistory(normalizeHistory(response.data, range));
//         }
//       } catch (error) {
//         if (axios.isCancel(error) || error?.code === "ERR_CANCELED" || signal.aborted)
//           return;
//         console.error("History failed:", error);
//       } finally {
//         if (!signal.aborted) setHistoryLoading(false);
//       }
//     },
//     [],
//   );

//   useEffect(() => {
//     if (!instrumentKey) return;
//     const controller = new AbortController();
//     loadHistory(instrumentKey, chartRange, controller.signal);
//     return () => {
//       controller.abort();
//     };
//   }, [instrumentKey, chartRange, loadHistory]);

//   /* ON MARKET CLOSE, REFETCH 1D CANDLES */
//   const wasMarketOpenRef = React.useRef(marketOpen);
//   useEffect(() => {
//     const wasOpen = wasMarketOpenRef.current;
//     wasMarketOpenRef.current = marketOpen;

//     if (wasOpen && !marketOpen && chartRange === "1D" && instrumentKey) {
//       const controller = new AbortController();
//       loadHistory(instrumentKey, "1D", controller.signal);
//       return () => controller.abort();
//     }
//     return undefined;
//   }, [marketOpen, chartRange, instrumentKey, loadHistory]);

//   /* RESET 1D STATE WHEN IST SESSION CHANGES */
//   useEffect(() => {
//     if (chartRange !== "1D") return undefined;

//     let activeController = null;

//     const checkSession = () => {
//       const today = getIndiaDate();
//       if (chartSessionDateRef.current !== today) {
//         chartSessionDateRef.current = today;
//         lastLiveTickRef.current = 0;
//         pendingLiveTickRef.current = null;
//         setHoverData(null);

//         if (instrumentKey) {
//           if (activeController) activeController.abort();
//           activeController = new AbortController();
//           loadHistory(instrumentKey, "1D", activeController.signal);
//         }
//       }
//     };

//     checkSession();
//     const intervalId = window.setInterval(checkSession, 30 * 1000);
//     return () => {
//       window.clearInterval(intervalId);
//       if (activeController) activeController.abort();
//     };
//   }, [chartRange, instrumentKey, loadHistory]);

//   const chartRangeRef = useRef(chartRange);
//   useEffect(() => {
//     chartRangeRef.current = chartRange;
//   }, [chartRange]);

//   /* WEBSOCKET CONNECTION & REAL-TIME TICK HANDLING */
//   useEffect(() => {
//     if (!instrumentKey) return undefined;

//     let alive = true;
//     let subscribed = false;
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

//       setHistory((prevHistory) => {
//         const safeHistory = Array.isArray(prevHistory) ? prevHistory : [];
//         const newPoint = {
//           timestamp,
//           time: new Intl.DateTimeFormat("en-IN", {
//             timeZone: "Asia/Kolkata",
//             hour: "2-digit",
//             minute: "2-digit",
//             hour12: true,
//           }).format(new Date(timestamp)),
//           price,
//           close: price,
//         };

//         const sessionHistory = safeHistory
//           .map((point) => {
//             const pointTimestamp = parseHistoryTimestamp(
//               Array.isArray(point) ? point[0] : point?.timestamp ?? point?.time,
//             );
//             return { point, pointTimestamp };
//           })
//           .filter(
//             ({ pointTimestamp }) =>
//               Number.isFinite(pointTimestamp) &&
//               indiaDateFromTimestamp(pointTimestamp) === today &&
//               isISTTradingTimestamp(pointTimestamp),
//           )
//           .sort((a, b) => a.pointTimestamp - b.pointTimestamp)
//           .map(({ point }) => point);

//         if (!sessionHistory.length) return [newPoint];

//         const lastPoint = sessionHistory[sessionHistory.length - 1];
//         const lastTs = parseHistoryTimestamp(
//           Array.isArray(lastPoint)
//             ? lastPoint[0]
//             : lastPoint?.timestamp ?? lastPoint?.time,
//         );

//         if (Number.isFinite(lastTs) && timestamp < lastTs) return sessionHistory;

//         if (Number.isFinite(lastTs) && Math.abs(timestamp - lastTs) < 60000) {
//           return [...sessionHistory.slice(0, -1), newPoint];
//         }

//         return [...sessionHistory, newPoint];
//       });
//     };

//     const applyLiveData = (data) => {
//       if (isStale() || !belongsToStock(data)) return;

//       setSnapshot((previous) => ({ ...(previous || {}), ...data }));

//       const newPrice = nullableNumber(data.ltp, data.lastPrice, data.last_price);
//       if (newPrice !== null && chartRangeRef.current === "1D") {
//         let timestamp = getMarketTimestamp(data);
//         if (!Number.isFinite(timestamp) && isISTTradingTimestamp(Date.now())) {
//           timestamp = Date.now();
//         }

//         if (Number.isFinite(timestamp)) {
//           const today = getIndiaDate();
//           const tickSession = indiaDateFromTimestamp(timestamp);

//           if (tickSession === today && isISTTradingTimestamp(timestamp)) {
//             pendingLiveTickRef.current = { timestamp, price: newPrice };

//             const now = Date.now();
//             if (lastLiveTickRef.current === 0 || now - lastLiveTickRef.current >= LIVE_TICK_THROTTLE_MS) {
//               commitPendingTick();
//             }
//           }
//         }
//       }

//       if (typeof data.marketOpen === "boolean") setMarketOpen(data.marketOpen);
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
//       if (isStale()) return;
//       commitPendingTick();
//     }, LIVE_TICK_THROTTLE_MS);

//     const handleSnapshot = applyLiveData;
//     const handleTick = applyLiveData;

//     const handleMarketStatus = (data) => {
//       if (isStale() || !belongsToStock(data)) return;
//       if (typeof data.marketOpen === "boolean") setMarketOpen(data.marketOpen);

//       setSnapshot((previous) => ({
//         ...(previous || {}),
//         marketOpen: data.marketOpen,
//         marketStatus:
//           data.marketStatus ||
//           data.status ||
//           (data.marketOpen ? "OPEN" : "CLOSED"),
//       }));
//     };

//     const subscribe = () => {
//       if (isStale() || subscribed || !detailStockSocket?.connected) return;

//       detailStockSocket.emit(
//         "detailStock:subscribe",
//         { instrumentKey, symbol },
//         (ack) => {
//           if (isStale()) {
//             if (ack?.success && detailStockSocket?.connected) {
//               detailStockSocket.emit("detailStock:unsubscribe", {
//                 instrumentKey,
//               });
//             }
//             return;
//           }
//           if (!ack?.success) {
//             subscribed = false;
//             setMarketError(
//               ack?.message || "Unable to subscribe to live market data.",
//             );
//             return;
//           }
//           subscribed = true;
//           if (ack.snapshot) applyLiveData(ack.snapshot);
//           if (typeof ack.marketOpen === "boolean")
//             setMarketOpen(ack.marketOpen);
//         },
//       );
//     };

//     const handleConnect = () => {
//       subscribed = false;
//       subscribe();
//     };

//     const handleDisconnect = () => {
//       subscribed = false;
//     };

//     detailStockSocket?.on("detailStock:snapshot", handleSnapshot);
//     detailStockSocket?.on("detailStock:tick", handleTick);
//     detailStockSocket?.on("detailStock:market-status", handleMarketStatus);
//     detailStockSocket?.on("connect", handleConnect);
//     detailStockSocket?.on("disconnect", handleDisconnect);

//     if (detailStockSocket?.connected) subscribe();

//     return () => {
//       alive = false;
//       if (liveTickFlushTimerRef.current) {
//         window.clearInterval(liveTickFlushTimerRef.current);
//         liveTickFlushTimerRef.current = null;
//       }
//       if (detailStockSocket?.connected && subscribed) {
//         detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
//       }
//       detailStockSocket?.off("detailStock:snapshot", handleSnapshot);
//       detailStockSocket?.off("detailStock:tick", handleTick);
//       detailStockSocket?.off("detailStock:market-status", handleMarketStatus);
//       detailStockSocket?.off("connect", handleConnect);
//       detailStockSocket?.off("disconnect", handleDisconnect);
//     };
//   }, [instrumentKey, symbol]);

//   /* MARKET VALUES */
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
//  const previousClose = nullableNumber(
//   stockInfo?.previousClose,
//   snapshot?.previousClose,
//   snapshot?.prevClose,
// );
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
//     const keysLow = [
//       "week52Low", "week_52_low", "yearLow", "fiftyTwoWeekLow",
//       "fifty_two_week_low", "52WeekLow", "52_week_low", "fiftyTwoWeekLowPrice",
//     ];
//     const keysHigh = [
//       "week52High", "week_52_high", "yearHigh", "fiftyTwoWeekHigh",
//       "fifty_two_week_high", "52WeekHigh", "52_week_high", "fiftyTwoWeekHighPrice",
//     ];
//     const keys = kind === "low" ? keysLow : keysHigh;

//     for (const source of sources) {
//       if (!source || typeof source !== "object") continue;
//       for (const key of keys) {
//         const value = source[key];
//         if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
//           return Number(value);
//         }
//       }
//     }
//     return null;
//   }

//   const week52Low = extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "low");
//   const week52High = extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "high");
//   const bsePrice = nullableNumber(
//     snapshot?.bsePrice,
//     snapshot?.bseLtp,
//     snapshot?.bseLastPrice,
//     snapshot?.bse,
//   );

//   const companyName = snapshot?.name || stockInfo?.companyName || stockInfo?.name || symbol || "Stock";
//   const exchange = snapshot?.exchange || stockInfo?.exchange || "NSE";

//   /* CHART DATA PREPARATION */
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
//             item.time ??
//             item.date ??
//             item.datetime ??
//             item.dateTime ??
//             item.ts ??
//             item.epoch ??
//             item.t ??
//             item.ltt,
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

//         const dateObj = Number.isFinite(rawTimestamp) ? new Date(rawTimestamp) : null;
//         const timeStr = dateObj
//           ? chartRange === "1D" || chartRange === "1W"
//             ? new Intl.DateTimeFormat("en-IN", {
//               timeZone: "Asia/Kolkata",
//               hour: "2-digit",
//               minute: "2-digit",
//               hour12: true,
//             }).format(dateObj)
//             : new Intl.DateTimeFormat("en-IN", {
//               timeZone: "Asia/Kolkata",
//               day: "2-digit",
//               month: "short",
//               year: "numeric",
//             }).format(dateObj)
//           : "—";

//         return {
//           price,
//           openPrice,
//           rawTimestamp,
//           time: timeStr,
//         };
//       })
//       .filter((point) => {
//         if (point.price === null || point.price <= 0) return false;
//         return Number.isFinite(point.rawTimestamp);
//       })
//       .sort((a, b) => a.rawTimestamp - b.rawTimestamp);

//     if (chartRange !== "1D") return parsed;

//     if (parsed.length > 0) return parsed;

//     // Flat line fallback if no intraday candles are available
//     if (previousClose !== null) {
//       const todayStr = getIndiaDate();
//       const marketOpenTs = Date.parse(`${todayStr}T03:45:00.000Z`);
//       const marketCloseTs = marketOpenTs + 375 * 60 * 1000;
//       return [
//         {
//           price: previousClose,
//           openPrice: previousClose,
//           rawTimestamp: marketOpenTs,
//           time: "09:15 AM",
//         },
//         {
//           price: previousClose,
//           openPrice: previousClose,
//           rawTimestamp: marketCloseTs,
//           time: "03:30 PM",
//         },
//       ];
//     }

//     return [];
//   }, [history, previousClose, chartRange]);

//   /* BASELINE REFERENCE PRICE ANCHOR */
//   const rangeStartPrice = useMemo(() => {
//     if (chartRange === "1D") {
//       // return previousClose ?? lineChartPreparedData[0]?.openPrice ?? lineChartPreparedData[0]?.price ?? null;
//        return previousClose;
//     }

//     const firstCandle = lineChartPreparedData[0];
//     return firstCandle?.openPrice ?? firstCandle?.price ?? null;
//   }, [chartRange, previousClose, lineChartPreparedData]);

//   const currentDisplayPrice = useMemo(() => {
//     return ltp ?? lineChartPreparedData[lineChartPreparedData.length - 1]?.price ?? null;
//   }, [ltp, lineChartPreparedData]);

//   const displayChange = useMemo(() => {
//     if (currentDisplayPrice !== null && rangeStartPrice !== null) {
//       return currentDisplayPrice - rangeStartPrice;
//     }
//     return snapshot?.change ?? stockInfo?.change_points ?? null;
//   }, [snapshot, stockInfo, currentDisplayPrice, rangeStartPrice]);

//   const displayChangePercent = useMemo(() => {
//     if (displayChange !== null && rangeStartPrice) {
//       return (displayChange / rangeStartPrice) * 100;
//     }
//     return snapshot?.changePercent ?? stockInfo?.change_percent ?? null;
//   }, [snapshot, stockInfo, displayChange, rangeStartPrice]);

//   const isPositive = displayChange !== null ? displayChange >= 0 : true;
//   const chartColor = isPositive ? "#00b28e" : "#e5484d";

//   const getChartX = useCallback(
//     (item, index, total) => {
//       if (chartRange === "1D") {
//         return getISTMarketProgress(item?.rawTimestamp) * CHART_WIDTH;
//       }
//       if (total <= 1) return CHART_WIDTH / 2;
//       return (
//         CHART_PADDING_X +
//         (index / (total - 1)) * (CHART_WIDTH - CHART_PADDING_X * 2)
//       );
//     },
//     [chartRange],
//   );

//   const lineChartSvg = useMemo(() => {
//     const empty = { line: "", area: "", min: 0, max: 0, baselineY: null, lastPoint: null };
//     if (!lineChartPreparedData.length) return empty;

//     const baseline = rangeStartPrice ?? lineChartPreparedData[0]?.price ?? null;
//     const allValues = lineChartPreparedData.map((d) => d.price).filter((v) => Number.isFinite(v));

//     if (Number.isFinite(baseline)) allValues.push(baseline);
//     if (!allValues.length) return empty;

//     let min = Math.min(...allValues);
//     let max = Math.max(...allValues);
//     const rawRange = max - min;

//     // Y-Axis padding calculation
//     const padding = rawRange > 0 ? rawRange * 0.08 : Math.abs(min) * 0.02 || 1;
//     min -= padding;
//     max += padding;

//     const range = max - min;

//     const toY = (value) =>
//       CHART_HEIGHT -
//       CHART_PADDING_Y -
//       ((value - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

//     const total = lineChartPreparedData.length;
//     const mappedPoints = lineChartPreparedData
//       .map((item, index) => {
//         const x = getChartX(item, index, total);
//         const y = toY(item.price);
//         return { x, y, price: item.price, time: item.time };
//       })
//       .filter(
//         (p) =>
//           Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.price),
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

//       const mouseX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
//       const percentage = mouseX / rect.width;
//       const targetX = percentage * CHART_WIDTH;

//       const total = lineChartPreparedData.length;
//       const min = lineChartSvg.min;
//       const max = lineChartSvg.max;
//       const range = max - min || 1;

//       let point = null;
//       let nearestDistance = Infinity;
//       lineChartPreparedData.forEach((candidate, candidateIndex) => {
//         const candidateX = getChartX(candidate, candidateIndex, total);
//         if (!Number.isFinite(candidateX)) return;
//         const distance = Math.abs(candidateX - targetX);
//         if (distance < nearestDistance) {
//           nearestDistance = distance;
//           point = candidate;
//         }
//       });

//       if (!point || !Number.isFinite(point.price)) return;

//       const candidateIndex = lineChartPreparedData.indexOf(point);
//       const x = getChartX(point, candidateIndex, total);
//       const y =
//         CHART_HEIGHT -
//         CHART_PADDING_Y -
//         ((point.price - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

//       if (!Number.isFinite(x) || !Number.isFinite(y)) return;

//       const percentX = (x / CHART_WIDTH) * 100;
//       let transformX = "-50%";
//       if (percentX < 15) transformX = "0%";
//       else if (percentX > 85) transformX = "-100%";

//       setHoverData({
//         price: point.price,
//         time: point.time,
//         x,
//         y,
//         percentX,
//         transformX,
//       });
//     },
//     [lineChartPreparedData, lineChartSvg.min, lineChartSvg.max, getChartX],
//   );

//   const calculated52WeekLow = week52Low;
//   const calculated52WeekHigh = week52High;

//   function getRangePosition(current, lowValue, highValue) {
//     if (
//       current === null ||
//       lowValue === null ||
//       highValue === null ||
//       highValue <= lowValue
//     ) {
//       return "50%";
//     }

//     return `${Math.max(
//       0,
//       Math.min(100, ((current - lowValue) / (highValue - lowValue)) * 100),
//     )}%`;
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
//       ["Profit (Cr)", firstDefined(data.operatingProfit, data.operating_profit)],
//       ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
//     ];
//   }, [fundamentalData, snapshot]);

//   const aboutInfo = useMemo(() => {
//     return normalizeAbout(
//       profileData || fundamentalData?.profile || snapshot?.profile,
//       fundamentalData,
//       snapshot?.symbol || symbol,
//     );
//   }, [profileData, fundamentalData, snapshot, symbol]);

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
//       const str = String(p).trim();
//       const lower = str.toLowerCase();

//       const monthMap = {
//         jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
//         jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
//       };
//       const quarterMap = { q1: 3, q2: 6, q3: 9, q4: 12 };

//       let month = 0;
//       for (const [k, m] of Object.entries(monthMap)) {
//         if (lower.includes(k)) {
//           month = m;
//           break;
//         }
//       }
//       if (!month) {
//         for (const [k, m] of Object.entries(quarterMap)) {
//           if (lower.includes(k)) {
//             month = m;
//             break;
//           }
//         }
//       }

//       let year = 0;
//       const yearMatch4 = str.match(/(19|20)\d{2}/);
//       if (yearMatch4) {
//         year = Number(yearMatch4[0]);
//       } else {
//         const digitRuns = str.match(/\d{1,2}/g);
//         if (digitRuns && digitRuns.length) {
//           year = 2000 + Number(digitRuns[digitRuns.length - 1]);
//         }
//       }

//       return year * 100 + month;
//     };

//     return Array.from(periodSet).sort(
//       (a, b) => parsePeriod(b) - parsePeriod(a),
//     );
//   }, [shareholdingData]);

//   useEffect(() => {
//     if (!selectedShareholdingPeriod && shareholdingPeriods.length) {
//       setSelectedShareholdingPeriod(shareholdingPeriods[0]);
//     }
//   }, [selectedShareholdingPeriod, shareholdingPeriods]);

//   const selectedShareholding = useMemo(() => {
//     if (!selectedShareholdingPeriod) return [];

//     const currentIndex = shareholdingPeriods.indexOf(selectedShareholdingPeriod);
//     const previousPeriod = currentIndex >= 0 ? shareholdingPeriods[currentIndex + 1] : undefined;

//     return shareholdingData
//       .map((item, index) => {
//         const historyRows = Array.isArray(item.history) ? item.history : [];
//         const selected = historyRows.find((row) => row.period === selectedShareholdingPeriod);
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
//           change: previousPercentage !== null ? percentage - previousPercentage : null,
//         };
//       })
//       .filter(Boolean);
//   }, [shareholdingData, selectedShareholdingPeriod, shareholdingPeriods]);

//   const mutualFunds = useMemo(() => {
//     return mutualFundData.map((fund, index) => ({
//       name: fund.name || fund.fundName || fund.fund_name || fund.fund || `Fund ${index + 1}`,
//       percentage: nullableNumber(fund.percentage, fund.percent, fund.aumPercentage, fund.aum_percent, fund.value),
//       value: fund.marketValue || fund.market_value || fund.value || null,
//       logo: fund.logo || fund.icon || "",
//     }));
//   }, [mutualFundData]);

//   const financialRows = useMemo(() => {
//     const rows = normalizeFinancialRows(
//       financialData ||
//       fundamentalData?.incomeStatement ||
//       fundamentalData?.income_statement ||
//       fundamentalData,
//     );

//     if (rows && rows.length) return rows;

//     const data = snapshot?.fundamentals || {};
//     const period = firstDefined(
//       data.period, data.quarter, data.reportPeriod, data.report_period,
//       data.asOf, data.as_of, data.reportDate, data.report_date,
//     );
//     if (period) {
//       const revenue = getFinancialNumber(data.revenue, data.sales, data.totalRevenue);
//       const profit = getFinancialNumber(data.netProfit, data.net_profit, data.operatingProfit, data.operating_profit);
//       if (revenue !== null || profit !== null) {
//         return [{ quarter: String(period), revenue: revenue ?? 0, profit: profit ?? 0 }];
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
//     const highest = Math.max(...financialBarData.flatMap((r) => [r.revenue, r.profit]));
//     return highest > 0 ? highest : 1;
//   }, [financialBarData]);

//   const effectivePrice = numberValue(priceLimit, 0) > 0 ? numberValue(priceLimit) : ltp || 0;
//   const approximateRequired = numberValue(quantity) * effectivePrice;

//   const handlePlaceOrder = async (e) => {
//     e.preventDefault();
//     if (!marketOpen || !quantity || numberValue(quantity) <= 0) return;

//     setOrderSubmitting(true);
//     setOrderMessage("");

//     try {
//       const payload = {
//         symbol: snapshot?.symbol || stockInfo?.symbol || symbol,
//         instrumentKey,
//         orderType,
//         quantity: numberValue(quantity),
//         price: effectivePrice,
//       };

//       const response = await axios.post(ENDPOINTS.order(), payload, { timeout: 10000 });

//       if (response.data?.success) {
//         setOrderMessage(`Success: ${orderType} order placed for ${quantity} shares!`);
//         setQuantity("");
//         setPriceLimit("");
//       } else {
//         setOrderMessage(response.data?.message || "Order placement request failed.");
//       }
//     } catch (err) {
//       setOrderMessage(err?.response?.data?.message || err?.message || "Failed to place order.");
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
//               {/* STOCK HEADER */}
//               <section className="stock-card">
//                 <div className="stock-header">
//                   <div className="stock-main-info">
//                     <div>
//                       <div className="stock-meta">
//                         <span>{snapshot?.symbol || stockInfo?.symbol || symbol}</span>
//                         <span className="stock-meta-dot" />
//                         <span>{exchange}</span>
//                       </div>

//                       <h1>{companyName}</h1>

//                       <div className="stock-price-row">
//                         <span className="stock-price">
//                           {ltp !== null ? formatCurrency(ltp) : "—"}
//                         </span>

//                         <span className={isPositive ? "stock-positive" : "stock-negative"}>
//                           {displayChange !== null
//                             ? `${displayChange >= 0 ? "+" : ""}${formatNumber(displayChange)} (${formatPercent(displayChangePercent)}) ${chartRange}`
//                             : "—"}
//                         </span>
//                       </div>

//                       {marketError && <div className="detail-stock-error">{marketError}</div>}
//                       {stockError && <div className="detail-stock-error">{stockError}</div>}
//                     </div>
//                   </div>

//                   <div className="stock-actions">
//                     <button
//                       className={isWatchlisted ? "watchlisted" : ""}
//                       onClick={() => setIsWatchlisted((v) => !v)}
//                     >
//                       {isWatchlisted ? "★" : "☆"}
//                     </button>
//                   </div>
//                 </div>

//                 {/* CHART */}
//                 <ErrorBoundary
//                   resetKey={`${instrumentKey}-${chartRange}`}
//                   fallback={
//                     <div className="chart-wrapper">
//                       <div style={{ padding: "1rem", color: "#64748b" }}>
//                         Chart unavailable right now.
//                       </div>
//                     </div>
//                   }
//                 >
//                   <div className="chart-wrapper">
//                     <div
//                       className="chart-area"
//                       onMouseMove={handleMouseMove}
//                       onMouseLeave={() => setHoverData(null)}
//                     >
//                       {historyLoading && <div className="chart-loading">Updating chart…</div>}

//                       {!historyLoading && !lineChartPreparedData.length && (
//                         <div className="chart-loading">
//                           {marketOpen ? "Waiting for market data…" : "Market data unavailable"}
//                         </div>
//                       )}

//                       {hoverData && (
//                         <div
//                           className="chart-hover-tooltip"
//                           style={{
//                             left: `${hoverData.percentX}%`,
//                             transform: `translateX(${hoverData.transformX || "-50%"})`,
//                           }}
//                         >
//                           <span className="tooltip-price">
//                             {formatCurrency(hoverData.price)}
//                           </span>
//                           <span className="tooltip-divider">|</span>
//                           <span className="tooltip-time">{hoverData.time}</span>
//                         </div>
//                       )}

//                       <svg
//                         className="stock-chart"
//                         viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
//                         preserveAspectRatio="none"
//                       >
//                         <defs>
//                           <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
//                             <stop offset="0%" stopColor={chartColor} stopOpacity="0.22" />
//                             <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
//                           </linearGradient>
//                         </defs>

//                         {/* DASHED BASELINE */}
//                         {lineChartSvg.baselineY !== null && (
//                           <line
//                             x1="0"
//                             y1={lineChartSvg.baselineY}
//                             x2="1000"
//                             y2={lineChartSvg.baselineY}
//                             stroke="#94a3b8"
//                             strokeWidth="1.5"
//                             strokeDasharray="6 6"
//                             vectorEffect="non-scaling-stroke"
//                           />
//                         )}

//                         {lineChartSvg.area && (
//                           <path d={lineChartSvg.area} fill="url(#stockGradient)" />
//                         )}

//                         {lineChartSvg.line && (
//                           <polyline
//                             points={lineChartSvg.line}
//                             fill="none"
//                             stroke={chartColor}
//                             strokeWidth="4"
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                           />
//                         )}

//                         {lineChartSvg.lastPoint && (
//                           <g>
//                             <circle
//                               cx={lineChartSvg.lastPoint.x}
//                               cy={lineChartSvg.lastPoint.y}
//                               r="8"
//                               fill={chartColor}
//                               fillOpacity="0.25"
//                             />
//                             <circle
//                               cx={lineChartSvg.lastPoint.x}
//                               cy={lineChartSvg.lastPoint.y}
//                               r="4.5"
//                               fill={chartColor}
//                             />
//                           </g>
//                         )}

//                         {hoverData && (
//                           <g>
//                             <line
//                               x1={hoverData.x}
//                               y1="0"
//                               x2={hoverData.x}
//                               y2="300"
//                               stroke="#cbd5e1"
//                               strokeWidth="1.5"
//                             />
//                             <circle
//                               cx={hoverData.x}
//                               cy={hoverData.y}
//                               r="6"
//                               fill="#ffffff"
//                               stroke={chartColor}
//                               strokeWidth="3"
//                             />
//                           </g>
//                         )}
//                       </svg>

//                       {chartRange === "1D" && (
//                         <div
//                           style={{
//                             display: "flex",
//                             justifyContent: "space-between",
//                             padding: "0 10px",
//                             fontSize: "0.75rem",
//                             color: "#64748b",
//                             marginTop: "4px",
//                           }}
//                         >
//                           <span>09:15 AM</span>
//                           <span>03:30 PM</span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </ErrorBoundary>

//                 <div className="chart-footer" style={{ marginTop: "1.5rem" }}>
//                   <div className="chart-periods">
//                     {RANGES.map((range) => (
//                       <button
//                         key={range}
//                         className={chartRange === range ? "active" : ""}
//                         onClick={() => setChartRange(range)}
//                         disabled={historyLoading}
//                       >
//                         {range}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               </section>

//               {/* PERFORMANCE */}
//               <section className="content-section">
//                 <div className="section-heading">
//                   <h2>Performance</h2>
//                 </div>

//                 <div className="performance-card">
//                   <div className="range-block">
//                     <div className="range-title">
//                       <p>Today's low</p>
//                       <p>Today's high</p>
//                     </div>

//                     <div className="range-values">
//                       <p>{low !== null ? formatCurrency(low) : "—"}</p>
//                       <p>{high !== null ? formatCurrency(high) : "—"}</p>
//                     </div>

//                     <div className="range-line">
//                       <div
//                         className="range-marker"
//                         style={{ left: getRangePosition(ltp, low, high) }}
//                       />
//                     </div>
//                   </div>

//                   <div className="range-block">
//                     <div className="range-title">
//                       <p>52 week low</p>
//                       <p>52 week high</p>
//                     </div>

//                     <div className="range-values">
//                       <p>
//                         {calculated52WeekLow !== null
//                           ? formatCurrency(calculated52WeekLow)
//                           : "—"}
//                       </p>
//                       <p>
//                         {calculated52WeekHigh !== null
//                           ? formatCurrency(calculated52WeekHigh)
//                           : "—"}
//                       </p>
//                     </div>

//                     <div className="range-line">
//                       <div
//                         className="range-marker"
//                         style={{
//                           left: getRangePosition(
//                             ltp,
//                             calculated52WeekLow,
//                             calculated52WeekHigh,
//                           ),
//                         }}
//                       />
//                     </div>
//                   </div>

//                   <div className="performance-stats">
//                     <div>
//                       <span>Open price</span>
//                       <p>{open !== null ? formatCurrency(open) : "—"}</p>
//                     </div>

//                     <div>
//                       <span>Previous close</span>
//                       <p>{previousClose !== null ? formatCurrency(previousClose) : "—"}</p>
//                     </div>

//                     <div>
//                       <span>Live volume</span>
//                       <p>{volume !== null ? formatCompact(volume) : "—"}</p>
//                     </div>

//                     <div>
//                       <span>Upper circuit</span>
//                       <p>{upperCircuit !== null ? formatCurrency(upperCircuit) : "—"}</p>
//                     </div>

//                     <div>
//                       <span>Lower circuit</span>
//                       <p>{lowerCircuit !== null ? formatCurrency(lowerCircuit) : "—"}</p>
//                     </div>
//                   </div>
//                 </div>
//               </section>

//               {/* FUNDAMENTALS */}
//               <section className="content-section">
//                 <div className="section-heading">
//                   <h2>Fundamentals</h2>
//                 </div>

//                 <div className="fundamentals-card">
//                   {fundamentalsLoading && <div>Loading fundamentals…</div>}

//                   {!fundamentalsLoading && fundamentalsError && (
//                     <div>Unable to load fundamentals: {fundamentalsError}</div>
//                   )}

//                   {!fundamentalsLoading &&
//                     !fundamentalsError &&
//                     fundamentals.map(([label, value]) => (
//                       <div className="fundamental-row" key={label}>
//                         <span>{label}</span>
//                         <p>
//                           {value !== null && value !== undefined && value !== ""
//                             ? typeof value === "number"
//                               ? formatNumber(value)
//                               : value
//                             : "N/A"}
//                         </p>
//                       </div>
//                     ))}
//                 </div>
//               </section>

//               {/* SHAREHOLDING */}
//               <ErrorBoundary resetKey={isin}>
//                 <section className="content-section">
//                   <div className="section-heading">
//                     <h2>Shareholding Pattern</h2>
//                   </div>

//                   <div className="shareholding-card">
//                     {shareholdingPeriods.length > 0 && (
//                       <div className="shareholding-periods">
//                         {shareholdingPeriods.map((period) => (
//                           <button
//                             key={period}
//                             className={
//                               selectedShareholdingPeriod === period
//                                 ? "active"
//                                 : ""
//                             }
//                             onClick={() => setSelectedShareholdingPeriod(period)}
//                           >
//                             {period}
//                           </button>
//                         ))}
//                       </div>
//                     )}

//                     <div className="shareholding-list">
//                       {selectedShareholding.length > 0 ? (
//                         <>
//                           {selectedShareholding.map((item) => (
//                             <div className="shareholding-row" key={item.key}>
//                               <div className="shareholding-label">
//                                 <span>{item.label}</span>
//                                 <p
//                                   style={{
//                                     color: "black",
//                                     margin: 0,
//                                     fontWeight: 500,
//                                     fontSize: 15,
//                                     display: "flex",
//                                     alignItems: "center",
//                                     gap: 6,
//                                   }}
//                                 >
//                                   {item.percentage.toFixed(2)}%
//                                   {item.change !== null &&
//                                     Math.abs(item.change) >= 0.01 && (
//                                       <span
//                                         style={{
//                                           fontSize: 12,
//                                           fontWeight: 600,
//                                           color:
//                                             item.change > 0
//                                               ? "#00b28e"
//                                               : "#e5484d",
//                                         }}
//                                       >
//                                         {item.change > 0 ? "▲" : "▼"}{" "}
//                                         {Math.abs(item.change).toFixed(2)}%
//                                       </span>
//                                     )}
//                                 </p>
//                               </div>

//                               <div className="shareholding-bar">
//                                 <div
//                                   style={{
//                                     width: `${Math.min(100, Math.max(0, item.percentage))}%`,
//                                   }}
//                                 />
//                               </div>
//                             </div>
//                           ))}
//                         </>
//                       ) : (
//                         <div>Shareholding data unavailable</div>
//                       )}
//                     </div>
//                   </div>
//                 </section>
//               </ErrorBoundary>

//               {/* FINANCIAL PERFORMANCE */}
//               <ErrorBoundary resetKey={isin}>
//                 {(() => {
//                   const safeData = Array.isArray(financialBarData) ? financialBarData : [];
//                   const hasData = safeData.length > 0;

//                   const latestItem = hasData ? safeData[safeData.length - 1] : null;
//                   const prevItem = safeData.length > 1 ? safeData[safeData.length - 2] : null;

//                   const getQuarter = (item) =>
//                     item?.quarter || item?.period || item?.Quarter || item?.quarterName || item?.quarter_name || item?.date || item?.label || "—";

//                   const getRevenue = (item) =>
//                     getFinancialNumber(item?.revenue, item?.Revenue, item?.total_revenue, item?.totalRevenue, item?.sales, item?.income) ?? 0;

//                   const getProfit = (item) =>
//                     getFinancialNumber(item?.profit, item?.Profit, item?.net_profit, item?.netProfit, item?.pat, item?.profitAfterTax) ?? 0;

//                   const autoMax = Math.max(...safeData.flatMap((d) => [getRevenue(d), getProfit(d)]), 1);
//                   const safeMaxVal = maxFinancialValue && !isNaN(maxFinancialValue) && maxFinancialValue > 0 ? maxFinancialValue : autoMax;

//                   return (
//                     <section className="content-section">
//                       <div className="section-heading">
//                         <h2>Financial performance</h2>
//                       </div>

//                       <div className="chart-card">
//                         <header className="chart-header">
//                           <div className="header-date">{getQuarter(latestItem)}</div>

//                           <div className="legend-row">
//                             <div className="legend-group">
//                               <div className="legend-title">
//                                 <span className="legend-badge bg-bar-revenue" />
//                                 <span className="legend-label">Revenue (CR)</span>
//                               </div>

//                               <div className="legend-metrics">
//                                 <span className="metric-value">
//                                   {latestItem ? formatNumber(getRevenue(latestItem)) : "—"}
//                                 </span>
//                               </div>
//                             </div>

//                             <div className="legend-group">
//                               <div className="legend-title">
//                                 <span className="legend-badge bg-bar-profit" />
//                                 <span className="legend-label">Profit (CR)</span>
//                               </div>

//                               <div className="legend-metrics">
//                                 <span className="metric-value">
//                                   {latestItem ? formatNumber(getProfit(latestItem)) : "—"}
//                                 </span>
//                               </div>
//                             </div>
//                           </div>
//                         </header>

//                         <div className="chart-area">
//                           {hasData ? (
//                             <div
//                               style={{
//                                 display: "flex",
//                                 alignItems: "flex-end",
//                                 gap: "2rem",
//                                 minHeight: "250px",
//                                 padding: "2rem",
//                               }}
//                             >
//                               {safeData.map((item, index) => {
//                                 const rev = getRevenue(item);
//                                 const prof = getProfit(item);
//                                 const quarterLabel = getQuarter(item);

//                                 const revPct = Math.min(100, Math.max(0, (rev / safeMaxVal) * 100));
//                                 const profPct = Math.min(100, Math.max(0, (prof / safeMaxVal) * 100));

//                                 return (
//                                   <div
//                                     key={item.id || item.quarter || index}
//                                     style={{
//                                       flex: 1,
//                                       display: "flex",
//                                       alignItems: "flex-end",
//                                       justifyContent: "center",
//                                       gap: "0.4rem",
//                                       height: "200px",
//                                       position: "relative",
//                                     }}
//                                   >
//                                     <div
//                                       style={{
//                                         width: "35%",
//                                         height: `${revPct}%`,
//                                         minHeight: rev > 0 ? "4px" : "0",
//                                       }}
//                                       className="bar-single bg-bar-revenue"
//                                       title={`Revenue: ${formatNumber(rev)}`}
//                                     />
//                                     <div
//                                       style={{
//                                         width: "35%",
//                                         height: `${profPct}%`,
//                                         minHeight: prof > 0 ? "4px" : "0",
//                                       }}
//                                       className="bar-single bg-bar-profit"
//                                       title={`Profit: ${formatNumber(prof)}`}
//                                     />
//                                     <span
//                                       style={{
//                                         position: "absolute",
//                                         bottom: "-25px",
//                                         fontSize: "0.85rem",
//                                       }}
//                                     >
//                                       {quarterLabel}
//                                     </span>
//                                   </div>
//                                 );
//                               })}
//                             </div>
//                           ) : (
//                             <div style={{ padding: "2rem" }}>
//                               Financial data unavailable
//                             </div>
//                           )}
//                         </div>
//                       </div>

//                       <div className="growth-container">
//                         <div className="growth-flex">
//                           <div className="growth-section growth-section-left">
//                             <div className="growth-header">
//                               <h3 className="growth-title">Revenue Growth</h3>
//                               <span className="growth-title">Value</span>
//                             </div>

//                             <div className="growth-rows">
//                               <div className="growth-row">
//                                 <span className="growth-label">Latest period</span>
//                                 <span className="text-accent-green">
//                                   {latestItem ? formatNumber(getRevenue(latestItem)) : "—"}
//                                 </span>
//                               </div>

//                               <div className="growth-row">
//                                 <span className="growth-label">Previous period</span>
//                                 <span className="text-accent-green">
//                                   {prevItem ? formatNumber(getRevenue(prevItem)) : "—"}
//                                 </span>
//                               </div>
//                             </div>
//                           </div>

//                           <div className="divider" />

//                           <div className="growth-section growth-section-right">
//                             <div className="growth-header">
//                               <h3 className="growth-title">Profit Growth</h3>
//                               <span className="growth-title">Value</span>
//                             </div>

//                             <div className="growth-rows">
//                               <div className="growth-row">
//                                 <span className="growth-label">Latest period</span>
//                                 <span className="text-accent-green">
//                                   {latestItem ? formatNumber(getProfit(latestItem)) : "—"}
//                                 </span>
//                               </div>

//                               <div className="growth-row">
//                                 <span className="growth-label">Previous period</span>
//                                 <span className="text-accent-green">
//                                   {prevItem ? formatNumber(getProfit(prevItem)) : "—"}
//                                 </span>
//                               </div>
//                             </div>
//                           </div>
//                         </div>
//                       </div>
//                     </section>
//                   );
//                 })()}
//               </ErrorBoundary>

//               {/* ABOUT */}
//               <section className="content-section">
//                 <div className="section-heading">
//                   <h2>About</h2>
//                 </div>

//                 <div className="about-card">
//                   <p className="about-description">
//                     {isAboutExpanded
//                       ? aboutInfo.description
//                       : `${String(aboutInfo.description).slice(0, 190)}${String(aboutInfo.description).length > 190 ? "..." : ""}`}

//                     {String(aboutInfo.description).length > 190 && (
//                       <button
//                         type="button"
//                         className="read-more-btn"
//                         onClick={() => setIsAboutExpanded((prev) => !prev)}
//                       >
//                         {isAboutExpanded ? "Read less" : "Read more"}
//                       </button>
//                     )}
//                   </p>
//                 </div>
//               </section>

//               {/* MUTUAL FUNDS */}
//               <section className="content-section">
//                 <div className="section-heading">
//                   <h2>Mutual Funds Invested ({mutualFunds.length})</h2>
//                 </div>

//                 <div className="mf-table-card">
//                   <div className="mf-table-header">
//                     <span className="mf-col-name">Fund name</span>
//                     <span className="mf-col-aum">AUM%</span>
//                   </div>

//                   <div className="mf-table-body">
//                     {mutualFunds.length > 0 ? (
//                       mutualFunds.map((fund, index) => (
//                         <div className="mf-row" key={`${fund.name}-${index}`}>
//                           <div className="mf-left-group">
//                             <div className="mf-logo-wrapper">
//                               {fund.logo ? (
//                                 <img
//                                   src={fund.logo}
//                                   alt={fund.name}
//                                   className="mf-logo-img"
//                                   onError={(e) => {
//                                     e.currentTarget.style.display = "none";
//                                     if (e.currentTarget.nextSibling) {
//                                       e.currentTarget.nextSibling.style.display = "flex";
//                                     }
//                                   }}
//                                 />
//                               ) : null}

//                               <div
//                                 className="mf-logo-fallback"
//                                 style={{ display: fund.logo ? "none" : "flex" }}
//                               >
//                                 {fund.name?.[0]}
//                               </div>
//                             </div>

//                             <span className="mf-fund-name">{fund.name}</span>
//                           </div>

//                           <div className="mf-aum-value">
//                             {fund.percentage !== null
//                               ? `${fund.percentage.toFixed(2)}%`
//                               : "—"}
//                           </div>
//                         </div>
//                       ))
//                     ) : (
//                       <div className="mf-row">
//                         Mutual fund ownership data unavailable
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               </section>
//             </div>

//             {/* RIGHT TRADING PANEL */}
//             <div
//               style={{
//                 height: "fit-content",
//                 width: "21.5rem",
//                 minWidth: "20rem",
//                 position: "sticky",
//                 top: "140px",
//               }}
//             >
//               <div className="trading-panel">
//                 <div className="trading-header">
//                   <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>
//                     {snapshot?.symbol || stockInfo?.symbol || symbol}
//                   </p>

//                   <div className="trading-market-info">
//                     <span>{exchange}</span>
//                     <span>{ltp !== null ? formatCurrency(ltp) : "—"}</span>
//                     <span>BSE</span>
//                     <span>
//                       {bsePrice !== null ? formatCurrency(bsePrice) : "—"}
//                     </span>
//                     <span className={isPositive ? "positive" : "negative"}>
//                       {formatPercent(displayChangePercent)}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="order-tabs">
//                   <button
//                     className={orderType === "BUY" ? "active buy" : ""}
//                     onClick={() => setOrderType("BUY")}
//                   >
//                     BUY
//                   </button>
//                   <button
//                     className={orderType === "SELL" ? "active sell" : ""}
//                     onClick={() => setOrderType("SELL")}
//                   >
//                     SELL
//                   </button>
//                 </div>

//                 <form onSubmit={handlePlaceOrder} className="trading-body">
//                   <div
//                     style={{
//                       borderBottom: "1px solid #e2e6ea",
//                       paddingBottom: ".5rem",
//                     }}
//                   >
//                     <div className="order-field">
//                       <div className="order-label">
//                         <span>Qty</span>
//                       </div>
//                       <input
//                         type="number"
//                         min="1"
//                         value={quantity}
//                         onChange={(e) => setQuantity(e.target.value)}
//                         placeholder="0"
//                       />
//                     </div>

//                     <div className="order-field">
//                       <div className="order-label">
//                         <span>Price Limit</span>
//                       </div>
//                       <input
//                         type="number"
//                         min="0"
//                         step="0.05"
//                         value={priceLimit}
//                         placeholder={ltp !== null ? String(ltp) : ""}
//                         onChange={(e) => setPriceLimit(e.target.value)}
//                       />
//                     </div>
//                   </div>

//                   <div className="order-summary">
//                     <span>Balance : ₹0</span>
//                     <div>
//                       <p style={{ margin: 0 }}>Approx</p>
//                       <p style={{ margin: 0 }}>
//                         {formatCurrency(approximateRequired)}
//                       </p>
//                     </div>
//                   </div>

//                   {orderMessage && (
//                     <div
//                       style={{
//                         fontSize: "0.8rem",
//                         marginTop: "0.5rem",
//                         color: orderMessage.startsWith("Success")
//                           ? "#00b28e"
//                           : "#e5484d",
//                       }}
//                     >
//                       {orderMessage}
//                     </div>
//                   )}

//                   <button
//                     type="submit"
//                     className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`}
//                     disabled={
//                       !marketOpen ||
//                       !quantity ||
//                       numberValue(quantity) <= 0 ||
//                       orderSubmitting
//                     }
//                   >
//                     {orderSubmitting
//                       ? "PROCESSING..."
//                       : marketOpen
//                         ? orderType
//                         : "MARKET CLOSED"}
//                   </button>
//                 </form>
//               </div>
//             </div>
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }

// export { StockDashboard as ShareholdingPattern };