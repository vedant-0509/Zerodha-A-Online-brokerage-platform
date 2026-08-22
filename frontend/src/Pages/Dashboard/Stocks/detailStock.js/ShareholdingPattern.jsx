// import React, { useEffect, useMemo, useState } from "react";
// import detailStockSocket from "./detailStockWebSocketConnection";
// // import "./FinancialDashboard.css";

// const API = process.env.REACT_APP_DETAIL_STOCK_API || "http://localhost:3011";
// const DEFAULT_INSTRUMENT = "NSE_EQ|INE020B01018";
// const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];

// // Raw Financial Data
// const RAW_FINANCIAL_DATA = [
//   { quarter: "Jun '25", revenue: 280, profit: 30 },
//   { quarter: "Sep '25", revenue: 280, profit: 24 },
//   { quarter: "Dec '25", revenue: 290, profit: 25 },
//   { quarter: "Mar '26", revenue: 330, profit: 22 },
//   { quarter: "Jun '26", revenue: 350, profit: 24, active: true },
// ];

// /* =========================================================
//    HELPERS
// ========================================================= */

// function numberValue(value, fallback = 0) {
//   const n = Number(value);
//   return Number.isFinite(n) ? n : fallback;
// }

// function formatNumber(value, digits = 2) {
//   const n = numberValue(value);
//   return n.toLocaleString("en-IN", {
//     minimumFractionDigits: digits,
//     maximumFractionDigits: digits,
//   });
// }

// function formatCurrency(value) {
//   const n = numberValue(value);
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   }).format(n);
// }

// function formatCompact(value) {
//   const n = numberValue(value);
//   return n.toLocaleString("en-IN");
// }

// function formatPercent(value) {
//   const n = numberValue(value);
//   return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
// }

// function getDateDaysAgo(days) {
//   const date = new Date();
//   date.setDate(date.getDate() - days);
//   return date.toISOString().slice(0, 10);
// }

// function getHistoryParams(range) {
//   switch (range) {
//     case "1D":
//       return { unit: "minutes", interval: "1", from: getDateDaysAgo(1) };
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
//       return { unit: "minutes", interval: "1", from: getDateDaysAgo(1) };
//   }
// }

// /* =========================================================
//    COMPONENT
// ========================================================= */

// export default function ShareholdingPattern({
//   instrumentKey = DEFAULT_INSTRUMENT,
//   isin = instrumentKey.includes("|") ? instrumentKey.split("|")[1] : "",
//   symbol = "Reliance Industries Limited",
//   exchange = "NSE",
// }) {
//   /* =====================================================
//        MARKET STATE
//     ===================================================== */
//   const [snapshot, setSnapshot] = useState(null);
//   const [marketOpen, setMarketOpen] = useState(false);
//   const [marketLoading, setMarketLoading] = useState(true);
//   const [marketError, setMarketError] = useState("");
//   const [hoverData, setHoverData] = useState(null);

//   /* =====================================================
//        HISTORY & UI
//     ===================================================== */
//   const [chartRange, setChartRange] = useState("1D");
//   const [historicalData, setHistoricalData] = useState([]);
//   const [loadingHistory, setLoadingHistory] = useState(false);
//   const [orderType, setOrderType] = useState("BUY");
//   const [isWatchlisted, setIsWatchlisted] = useState(false);
//   const [quantity, setQuantity] = useState("");
//   const [priceLimit, setPriceLimit] = useState("");
//   const [isAboutExpanded, setIsAboutExpanded] = useState(false);

//   /* =====================================================
//        FUNDAMENTALS & SHAREHOLDING
//     ===================================================== */
//   const [fundamentalData, setFundamentalData] = useState(null);
//   const [shareholdingData, setShareholdingData] = useState(null);
//   const [mutualFundData, setMutualFundData] = useState(null);
//   const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] =
//     useState("");
//   const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
//   const [fundamentalsError, setFundamentalsError] = useState("");

//   /* =====================================================
//        NORMALIZED MARKET VALUES
//     ===================================================== */
//   const ltp = numberValue(
//     snapshot?.ltp ??
//     snapshot?.price ??
//     snapshot?.lastPrice ??
//     snapshot?.close ??
//     0,
//   );
//   const open = numberValue(snapshot?.open ?? snapshot?.openPrice ?? 0);
//   const high = numberValue(snapshot?.high ?? snapshot?.dayHigh ?? 0);
//   const low = numberValue(snapshot?.low ?? snapshot?.dayLow ?? 0);
//   const previousClose = numberValue(
//     snapshot?.previousClose ?? snapshot?.prevClose ?? snapshot?.close ?? 0,
//   );
//   const volume = numberValue(snapshot?.volume ?? snapshot?.totalVolume ?? 0);
//   const change = numberValue(
//     snapshot?.change ??
//     snapshot?.netChange ??
//     (ltp && previousClose ? ltp - previousClose : 0),
//   );
//   const changePercent = numberValue(
//     snapshot?.changePercent ??
//     snapshot?.changePercentage ??
//     (previousClose ? (change / previousClose) * 100 : 0),
//   );
//   const upperCircuit = numberValue(
//     snapshot?.upperCircuit ??
//     snapshot?.upperLimit ??
//     snapshot?.upperCircuitLimit ??
//     0,
//   );
//   const lowerCircuit = numberValue(
//     snapshot?.lowerCircuit ??
//     snapshot?.lowerLimit ??
//     snapshot?.lowerCircuitLimit ??
//     0,
//   );
//   const week52Low = numberValue(
//     snapshot?.week52Low ?? snapshot?.yearLow ?? snapshot?.fiftyTwoWeekLow ?? 0,
//   );
//   const week52High = numberValue(
//     snapshot?.week52High ??
//     snapshot?.yearHigh ??
//     snapshot?.fiftyTwoWeekHigh ??
//     0,
//   );
//   const bsePrice = numberValue(
//     snapshot?.bsePrice ??
//     snapshot?.bseLtp ??
//     snapshot?.bseLastPrice ??
//     snapshot?.bse ??
//     0,
//   );
//   const positive = change >= 0;

//   /* =====================================================
//        FINANCIAL BAR CHART SCALED DATA
//     ===================================================== */
//   const financialBarData = useMemo(() => {
//     const Y_AXIS_MAX = 400;
//     return RAW_FINANCIAL_DATA.map((item) => ({
//       ...item,
//       revenueHeight: `${(item.revenue / Y_AXIS_MAX) * 100}%`,
//       profitHeight: `${(item.profit / Y_AXIS_MAX) * 100}%`,
//     }));
//   }, []);

//   const lineChartPreparedData = useMemo(() => {
//     if (!historicalData.length) {
//       return ltp > 0 ? [{ price: ltp, time: "Live" }] : [];
//     }
//     return historicalData
//       .map((item) => {
//         let price = 0;
//         let timeStr = "";

//         if (typeof item === "number" || typeof item === "string") {
//           price = numberValue(item, 0);
//         } else if (Array.isArray(item)) {
//           // Handle OHLC candle format [timestamp, open, high, low, close]
//           timeStr = item[0]
//             ? new Date(item[0]).toLocaleTimeString([], {
//               hour: "2-digit",
//               minute: "2-digit",
//             })
//             : "";
//           price = numberValue(item[4] ?? item[1], 0);
//         } else {
//           price = numberValue(item?.close ?? item?.ltp ?? item?.price, 0);
//           const rawTime = item?.time ?? item?.timestamp ?? item?.date;
//           timeStr = rawTime
//             ? new Date(rawTime).toLocaleTimeString([], {
//               hour: "2-digit",
//               minute: "2-digit",
//             })
//             : "";
//         }

//         return { price, time: timeStr || "12:22 PM" };
//       })
//       .filter((d) => Number.isFinite(d.price));
//   }, [historicalData, ltp]);

//   // 3. Mouse Movement Handler for Crosshair and Tooltip
//   const handleMouseMove = (e) => {
//     if (!lineChartPreparedData.length) return;

//     const rect = e.currentTarget.getBoundingClientRect();
//     const mouseX = e.clientX - rect.left;
//     const percentage = Math.max(0, Math.min(1, mouseX / rect.width));

//     const index = Math.round(percentage * (lineChartPreparedData.length - 1));
//     const point = lineChartPreparedData[index];

//     if (!point) return;

//     const width = 1000;
//     const height = 300;
//     const paddingX = 10;
//     const paddingY = 20;

//     const min = lineChartSvg.min;
//     const max = lineChartSvg.max;
//     const range = max - min || 1;

//     const svgX =
//       lineChartPreparedData.length === 1
//         ? width / 2
//         : paddingX +
//         (index / (lineChartPreparedData.length - 1)) * (width - paddingX * 2);
//     const svgY =
//       height -
//       paddingY -
//       ((point.price - min) / range) * (height - paddingY * 2);

//     setHoverData({
//       price: point.price,
//       time: point.time,
//       x: svgX,
//       y: svgY,
//       percentX: (mouseX / rect.width) * 100,
//     });
//   };

//   const handleMouseLeave = () => {
//     setHoverData(null);
//   };

//   /* =====================================================
//        WEBSOCKET CONNECTION
//     ===================================================== */
//   useEffect(() => {
//     let alive = true;
//     setMarketLoading(true);
//     setMarketError("");

//     const handleSnapshot = (data) => {
//       if (!alive || !data) return;
//       if (data.instrumentKey && data.instrumentKey !== instrumentKey) return;

//       setSnapshot((previous) => ({ ...(previous || {}), ...data }));
//       if (typeof data.marketOpen !== "undefined")
//         setMarketOpen(Boolean(data.marketOpen));
//       if (data.fundamentals) setFundamentalData(data.fundamentals);
//       if (data.shareholding) setShareholdingData(data.shareholding);
//       if (data.mutualFunds) setMutualFundData(data.mutualFunds);
//       setMarketLoading(false);
//     };

