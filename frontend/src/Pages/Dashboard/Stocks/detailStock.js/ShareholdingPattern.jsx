import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import axios from "axios";
import detailStockSocket from "./detailStockWebSocketConnection";


/* API CONFIG */
const DETAIL_API = process.env.REACT_APP_DETAIL_STOCK_API || "http://localhost:3011";
const STOCK_API = process.env.REACT_APP_STOCK_API || "http://localhost:3001";


const ENDPOINTS = {
  stock: (symbol) => `${STOCK_API}/stock/${encodeURIComponent(symbol)}`,

  marketStatus: () => `${DETAIL_API}/api/detail-stock/market-status`,

  snapshot: (instrumentKey) =>
    `${DETAIL_API}/api/detail-stock/snapshot/${encodeURIComponent(
      instrumentKey,
    )}`,

  history: (instrumentKey, params) =>
    `${DETAIL_API}/api/detail-stock/history/${encodeURIComponent(
      instrumentKey,
    )}?unit=${encodeURIComponent(params.unit)}&interval=${encodeURIComponent(
      params.interval,
    )}&from=${encodeURIComponent(params.from)}&to=${encodeURIComponent(
      params.to,
    )}`,

  fundamentals: (isin) =>
    `${DETAIL_API}/api/detail-stock/fundamentals/${encodeURIComponent(isin)}`,

  shareholding: (isin) =>
    `${DETAIL_API}/api/detail-stock/shareholding/${encodeURIComponent(isin)}`,

  financials: (isin) =>
    `${DETAIL_API}/api/detail-stock/financials/${encodeURIComponent(isin)}`,

  mutualFunds: (isin) =>
    `${DETAIL_API}/api/detail-stock/mutual-funds/${encodeURIComponent(isin)}`,

  profile: (isin) =>
    `${DETAIL_API}/api/detail-stock/profile/${encodeURIComponent(isin)}`,
};

const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];


/* GENERIC HELPERS */
function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nullableNumber(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) {
      return Number(value);
    }
    console.log("FULL SNAPSHOT:", JSON.stringify(value));
  }

  return null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) return String(value);

  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatCompact(value) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return String(value);
  }

  return n.toLocaleString("en-IN");
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return String(value);
  }

  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* 
   DATE HELPER*/

function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}


function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}


function getHistoryParams(range) {
  switch (range) {
    case "1D": return { unit: "minutes", interval: "1", from: getDateDaysAgo(1), };
    case "1W": return { unit: "minutes", interval: "5", from: getDateDaysAgo(7), };
    case "1M": return { unit: "days", interval: "1", from: getDateDaysAgo(31), };
    case "3M": return { unit: "days", interval: "1", from: getDateDaysAgo(92), };
    case "6M": return { unit: "days", interval: "1", from: getDateDaysAgo(183), };
    case "1Y": return { unit: "days", interval: "1", from: getDateDaysAgo(365), };
    case "3Y": return { unit: "weeks", interval: "1", from: getDateDaysAgo(1095), };
    case "5Y": return { unit: "weeks", interval: "1", from: getDateDaysAgo(1825), };
    case "All": return { unit: "months", interval: "1", from: "2000-01-01", };


    default: return { unit: "minutes", interval: "1", from: getDateDaysAgo(1), };
  }
}



/* RESPONSE NORMALIZATION */
function unwrapResponse(json) {
  if (!json) return null;
  if (json.data !== undefined) return json.data;

  return json;
}

function getArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function normalizeStock(json, fallbackSymbol) {
  const data = unwrapResponse(json) || {};

  return {
    ...data,

    symbol: data.symbol || data.tradingSymbol || data.trading_symbol || fallbackSymbol,

    companyName: data.companyName || data.company_name || data.name || fallbackSymbol,

    name: data.name || data.companyName || data.company_name || fallbackSymbol,

    exchange: data.exchange || data.exchangeName || data.exchange_name || "NSE",

    instrumentKey: data.instrumentKey || data.instrument_key || data.instrumentkey || data.instrument,

    isin: data.isin || data.ISIN || data.isin_code || data.isinCode,
  };
}



/* FUNDAMENTALS */
function normalizeFundamentals(json) {
  const data = unwrapResponse(json) || {};
  return data.fundamentals || data.fundamental || data.metrics || data;
}


/* SHAREHOLDING */
function normalizeShareholding(json) {
  const data = unwrapResponse(json) || {};

  return getArray(
    data.shareholding,
    data.shareholdingPattern,
    data.shareholding_pattern,
    data.holdings,
    data.data,
    Array.isArray(data) ? data : null,
  );
}


/* MUTUAL FUNDS */
function normalizeMutualFunds(json) {
  const data = unwrapResponse(json) || {};

  return getArray(
    data.mutualFunds,
    data.mutual_funds,
    data.mutualFundHoldings,
    data.mfHoldings,
    data.data,
    Array.isArray(data) ? data : null,
  );
}


/* FINANCIALS */
function normalizeFinancials(json) {
  const data = unwrapResponse(json) || {};

  return (
    data.financials ||
    data.financialPerformance ||
    data.financial_performance ||
    data.incomeStatement ||
    data.income_statement ||
    data
  );
}


/* HISTORY */
function normalizeHistory(json) {
  const data = unwrapResponse(json);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.candles)) return data.candles;
  if (Array.isArray(data?.history)) return data.history;
  if (Array.isArray(data?.prices)) return data.prices;

  return [];
}


