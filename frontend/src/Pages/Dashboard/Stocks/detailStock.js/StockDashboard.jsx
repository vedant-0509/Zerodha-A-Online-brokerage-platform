import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";


import detailStockSocket from "./detailStockWebSocketConnection";
import { SYMBOL_ISIN_MAP, ENDPOINTS, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING_X, CHART_PADDING_Y, LIVE_TICK_THROTTLE_MS } from "./config/stockConfig";
import { numberValue, nullableNumber, firstDefined, getFinancialNumber } from "./utils/formatters";
import { getIndiaDate, getHistoryParams, parseHistoryTimestamp, indiaDateFromTimestamp, isISTTradingTimestamp, getMarketTimestamp, getISTMarketProgress } from "./utils/dateHelpers";
import { unwrapResponse, normalizeStock, normalizeFundamentals, normalizeShareholding, normalizeMutualFunds, normalizeFinancialRows, normalizeHistory, normalizeMarketStatus, normalizeAbout } from "./utils/normalizers";


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


export default function StockDashboard({ instrumentKey: propInstrumentKey, isin: propIsin }) {
  const { symbol: routeSymbol } = useParams();
  const location = useLocation();
  const initialStock = location.state || null;
  const symbol = routeSymbol || initialStock?.symbol || initialStock?.tradingSymbol || "";

  /* STATE */
  const [stockInfo, setStockInfo] = useState(initialStock);
  const [snapshot, setSnapshot] = useState(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [history, setHistory] = useState([]);
  const [chartRange, setChartRange] = useState("1D");

  const chartSessionDateRef = useRef(getIndiaDate());
  const lastLiveTickRef = useRef(0);
  const pendingLiveTickRef = useRef(null);
  const liveTickFlushTimerRef = useRef(null);
  const wsGenerationRef = useRef(0);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [fundamentalData, setFundamentalData] = useState(null);
  const [shareholdingData, setShareholdingData] = useState([]);
  const [mutualFundData, setMutualFundData] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
  const [fundamentalsError, setFundamentalsError] = useState("");
  const [selectedShareholdingPeriod, setSelectedShareholdingPeriod] = useState("");
  const [hoverData, setHoverData] = useState(null);
  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
  const [orderType, setOrderType] = useState("BUY");
  const [quantity, setQuantity] = useState("1");
  const [priceLimit, setPriceLimit] = useState("");
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState("");

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
        const response = await axios.get(ENDPOINTS.stock(symbol), { timeout: 15000, signal: controller.signal });
        const stock = normalizeStock(response.data, symbol);
        setStockInfo((previous) => ({ ...(previous || {}), ...stock }));
      } catch (error) {
        if (axios.isCancel(error) || error?.code === "ERR_CANCELED") return;
        setStockError(error?.response?.data?.message || error?.message || "Failed to load stock details.");
      } finally {
        if (!controller.signal.aborted) setStockLoading(false);
      }
    }
    loadStock();
    return () => controller.abort();
  }, [symbol]);

  const instrumentKey = propInstrumentKey || stockInfo?.instrumentKey || stockInfo?.instrument_key || initialStock?.instrumentKey || initialStock?.instrument_key || "";
  const isin = propIsin || stockInfo?.isin || stockInfo?.ISIN || initialStock?.isin || initialStock?.ISIN || SYMBOL_ISIN_MAP[symbol?.toUpperCase()] || "";

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

      if (statusResult.status === "fulfilled") isOpen = normalizeMarketStatus(statusResult.value.data);
      if (snapshotResult.status === "fulfilled") {
        initialSnapshot = unwrapResponse(snapshotResult.value.data);
        if (typeof initialSnapshot?.marketOpen === "boolean") isOpen = initialSnapshot.marketOpen;
      }

      if (isOpen === null) isOpen = normalizeMarketStatus({});
      setMarketOpen(Boolean(isOpen));
      if (initialSnapshot) setSnapshot(initialSnapshot);
    } catch (error) {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED" || signal.aborted) return;
      setMarketError(error?.response?.data?.message || error?.message || "Unable to load market data.");
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

  /* LOAD STATIC DATA VIA ISIN */
  useEffect(() => {
    if (!isin) {
      setFundamentalsLoading(false);
      return;
    }
    const controller = new AbortController();
    let timeoutId = null;

    async function requestJson(url) {
      const response = await axios.get(url, { timeout: 15000, signal: controller.signal });
      return response.data;
    }

    async function loadAllStaticData() {
      setFundamentalsLoading(true);
      setFundamentalsError("");
      try {
        const results = await Promise.allSettled([
          requestJson(ENDPOINTS.fundamentals(isin)),
          requestJson(ENDPOINTS.shareholding(isin)),
          requestJson(ENDPOINTS.financials(isin)),
          requestJson(ENDPOINTS.mutualFunds(isin)),
          requestJson(ENDPOINTS.profile(isin)),
        ]);
        if (controller.signal.aborted) return;

        if (results[0].status === "fulfilled") {
          const data = normalizeFundamentals(results[0].value);
          setFundamentalData(data);
          const combinedShareholding = normalizeShareholding(results[0].value);
          const combinedMF = normalizeMutualFunds(results[0].value);
          if (combinedShareholding.length) setShareholdingData(combinedShareholding);
          if (combinedMF.length) setMutualFundData(combinedMF);
        }
        if (results[1].status === "fulfilled") {
          const data = normalizeShareholding(results[1].value);
          if (data.length) setShareholdingData(data);
        }
        if (results[2].status === "fulfilled") setFinancialData(unwrapResponse(results[2].value));
        if (results[3].status === "fulfilled") {
          const data = normalizeMutualFunds(results[3].value);
          if (data.length) setMutualFundData(data);
        }
        if (results[4].status === "fulfilled") {
          const data = unwrapResponse(results[4].value);
          setProfileData(data?.profile || data);
        }
        if (results[0].status === "rejected" && results[2].status === "rejected") {
          setFundamentalsError(results[0].reason?.response?.data?.message || results[0].reason?.message || "Unable to load static company data.");
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
  }, [isin]);

  /* LOAD CHART HISTORY */
  const loadHistory = useCallback(async (key, range, signal) => {
    if (!key) return;
    setHistoryLoading(true);
    const params = getHistoryParams(range);
    params.to = getIndiaDate();
    try {
      const response = await axios.get(ENDPOINTS.history(key, params), { timeout: 20000, signal });
      if (!signal.aborted) setHistory(normalizeHistory(response.data, range));
    } catch (error) {
      if (axios.isCancel(error) || error?.code === "ERR_CANCELED" || signal.aborted) return;
      console.error("History failed:", error);
    } finally {
      if (!signal.aborted) setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!instrumentKey) return;
    const controller = new AbortController();
    loadHistory(instrumentKey, chartRange, controller.signal);
    return () => controller.abort();
  }, [instrumentKey, chartRange, loadHistory]);

  const wasMarketOpenRef = useRef(marketOpen);
  useEffect(() => {
    const wasOpen = wasMarketOpenRef.current;
    wasMarketOpenRef.current = marketOpen;
    if (wasOpen && !marketOpen && chartRange === "1D" && instrumentKey) {
      const controller = new AbortController();
      loadHistory(instrumentKey, "1D", controller.signal);
      return () => controller.abort();
    }
  }, [marketOpen, chartRange, instrumentKey, loadHistory]);

  useEffect(() => {
    if (chartRange !== "1D") return;
    let activeController = null;
    const checkSession = () => {
      const today = getIndiaDate();
      if (chartSessionDateRef.current !== today) {
        chartSessionDateRef.current = today;
        lastLiveTickRef.current = 0;
        pendingLiveTickRef.current = null;
        setHoverData(null);
        if (instrumentKey) {
          if (activeController) activeController.abort();
          activeController = new AbortController();
          loadHistory(instrumentKey, "1D", activeController.signal);
        }
      }
    };
    checkSession();
    const intervalId = window.setInterval(checkSession, 30 * 1000);
    return () => {
      window.clearInterval(intervalId);
      if (activeController) activeController.abort();
    };
  }, [chartRange, instrumentKey, loadHistory]);

  const chartRangeRef = useRef(chartRange);
  useEffect(() => {
    chartRangeRef.current = chartRange;
  }, [chartRange]);

  /* WEBSOCKET CONNECTION & TIK HANDLING */
  useEffect(() => {
    if (!instrumentKey) return;
    let alive = true;
    let subscribed = false;
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

      setHistory((prevHistory) => {
        const safeHistory = Array.isArray(prevHistory) ? prevHistory : [];
        const newPoint = {
          timestamp,
          time: new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(timestamp)),
          price,
          close: price,
        };
        const sessionHistory = safeHistory
          .map((point) => ({ point, pointTimestamp: parseHistoryTimestamp(Array.isArray(point) ? point[0] : point?.timestamp ?? point?.time) }))
          .filter(({ pointTimestamp }) => Number.isFinite(pointTimestamp) && indiaDateFromTimestamp(pointTimestamp) === today && isISTTradingTimestamp(pointTimestamp))
          .sort((a, b) => a.pointTimestamp - b.pointTimestamp)
          .map(({ point }) => point);

        if (!sessionHistory.length) return [newPoint];
        const lastPoint = sessionHistory[sessionHistory.length - 1];
        const lastTs = parseHistoryTimestamp(Array.isArray(lastPoint) ? lastPoint[0] : lastPoint?.timestamp ?? lastPoint?.time);

        if (Number.isFinite(lastTs) && timestamp < lastTs) return sessionHistory;
        if (Number.isFinite(lastTs) && Math.abs(timestamp - lastTs) < 60000) return [...sessionHistory.slice(0, -1), newPoint];
        return [...sessionHistory, newPoint];
      });
    };

    const applyLiveData = (data) => {
      if (isStale() || !belongsToStock(data)) return;
      setSnapshot((previous) => ({ ...(previous || {}), ...data }));
      const newPrice = nullableNumber(data.ltp, data.lastPrice, data.last_price);
      if (newPrice !== null && chartRangeRef.current === "1D") {
        let timestamp = getMarketTimestamp(data);
        if (!Number.isFinite(timestamp) && isISTTradingTimestamp(Date.now())) timestamp = Date.now();
        if (Number.isFinite(timestamp)) {
          const today = getIndiaDate();
          if (indiaDateFromTimestamp(timestamp) === today && isISTTradingTimestamp(timestamp)) {
            pendingLiveTickRef.current = { timestamp, price: newPrice };
            const now = Date.now();
            if (lastLiveTickRef.current === 0 || now - lastLiveTickRef.current >= LIVE_TICK_THROTTLE_MS) commitPendingTick();
          }
        }
      }
      if (typeof data.marketOpen === "boolean") setMarketOpen(data.marketOpen);
      if (data.fundamentals) setFundamentalData((prev) => ({ ...(prev || {}), ...data.fundamentals }));
      if (Array.isArray(data.shareholding)) setShareholdingData(normalizeShareholding(data.shareholding));
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
      if (typeof data.marketOpen === "boolean") setMarketOpen(data.marketOpen);
      setSnapshot((prev) => ({ ...(prev || {}), marketOpen: data.marketOpen, marketStatus: data.marketStatus || data.status || (data.marketOpen ? "OPEN" : "CLOSED") }));
    };

    const subscribe = () => {
      if (isStale() || subscribed || !detailStockSocket?.connected) return;
      detailStockSocket.emit("detailStock:subscribe", { instrumentKey, symbol }, (ack) => {
        if (isStale()) {
          if (ack?.success && detailStockSocket?.connected) detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
          return;
        }
        if (!ack?.success) {
          subscribed = false;
          setMarketError(ack?.message || "Unable to subscribe to live market data.");
          return;
        }
        subscribed = true;
        if (ack.snapshot) applyLiveData(ack.snapshot);
        if (typeof ack.marketOpen === "boolean") setMarketOpen(ack.marketOpen);
      });
    };

    detailStockSocket?.on("detailStock:snapshot", handleSnapshot);
    detailStockSocket?.on("detailStock:tick", handleTick);
    detailStockSocket?.on("detailStock:market-status", handleMarketStatus);
    detailStockSocket?.on("connect", subscribe);

    if (detailStockSocket?.connected) subscribe();

    return () => {
      alive = false;
      if (liveTickFlushTimerRef.current) window.clearInterval(liveTickFlushTimerRef.current);
      if (detailStockSocket?.connected && subscribed) detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
      detailStockSocket?.off("detailStock:snapshot", handleSnapshot);
      detailStockSocket?.off("detailStock:tick", handleTick);
      detailStockSocket?.off("detailStock:market-status", handleMarketStatus);
    };
  }, [instrumentKey, symbol]);

  /* MARKET DATA EXTRACTORS */
  const ltp = nullableNumber(snapshot?.ltp, snapshot?.lastPrice, snapshot?.last_price, snapshot?.price, snapshot?.close, stockInfo?.ltp, stockInfo?.lastPrice, stockInfo?.price, initialStock?.ltp, initialStock?.price);
  const open = nullableNumber(snapshot?.open, snapshot?.openPrice, stockInfo?.open);
  const high = nullableNumber(snapshot?.high, snapshot?.dayHigh, stockInfo?.high);
  const low = nullableNumber(snapshot?.low, snapshot?.dayLow, stockInfo?.low);
  const previousClose = nullableNumber(stockInfo?.previousClose, snapshot?.previousClose, snapshot?.prevClose);
  const volume = nullableNumber(snapshot?.volume, snapshot?.totalVolume, stockInfo?.volume);
  const upperCircuit = nullableNumber(snapshot?.upperCircuit, snapshot?.upperLimit, snapshot?.upperCircuitLimit);
  const lowerCircuit = nullableNumber(snapshot?.lowerCircuit, snapshot?.lowerLimit, snapshot?.lowerCircuitLimit);

  function extractWeek52(sources, kind) {
    const keys = kind === "low"
      ? ["week52Low", "week_52_low", "yearLow", "fiftyTwoWeekLow", "fifty_two_week_low", "52WeekLow", "52_week_low", "fiftyTwoWeekLowPrice"]
      : ["week52High", "week_52_high", "yearHigh", "fiftyTwoWeekHigh", "fifty_two_week_high", "52WeekHigh", "52_week_high", "fiftyTwoWeekHighPrice"];
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      for (const key of keys) {
        const val = source[key];
        if (val !== null && val !== undefined && val !== "" && Number.isFinite(Number(val))) return Number(val);
      }
    }
    return null;
  }

  const calculated52WeekLow = extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "low");
  const calculated52WeekHigh = extractWeek52([snapshot, stockInfo, initialStock, fundamentalData], "high");
  const bsePrice = nullableNumber(snapshot?.bsePrice, snapshot?.bseLtp, snapshot?.bseLastPrice, snapshot?.bse);
  const companyName = snapshot?.name || stockInfo?.companyName || stockInfo?.name || symbol || "Stock";
  const exchange = snapshot?.exchange || stockInfo?.exchange || "NSE";

  /* CHART MAPPING & GEOMETRY */
  const lineChartPreparedData = useMemo(() => {
    const source = Array.isArray(history) ? history : [];
    const parsed = source
      .map((item) => {
        let price = null, openPrice = null, rawTimestamp = NaN;
        if (Array.isArray(item)) {
          rawTimestamp = parseHistoryTimestamp(item[0]);
          openPrice = nullableNumber(item[1]);
          price = nullableNumber(item[4], item[1], item[2], item[3]);
        } else if (item && typeof item === "object") {
          rawTimestamp = parseHistoryTimestamp(item.timestamp ?? item.time ?? item.date ?? item.datetime ?? item.dateTime ?? item.ts ?? item.epoch ?? item.t ?? item.ltt);
          openPrice = nullableNumber(item.open, item.openPrice, item.o);
          price = nullableNumber(item.close, item.c, item.ltp, item.lastPrice, item.last_price, item.price, item.open);
        } else if (typeof item === "number" || typeof item === "string") {
          price = nullableNumber(item);
        }
        const dateObj = Number.isFinite(rawTimestamp) ? new Date(rawTimestamp) : null;
        const timeStr = dateObj
          ? chartRange === "1D" || chartRange === "1W"
            ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(dateObj)
            : new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(dateObj)
          : "—";
        return { price, openPrice, rawTimestamp, time: timeStr };
      })
      .filter((point) => point.price !== null && point.price > 0 && Number.isFinite(point.rawTimestamp))
      .sort((a, b) => a.rawTimestamp - b.rawTimestamp);

    if (chartRange !== "1D" || parsed.length > 0) return parsed;

    if (previousClose !== null) {
      const todayStr = getIndiaDate();
      const marketOpenTs = Date.parse(`${todayStr}T03:45:00.000Z`);
      return [
        { price: previousClose, openPrice: previousClose, rawTimestamp: marketOpenTs, time: "09:15 AM" },
        { price: previousClose, openPrice: previousClose, rawTimestamp: marketOpenTs + 375 * 60 * 1000, time: "03:30 PM" },
      ];
    }
    return [];
  }, [history, previousClose, chartRange]);

  const rangeStartPrice = useMemo(() => {
    if (chartRange === "1D") return previousClose;
    const firstCandle = lineChartPreparedData[0];
    return firstCandle?.openPrice ?? firstCandle?.price ?? null;
  }, [chartRange, previousClose, lineChartPreparedData]);

  const currentDisplayPrice = useMemo(() => ltp ?? lineChartPreparedData[lineChartPreparedData.length - 1]?.price ?? null, [ltp, lineChartPreparedData]);

  const displayChange = useMemo(() => {
    if (currentDisplayPrice !== null && rangeStartPrice !== null) return currentDisplayPrice - rangeStartPrice;
    return snapshot?.change ?? stockInfo?.change_points ?? null;
  }, [snapshot, stockInfo, currentDisplayPrice, rangeStartPrice]);

  const displayChangePercent = useMemo(() => {
    if (displayChange !== null && rangeStartPrice) return (displayChange / rangeStartPrice) * 100;
    return snapshot?.changePercent ?? stockInfo?.change_percent ?? null;
  }, [snapshot, stockInfo, displayChange, rangeStartPrice]);

  const isPositive = displayChange !== null ? displayChange >= 0 : true;
  const chartColor = isPositive ? "#00b28e" : "#e5484d";

  const getChartX = useCallback((item, index, total) => {
    if (chartRange === "1D") return getISTMarketProgress(item?.rawTimestamp) * CHART_WIDTH;
    if (total <= 1) return CHART_WIDTH / 2;
    return CHART_PADDING_X + (index / (total - 1)) * (CHART_WIDTH - CHART_PADDING_X * 2);
  }, [chartRange]);

  const lineChartSvg = useMemo(() => {
    const empty = { line: "", area: "", min: 0, max: 0, baselineY: null, lastPoint: null };
    if (!lineChartPreparedData.length) return empty;

    const baseline = rangeStartPrice ?? lineChartPreparedData[0]?.price ?? null;
    const allValues = lineChartPreparedData.map((d) => d.price).filter((v) => Number.isFinite(v));
    if (Number.isFinite(baseline)) allValues.push(baseline);
    if (!allValues.length) return empty;

    let min = Math.min(...allValues);
    let max = Math.max(...allValues);
    const rawRange = max - min;
    const padding = rawRange > 0 ? rawRange * 0.08 : Math.abs(min) * 0.02 || 1;
    min -= padding;
    max += padding;
    const range = max - min;

    const toY = (v) => CHART_HEIGHT - CHART_PADDING_Y - ((v - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);
    const total = lineChartPreparedData.length;
    const mappedPoints = lineChartPreparedData
      .map((item, index) => ({ x: getChartX(item, index, total), y: toY(item.price), price: item.price, time: item.time }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.price));

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

  const handleMouseMove = useCallback((event) => {
    if (!lineChartPreparedData.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const mouseX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const targetX = (mouseX / rect.width) * CHART_WIDTH;
    const total = lineChartPreparedData.length;
    const { min, max } = lineChartSvg;
    const range = max - min || 1;

    let point = null, nearestDistance = Infinity;
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
    const y = CHART_HEIGHT - CHART_PADDING_Y - ((point.price - min) / range) * (CHART_HEIGHT - CHART_PADDING_Y * 2);

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
  }, [lineChartPreparedData, lineChartSvg, getChartX]);

  function getRangePosition(current, lowValue, highValue) {
    if (current === null || lowValue === null || highValue === null || highValue <= lowValue) return "50%";
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
      ["Profit (Cr)", firstDefined(data.operatingProfit, data.operating_profit)],
      ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
    ];
  }, [fundamentalData, snapshot]);

  const aboutInfo = useMemo(() => normalizeAbout(profileData || fundamentalData?.profile || snapshot?.profile, fundamentalData, snapshot?.symbol || symbol), [profileData, fundamentalData, snapshot, symbol]);

  const shareholdingPeriods = useMemo(() => {
    const periodSet = new Set();
    (Array.isArray(shareholdingData) ? shareholdingData : []).forEach((item) => {
      (Array.isArray(item.history) ? item.history : []).forEach((row) => {
        if (row?.period) periodSet.add(row.period);
      });
    });

    const parsePeriod = (p) => {
      const str = String(p).trim().toLowerCase();
      const monthMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, q1: 3, q2: 6, q3: 9, q4: 12 };
      let month = 0;
      for (const [k, m] of Object.entries(monthMap)) {
        if (str.includes(k)) { month = m; break; }
      }
      let year = 0;
      const yearMatch = str.match(/(19|20)\d{2}/);
      if (yearMatch) year = Number(yearMatch[0]);
      else {
        const digitRuns = str.match(/\d{1,2}/g);
        if (digitRuns?.length) year = 2000 + Number(digitRuns[digitRuns.length - 1]);
      }
      return year * 100 + month;
    };

    return Array.from(periodSet).sort((a, b) => parsePeriod(b) - parsePeriod(a));
  }, [shareholdingData]);

  useEffect(() => {
    if (!selectedShareholdingPeriod && shareholdingPeriods.length) setSelectedShareholdingPeriod(shareholdingPeriods[0]);
  }, [selectedShareholdingPeriod, shareholdingPeriods]);

  const selectedShareholding = useMemo(() => {
    if (!selectedShareholdingPeriod) return [];
    const idx = shareholdingPeriods.indexOf(selectedShareholdingPeriod);
    const previousPeriod = idx >= 0 ? shareholdingPeriods[idx + 1] : undefined;

    return shareholdingData
      .map((item, index) => {
        const historyRows = Array.isArray(item.history) ? item.history : [];
        const selected = historyRows.find((row) => row.period === selectedShareholdingPeriod);
        if (!selected) return null;

        const previousRow = previousPeriod ? historyRows.find((row) => row.period === previousPeriod) : null;
        const percentage = numberValue(selected.percentage, 0);
        const previousPercentage = previousRow ? numberValue(previousRow.percentage, 0) : null;

        return {
          key: `${item.label || "unknown"}-${index}`,
          label: item.label || "Unknown",
          percentage,
          change: previousPercentage !== null ? percentage - previousPercentage : null,
        };
      })
      .filter(Boolean);
  }, [shareholdingData, selectedShareholdingPeriod, shareholdingPeriods]);

  const mutualFunds = useMemo(() => {
    return mutualFundData.map((fund, index) => ({
      name: fund.name || fund.fundName || fund.fund_name || fund.fund || `Fund ${index + 1}`,
      percentage: nullableNumber(fund.percentage, fund.percent, fund.aumPercentage, fund.aum_percent, fund.value),
      value: fund.marketValue || fund.market_value || fund.value || null,
      logo: fund.logo || fund.icon || "",
    }));
  }, [mutualFundData]);

  const financialRows = useMemo(() => {
    const rows = normalizeFinancialRows(financialData || fundamentalData?.incomeStatement || fundamentalData?.income_statement || fundamentalData);
    if (rows?.length) return rows;

    const data = snapshot?.fundamentals || {};
    const period = firstDefined(data.period, data.quarter, data.reportPeriod, data.report_period, data.asOf, data.as_of, data.reportDate, data.report_date);
    if (period) {
      const revenue = getFinancialNumber(data.revenue, data.sales, data.totalRevenue);
      const profit = getFinancialNumber(data.netProfit, data.net_profit, data.operatingProfit, data.operating_profit);
      if (revenue !== null || profit !== null) return [{ quarter: String(period), revenue: revenue ?? 0, profit: profit ?? 0 }];
    }
    return [];
  }, [financialData, fundamentalData, snapshot]);

  const financialBarData = useMemo(() => {
    const last5 = financialRows.slice(-5);
    return last5.map((item, index, rows) => ({ ...item, active: index === rows.length - 1 }));
  }, [financialRows]);

  const maxFinancialValue = useMemo(() => {
    if (!financialBarData.length) return 1;
    const highest = Math.max(...financialBarData.flatMap((r) => [r.revenue, r.profit]));
    return highest > 0 ? highest : 1;
  }, [financialBarData]);

  const effectivePrice = numberValue(priceLimit, 0) > 0 ? numberValue(priceLimit) : ltp || 0;
  const approximateRequired = numberValue(quantity) * effectivePrice;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!marketOpen || !quantity || numberValue(quantity) <= 0) return;
    setOrderSubmitting(true);
    setOrderMessage("");
    try {
      const payload = { symbol: snapshot?.symbol || stockInfo?.symbol || symbol, instrumentKey, orderType, quantity: numberValue(quantity), price: effectivePrice };
      const response = await axios.post(ENDPOINTS.order(), payload, { timeout: 10000 });
      if (response.data?.success) {
        setOrderMessage(`Success: ${orderType} order placed for ${quantity} shares!`);
        setQuantity("");
        setPriceLimit("");
      } else {
        setOrderMessage(response.data?.message || "Order placement request failed.");
      }
    } catch (err) {
      setOrderMessage(err?.response?.data?.message || err?.message || "Failed to place order.");
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
                  onToggleWatchlist={() => setIsWatchlisted((v) => !v)}
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
              marketOpen={marketOpen}
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