//     const handleTick = (data) => {
//       if (!alive || !data) return;
//       if (data.instrumentKey && data.instrumentKey !== instrumentKey) return;

//       setSnapshot((previous) => ({ ...(previous || {}), ...data }));
//       setMarketOpen(
//         typeof data.marketOpen !== "undefined"
//           ? Boolean(data.marketOpen)
//           : true,
//       );
//       setMarketLoading(false);
//     };

//     const subscribe = () => {
//       detailStockSocket.emit(
//         "detailStock:subscribe",
//         { instrumentKey },
//         (ack) => {
//           if (!alive) return;
//           if (!ack?.success) {
//             setMarketError(
//               ack?.message || "Unable to subscribe to live market data.",
//             );
//             setMarketLoading(false);
//             return;
//           }
//           if (ack.snapshot) {
//             setSnapshot((previous) => ({
//               ...(previous || {}),
//               ...ack.snapshot,
//             }));
//             if (typeof ack.snapshot.marketOpen !== "undefined") {
//               setMarketOpen(Boolean(ack.snapshot.marketOpen));
//             }
//             setMarketLoading(false);
//           }
//         },
//       );
//     };

//     detailStockSocket.on("detailStock:snapshot", handleSnapshot);
//     detailStockSocket.on("detailStock:tick", handleTick);

//     if (detailStockSocket.connected) {
//       subscribe();
//     } else {
//       detailStockSocket.once("connect", subscribe);
//     }

//     return () => {
//       alive = false;
//       detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
//       detailStockSocket.off("detailStock:snapshot", handleSnapshot);
//       detailStockSocket.off("detailStock:tick", handleTick);
//       detailStockSocket.off("connect", subscribe);
//     };
//   }, [instrumentKey]);

//   /* =====================================================
//        FUNDAMENTALS FETCH
//     ===================================================== */
//   useEffect(() => {
//     let alive = true;

//     async function loadFundamentals() {
//       if (!isin) {
//         setFundamentalsLoading(false);
//         return;
//       }
//       setFundamentalsLoading(true);
//       setFundamentalsError("");

//       try {
//         const response = await fetch(
//           `${API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,
//         );
//         const json = await response.json();

//         if (!response.ok || !json?.success) {
//           throw new Error(json?.message || "Unable to load fundamentals.");
//         }
//         if (!alive) return;

//         setFundamentalData(json.fundamentals || null);
//         setShareholdingData(json.shareholding || []);
//         setMutualFundData(json.mutualFunds || []);

//         const periods = (json.shareholding || [])
//           .flatMap((item) => (item.history || []).map((h) => h.period))
//           .filter(
//             (value, index, array) => value && array.indexOf(value) === index,
//           );

//         setSelectedShareholdingPeriod((current) => current || periods[0] || "");
//       } catch (error) {
//         if (!alive) return;
//         setFundamentalsError(error.message || "Unable to load fundamentals.");
//         setFundamentalData(null);
//         setShareholdingData([]);
//         setMutualFundData([]);
//       } finally {
//         if (alive) setFundamentalsLoading(false);
//       }
//     }

//     loadFundamentals();
//     const timer = setInterval(loadFundamentals, 15 * 60 * 1000);
//     return () => {
//       alive = false;
//       clearInterval(timer);
//     };
//   }, [isin]);

//   /* =====================================================
//        HISTORICAL PRICE DATA FETCH
//     ===================================================== */
//   useEffect(() => {
//     let alive = true;

//     async function loadHistory() {
//       setLoadingHistory(true);
//       const params = getHistoryParams(chartRange);
//       const to = new Date().toISOString().slice(0, 10);

//       try {
//         const url = `${API}/api/detail-stock/history/${encodeURIComponent(instrumentKey)}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(params.interval)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(to)}`;
//         const response = await fetch(url);
//         if (!response.ok)
//           throw new Error(`History request failed: ${response.status}`);

//         const json = await response.json();
//         if (!alive) return;

//         const candles = Array.isArray(json?.data)
//           ? json.data
//           : Array.isArray(json?.candles)
//             ? json.candles
//             : [];
//         setHistoricalData(candles);
//       } catch (error) {
//         console.error("Failed to fetch historical data:", error);
//         if (alive) setHistoricalData([]);
//       } finally {
//         if (alive) setLoadingHistory(false);
//       }
//     }

//     loadHistory();
//     return () => {
//       alive = false;
//     };
//   }, [chartRange, instrumentKey]);

//   /* =====================================================
//        LINE CHART PREPARATION
//     ===================================================== */
//   const lineChartData = useMemo(() => {
//     const values = historicalData
//       .map((item) =>
//         typeof item === "number" || typeof item === "string"
//           ? numberValue(item, NaN)
//           : numberValue(item?.close ?? item?.ltp ?? item?.price, NaN),
//       )
//       .filter(Number.isFinite);

//     if (!values.length && ltp > 0) return [ltp];
//     return values;
//   }, [historicalData, ltp]);

//   const lineChartSvg = useMemo(() => {
//     const width = 1000;
//     const height = 300;
//     const paddingX = 10;
//     const paddingY = 20;

//     if (!lineChartData.length) return { line: "", area: "", min: 0, max: 0 };

//     const min = Math.min(...lineChartData);
//     const max = Math.max(...lineChartData);
//     const range = max - min || 1;
//     const points = lineChartData.map((value, index) => {
//       const x =
//         lineChartData.length === 1
//           ? width / 2
//           : paddingX +
//           (index / (lineChartData.length - 1)) * (width - paddingX * 2);
//       const y =
//         height - paddingY - ((value - min) / range) * (height - paddingY * 2);
//       return `${x},${y}`;
//     });

//     return {
//       line: points.join(" "),
//       area:
//         points.length > 0
//           ? `M ${points[0]} L ${points.join(" L ")} L ${width - paddingX},${height} L ${paddingX},${height} Z`
//           : "",
//       min,
//       max,
//     };
//   }, [lineChartData]);

//   /* =====================================================
//        COMPUTED VALUES & ABOUT SECTION DATA
//     ===================================================== */
//   const calculated52WeekLow = useMemo(
//     () =>
//       week52Low > 0
//         ? week52Low
//         : lineChartData.length
//           ? Math.min(...lineChartData)
//           : 0,
//     [week52Low, lineChartData],
//   );
//   const calculated52WeekHigh = useMemo(
//     () =>
//       week52High > 0
//         ? week52High
//         : lineChartData.length
//           ? Math.max(...lineChartData)
//           : 0,
//     [week52High, lineChartData],
//   );

//   function getRangePosition(current, lowValue, highValue) {
//     const c = numberValue(current),
//       l = numberValue(lowValue),
//       h = numberValue(highValue);
//     if (!c || h <= l) return "50%";
//     return `${Math.max(0, Math.min(100, ((c - l) / (h - l)) * 100))}%`;
//   }

//   const effectivePrice =
//     numberValue(priceLimit) > 0 ? numberValue(priceLimit) : ltp;
//   const approximateRequired = numberValue(quantity) * effectivePrice;

//   // Company Description Details
//   const aboutInfo = useMemo(() => {
//     const fullDescription =
//       fundamentalData?.about ||
//       `${symbol} is a Fortune Global 500 company and the largest private sector company in India. The company's growth mirrors the relentless spirit of dynamism and hope that defines the nation, with its core motto being 'Growth is Life'. Its activities span hydrocarbon exploration and production, petroleum refining and marketing, petrochemicals, retail, digital services, and green energy.`;

//     return {
//       description: fullDescription,
//       ceo: fundamentalData?.ceo || "Mukesh D. Ambani",
//       founded: fundamentalData?.foundedIn || "1973",
//       nseSymbol: fundamentalData?.nseSymbol || "RELIANCE",
//     };
//   }, [fundamentalData, symbol]);

//   const fundamentals = useMemo(() => {
//     const data = fundamentalData || snapshot?.fundamentals;
//     return [
//       { label: "Market Cap", value: data?.marketCap ?? "N/A" },
//       { label: "ROE", value: data?.roe ?? "N/A" },
//       { label: "ROA", value: data?.roa ?? "N/A" },
//       { label: "ROCE", value: data?.roce ?? "N/A" },
//       { label: "P/E Ratio (TTM)", value: data?.peRatio ?? "N/A" },
//       { label: "P/B Ratio", value: data?.pbRatio ?? "N/A" },
//       { label: "EV / EBITDA", value: data?.evEbitda ?? "N/A" },
//       { label: "EPS (Basic)", value: data?.eps ?? "N/A" },
//       { label: "Revenue (Cr)", value: data?.revenue ?? "N/A" },
//       { label: "Operating Profit (Cr)", value: data?.operatingProfit ?? "N/A" },
//       { label: "Net Profit (Cr)", value: data?.netProfit ?? "N/A" },
//       { label: "Dividend Yield", value: data?.dividendYield ?? "N/A" },
//       { label: "Book Value", value: data?.bookValue ?? "N/A" },
//       { label: "Debt to Equity", value: data?.debtToEquity ?? "N/A" },
//       { label: "Face Value", value: data?.faceValue ?? "N/A" },
//       { label: "Sector", value: data?.sector ?? "N/A" },
//     ];
//   }, [fundamentalData, snapshot]);

//   const shareholdingPeriods = useMemo(() => {
//     const data = shareholdingData || snapshot?.shareholding || [];
//     const periods = [];
//     for (const item of Array.isArray(data) ? data : []) {
//       for (const row of item.history || []) {
//         if (row.period && !periods.includes(row.period))
//           periods.push(row.period);
//       }
//     }
//     return periods;
//   }, [shareholdingData, snapshot]);