/* MARKET STATUS */
function normalizeMarketStatus(json) {
  const data = unwrapResponse(json) || {};

  if (typeof data === "boolean") return data;
  if (typeof data.marketOpen === "boolean") return data.marketOpen;
  if (typeof data.isOpen === "boolean") return data.isOpen;
  if (typeof data.open === "boolean") return data.open;

  const status = String(data.marketStatus || data.status || data.market_status || "",).toLowerCase();

  if (status === "open" || status === "market_open" || status === "live") return true;
  if (status === "closed" || status === "market_closed") return false;


  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .split(":");


  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  const totalMinutes = hour * 60 + minute;

  return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
}



/* FINANCIAL HISTORY */
function extractHistoryRows(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (Array.isArray(source.income_statement)) return source.income_statement;
  if (Array.isArray(source.incomeStatement)) return source.incomeStatement;
  if (Array.isArray(source.full_statement)) return source.full_statement;
  if (Array.isArray(source.financials)) return source.financials;

  return [];
}


function extractCategoryHistory(source, category) {
  const rows = extractHistoryRows(source);

  const row = rows.find(
    (item) =>
      String(item?.category || item?.name || item?.type || "").toLowerCase() ===
      category.toLowerCase(),
  );

  return Array.isArray(row?.history) ? row.history : [];
}


function normalizeFinancialRows(source) {
  const revenue = extractCategoryHistory(source, "revenue");
  const profit = extractCategoryHistory(source, "net_profit");
  const byPeriod = new Map();

  for (const row of revenue) {
    const period = row?.period || row?.date || row?.year || row?.quarter || "";

    if (!period) continue;

    byPeriod.set(period, {
      quarter: period,

      revenue:
        nullableNumber(
          row?.value,
          row?.company_value,
          row?.amount,
          row?.revenue,
        ) || 0,

      profit: 0,
    });
  }


  for (const row of profit) {
    const period = row?.period || row?.date || row?.year || row?.quarter || "";

    if (!period) continue;

    const existing = byPeriod.get(period) || {
      quarter: period,
      revenue: 0,
      profit: 0,
    };

    existing.profit =
      nullableNumber(
        row?.value,
        row?.company_value,
        row?.amount,
        row?.netProfit,
        row?.net_profit,
      ) || 0;

    byPeriod.set(period, existing);
  }

  return [...byPeriod.values()].sort((a, b) =>
    String(a.quarter).localeCompare(String(b.quarter)),
  );
}


/* ABOUT / COMPANY PROFILE */
function normalizeAbout(profile, fundamentals, fallbackSymbol) {
  const p = profile || {};
  const f = fundamentals || {};

  return {
    description: p.company_profile || p.description || p.about || p.business_description || p.businessDescription || f.about || f.description || "Company profile information is not available from the backend.",

    sector: p.sector || f.sector || "N/A",
    sectorMarketCapInr: p.sector_market_cap_inr || null,
    sectorMarketCapUsd: p.sector_market_cap_usd || null,
    ceo: p.ceo || p.ceo_name || p.ceoName || p.management?.ceo || "N/A",
    founded: p.foundedIn || p.founded_in || p.founded || p.incorporation_date || "N/A",
    nseSymbol: p.nseSymbol || p.nse_symbol || p.symbol || fallbackSymbol || "N/A",
  };
}