//   const selectedShareholding = useMemo(() => {
//     const data = shareholdingData || snapshot?.shareholding || [];
//     if (!Array.isArray(data)) return [];
//     const period = selectedShareholdingPeriod || shareholdingPeriods[0];
//     return data.map((item) => {
//       const selected = (item.history || []).find(
//         (row) => row.period === period,
//       );
//       return {
//         label: item.label || item.name || item.category || "Unknown",
//         percentage: numberValue(
//           selected?.percentage ??
//           selected?.value ??
//           item.percentage ??
//           item.percent,
//         ),
//       };
//     });
//   }, [
//     shareholdingData,
//     snapshot,
//     selectedShareholdingPeriod,
//     shareholdingPeriods,
//   ]);

//   const mutualFunds = useMemo(() => {
//     const data = mutualFundData || snapshot?.mutualFunds;
//     if (!Array.isArray(data)) return [];
//     return data.map((fund, index) => ({
//       name: fund.name || fund.fundName || `Fund ${index + 1}`,
//       percentage: fund.percentage ?? fund.percent ?? fund.value ?? "N/A",
//       value: fund.period
//         ? `Latest quarter: ${fund.period}`
//         : (fund.value ?? fund.marketValue ?? "N/A"),
//     }));
//   }, [mutualFundData, snapshot]);

//   if (marketLoading && !snapshot) {
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
//     <div className="precision-dashboard">
//       <main className="precision-main">
//         <div className="precision-content">
//           {/* LEFT COLUMN */}
//           <div className="precision-left">
//             {/* STOCK HEADER CARD */}
//             <section className="stock-card">
//               <div className="stock-header">
//                 <div className="stock-main-info">
//                   <div>
//                     <div className="stock-meta">
//                       <span>{symbol}</span>
//                       <span className="stock-meta-dot" />
//                       <span>{exchange}</span>
//                     </div>
//                     <h1>{symbol}</h1>
//                     <div className="stock-price-row">
//                       <span className="stock-price">{formatCurrency(ltp)}</span>
//                       <span
//                         className={
//                           positive ? "stock-positive" : "stock-negative"
//                         }
//                       >
//                         {change >= 0 ? "+" : ""}
//                         {formatNumber(change)} ({formatPercent(changePercent)})
//                         1D
//                       </span>
//                     </div>
//                     {marketError && (
//                       <div className="detail-stock-error">{marketError}</div>
//                     )}
//                   </div>
//                 </div>

//                 <div className="stock-actions">
//                   <button
//                     className={isWatchlisted ? "watchlisted" : ""}
//                     onClick={() => setIsWatchlisted((v) => !v)}
//                     aria-label="Watchlist"
//                   >
//                     {isWatchlisted ? "★" : "☆"}
//                   </button>
//                 </div>
//               </div>

//               {/* REALTIME LINE CHART */}
//               {/* REALTIME LINE CHART WITH HOVER CROSSHAIR */}
//               <div className="chart-wrapper" style={{ height: "auto" }}>
//                 <div
//                   className="chart-area"
//                   onMouseMove={handleMouseMove}
//                   onMouseLeave={handleMouseLeave}
//                 >
//                   {loadingHistory && (
//                     <div className="chart-loading">Updating chart…</div>
//                   )}

//                   {/* Floating Price & Time Tooltip */}
//                   {hoverData && (
//                     <div
//                       className="chart-hover-tooltip"
//                       style={{ left: `${hoverData.percentX}%` }}
//                     >
//                       <span className="tooltip-price">
//                         {formatCurrency(hoverData.price)}
//                       </span>
//                       <span className="tooltip-divider">|</span>
//                       <span className="tooltip-time">{hoverData.time}</span>
//                     </div>
//                   )}

//                   <svg
//                     className="stock-chart"
//                     viewBox="0 0 1000 300"
//                     preserveAspectRatio="none"
//                   >
//                     <defs>
//                       <linearGradient
//                         id="stockGradient"
//                         x1="0"
//                         y1="0"
//                         x2="0"
//                         y2="1"
//                       >
//                         <stop
//                           offset="0%"
//                           stopColor="#00b28e"
//                           stopOpacity="0.22"
//                         />
//                         <stop
//                           offset="100%"
//                           stopColor="#00b28e"
//                           stopOpacity="0"
//                         />
//                       </linearGradient>
//                     </defs>

//                     {lineChartSvg.area && (
//                       <path d={lineChartSvg.area} fill="url(#stockGradient)" />
//                     )}

//                     {lineChartSvg.line && (
//                       <polyline
//                         points={lineChartSvg.line}
//                         fill="none"
//                         stroke="#00b28e"
//                         strokeWidth="4"
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                       />
//                     )}

//                     {/* Crosshair Vertical Line & Hover Dot */}
//                     {hoverData && (
//                       <g className="hover-crosshair">
//                         <line
//                           x1={hoverData.x}
//                           y1={0}
//                           x2={hoverData.x}
//                           y2={300}
//                           stroke="#e2e8f0"
//                           strokeWidth="2"
//                         />
//                         <circle
//                           cx={hoverData.x}
//                           cy={hoverData.y}
//                           r="6"
//                           fill="#ffffff"
//                           stroke="#00b28e"
//                           strokeWidth="3"
//                         />
//                       </g>
//                     )}
//                   </svg>

//                   {!hoverData && (
//                     <div className="chart-current-price">
//                       {formatCurrency(ltp)}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* RANGES */}
//               <div className="chart-footer" style={{ marginTop: "1.5rem" }}>
//                 <div className="chart-periods">
//                   {RANGES.map((period) => (
//                     <button
//                       key={period}
//                       className={chartRange === period ? "active" : ""}
//                       onClick={() => setChartRange(period)}
//                       disabled={loadingHistory}
//                     >
//                       <p style={{ margin: "0" }}>{period}</p>
//                     </button>
//                   ))}
//                 </div>
//               </div>
//             </section>

//             {/* PERFORMANCE SECTION */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>Performance</h2>
//               </div>
//               <div className="performance-card">
//                 <div className="range-block">
//                   <div className="range-title">
//                     <p>Today's low</p>
//                     <p>Today's high</p>
//                   </div>
//                   <div className="range-values">
//                     <p>{formatCurrency(low)}</p>
//                     <p>{formatCurrency(high)}</p>
//                   </div>
//                   <div className="range-line">
//                     <div
//                       className="range-marker"
//                       style={{ left: getRangePosition(ltp, low, high) }}
//                     />
//                   </div>
//                 </div>

//                 <div className="range-block">
//                   <div className="range-title">
//                     <p>52 week low</p>
//                     <p>52 week high</p>
//                   </div>
//                   <div className="range-values">
//                     <p>
//                       {calculated52WeekLow
//                         ? formatCurrency(calculated52WeekLow)
//                         : "—"}
//                     </p>
//                     <p>
//                       {calculated52WeekHigh
//                         ? formatCurrency(calculated52WeekHigh)
//                         : "—"}
//                     </p>
//                   </div>
//                   <div className="range-line">
//                     <div
//                       className="range-marker"
//                       style={{
//                         left: getRangePosition(
//                           ltp,
//                           calculated52WeekLow,
//                           calculated52WeekHigh,
//                         ),
//                       }}
//                     />
//                   </div>
//                 </div>

//                 <div className="performance-stats">
//                   <div>
//                     <span>Open price</span>
//                     <p>{open ? formatCurrency(open) : "—"}</p>
//                   </div>
//                   <div>
//                     <span>Previous close</span>
//                     <p>{previousClose ? formatCurrency(previousClose) : "—"}</p>
//                   </div>
//                   <div>
//                     <span>Live volume</span>
//                     <p>{volume ? formatCompact(volume) : "—"}</p>
//                   </div>
//                   <div>
//                     <span>Upper circuit</span>
//                     <p>{upperCircuit ? formatCurrency(upperCircuit) : "—"}</p>
//                   </div>
//                   <div>
//                     <span>Lower circuit</span>
//                     <p>{lowerCircuit ? formatCurrency(lowerCircuit) : "—"}</p>
//                   </div>
//                 </div>
//               </div>
//             </section>

//             {/* FUNDAMENTALS */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>Fundamentals</h2>
//               </div>
//               <div className="fundamentals-card">
//                 {fundamentalsLoading && <div>Loading fundamentals…</div>}
//                 {!fundamentalsLoading && fundamentalsError && (
//                   <div>Unable to load fundamentals: {fundamentalsError}</div>
//                 )}
//                 {!fundamentalsLoading &&
//                   !fundamentalsError &&
//                   fundamentals.map((item) => (
//                     <div className="fundamental-row" key={item.label}>
//                       <span>{item.label}</span>
//                       <p>{item.value}</p>
//                     </div>
//                   ))}
//               </div>
//             </section>

//             {/* SHAREHOLDING PATTERN */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>Shareholding Pattern</h2>
//               </div>
//               <div className="shareholding-card">
//                 <div className="shareholding-periods">
//                   {shareholdingPeriods.map((period) => (
//                     <button
//                       key={period}
//                       className={
//                         selectedShareholdingPeriod === period ? "active" : ""
//                       }
//                       onClick={() => setSelectedShareholdingPeriod(period)}
//                     >
//                       {period}
//                     </button>
//                   ))}
//                 </div>