/* COMPONENT */
export default function ShareholdingPattern() {
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
  const [quantity, setQuantity] = useState("");
  const [priceLimit, setPriceLimit] = useState("");
  const [isWatchlisted, setIsWatchlisted] = useState(false);


  /* STEP 1 LOAD STOCK IDENTIFIER */
  useEffect(() => {
    let alive = true;

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
        });

        if (!alive) return;

        const stock = normalizeStock(response.data, symbol);

        setStockInfo((previous) => ({
          ...(previous || {}),
          ...stock,
        }));
      } catch (error) {
        console.error("Stock details failed:", error);

        if (!alive) return;

        setStockError(
          error?.response?.data?.message ||
          error?.message ||
          "Failed to load stock details.",
        );
      } finally {
        if (alive) {
          setStockLoading(false);
        }
      }
    }

    loadStock();

    return () => {
      alive = false;
    };
  }, [symbol]);


  /* IDENTIFIERS */
  const instrumentKey = stockInfo?.instrumentKey || stockInfo?.instrument_key || initialStock?.instrumentKey || initialStock?.instrument_key || "";
  const isin = stockInfo?.isin || stockInfo?.ISIN || initialStock?.isin || initialStock?.ISIN || "";


  /* STEP 2 LOAD MARKET STATUS + INITIAL SNAPSHOT*/
  const loadMarketData = useCallback(async (key) => {
    if (!key) return;

    setMarketLoading(true);
    setMarketError("");

    try {
      const [statusResult, snapshotResult] = await Promise.allSettled([
        axios.get(ENDPOINTS.marketStatus(), {
          timeout: 8000,
        }),

        axios.get(ENDPOINTS.snapshot(key), {
          timeout: 10000,
        }),
      ]);

      let isOpen = null;
      let initialSnapshot = null;

      if (statusResult.status === "fulfilled") {
        isOpen = normalizeMarketStatus(statusResult.value.data);
      }

      if (snapshotResult.status === "fulfilled") {
        initialSnapshot = unwrapResponse(snapshotResult.value.data);

        if (typeof initialSnapshot?.marketOpen === "boolean") {
          isOpen = initialSnapshot.marketOpen;
        }
      }

      if (isOpen === null) {
        isOpen = normalizeMarketStatus({});
      }

      setMarketOpen(Boolean(isOpen));

      if (initialSnapshot) {
        setSnapshot(initialSnapshot);
      }

      if (statusResult.status === "rejected" && snapshotResult.status === "rejected") {
        throw new Error("Market data endpoints are unavailable.");
      }
    } catch (error) {
      console.error("Market data failed:", error);

      setMarketError(error?.response?.data?.message || error?.message || "Unable to load market data.",);

      setMarketOpen(false);
    } finally {
      setMarketLoading(false);
    }
  }, []);


  useEffect(() => {
    if (!instrumentKey) return;

    loadMarketData(instrumentKey);
  }, [instrumentKey, loadMarketData]);


  /* STEP 3 LOAD ALL STATIC DATA AFTER ISIN IS KNOWN*/
  useEffect(() => {
    if (!isin) {
      setFundamentalsLoading(false);
      return;
    }

    let alive = true;

    async function requestJson(url) {
      const response = await axios.get(url, {
        timeout: 15000,
      });

      return response.data;
    }

    async function loadAllStaticData() {
      setFundamentalsLoading(true);
      setFundamentalsError("");

      const results = await Promise.allSettled([
        requestJson(ENDPOINTS.fundamentals(isin)),
        requestJson(ENDPOINTS.shareholding(isin)),
        requestJson(ENDPOINTS.financials(isin)),
        requestJson(ENDPOINTS.mutualFunds(isin)),
        requestJson(ENDPOINTS.profile(isin)),
      ]);

      if (!alive) return;


      /* FUNDAMENTALS */
      if (results[0].status === "fulfilled") {
        const data = normalizeFundamentals(results[0].value);

        setFundamentalData(data);

        const combinedShareholding = normalizeShareholding(results[0].value);
        const combinedMF = normalizeMutualFunds(results[0].value);

        if (combinedShareholding.length) {
          setShareholdingData(combinedShareholding);
        }

        if (combinedMF.length) setMutualFundData(combinedMF);
      }


      /* SHAREHOLDING */
      if (results[1].status === "fulfilled") {
        const data = normalizeShareholding(results[1].value);

        if (data.length) setShareholdingData(data);
      }


      /* FINANCIALS */
      if (results[2].status === "fulfilled") {
        setFinancialData(normalizeFinancials(results[2].value));
      }


      /* MUTUAL FUNDS */
      if (results[3].status === "fulfilled") {
        const data = normalizeMutualFunds(results[3].value);

        if (data.length) setMutualFundData(data);
      }

      /* PROFILE */
      if (results[4].status === "fulfilled") {
        const data = unwrapResponse(results[4].value);

        setProfileData(data?.profile || data);
      }


      if (results[0].status === "rejected") {
        setFundamentalsError(
          results[0].reason?.response?.data?.message ||
          results[0].reason?.message ||
          "Unable to load fundamentals.",
        );
      }

      setFundamentalsLoading(false);
    }

    loadAllStaticData();

    const timer = setInterval(loadAllStaticData, 15 * 60 * 1000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isin]);


  /* STEP 4 HISTORY*/
  useEffect(() => {
    if (!instrumentKey) return;

    let alive = true;

    async function loadHistory() {
      setHistoryLoading(true);
      const params = getHistoryParams(chartRange);
      params.to = getIndiaDate();

      try {
        const response = await axios.get(ENDPOINTS.history(instrumentKey, params), { timeout: 20000, });

        if (!alive) return;

        setHistory(normalizeHistory(response.data));
      } catch (error) {
        console.error("History failed:", error);

        if (alive) setHistory([]);
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }

    loadHistory();

    return () => {
      alive = false;
    };
  }, [instrumentKey, chartRange]);


  /* LOAD COMPANY PROFIL*/
  useEffect(() => {
    let alive = true;

    async function loadCompanyProfile() {
      if (!isin) return;

      try {
        const response = await axios.get(`/api/detail-stock/about/${encodeURIComponent(isin)}`, {timeout: 15000});

        if (!alive) return;
        const result = response?.data;

        if (!result?.success) {
          throw new Error(result?.message || "Failed to load company profile");
        }

        setProfileData(result?.profile || null);
      } catch (error) {
        console.error("Company profile failed:", error);

        if (!alive) return;
        setProfileData(null);
      }
    }

    loadCompanyProfile();

    return () => {
      alive = false;
    };
  }, [isin]);


  /* STEP 5 WEBSOCKET
     SOCKET IS ONLY FOR LIVE MARKET UPDATES.
     STATIC DATA DOES NOT DEPEND ON SOCKET.*/

  useEffect(() => {
    if (!instrumentKey) return undefined;

    let alive = true;
    let subscribed = false;

    const belongsToStock = (data) => {
      if (!data) return false;
      const key = data.instrumentKey || data.instrument_key || data.instrument;

      if (!key) return true;
      return key === instrumentKey;
    };

    const applyLiveData = (data) => {
      if (!alive || !belongsToStock(data)) return;

      setSnapshot((previous) => ({
        ...(previous || {}),
        ...data,
      }));

      if (typeof data.marketOpen === "boolean") {
        setMarketOpen(data.marketOpen);
      }

      /*
       * If backend sends static data together
       * with snapshot, use it.
       */

      if (data.fundamentals) {
        setFundamentalData((previous) => ({
          ...(previous || {}),
          ...data.fundamentals,
        }));
      }

      if (Array.isArray(data.shareholding)) {
        setShareholdingData(data.shareholding);
      }

      if (Array.isArray(data.mutualFunds)) {
        setMutualFundData(data.mutualFunds);
      }

      setMarketLoading(false);
    };


    const handleSnapshot = applyLiveData;
    const handleTick = applyLiveData;

    const handleMarketStatus = (data) => {
      if (!alive || !belongsToStock(data)) return;

      if (typeof data.marketOpen === "boolean") {
        setMarketOpen(data.marketOpen);
      }

      setSnapshot((previous) => ({
        ...(previous || {}),
        marketOpen: data.marketOpen,
        marketStatus:
          data.marketStatus ||
          data.status ||
          (data.marketOpen ? "OPEN" : "CLOSED"),
      }));
    };


    const subscribe = () => {
      if (!alive || subscribed || !detailStockSocket.connected) return;

      detailStockSocket.emit("detailStock:subscribe", { instrumentKey, symbol, },
        (ack) => {
          if (!alive) return;

          if (!ack?.success) {
            subscribed = false;

            setMarketError(
              ack?.message || "Unable to subscribe to live market data.",
            );

            return;
          }

          subscribed = true;

          if (ack.snapshot) {
            applyLiveData(ack.snapshot);
          }

          if (typeof ack.marketOpen === "boolean") {
            setMarketOpen(ack.marketOpen);
          }
        },
      );
    };

    const handleConnect = () => {
      subscribed = false;
      subscribe();
    };


    const handleDisconnect = () => {
      subscribed = false;

      /*
       * Don't erase existing market
       * snapshot when socket disconnects.
       */
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
        detailStockSocket.emit("detailStock:unsubscribe", {
          instrumentKey,
        });
      }

      detailStockSocket.off("detailStock:snapshot", handleSnapshot);
      detailStockSocket.off("detailStock:tick", handleTick);
      detailStockSocket.off("detailStock:market-status", handleMarketStatus);
      detailStockSocket.off("connect", handleConnect);
      detailStockSocket.off("disconnect", handleDisconnect);
    };
  }, [instrumentKey, symbol]);


  /* MARKET VALUES */
  const ltp = nullableNumber(
    snapshot?.ltp,
    snapshot?.price,
    snapshot?.lastPrice,
    snapshot?.close,
    stockInfo?.price,
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

  const change = nullableNumber(
    snapshot?.change,
    snapshot?.netChange,
    stockInfo?.change_points,
  ) ?? (ltp !== null && previousClose !== null ? ltp - previousClose : null);

  const changePercent = nullableNumber(
    snapshot?.changePercent,
    snapshot?.changePercentage,
    stockInfo?.change_percent,
  ) ??
    (change !== null && previousClose ? (change / previousClose) * 100 : null);

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

  const week52Low = nullableNumber(
    snapshot?.week52Low,
    snapshot?.yearLow,
    snapshot?.fiftyTwoWeekLow,
  );

  const week52High = nullableNumber(
    snapshot?.week52High,
    snapshot?.yearHigh,
    snapshot?.fiftyTwoWeekHigh,
  );

  const bsePrice = nullableNumber(
    snapshot?.bsePrice,
    snapshot?.bseLtp,
    snapshot?.bseLastPrice,
    snapshot?.bse,
  );

  const positive = (change ?? 0) >= 0;
  const companyName = snapshot?.name || stockInfo?.companyName || stockInfo?.name || symbol || "Stock";
  const exchange = snapshot?.exchange || stockInfo?.exchange || "NSE";

  /* CHART */
  const lineChartPreparedData = useMemo(() => {
    if (!history.length) {
      return ltp !== null
        ? [
          {
            price: ltp,
            time: "Live",
          },
        ]
        : [];
    }

    return history
      .map((item) => {
        let price = null;
        let time = "";

        if (typeof item === "number" || typeof item === "string") {
          price = Number(item);
        } else if (Array.isArray(item)) {
          price = nullableNumber(item[4], item[1]);

          time = item[0]
            ? new Date(item[0]).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
            : "";
        } else {
          price = nullableNumber(item?.close, item?.ltp, item?.price);

          const rawTime = item?.time || item?.timestamp || item?.date;

          if (rawTime) {
            time = new Date(rawTime).toLocaleString([], {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        }

        return {
          price,
          time: time || "—",
        };
      })
      .filter((item) => item.price !== null && Number.isFinite(item.price));
  }, [history, ltp]);


  const chartValues = useMemo(
    () => lineChartPreparedData.map((item) => item.price),
    [lineChartPreparedData],
  );

  const lineChartSvg = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 10;
    const paddingY = 20;

    if (!chartValues.length) return { line: "", area: "", min: 0, max: 0, baselineY: null };

    const baseline = previousClose ?? chartValues[0] ?? null;
    const allValues = baseline !== null ? [...chartValues, baseline] : chartValues;
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const toY = (value) => height - paddingY - ((value - min) / range) * (height - paddingY * 2);

    const points = chartValues.map((value, index) => {
      const x = chartValues.length === 1 ? width / 2 : paddingX + (index / (chartValues.length - 1)) * (width - paddingX * 2);
      return `${x},${toY(value)}`;
    });

    return {
      line: points.join(" "),
      area: points.length
        ? `M ${points[0]} L ${points.join(" L ")} L ${width - paddingX},${height} L ${paddingX},${height} Z`
        : "",
      min,
      max,
      baselineY: baseline !== null ? toY(baseline) : null,
    };
  }, [chartValues, previousClose]);


  const lastChartValue = chartValues.length > 0 ? chartValues[chartValues.length - 1] : ltp;

  // Groww colors it based on previous close, not just the header change.
  const chartPositive = previousClose !== null && lastChartValue !== null ? lastChartValue >= previousClose : positive;
  const chartColor = chartPositive ? "#00b28e" : "#e5484d";
  const chartColorSoft = chartPositive ? "rgba(0, 178, 142, 0.22)" : "rgba(229, 72, 77, 0.20)";

  const handleMouseMove = (event) => {
    if (!lineChartPreparedData.length) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
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

    const x = lineChartPreparedData.length === 1 ? width / 2 : paddingX + (index / (lineChartPreparedData.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((point.price - min) / range) * (height - paddingY * 2);

    setHoverData({
      price: point.price,
      time: point.time,
      x,
      y,
      percentX: percentage * 100,
    });
  };


  /* 52 WEEK*/
  const calculated52WeekLow = week52Low ?? (chartValues.length ? Math.min(...chartValues) : null);
  const calculated52WeekHigh = week52High ?? (chartValues.length ? Math.max(...chartValues) : null);

  function getRangePosition(current, lowValue, highValue) {
    if (
      current === null ||
      lowValue === null ||
      highValue === null ||
      highValue <= lowValue
    ) {
      return "50%";
    }

    return `${Math.max(
      0,
      Math.min(100, ((current - lowValue) / (highValue - lowValue)) * 100),
    )}%`;
  }

  /* 
     FUNDAMENTALS UI DATA*/

  // const fundamentals = useMemo(() => {
  //   const data = fundamentalData || snapshot?.fundamentals || {};

  //   return [
  //     ["Market Cap", firstDefined(data.marketCap, data.market_cap)],
  //     ["ROE", firstDefined(data.roe)],
  //     ["ROA", firstDefined(data.roa)],
  //     ["ROCE", firstDefined(data.roce)],
  //     ["P/E Ratio (TTM)", firstDefined(data.peRatio, data.pe_ratio, data.pe)],
  //     ["P/B Ratio", firstDefined(data.pbRatio, data.pb_ratio, data.pb)],
  //     ["EV / EBITDA", firstDefined(data.evEbitda, data.ev_ebitda)],
  //     ["EPS (Basic)", firstDefined(data.eps, data.epsBasic)],
  //     ["Revenue (Cr)", firstDefined(data.revenue)],
  //     [
  //       "Operating Profit (Cr)",
  //       firstDefined(data.operatingProfit, data.operating_profit),
  //     ],
  //     ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
  //     ["Dividend Yield", firstDefined(data.dividendYield, data.dividend_yield)],
  //     ["Book Value", firstDefined(data.bookValue, data.book_value)],
  //     ["Debt to Equity", firstDefined(data.debtToEquity, data.debt_to_equity)],
  //     ["Face Value", firstDefined(data.faceValue, data.face_value)],
  //     ["Sector", firstDefined(data.sector)],
  //   ];
  // }, [fundamentalData, snapshot]);


  /* FUNDAMENTALS UI DAT*/
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
      ["Profit (Cr)", firstDefined(data.operatingProfit, data.operating_profit),],
      ["Net Profit (Cr)", firstDefined(data.netProfit, data.net_profit)],
      ["Market Cap", firstDefined(data.marketCap, data.market_cap)],
    ];
  }, [fundamentalData, snapshot]);


  /* COMPANY PROFILE UI DATA*/
  const aboutData = useMemo(() => {
    return normalizeAbout(
      profileData,
      fundamentalData || snapshot?.fundamentals || {},
      symbol,
    );
  }, [profileData, fundamentalData, snapshot, symbol]);


  /* SHAREHOLDING*/
  const shareholdingPeriods = useMemo(() => {
    const periods = [];

    for (const item of Array.isArray(shareholdingData) ? shareholdingData : []) {
      for (const row of Array.isArray(item.history) ? item.history : []) {
        const period = row?.period || row?.date || row?.quarter;

        if (period && !periods.includes(period)) {
          periods.push(period);
        }
      }
    }

    return periods;
  }, [shareholdingData]);

  useEffect(() => {
    if (!selectedShareholdingPeriod && shareholdingPeriods.length) {
      setSelectedShareholdingPeriod(shareholdingPeriods[0]);
    }
  }, [selectedShareholdingPeriod, shareholdingPeriods]);


  const selectedShareholding = useMemo(() => {
    return shareholdingData.map((item) => {
      const historyRows = Array.isArray(item.history) ? item.history : [];

      const selected = historyRows.find(
        (row) =>
          row.period === selectedShareholdingPeriod ||
          row.date === selectedShareholdingPeriod ||
          row.quarter === selectedShareholdingPeriod,
      );

      return {
        label: item.label || item.name || item.category || "Unknown",

        percentage: numberValue(
          selected?.percentage ??
          selected?.percent ??
          selected?.value ??
          item.percentage ??
          item.percent,
          0,
        ),
      };
    });
  }, [shareholdingData, selectedShareholdingPeriod]);


  /* MUTUAL FUNDS */
  const mutualFunds = useMemo(() => {
    return mutualFundData.map((fund, index) => ({
      name: fund.name || fund.fundName || fund.fund_name || `Fund ${index + 1}`,

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


  /* FINANCIAL DATA */
  const financialRows = useMemo(() => {
    return normalizeFinancialRows(
      financialData ||
      fundamentalData?.incomeStatement ||
      fundamentalData?.income_statement ||
      fundamentalData,
    );
  }, [financialData, fundamentalData]);

  const financialBarData = useMemo(() => {
    return financialRows.slice(-5).map((item, index, rows) => ({
      ...item,
      revenueHeight: `${Math.max(0, item.revenue)}%`,
      profitHeight: `${Math.max(0, item.profit)}%`,
      active: index === rows.length - 1,
    }));
  }, [financialRows]);


  /* ABOUT */
  const aboutInfo = useMemo(() => {
    return normalizeAbout(
      profileData || fundamentalData?.profile || snapshot?.profile,
      fundamentalData,
      snapshot?.symbol || symbol,
    );
  }, [profileData, fundamentalData, snapshot, symbol]);


  /* ORDER */
  const effectivePrice = numberValue(priceLimit, 0) > 0 ? numberValue(priceLimit) : ltp || 0;
  const approximateRequired = numberValue(quantity) * effectivePrice;

  /* LOADING */
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

  /* RENDER*/
  return (
    <div className="home" style={{ paddingTop: "1.5rem" }}>
      <div className="precision-dashboard">
        <main className="precision-main">
          <div className="precision-content">

            {/* LEFT */}
            <div className="precision-left">
              {/* STOCK HEADER */}
              <section className="stock-card">
                <div className="stock-header">
                  <div className="stock-main-info">
                    <div>
                      <div className="stock-meta">
                        <span>
                          {snapshot?.symbol || stockInfo?.symbol || symbol}
                        </span>

                        <span className="stock-meta-dot" />

                        <span>{exchange}</span>
                      </div>

                      <h1>{companyName}</h1>

                      <div className="stock-price-row">
                        <span className="stock-price">
                          {ltp !== null ? formatCurrency(ltp) : "—"}
                        </span>

                        <span className={positive ? "stock-positive" : "stock-negative"}>
                          {change !== null
                            ? `${change >= 0 ? "+" : ""}${formatNumber(
                              change,
                            )} (${formatPercent(changePercent)}) 1D`
                            : "—"}
                        </span>
                      </div>

                      <div style={{ marginTop: "0.4rem", fontSize: "0.85rem", }}>
                        {marketLoading ? "Checking market…" : marketOpen ? "Market open · Live" : "Market closed · Latest available data"}
                      </div>

                      {marketError && (
                        <div className="detail-stock-error">{marketError}</div>
                      )}

                      {stockError && (
                        <div className="detail-stock-error">{stockError}</div>
                      )}
                    </div>
                  </div>

                  <div className="stock-actions">
                    <button className={isWatchlisted ? "watchlisted" : ""} onClick={() => setIsWatchlisted((value) => !value)}>
                      {isWatchlisted ? "★" : "☆"}
                    </button>
                  </div>
                </div>

                {/* CHART */}

                <div className="chart-wrapper">
                  <div className="chart-area" onMouseMove={handleMouseMove} onMouseLeave={() => setHoverData(null)}>
                    {historyLoading && (
                      <div className="chart-loading">Updating chart…</div>
                    )}

                    {hoverData && (
                      <div className="chart-hover-tooltip" style={{ left: `${hoverData.percentX}%`, }}>
                        <span className="tooltip-price">
                          {formatCurrency(hoverData.price)}
                        </span>

                        <span className="tooltip-divider">|</span>
                        <span className="tooltip-time">{hoverData.time}</span>
                      </div>
                    )}

                    <svg className="stock-chart" viewBox="0 0 1000 300" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartColor} stopOpacity="0.22" />
                          <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {lineChartSvg.baselineY !== null && (
                        <line x1="0" y1={lineChartSvg.baselineY} x2="1000" y2={lineChartSvg.baselineY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
                      )}

                      {lineChartSvg.area && (
                        <path d={lineChartSvg.area} fill="url(#stockGradient)" />
                      )}

                      {lineChartSvg.line && (
                        <polyline points={lineChartSvg.line} fill="none" stroke={chartColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      )}

                      {hoverData && (
                        <g>
                          <line x1={hoverData.x} y1="0" x2={hoverData.x} y2="300" stroke="#e2e8f0" strokeWidth="2" />
                          <circle cx={hoverData.x} cy={hoverData.y} r="6" fill="#ffffff" stroke={chartColor} strokeWidth="3" />
                        </g>
                      )}
                    </svg>

                    {!hoverData && ltp !== null && (
                      <div className="chart-current-price">
                        {formatCurrency(ltp)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="chart-footer" style={{ marginTop: "1.5rem", }}>
                  <div className="chart-periods">
                    {RANGES.map((range) => (
                      <button key={range} className={chartRange === range ? "active" : ""} onClick={() => setChartRange(range)} disabled={historyLoading}>
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              </section>


              {/* PERFORMANCE */}
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
                      <p>{low !== null ? formatCurrency(low) : "—"}</p>
                      <p>{high !== null ? formatCurrency(high) : "—"}</p>
                    </div>

                    <div className="range-line">
                      <div className="range-marker" style={{ left: getRangePosition(ltp, low, high), }} />
                    </div>
                  </div>

                  <div className="range-block">
                    <div className="range-title">
                      <p>52 week low</p>
                      <p>52 week high</p>
                    </div>

                    <div className="range-values">
                      <p>
                        {calculated52WeekLow !== null
                          ? formatCurrency(calculated52WeekLow)
                          : "—"}
                      </p>

                      <p>
                        {calculated52WeekHigh !== null
                          ? formatCurrency(calculated52WeekHigh)
                          : "—"}
                      </p>
                    </div>

                    <div className="range-line">
                      <div className="range-marker" style={{ left: getRangePosition(ltp, calculated52WeekLow, calculated52WeekHigh,), }} />
                    </div>
                  </div>

                  <div className="performance-stats">
                    <div>
                      <span>Open price</span>
                      <p>{open !== null ? formatCurrency(open) : "—"}</p>
                    </div>

                    <div>
                      <span>Previous close</span>

                      <p>
                        {previousClose !== null
                          ? formatCurrency(previousClose)
                          : "—"}
                      </p>
                    </div>

                    <div>
                      <span>Live volume</span>
                      <p>{volume !== null ? formatCompact(volume) : "—"}</p>
                    </div>

                    <div>
                      <span>Upper circuit</span>

                      <p>
                        {upperCircuit !== null
                          ? formatCurrency(upperCircuit)
                          : "—"}
                      </p>
                    </div>

                    <div>
                      <span>Lower circuit</span>

                      <p>
                        {lowerCircuit !== null
                          ? formatCurrency(lowerCircuit)
                          : "—"}
                      </p>
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
                    fundamentals.map(([label, value]) => (
                      <div className="fundamental-row" key={label}>
                        <span>{label}</span>

                        <p>
                          {value !== null && value !== undefined && value !== ""
                            ? typeof value === "number"
                              ? formatNumber(value)
                              : value
                            : "N/A"}
                        </p>
                      </div>
                    ))}
                </div>
              </section>


              {/* SHAREHOLDING */}
              <section className="content-section">
                <div className="section-heading">
                  <h2>Shareholding Pattern</h2>
                </div>

                <div className="shareholding-card">
                  {shareholdingPeriods.length > 0 && (
                    <div className="shareholding-periods">
                      {shareholdingPeriods.map((period) => (
                        <button key={period}
                          className={
                            selectedShareholdingPeriod === period
                              ? "active"
                              : ""
                          }
                          onClick={() => setSelectedShareholdingPeriod(period)}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="shareholding-list">
                    {selectedShareholding.length > 0 ? (
                      selectedShareholding.map((item) => (
                        <div className="shareholding-row" key={item.label}>
                          <div className="shareholding-label">
                            <span>{item.label}</span>

                            <p style={{ color: "black", margin: 0, fontWeight: 500, fontSize: 15, }}>
                              {item.percentage.toFixed(2)}%
                            </p>
                          </div>

                          <div className="shareholding-bar">
                            <div style={{ width: `${Math.min(100, Math.max(0, item.percentage),)}%`, }} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div>Shareholding data unavailable</div>
                    )}
                  </div>
                </div>
              </section>

              {/* =================================================
                FINANCIAL PERFORMANCE
            ================================================= */}

              <section className="content-section">
                <div className="section-heading">
                  <h2>Financial performance</h2>
                </div>

                <div className="chart-card">
                  <header className="chart-header">
                    <div className="header-date">
                      {financialBarData[financialBarData.length - 1]?.quarter ||
                        "—"}
                    </div>

                    <div className="legend-row">
                      <div className="legend-group">
                        <div className="legend-title">
                          <span className="legend-badge bg-bar-revenue" />
                          <span className="legend-label">Revenue (CR)</span>
                        </div>

                        <div className="legend-metrics">
                          <span className="metric-value">
                            {financialBarData.length
                              ? formatNumber(
                                financialBarData[financialBarData.length - 1]
                                  .revenue,
                              )
                              : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="legend-group">
                        <div className="legend-title">
                          <span className="legend-badge bg-bar-profit" />
                          <span className="legend-label">Profit (CR)</span>
                        </div>

                        <div className="legend-metrics">
                          <span className="metric-value">
                            {financialBarData.length
                              ? formatNumber(
                                financialBarData[financialBarData.length - 1]
                                  .profit,
                              )
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </header>

                  <div className="chart-area">
                    {financialBarData.length > 0 ? (
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "2rem", minHeight: "250px", padding: "2rem", }}>
                        {financialBarData.map((item) => {
                          const max = Math.max(
                            1,
                            ...financialBarData.flatMap((row) => [
                              row.revenue,
                              row.profit,
                            ]),
                          );

                          return (
                            <div key={item.quarter} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "0.4rem", height: "200px", }}>
                              <div style={{ width: "35%", height: `${(item.revenue / max) * 100}%`, minHeight: item.revenue > 0 ? "4px" : "0", }} className="bar-single bg-bar-revenue" />

                              <div style={{ width: "35%", height: `${(item.profit / max) * 100}%`, minHeight: item.profit > 0 ? "4px" : "0", }} className="bar-single bg-bar-profit" />

                              <span style={{ position: "absolute", transform: "translateY(125px)", }}>
                                {item.quarter}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: "2rem", }}>
                        Financial data unavailable
                      </div>
                    )}
                  </div>
                </div>

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

                          <span className="text-accent-green">
                            {financialBarData.length
                              ? formatNumber(
                                financialBarData[financialBarData.length - 1]
                                  .revenue,
                              )
                              : "—"}
                          </span>
                        </div>

                        <div className="growth-row">
                          <span className="growth-label">Previous period</span>

                          <span className="text-accent-green">
                            {financialBarData.length > 1
                              ? formatNumber(
                                financialBarData[financialBarData.length - 2]
                                  .revenue,
                              )
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="divider" />

                    <div className="growth-section growth-section-right">
                      <div className="growth-header">
                        <h3 className="growth-title">Profit Growth</h3>

                        <span className="growth-title">Value</span>
                      </div>

                      <div className="growth-rows">
                        <div className="growth-row">
                          <span className="growth-label">Latest period</span>

                          <span className="text-accent-green">
                            {financialBarData.length
                              ? formatNumber(
                                financialBarData[financialBarData.length - 1]
                                  .profit,
                              )
                              : "—"}
                          </span>
                        </div>

                        <div className="growth-row">
                          <span className="growth-label">Previous period</span>

                          <span className="text-accent-green">
                            {financialBarData.length > 1
                              ? formatNumber(
                                financialBarData[financialBarData.length - 2]
                                  .profit,
                              )
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>


              {/* ABOUT */}
              <section className="content-section">
                <div className="section-heading">
                  <h2>About</h2>
                </div>

                <div className="about-card">
                  <p className="about-description">
                    {isAboutExpanded
                      ? aboutInfo.description
                      : `${String(aboutInfo.description).slice(0, 190)}${String(aboutInfo.description).length > 190
                        ? "..."
                        : ""
                      }`}

                    {String(aboutInfo.description).length > 190 && (
                      <button
                        type="button"
                        className="read-more-btn"
                        onClick={() => setIsAboutExpanded((prev) => !prev)}
                      >
                        {isAboutExpanded ? "Read less" : "Read more"}
                      </button>
                    )}
                  </p>
                </div>
              </section>


              {/* MUTUAL FUNDS */}
              <section className="content-section">
                <div className="section-heading">
                  <h2>Mutual Funds Invested ({mutualFunds.length})</h2>
                </div>

                <div className="mf-table-card">
                  <div className="mf-table-header">
                    <span className="mf-col-name">Fund name</span>

                    <span className="mf-col-aum">AUM%</span>
                  </div>

                  <div className="mf-table-body">
                    {mutualFunds.length > 0 ? (
                      mutualFunds.map((fund, index) => (
                        <div className="mf-row" key={`${fund.name}-${index}`}>
                          <div className="mf-left-group">
                            <div className="mf-logo-wrapper">
                              {fund.logo ? (
                                <img
                                  src={fund.logo}
                                  alt={fund.name}
                                  className="mf-logo-img"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none";

                                    if (e.currentTarget.nextSibling) {
                                      e.currentTarget.nextSibling.style.display =
                                        "flex";
                                    }
                                  }}
                                />
                              ) : null}

                              <div className="mf-logo-fallback" style={{ display: fund.logo ? "none" : "flex" }}>
                                {fund.name?.[0]}
                              </div>
                            </div>

                            <span className="mf-fund-name">{fund.name}</span>
                          </div>

                          <div className="mf-aum-value">
                            {fund.percentage !== null
                              ? `${fund.percentage.toFixed(2)}%`
                              : "—"}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="mf-row">
                        Mutual fund ownership data unavailable
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>


            {/* RIGHT TRADING PANEL */}
            <div style={{ height: "fit-content", width: "25rem", minWidth: "20rem", position: "sticky", top: "140px", }}>
              <div className="trading-panel">
                <div className="trading-header">
                  <p style={{ margin: 0, fontSize: "1rem", fontWeight: 500 }}>
                    {snapshot?.symbol || stockInfo?.symbol || symbol}
                  </p>

                  <div className="trading-market-info">
                    <span>{exchange}</span>
                    <span>{ltp !== null ? formatCurrency(ltp) : "—"}</span>
                    <span>BSE</span>

                    <span>
                      {bsePrice !== null ? formatCurrency(bsePrice) : "—"}
                    </span>

                    <span className={positive ? "positive" : "negative"}>
                      {formatPercent(changePercent)}
                    </span>
                  </div>
                </div>

                <div className="order-tabs">
                  <button className={orderType === "BUY" ? "active buy" : ""} onClick={() => setOrderType("BUY")}>
                    BUY
                  </button>

                  <button className={orderType === "SELL" ? "active sell" : ""} onClick={() => setOrderType("SELL")}>
                    SELL
                  </button>
                </div>

                <div className="trading-body">
                  <div style={{ borderBottom: "1px solid #e2e6ea", paddingBottom: ".5rem", }}>
                    <div className="order-field">
                      <div className="order-label">
                        <span>Qty</span>
                      </div>

                      <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                    </div>

                    <div className="order-field">
                      <div className="order-label">
                        <span>Price Limit</span>
                      </div>

                      <input type="number" min="0" value={priceLimit} placeholder={ltp !== null ? String(ltp) : ""} onChange={(e) => setPriceLimit(e.target.value)} />
                    </div>
                  </div>

                  <div className="order-summary">
                    <span>Balance : ₹0</span>

                    <div>
                      <p style={{ margin: 0 }}>Approx</p>

                      <p style={{ margin: 0 }}>
                        {formatCurrency(approximateRequired)}
                      </p>
                    </div>
                  </div>

                  <button
                    className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"
                      }`}
                    disabled={
                      !marketOpen || !quantity || numberValue(quantity) <= 0
                    }
                  >
                    {marketOpen ? orderType : "MARKET CLOSED"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}