//                 <div className="shareholding-list">
//                   {selectedShareholding.length > 0 ? (
//                     selectedShareholding.map((item) => (
//                       <div className="shareholding-row" key={item.label}>
//                         <div className="shareholding-label">
//                           <span>{item.label}</span>
//                           <p
//                             style={{
//                               color: "black",
//                               margin: 0,
//                               fontWeight: 500,
//                               fontSize: 15,
//                             }}
//                           >
//                             {item.percentage.toFixed(2)}%
//                           </p>
//                         </div>
//                         <div className="shareholding-bar">
//                           <div
//                             style={{
//                               width: `${Math.min(100, Math.max(0, item.percentage))}%`,
//                             }}
//                           />
//                         </div>
//                       </div>
//                     ))
//                   ) : (
//                     <div>Shareholding data unavailable</div>
//                   )}
//                 </div>
//               </div>
//             </section>

//             {/* FINANCIAL PERFORMANCE BAR CHART */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>Financial performance</h2>
//               </div>

//               <main className="dashboard-main">
//                 <div className="chart-card">
//                   <header className="chart-header">
//                     <div className="header-date">Jun '26</div>
//                     <div className="legend-row">
//                       <div className="legend-group">
//                         <div className="legend-title">
//                           <span className="legend-badge bg-bar-revenue"></span>
//                           <span className="legend-label">Revenue (CR)</span>
//                         </div>
//                         <div className="legend-metrics">
//                           <span className="metric-value">₹3,46,807</span>
//                           <span className="text-accent-green">+5.18%</span>
//                         </div>
//                       </div>

//                       <div className="legend-group">
//                         <div className="legend-title">
//                           <span className="legend-badge bg-bar-profit"></span>
//                           <span className="legend-label">Profit (CR)</span>
//                         </div>
//                         <div className="legend-metrics">
//                           <span className="metric-value">₹23,001</span>
//                           <span className="text-accent-green">+11.57%</span>
//                         </div>
//                       </div>
//                     </div>
//                   </header>

//                   <div className="chart-area">
//                     <div className="y-axis">
//                       <span>400k</span>
//                       <span>300k</span>
//                       <span>200k</span>
//                       <span>100k</span>
//                       <span>0</span>
//                     </div>

//                     <div className="grid-lines-container">
//                       <div className="grid-line-dashed"></div>
//                       <div className="grid-line-dashed"></div>
//                       <div className="grid-line-dashed"></div>
//                       <div className="grid-line-dashed"></div>
//                       <div className="grid-line-axis"></div>
//                     </div>

//                     <div className="bars-container">
//                       {financialBarData.map((item, index) => (
//                         <div key={index} className="bar-group">
//                           <div
//                             className="bar-single bg-bar-revenue"
//                             style={{ height: item.revenueHeight }}
//                           />
//                           <div
//                             className="bar-single bg-bar-profit"
//                             style={{ height: item.profitHeight }}
//                           />
//                           <span
//                             className={`x-axis-label ${item.active ? "active" : ""}`}
//                           >
//                             {item.quarter}
//                           </span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 {/* GROWTH METRICS */}
//                 <div className="growth-container">
//                   <div className="growth-flex">
//                     <div className="growth-section growth-section-left">
//                       <div className="growth-header">
//                         <h3 className="growth-title">Revenue Growth</h3>
//                         <span className="growth-title">Value</span>
//                       </div>
//                       <div className="growth-rows">
//                         <div className="growth-row">
//                           <span className="growth-label">1Y (TTM)</span>
//                           <span className="text-accent-green">+20%</span>
//                         </div>
//                         <div className="growth-row">
//                           <span className="growth-label">3Y CAGR</span>
//                           <span className="text-accent-green">+7.0%</span>
//                         </div>
//                       </div>
//                     </div>

//                     <div className="divider"></div>

//                     <div className="growth-section growth-section-right">
//                       <div className="growth-header">
//                         <h3 className="growth-title">Profit Growth</h3>
//                         <span className="growth-title">Value</span>
//                       </div>
//                       <div className="growth-rows">
//                         <div className="growth-row">
//                           <span className="growth-label">1Y (TTM)</span>
//                           <span className="text-accent-red">-25%</span>
//                         </div>
//                         <div className="growth-row">
//                           <span className="growth-label">3Y CAGR</span>
//                           <span className="text-accent-green">+9%</span>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </main>
//             </section>

//             {/* ABOUT SECTION */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>About</h2>
//               </div>

//               <div className="about-card">
//                 <p className="about-description">
//                   {isAboutExpanded
//                     ? aboutInfo.description
//                     : `${aboutInfo.description.slice(0, 190)}...`}
//                   <button
//                     type="button"
//                     className="read-more-btn"
//                     onClick={() => setIsAboutExpanded((prev) => !prev)}
//                   >
//                     {isAboutExpanded ? "Read less" : "Read more"}
//                   </button>
//                 </p>

//                 <div className="about-meta-grid">
//                   <div className="about-meta-item">
//                     <span className="about-meta-label">CEO/MD</span>
//                     <p className="about-meta-value">{aboutInfo.ceo}</p>
//                   </div>
//                   <div className="about-meta-item">
//                     <span className="about-meta-label">Founded in</span>
//                     <p className="about-meta-value">{aboutInfo.founded}</p>
//                   </div>
//                   <div className="about-meta-item">
//                     <span className="about-meta-label">NSE symbol</span>
//                     <p className="about-meta-value">{aboutInfo.nseSymbol}</p>
//                   </div>
//                 </div>
//               </div>
//             </section>

//             {/* MUTUAL FUNDS */}
//             {/* MUTUAL FUNDS INVESTED */}
//             <section className="content-section">
//               <div className="section-heading">
//                 <h2>Mutual Funds Invested ({mutualFunds.length || 4})</h2>
//               </div>

//               <div className="mf-table-card">
//                 {/* Header Row */}
//                 <div className="mf-table-header">
//                   <span className="mf-col-name">Fund name</span>
//                   <span className="mf-col-aum">AUM%</span>
//                 </div>

//                 {/* Table Rows */}
//                 <div className="mf-table-body">
//                   {(mutualFunds.length > 0
//                     ? mutualFunds
//                     : [
//                       {
//                         name: "HSBC Large and Mid Cap Fund Direct Growth",
//                         percentage: 0.37,
//                         logo: "https://logo.clearbit.com/hsbc.com",
//                       },
//                       {
//                         name: "Mahindra Manulife Focused Fund Direct Growth",
//                         percentage: 6.37,
//                         logo: "https://logo.clearbit.com/mahindramanulife.com",
//                       },
//                       {
//                         name: "Mahindra Manulife Flexi Cap Fund Direct Growth",
//                         percentage: 1.91,
//                         logo: "https://logo.clearbit.com/mahindramanulife.com",
//                       },
//                       {
//                         name: "Tata Flexi Cap Fund Direct Growth",
//                         percentage: 4.37,
//                         logo: "https://logo.clearbit.com/tatamutualfund.com",
//                       },
//                     ]
//                   ).map((fund, index) => (
//                     <div className="mf-row" key={index}>
//                       <div className="mf-left-group">
//                         <div className="mf-logo-wrapper">
//                           <img
//                             src={fund.logo || fund.icon}
//                             alt={fund.name}
//                             className="mf-logo-img"
//                             onError={(e) => {
//                               e.target.style.display = "none";
//                               e.target.nextSibling.style.display = "flex";
//                             }}
//                           />
//                           <div
//                             className="mf-logo-fallback"
//                             style={{ display: "none" }}
//                           >
//                             {fund.name ? fund.name[0] : "M"}
//                           </div>
//                         </div>
//                         <span className="mf-fund-name">{fund.name}</span>
//                       </div>

//                       <div className="mf-aum-value">
//                         {typeof fund.percentage === "number"
//                           ? fund.percentage.toFixed(2)
//                           : fund.percentage}
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </section>
//           </div>

//           {/* RIGHT COLUMN TRADING PANEL */}
//           <div
//             style={{
//               height: "fit-content",
//               width: "25rem",
//               minWidth: "20rem",
//               position: "sticky",
//               top: "140px",
//             }}
//           >
//             <div className="trading-panel">
//               <div className="trading-header">
//                 <p
//                   style={{
//                     margin: "0",
//                     fontSize: "1rem",
//                     fontWeight: "500",
//                     lineHeight: "1.357rem",
//                   }}
//                 >
//                   {symbol}
//                 </p>
//                 <div className="trading-market-info">
//                   <span>NSE</span>
//                   <span>{formatCurrency(ltp)}</span>
//                   <span>BSE</span>
//                   <span>{bsePrice ? formatCurrency(bsePrice) : "—"}</span>
//                   <span className={positive ? "positive" : "negative"}>
//                     {formatPercent(changePercent)}
//                   </span>
//                 </div>
//               </div>

//               <div className="order-tabs">
//                 <button
//                   className={orderType === "BUY" ? "active buy" : ""}
//                   onClick={() => setOrderType("BUY")}
//                 >
//                   BUY
//                 </button>
//                 <button
//                   className={orderType === "SELL" ? "active sell" : ""}
//                   onClick={() => setOrderType("SELL")}
//                 >
//                   SELL
//                 </button>
//               </div>

//               <div className="trading-body">
//                 <div
//                   style={{
//                     borderBottom: "1px solid #e2e6ea",
//                     paddingBottom: ".5rem",
//                   }}
//                 >
//                   <div className="order-field">
//                     <div className="order-label">
//                       <span>Qty</span>
//                     </div>
//                     <input
//                       type="number"
//                       min="0"
//                       value={quantity}
//                       onChange={(e) => setQuantity(e.target.value)}
//                       placeholder="0"
//                     />
//                   </div>
//                   <div className="order-field">
//                     <div className="order-label">
//                       <span>Price Limit</span>
//                     </div>
//                     <input
//                       type="number"
//                       min="0"
//                       value={priceLimit}
//                       placeholder={ltp ? String(ltp) : ""}
//                       onChange={(e) => setPriceLimit(e.target.value)}
//                     />
//                   </div>
//                 </div>

//                 <div className="order-summary">
//                   <span>Balance : ₹0</span>
//                   <div style={{ display: "flex", flexDirection: "column" }}>
//                     <p
//                       style={{
//                         margin: "0",
//                         paddingBottom: ".25rem",
//                         maxWidth: "5rem",
//                         textAlign: "end",
//                       }}
//                     >
//                       Approx
//                     </p>
//                     <p style={{ margin: "0" }}>
//                       {formatCurrency(approximateRequired)}
//                     </p>
//                   </div>
//                 </div>

//                 <button
//                   className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`}
//                   disabled={
//                     !marketOpen || !quantity || numberValue(quantity) <= 0
//                   }
//                 >
//                   {orderType}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }











































import React, { useEffect, useMemo, useState } from "react";
import detailStockSocket from "./detailStockWebSocketConnection";
// import "./FinancialDashboard.css";

const API = process.env.REACT_APP_DETAIL_STOCK_API || "http://localhost:3011";
const DEFAULT_INSTRUMENT = "NSE_EQ|INE020B01018";
const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];


/* =========================================================
   HELPERS
========================================================= */

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, digits = 2) {
  const n = numberValue(value);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value) {
  const n = numberValue(value);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCompact(value) {
  const n = numberValue(value);
  return n.toLocaleString("en-IN");
}

function formatPercent(value) {
  const n = numberValue(value);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function getHistoryParams(range) {
  switch (range) {
    case "1D":
      return { unit: "minutes", interval: "1", from: getDateDaysAgo(1) };
    case "1W":
      return { unit: "minutes", interval: "5", from: getDateDaysAgo(7) };
    case "1M":
      return { unit: "days", interval: "1", from: getDateDaysAgo(31) };
    case "3M":
      return { unit: "days", interval: "1", from: getDateDaysAgo(92) };
    case "6M":
      return { unit: "days", interval: "1", from: getDateDaysAgo(183) };
    case "1Y":
      return { unit: "days", interval: "1", from: getDateDaysAgo(365) };
    case "3Y":
      return { unit: "weeks", interval: "1", from: getDateDaysAgo(1095) };
    case "5Y":
      return { unit: "weeks", interval: "1", from: getDateDaysAgo(1825) };
    case "All":
      return { unit: "months", interval: "1", from: "2000-01-01" };
    default:
      return { unit: "minutes", interval: "1", from: getDateDaysAgo(1) };
  }
}

/* =========================================================
   BACKEND DATA NORMALIZATION
========================================================= */

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function formatMaybe(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
  }
  return String(value);
}

function extractHistoryRows(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.income_statement)) return source.income_statement;
  if (Array.isArray(source?.full_statement)) return source.full_statement;
  return [];
}

function extractCategoryHistory(source, category) {
  const rows = extractHistoryRows(source);
  const row = rows.find((item) => String(item?.category || "").toLowerCase() === category);
  return Array.isArray(row?.history) ? row.history : [];
}

function normalizeFinancialRows(source) {
  const revenue = extractCategoryHistory(source, "revenue");
  const profit = extractCategoryHistory(source, "net_profit");
  const byPeriod = new Map();

  for (const row of revenue) {
    const period = row?.period || row?.date || row?.year || "";
    if (!period) continue;
    byPeriod.set(period, {
      quarter: period,
      revenue: firstNumber(row?.value, row?.company_value, row?.amount, row?.revenue) || 0,
      profit: 0,
    });
  }

  for (const row of profit) {
    const period = row?.period || row?.date || row?.year || "";
    if (!period) continue;
    const existing = byPeriod.get(period) || { quarter: period, revenue: 0, profit: 0 };
    existing.profit = firstNumber(row?.value, row?.company_value, row?.amount, row?.netProfit) || 0;
    byPeriod.set(period, existing);
  }

  return [...byPeriod.values()].sort((a, b) => String(a.quarter).localeCompare(String(b.quarter)));
}

function normalizeFundamentalsResponse(json) {
  if (!json) return null;
  if (json.fundamentals || json.profile || json.shareholding || json.incomeStatement) return json;
  return json.data || json;
}

function normalizeAbout(profile, fundamentals, fallbackSymbol) {
  const p = profile || {};
  const f = fundamentals || {};
  return {
    description: p.description || p.about || p.business_description || f.about || "Company profile information is not available from the backend.",
    ceo: p.ceo || p.ceo_name || p.management?.ceo || "N/A",
    founded: p.foundedIn || p.founded_in || p.incorporation_date || "N/A",
    nseSymbol: p.nseSymbol || p.nse_symbol || p.symbol || fallbackSymbol || "N/A",
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ShareholdingPattern({
  instrumentKey = DEFAULT_INSTRUMENT,
  isin = instrumentKey.includes("|") ? instrumentKey.split("|")[1] : "",
  symbol = "Reliance Industries Limited",
  exchange = "NSE",
}) {
  /* =====================================================
       MARKET STATE
    ===================================================== */
  const [snapshot, setSnapshot] = useState(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [hoverData, setHoverData] = useState(null);

  /* =====================================================
       HISTORY & UI
    ===================================================== */
  const [chartRange, setChartRange] = useState("1D");
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [orderType, setOrderType] = useState("BUY");
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [priceLimit, setPriceLimit] = useState("");
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);

  /* =====================================================
       FUNDAMENTALS & SHAREHOLDING
    ===================================================== */
  const [fundamentalData, setFundamentalData] = useState(null);
  const [shareholdingData, setShareholdingData] = useState(null);
  const [mutualFundData, setMutualFundData] = useState(null);
  const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] =
    useState("");
  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
  const [fundamentalsError, setFundamentalsError] = useState("");

  /* =====================================================
       NORMALIZED MARKET VALUES
    ===================================================== */
  const ltp = numberValue(
    snapshot?.ltp ??
    snapshot?.price ??
    snapshot?.lastPrice ??
    snapshot?.close ??
    0,
  );
  const open = numberValue(snapshot?.open ?? snapshot?.openPrice ?? 0);
  const high = numberValue(snapshot?.high ?? snapshot?.dayHigh ?? 0);
  const low = numberValue(snapshot?.low ?? snapshot?.dayLow ?? 0);
  const previousClose = numberValue(
    snapshot?.previousClose ?? snapshot?.prevClose ?? snapshot?.close ?? 0,
  );
  const volume = numberValue(snapshot?.volume ?? snapshot?.totalVolume ?? 0);
  const change = numberValue(
    snapshot?.change ??
    snapshot?.netChange ??
    (ltp && previousClose ? ltp - previousClose : 0),
  );
  const changePercent = numberValue(
    snapshot?.changePercent ??
    snapshot?.changePercentage ??
    (previousClose ? (change / previousClose) * 100 : 0),
  );
  const upperCircuit = numberValue(
    snapshot?.upperCircuit ??
    snapshot?.upperLimit ??
    snapshot?.upperCircuitLimit ??
    0,
  );
  const lowerCircuit = numberValue(
    snapshot?.lowerCircuit ??
    snapshot?.lowerLimit ??
    snapshot?.lowerCircuitLimit ??
    0,
  );
  const week52Low = numberValue(
    snapshot?.week52Low ?? snapshot?.yearLow ?? snapshot?.fiftyTwoWeekLow ?? 0,
  );
  const week52High = numberValue(
    snapshot?.week52High ??
    snapshot?.yearHigh ??
    snapshot?.fiftyTwoWeekHigh ??
    0,
  );
  const bsePrice = numberValue(
    snapshot?.bsePrice ??
    snapshot?.bseLtp ??
    snapshot?.bseLastPrice ??
    snapshot?.bse ??
    0,
  );
  const positive = change >= 0;

  /* =====================================================
       FINANCIAL BAR CHART SCALED DATA
    ===================================================== */
  const financialRows = useMemo(() => {
    return normalizeFinancialRows(
      fundamentalData?.incomeStatement ||
      fundamentalData?.income_statement ||
      fundamentalData?.financialPerformance ||
      snapshot?.incomeStatement,
    );
  }, [fundamentalData, snapshot]);

  const financialBarData = useMemo(() => {
    if (!financialRows.length) return [];
    const maxValue = Math.max(1, ...financialRows.flatMap((x) => [x.revenue, x.profit]));
    return financialRows.slice(-5).map((item, index, rows) => ({
      ...item,
      revenueHeight: `${(item.revenue / maxValue) * 100}%`,
      profitHeight: `${(item.profit / maxValue) * 100}%`,
      active: index === rows.length - 1,
    }));
  }, [financialRows]);

  const lineChartPreparedData = useMemo(() => {
    if (!historicalData.length) {
      return ltp > 0 ? [{ price: ltp, time: "Live" }] : [];
    }
    return historicalData
      .map((item) => {
        let price = 0;
        let timeStr = "";

        if (typeof item === "number" || typeof item === "string") {
          price = numberValue(item, 0);
        } else if (Array.isArray(item)) {
          // Handle OHLC candle format [timestamp, open, high, low, close]
          timeStr = item[0]
            ? new Date(item[0]).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            : "";
          price = numberValue(item[4] ?? item[1], 0);
        } else {
          price = numberValue(item?.close ?? item?.ltp ?? item?.price, 0);
          const rawTime = item?.time ?? item?.timestamp ?? item?.date;
          timeStr = rawTime
            ? new Date(rawTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            : "";
        }

        return { price, time: timeStr || "12:22 PM" };
      })
      .filter((d) => Number.isFinite(d.price));
  }, [historicalData, ltp]);

  // 3. Mouse Movement Handler for Crosshair and Tooltip
  const handleMouseMove = (e) => {
    if (!lineChartPreparedData.length) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, mouseX / rect.width));

    const index = Math.round(percentage * (lineChartPreparedData.length - 1));
    const point = lineChartPreparedData[index];

    if (!point) return;

    const width = 1000;
    const height = 300;
    const paddingX = 10;
    const paddingY = 20;

    const min = lineChartSvg.min;
    const max = lineChartSvg.max;
    const range = max - min || 1;

    const svgX =
      lineChartPreparedData.length === 1
        ? width / 2
        : paddingX +
        (index / (lineChartPreparedData.length - 1)) * (width - paddingX * 2);
    const svgY =
      height -
      paddingY -
      ((point.price - min) / range) * (height - paddingY * 2);

    setHoverData({
      price: point.price,
      time: point.time,
      x: svgX,
      y: svgY,
      percentX: (mouseX / rect.width) * 100,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  /* =====================================================
       WEBSOCKET CONNECTION
     ===================================================== */
  useEffect(() => {
    let alive = true;
    let subscribed = false;
    setMarketLoading(true);
    setMarketError("");

    const belongsToStock = (data) =>
      data && (!data.instrumentKey || data.instrumentKey === instrumentKey);

    const applySnapshot = (data) => {
      if (!alive || !belongsToStock(data)) return;
      setSnapshot((previous) => ({ ...(previous || {}), ...data }));
      if (typeof data.marketOpen !== "undefined") setMarketOpen(Boolean(data.marketOpen));
      if (data.fundamentals) setFundamentalData((previous) => ({ ...(previous || {}), ...data.fundamentals }));
      if (Array.isArray(data.shareholding)) setShareholdingData(data.shareholding);
      if (Array.isArray(data.mutualFunds)) setMutualFundData(data.mutualFunds);
      setMarketLoading(false);
    };

    const handleSnapshot = applySnapshot;
    const handleTick = applySnapshot;

    const handleMarketStatus = (data) => {
      if (!alive || !belongsToStock(data)) return;
      setMarketOpen(Boolean(data.marketOpen));
      setSnapshot((previous) => ({
        ...(previous || {}),
        marketOpen: Boolean(data.marketOpen),
        marketStatus: data.marketStatus || (data.marketOpen ? "OPEN" : "CLOSED"),
      }));
    };

    const subscribe = () => {
      if (!alive || subscribed || !detailStockSocket.connected) return;
      detailStockSocket.emit("detailStock:subscribe", { instrumentKey }, (ack) => {
        if (!alive) return;
        if (!ack?.success) {
          subscribed = false;
          setMarketError(ack?.message || "Unable to subscribe to market data.");
          setMarketLoading(false);
          return;
        }
        subscribed = true;
        setMarketError("");
        if (ack.snapshot) applySnapshot(ack.snapshot);
        if (typeof ack.marketOpen !== "undefined") setMarketOpen(Boolean(ack.marketOpen));
      });
    };

    const handleConnect = () => {
      subscribed = false;
      setMarketLoading(true);
      subscribe();
    };

    const handleDisconnect = () => {
      subscribed = false;
      if (alive) setMarketOpen(false);
    };

    detailStockSocket.on("detailStock:snapshot", handleSnapshot);
    detailStockSocket.on("detailStock:tick", handleTick);
    detailStockSocket.on("detailStock:market-status", handleMarketStatus);
    detailStockSocket.on("connect", handleConnect);
    detailStockSocket.on("disconnect", handleDisconnect);

    if (detailStockSocket.connected) subscribe();

    return () => {
      alive = false;
      if (detailStockSocket.connected && subscribed) {
        detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
      }
      detailStockSocket.off("detailStock:snapshot", handleSnapshot);
      detailStockSocket.off("detailStock:tick", handleTick);
      detailStockSocket.off("detailStock:market-status", handleMarketStatus);
      detailStockSocket.off("connect", handleConnect);
      detailStockSocket.off("disconnect", handleDisconnect);
    };
  }, [instrumentKey]);

  /* =====================================================
       FUNDAMENTALS FETCH
    ===================================================== */
  useEffect(() => {
    let alive = true;

    async function loadFundamentals() {
      if (!isin) {
        setFundamentalsLoading(false);
        return;
      }
      setFundamentalsLoading(true);
      setFundamentalsError("");

      try {
        const response = await fetch(
          `${API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,
        );
        const json = await response.json();

        if (!response.ok || !json?.success) {
          throw new Error(json?.message || "Unable to load fundamentals.");
        }
        if (!alive) return;

        const data = normalizeFundamentalsResponse(json) || {};
        setFundamentalData(data.fundamentals || data);
        setShareholdingData(Array.isArray(data.shareholding) ? data.shareholding : []);
        setMutualFundData(Array.isArray(data.mutualFunds) ? data.mutualFunds : []);

        if (!Array.isArray(data.shareholding) || !Array.isArray(data.mutualFunds)) {
          try {
            const holdingResponse = await fetch(
              `${API}/api/detail-stock/shareholding/${encodeURIComponent(isin)}`,
            );
            const holdingJson = await holdingResponse.json();
            if (holdingResponse.ok && holdingJson?.success) {
              setShareholdingData(holdingJson.shareholding || []);
              setMutualFundData(holdingJson.mutualFunds || []);
            }
          } catch {}
        }

        const periods = (data.shareholding || [])
          .flatMap((item) => (item.history || []).map((h) => h.period))
          .filter(
            (value, index, array) => value && array.indexOf(value) === index,
          );

        setSelectedShareholdingPeriod((current) => current || periods[0] || "");
      } catch (error) {
        if (!alive) return;
        setFundamentalsError(error.message || "Unable to load fundamentals.");
        setFundamentalData(null);
        setShareholdingData([]);
        setMutualFundData([]);
      } finally {
        if (alive) setFundamentalsLoading(false);
      }
    }

    loadFundamentals();
    const timer = setInterval(loadFundamentals, 15 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isin]);

  /* =====================================================
       HISTORICAL PRICE DATA FETCH
    ===================================================== */
  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      setLoadingHistory(true);
      const params = getHistoryParams(chartRange);
      const to = getIndiaDate();

      try {
        const url = `${API}/api/detail-stock/history/${encodeURIComponent(instrumentKey)}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(params.interval)}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(to)}`;
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`History request failed: ${response.status}`);

        const json = await response.json();
        if (!alive) return;

        const candles = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.candles)
            ? json.candles
            : [];
        setHistoricalData(candles);
      } catch (error) {
        console.error("Failed to fetch historical data:", error);
        if (alive) setHistoricalData([]);
      } finally {
        if (alive) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      alive = false;
    };
  }, [chartRange, instrumentKey]);

  /* =====================================================
       LINE CHART PREPARATION
    ===================================================== */
  const lineChartData = useMemo(() => {
    const values = historicalData
      .map((item) =>
        typeof item === "number" || typeof item === "string"
          ? numberValue(item, NaN)
          : numberValue(item?.close ?? item?.ltp ?? item?.price, NaN),
      )
      .filter(Number.isFinite);

    if (!values.length && ltp > 0) return [ltp];
    return values;
  }, [historicalData, ltp]);

  const lineChartSvg = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 10;
    const paddingY = 20;

    if (!lineChartData.length) return { line: "", area: "", min: 0, max: 0 };

    const min = Math.min(...lineChartData);
    const max = Math.max(...lineChartData);
    const range = max - min || 1;
    const points = lineChartData.map((value, index) => {
      const x =
        lineChartData.length === 1
          ? width / 2
          : paddingX +
          (index / (lineChartData.length - 1)) * (width - paddingX * 2);
      const y =
        height - paddingY - ((value - min) / range) * (height - paddingY * 2);
      return `${x},${y}`;
    });

    return {
      line: points.join(" "),
      area:
        points.length > 0
          ? `M ${points[0]} L ${points.join(" L ")} L ${width - paddingX},${height} L ${paddingX},${height} Z`
          : "",
      min,
      max,
    };
  }, [lineChartData]);

  /* =====================================================
       COMPUTED VALUES & ABOUT SECTION DATA
    ===================================================== */
  const calculated52WeekLow = useMemo(
    () =>
      week52Low > 0
        ? week52Low
        : lineChartData.length
          ? Math.min(...lineChartData)
          : 0,
    [week52Low, lineChartData],
  );
  const calculated52WeekHigh = useMemo(
    () =>
      week52High > 0
        ? week52High
        : lineChartData.length
          ? Math.max(...lineChartData)
          : 0,
    [week52High, lineChartData],
  );

  function getRangePosition(current, lowValue, highValue) {
    const c = numberValue(current),
      l = numberValue(lowValue),
      h = numberValue(highValue);
    if (!c || h <= l) return "50%";
    return `${Math.max(0, Math.min(100, ((c - l) / (h - l)) * 100))}%`;
  }

  const effectivePrice =
    numberValue(priceLimit) > 0 ? numberValue(priceLimit) : ltp;
  const approximateRequired = numberValue(quantity) * effectivePrice;

  // Company Description Details
  const aboutInfo = useMemo(() => {
    return normalizeAbout(
      fundamentalData?.profile || snapshot?.profile,
      fundamentalData,
      snapshot?.symbol || symbol,
    );
  }, [fundamentalData, snapshot, symbol]);

  const fundamentals = useMemo(() => {
    const data = fundamentalData || snapshot?.fundamentals;
    return [
      { label: "Market Cap", value: data?.marketCap ?? data?.market_cap ?? "N/A" },
      { label: "ROE", value: data?.roe ?? "N/A" },
      { label: "ROA", value: data?.roa ?? "N/A" },
      { label: "ROCE", value: data?.roce ?? "N/A" },
      { label: "P/E Ratio (TTM)", value: data?.peRatio ?? "N/A" },
      { label: "P/B Ratio", value: data?.pbRatio ?? "N/A" },
      { label: "EV / EBITDA", value: data?.evEbitda ?? "N/A" },
      { label: "EPS (Basic)", value: data?.eps ?? "N/A" },
      { label: "Revenue (Cr)", value: data?.revenue ?? "N/A" },
      { label: "Operating Profit (Cr)", value: data?.operatingProfit ?? "N/A" },
      { label: "Net Profit (Cr)", value: data?.netProfit ?? "N/A" },
      { label: "Dividend Yield", value: data?.dividendYield ?? "N/A" },
      { label: "Book Value", value: data?.bookValue ?? "N/A" },
      { label: "Debt to Equity", value: data?.debtToEquity ?? "N/A" },
      { label: "Face Value", value: data?.faceValue ?? "N/A" },
      { label: "Sector", value: data?.sector ?? "N/A" },
    ];
  }, [fundamentalData, snapshot]);

  const shareholdingPeriods = useMemo(() => {
    const data = shareholdingData || snapshot?.shareholding || [];
    const periods = [];
    for (const item of Array.isArray(data) ? data : []) {
      for (const row of item.history || []) {
        if (row.period && !periods.includes(row.period))
          periods.push(row.period);
      }
    }
    return periods;
  }, [shareholdingData, snapshot]);

  const selectedShareholding = useMemo(() => {
    const data = shareholdingData || snapshot?.shareholding || [];
    if (!Array.isArray(data)) return [];
    const period = selectedShareholdingPeriod || shareholdingPeriods[0];
    return data.map((item) => {
      const selected = (item.history || []).find(
        (row) => row.period === period,
      );
      return {
        label: item.label || item.name || item.category || "Unknown",
        percentage: numberValue(
          selected?.percentage ??
          selected?.value ??
          item.percentage ??
          item.percent,
        ),
      };
    });
  }, [
    shareholdingData,
    snapshot,
    selectedShareholdingPeriod,
    shareholdingPeriods,
  ]);

  const mutualFunds = useMemo(() => {
    const data = mutualFundData || snapshot?.mutualFunds;
    if (!Array.isArray(data)) return [];
    return data.map((fund, index) => ({
      name: fund.name || fund.fundName || `Fund ${index + 1}`,
      percentage: fund.percentage ?? fund.percent ?? fund.value ?? "N/A",
      value: fund.period
        ? `Latest quarter: ${fund.period}`
        : (fund.value ?? fund.marketValue ?? "N/A"),
    }));
  }, [mutualFundData, snapshot]);

  if (marketLoading && !snapshot) {
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
    <div className="precision-dashboard">
      <main className="precision-main">
        <div className="precision-content">
          {/* LEFT COLUMN */}
          <div className="precision-left">
            {/* STOCK HEADER CARD */}
            <section className="stock-card">
              <div className="stock-header">
                <div className="stock-main-info">
                  <div>
                    <div className="stock-meta">
                      <span>{snapshot?.symbol || snapshot?.tradingSymbol || symbol}</span>
                      <span className="stock-meta-dot" />
                      <span>{snapshot?.exchange || exchange}</span>
                    </div>
                    <h1>{snapshot?.name || snapshot?.symbol || symbol}</h1>
                    <div className="stock-price-row">
                      <span className="stock-price">{formatCurrency(ltp)}</span>
                      <span
                        className={
                          positive ? "stock-positive" : "stock-negative"
                        }
                      >
                        {change >= 0 ? "+" : ""}
                        {formatNumber(change)} ({formatPercent(changePercent)})
                        1D
                      </span>
                    </div>
                    {marketError && (
                      <div className="detail-stock-error">{marketError}</div>
                    )}
                  </div>
                </div>

                <div className="stock-actions">
                  <button
                    className={isWatchlisted ? "watchlisted" : ""}
                    onClick={() => setIsWatchlisted((v) => !v)}
                    aria-label="Watchlist"
                  >
                    {isWatchlisted ? "★" : "☆"}
                  </button>
                </div>
              </div>

              {/* REALTIME LINE CHART */}
              {/* REALTIME LINE CHART WITH HOVER CROSSHAIR */}
              <div className="chart-wrapper" style={{ height: "auto" }}>
                <div
                  className="chart-area"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  {loadingHistory && (
                    <div className="chart-loading">Updating chart…</div>
                  )}

                  {/* Floating Price & Time Tooltip */}
                  {hoverData && (
                    <div
                      className="chart-hover-tooltip"
                      style={{ left: `${hoverData.percentX}%` }}
                    >
                      <span className="tooltip-price">
                        {formatCurrency(hoverData.price)}
                      </span>
                      <span className="tooltip-divider">|</span>
                      <span className="tooltip-time">{hoverData.time}</span>
                    </div>
                  )}

                  <svg
                    className="stock-chart"
                    viewBox="0 0 1000 300"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient
                        id="stockGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#00b28e"
                          stopOpacity="0.22"
                        />
                        <stop
                          offset="100%"
                          stopColor="#00b28e"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>

                    {lineChartSvg.area && (
                      <path d={lineChartSvg.area} fill="url(#stockGradient)" />
                    )}

                    {lineChartSvg.line && (
                      <polyline
                        points={lineChartSvg.line}
                        fill="none"
                        stroke="#00b28e"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Crosshair Vertical Line & Hover Dot */}
                    {hoverData && (
                      <g className="hover-crosshair">
                        <line
                          x1={hoverData.x}
                          y1={0}
                          x2={hoverData.x}
                          y2={300}
                          stroke="#e2e8f0"
                          strokeWidth="2"
                        />
                        <circle
                          cx={hoverData.x}
                          cy={hoverData.y}
                          r="6"
                          fill="#ffffff"
                          stroke="#00b28e"
                          strokeWidth="3"
                        />
                      </g>
                    )}
                  </svg>

                  {!hoverData && (
                    <div className="chart-current-price">
                      {formatCurrency(ltp)}
                    </div>
                  )}
                </div>
              </div>

              {/* RANGES */}
              <div className="chart-footer" style={{ marginTop: "1.5rem" }}>
                <div className="chart-periods">
                  {RANGES.map((period) => (
                    <button
                      key={period}
                      className={chartRange === period ? "active" : ""}
                      onClick={() => setChartRange(period)}
                      disabled={loadingHistory}
                    >
                      <p style={{ margin: "0" }}>{period}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* PERFORMANCE SECTION */}
            <section className="content-section">
              <div className="section-heading">
                <h2>Performance</h2>
              </div>
              <div className="performance-card">
                <div className="range-block">
                  <div className="range-title">
                    <p>Today's low</p>
                    <p>Today's high</p>
                  </div>
                  <div className="range-values">
                    <p>{formatCurrency(low)}</p>
                    <p>{formatCurrency(high)}</p>
                  </div>
                  <div className="range-line">
                    <div
                      className="range-marker"
                      style={{ left: getRangePosition(ltp, low, high) }}
                    />
                  </div>
                </div>

                <div className="range-block">
                  <div className="range-title">
                    <p>52 week low</p>
                    <p>52 week high</p>
                  </div>
                  <div className="range-values">
                    <p>
                      {calculated52WeekLow
                        ? formatCurrency(calculated52WeekLow)
                        : "—"}
                    </p>
                    <p>
                      {calculated52WeekHigh
                        ? formatCurrency(calculated52WeekHigh)
                        : "—"}
                    </p>
                  </div>
                  <div className="range-line">
                    <div
                      className="range-marker"
                      style={{
                        left: getRangePosition(
                          ltp,
                          calculated52WeekLow,
                          calculated52WeekHigh,
                        ),
                      }}
                    />
                  </div>
                </div>

                <div className="performance-stats">
                  <div>
                    <span>Open price</span>
                    <p>{open ? formatCurrency(open) : "—"}</p>
                  </div>
                  <div>
                    <span>Previous close</span>
                    <p>{previousClose ? formatCurrency(previousClose) : "—"}</p>
                  </div>
                  <div>
                    <span>Live volume</span>
                    <p>{volume ? formatCompact(volume) : "—"}</p>
                  </div>
                  <div>
                    <span>Upper circuit</span>
                    <p>{upperCircuit ? formatCurrency(upperCircuit) : "—"}</p>
                  </div>
                  <div>
                    <span>Lower circuit</span>
                    <p>{lowerCircuit ? formatCurrency(lowerCircuit) : "—"}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* FUNDAMENTALS */}
            <section className="content-section">
              <div className="section-heading">
                <h2>Fundamentals</h2>
              </div>
              <div className="fundamentals-card">
                {fundamentalsLoading && <div>Loading fundamentals…</div>}
                {!fundamentalsLoading && fundamentalsError && (
                  <div>Unable to load fundamentals: {fundamentalsError}</div>
                )}
                {!fundamentalsLoading &&
                  !fundamentalsError &&
                  fundamentals.map((item) => (
                    <div className="fundamental-row" key={item.label}>
                      <span>{item.label}</span>
                      <p>{item.value}</p>
                    </div>
                  ))}
              </div>
            </section>

            {/* SHAREHOLDING PATTERN */}
            <section className="content-section">
              <div className="section-heading">
                <h2>Shareholding Pattern</h2>
              </div>
              <div className="shareholding-card">
                <div className="shareholding-periods">
                  {shareholdingPeriods.map((period) => (
                    <button
                      key={period}
                      className={
                        selectedShareholdingPeriod === period ? "active" : ""
                      }
                      onClick={() => setSelectedShareholdingPeriod(period)}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                <div className="shareholding-list">
                  {selectedShareholding.length > 0 ? (
                    selectedShareholding.map((item) => (
                      <div className="shareholding-row" key={item.label}>
                        <div className="shareholding-label">
                          <span>{item.label}</span>
                          <p
                            style={{
                              color: "black",
                              margin: 0,
                              fontWeight: 500,
                              fontSize: 15,
                            }}
                          >
                            {item.percentage.toFixed(2)}%
                          </p>
                        </div>
                        <div className="shareholding-bar">
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, item.percentage))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div>Shareholding data unavailable</div>
                  )}
                </div>
              </div>
            </section>

            {/* FINANCIAL PERFORMANCE BAR CHART */}
            <section className="content-section">
              <div className="section-heading">
                <h2>Financial performance</h2>
              </div>

              <main className="dashboard-main">
                <div className="chart-card">
                  <header className="chart-header">
                    <div className="header-date">{financialBarData[financialBarData.length - 1]?.quarter || "—"}</div>
                    <div className="legend-row">
                      <div className="legend-group">
                        <div className="legend-title">
                          <span className="legend-badge bg-bar-revenue"></span>
                          <span className="legend-label">Revenue (CR)</span>
                        </div>
                        <div className="legend-metrics">
                          <span className="metric-value">{financialBarData.length ? formatMaybe(financialBarData[financialBarData.length - 1].revenue) : "—"}</span>
                          <span className="text-accent-green">—</span>
                        </div>
                      </div>

                      <div className="legend-group">
                        <div className="legend-title">
                          <span className="legend-badge bg-bar-profit"></span>
                          <span className="legend-label">Profit (CR)</span>
                        </div>
                        <div className="legend-metrics">
                          <span className="metric-value">{financialBarData.length ? formatMaybe(financialBarData[financialBarData.length - 1].profit) : "—"}</span>
                          <span className="text-accent-green">—</span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <div className="chart-area">
                    <div className="y-axis">
                      <span>{financialBarData.length ? formatMaybe(Math.max(...financialBarData.flatMap((x) => [x.revenue, x.profit]))) : "—"}</span>
                      <span>{financialBarData.length ? formatMaybe(Math.max(...financialBarData.flatMap((x) => [x.revenue, x.profit])) * 0.75) : "—"}</span>
                      <span>{financialBarData.length ? formatMaybe(Math.max(...financialBarData.flatMap((x) => [x.revenue, x.profit])) * 0.5) : "—"}</span>
                      <span>{financialBarData.length ? formatMaybe(Math.max(...financialBarData.flatMap((x) => [x.revenue, x.profit])) * 0.25) : "—"}</span>
                      <span>0</span>
                    </div>

                    <div className="grid-lines-container">
                      <div className="grid-line-dashed"></div>
                      <div className="grid-line-dashed"></div>
                      <div className="grid-line-dashed"></div>
                      <div className="grid-line-dashed"></div>
                      <div className="grid-line-axis"></div>
                    </div>

                    <div className="bars-container">
                      {financialBarData.map((item, index) => (
                        <div key={index} className="bar-group">
                          <div
                            className="bar-single bg-bar-revenue"
                            style={{ height: item.revenueHeight }}
                          />
                          <div
                            className="bar-single bg-bar-profit"
                            style={{ height: item.profitHeight }}
                          />
                          <span
                            className={`x-axis-label ${item.active ? "active" : ""}`}
                          >
                            {item.quarter}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* GROWTH METRICS */}
                <div className="growth-container">
                  <div className="growth-flex">
                    <div className="growth-section growth-section-left">
                      <div className="growth-header">
                        <h3 className="growth-title">Revenue Growth</h3>
                        <span className="growth-title">Value</span>
                      </div>
                      <div className="growth-rows">
                        <div className="growth-row">
                          <span className="growth-label">Latest period</span>
                          <span className="text-accent-green">{financialBarData.length ? formatMaybe(financialBarData[financialBarData.length - 1].revenue) : "—"}</span>
                        </div>
                        <div className="growth-row">
                          <span className="growth-label">Previous period</span>
                          <span className="text-accent-green">{financialBarData.length > 1 ? formatMaybe(financialBarData[financialBarData.length - 2].revenue) : "—"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="divider"></div>

                    <div className="growth-section growth-section-right">
                      <div className="growth-header">
                        <h3 className="growth-title">Profit Growth</h3>
                        <span className="growth-title">Value</span>
                      </div>
                      <div className="growth-rows">
                        <div className="growth-row">
                          <span className="growth-label">Latest period</span>
                          <span className="text-accent-green">{financialBarData.length ? formatMaybe(financialBarData[financialBarData.length - 1].profit) : "—"}</span>
                        </div>
                        <div className="growth-row">
                          <span className="growth-label">Previous period</span>
                          <span className="text-accent-green">{financialBarData.length > 1 ? formatMaybe(financialBarData[financialBarData.length - 2].profit) : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </main>
            </section>

            {/* ABOUT SECTION */}
            <section className="content-section">
              <div className="section-heading">
                <h2>About</h2>
              </div>

              <div className="about-card">
                <p className="about-description">
                  {isAboutExpanded
                    ? aboutInfo.description
                    : `${aboutInfo.description.slice(0, 190)}...`}
                  <button
                    type="button"
                    className="read-more-btn"
                    onClick={() => setIsAboutExpanded((prev) => !prev)}
                  >
                    {isAboutExpanded ? "Read less" : "Read more"}
                  </button>
                </p>

                <div className="about-meta-grid">
                  <div className="about-meta-item">
                    <span className="about-meta-label">CEO/MD</span>
                    <p className="about-meta-value">{aboutInfo.ceo}</p>
                  </div>
                  <div className="about-meta-item">
                    <span className="about-meta-label">Founded in</span>
                    <p className="about-meta-value">{aboutInfo.founded}</p>
                  </div>
                  <div className="about-meta-item">
                    <span className="about-meta-label">NSE symbol</span>
                    <p className="about-meta-value">{aboutInfo.nseSymbol}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* MUTUAL FUNDS */}
            {/* MUTUAL FUNDS INVESTED */}
            <section className="content-section">
              <div className="section-heading">
                <h2>Mutual Funds Invested ({mutualFunds.length})</h2>
              </div>

              <div className="mf-table-card">
                {/* Header Row */}
                <div className="mf-table-header">
                  <span className="mf-col-name">Fund name</span>
                  <span className="mf-col-aum">AUM%</span>
                </div>

                {/* Table Rows */}
                <div className="mf-table-body">
                  {mutualFunds.map((fund, index) => (
                    <div className="mf-row" key={index}>
                      <div className="mf-left-group">
                        <div className="mf-logo-wrapper">
                          <img
                            src={fund.logo || fund.icon}
                            alt={fund.name}
                            className="mf-logo-img"
                            onError={(e) => {
                              e.target.style.display = "none";
                              e.target.nextSibling.style.display = "flex";
                            }}
                          />
                          <div
                            className="mf-logo-fallback"
                            style={{ display: "none" }}
                          >
                            {fund.name ? fund.name[0] : "M"}
                          </div>
                        </div>
                        <span className="mf-fund-name">{fund.name}</span>
                      </div>

                      <div className="mf-aum-value">
                        {typeof fund.percentage === "number"
                          ? fund.percentage.toFixed(2)
                          : fund.percentage}
                      </div>
                    </div>
                  ))}
                  {mutualFunds.length === 0 && (
                    <div className="mf-row">Mutual fund ownership data unavailable</div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN TRADING PANEL */}
          <div
            style={{
              height: "fit-content",
              width: "25rem",
              minWidth: "20rem",
              position: "sticky",
              top: "140px",
            }}
          >
            <div className="trading-panel">
              <div className="trading-header">
                <p
                  style={{
                    margin: "0",
                    fontSize: "1rem",
                    fontWeight: "500",
                    lineHeight: "1.357rem",
                  }}
                >
                  {snapshot?.symbol || snapshot?.tradingSymbol || symbol}
                </p>
                <div className="trading-market-info">
                  <span>{snapshot?.exchange || exchange}</span>
                  <span>{formatCurrency(ltp)}</span>
                  <span>BSE</span>
                  <span>{bsePrice ? formatCurrency(bsePrice) : "—"}</span>
                  <span className={positive ? "positive" : "negative"}>
                    {formatPercent(changePercent)}
                  </span>
                </div>
              </div>

              <div className="order-tabs">
                <button
                  className={orderType === "BUY" ? "active buy" : ""}
                  onClick={() => setOrderType("BUY")}
                >
                  BUY
                </button>
                <button
                  className={orderType === "SELL" ? "active sell" : ""}
                  onClick={() => setOrderType("SELL")}
                >
                  SELL
                </button>
              </div>

              <div className="trading-body">
                <div
                  style={{
                    borderBottom: "1px solid #e2e6ea",
                    paddingBottom: ".5rem",
                  }}
                >
                  <div className="order-field">
                    <div className="order-label">
                      <span>Qty</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="order-field">
                    <div className="order-label">
                      <span>Price Limit</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={priceLimit}
                      placeholder={ltp ? String(ltp) : ""}
                      onChange={(e) => setPriceLimit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="order-summary">
                  <span>Balance : ₹0</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <p
                      style={{
                        margin: "0",
                        paddingBottom: ".25rem",
                        maxWidth: "5rem",
                        textAlign: "end",
                      }}
                    >
                      Approx
                    </p>
                    <p style={{ margin: "0" }}>
                      {formatCurrency(approximateRequired)}
                    </p>
                  </div>
                </div>

                <button
                  className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`}
                  disabled={
                    !marketOpen || !quantity || numberValue(quantity) <= 0
                  }
                >
                  {orderType}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}