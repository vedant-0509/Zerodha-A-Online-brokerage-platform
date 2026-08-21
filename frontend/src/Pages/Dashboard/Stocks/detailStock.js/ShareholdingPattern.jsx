import React, { useEffect, useMemo, useState } from "react";
import detailStockSocket from "./detailStockWebSocketConnection";

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
      return {
        unit: "minutes",
        interval: "1",
        from: getDateDaysAgo(1),
      };

    case "1W":
      return {
        unit: "minutes",
        interval: "5",
        from: getDateDaysAgo(7),
      };

    case "1M":
      return {
        unit: "days",
        interval: "1",
        from: getDateDaysAgo(31),
      };

    case "3M":
      return {
        unit: "days",
        interval: "1",
        from: getDateDaysAgo(92),
      };

    case "6M":
      return {
        unit: "days",
        interval: "1",
        from: getDateDaysAgo(183),
      };

    case "1Y":
      return {
        unit: "days",
        interval: "1",
        from: getDateDaysAgo(365),
      };

    case "3Y":
      return {
        unit: "weeks",
        interval: "1",
        from: getDateDaysAgo(1095),
      };

    case "5Y":
      return {
        unit: "weeks",
        interval: "1",
        from: getDateDaysAgo(1825),
      };

    case "All":
      return {
        unit: "months",
        interval: "1",
        from: "2000-01-01",
      };

    default:
      return {
        unit: "minutes",
        interval: "1",
        from: getDateDaysAgo(1),
      };
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ShareholdingPattern({
  instrumentKey = DEFAULT_INSTRUMENT,
  isin = instrumentKey.includes("|") ? instrumentKey.split("|")[1] : "",
  symbol = "Siemens Energy India",
  exchange = "NSE",
}) {
  /* =====================================================
       MARKET STATE
    ===================================================== */

  const [snapshot, setSnapshot] = useState(null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");

  /* =====================================================
       HISTORY
    ===================================================== */

  const [chartRange, setChartRange] = useState("1D");
  const [historicalData, setHistoricalData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* =====================================================
       UI
    ===================================================== */

  const [orderType, setOrderType] = useState("BUY");
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [priceLimit, setPriceLimit] = useState("");

  /* =====================================================
       FUNDAMENTALS
       
       These can come from backend snapshot if available.
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

  /* =====================================================
       BSE PRICE

       Your backend may send this as:
       bsePrice / bseLtp / bse / bseLastPrice
    ===================================================== */

  const bsePrice = numberValue(
    snapshot?.bsePrice ??
    snapshot?.bseLtp ??
    snapshot?.bseLastPrice ??
    snapshot?.bse ??
    0,
  );
  const positive = change >= 0;

  /* =====================================================
       WEBSOCKET
       
       One connection per browser.
       Backend should multiplex provider ticks.
    ===================================================== */

  useEffect(() => {
    let alive = true;

    setMarketLoading(true);
    setMarketError("");

    const handleSnapshot = (data) => {
      if (!alive || !data) return;

      /*
       * If backend sends snapshots for many instruments,
       * ignore snapshots belonging to another instrument.
       *
       * If your backend sends instrumentKey under another
       * property, add it here.
       */
      if (data.instrumentKey && data.instrumentKey !== instrumentKey) {
        return;
      }

      setSnapshot((previous) => ({
        ...(previous || {}),
        ...data,
      }));

      if (typeof data.marketOpen !== "undefined") {
        setMarketOpen(Boolean(data.marketOpen));
      }

      /*
       * Optional backend data.
       */

      if (data.fundamentals) {
        setFundamentalData(data.fundamentals);
      }

      if (data.shareholding) {
        setShareholdingData(data.shareholding);
      }

      if (data.mutualFunds) {
        setMutualFundData(data.mutualFunds);
      }

      setMarketLoading(false);
    };

    const handleTick = (data) => {
      if (!alive || !data) return;

      if (data.instrumentKey && data.instrumentKey !== instrumentKey) {
        return;
      }

      setSnapshot((previous) => ({
        ...(previous || {}),
        ...data,
      }));

      if (typeof data.marketOpen !== "undefined") {
        setMarketOpen(Boolean(data.marketOpen));
      } else {
        setMarketOpen(true);
      }

      setMarketLoading(false);
    };

    const subscribe = () => {
      detailStockSocket.emit(
        "detailStock:subscribe",
        {
          instrumentKey,
        },
        (ack) => {
          if (!alive) return;

          if (!ack?.success) {
            setMarketError(
              ack?.message || "Unable to subscribe to live market data.",
            );
            setMarketLoading(false);
            return;
          }

          /*
           * Some backends return the initial snapshot
           * through the subscription acknowledgement.
           */

          if (ack.snapshot) {
            setSnapshot((previous) => ({
              ...(previous || {}),
              ...ack.snapshot,
            }));

            if (typeof ack.snapshot.marketOpen !== "undefined") {
              setMarketOpen(Boolean(ack.snapshot.marketOpen));
            }

            setMarketLoading(false);
          }
        },
      );
    };

    detailStockSocket.on("detailStock:snapshot", handleSnapshot);

    detailStockSocket.on("detailStock:tick", handleTick);

    if (detailStockSocket.connected) {
      subscribe();
    } else {
      detailStockSocket.once("connect", subscribe);
    }

    return () => {
      alive = false;

      detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
      detailStockSocket.off("detailStock:snapshot", handleSnapshot);
      detailStockSocket.off("detailStock:tick", handleTick);
      detailStockSocket.off("connect", subscribe);
    };
  }, [instrumentKey]);

  /* =====================================================
       FUNDAMENTALS / SHAREHOLDING / MUTUAL FUNDS
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

        setFundamentalData(json.fundamentals || null);
        setShareholdingData(json.shareholding || []);
        setMutualFundData(json.mutualFunds || []);

        const periods = (json.shareholding || [])
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
       HISTORICAL DATA
    ===================================================== */

  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      setLoadingHistory(true);

      const params = getHistoryParams(chartRange);
      const to = new Date().toISOString().slice(0, 10);

      try {
        const url =
          `${API}/api/detail-stock/history/` +
          `${encodeURIComponent(instrumentKey)}` +
          `?unit=${encodeURIComponent(params.unit)}` +
          `&interval=${encodeURIComponent(params.interval)}` +
          `&from=${encodeURIComponent(params.from)}` +
          `&to=${encodeURIComponent(to)}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`History request failed: ${response.status}`);
        }

        const json = await response.json();

        if (!alive) return;

        /*
         * Supports both:
         *
         * { data: [...] }
         *
         * and
         *
         * { candles: [...] }
         */

        const candles = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.candles)
            ? json.candles
            : [];

        setHistoricalData(candles);
      } catch (error) {
        console.error("Failed to fetch historical data:", error);

        if (alive) {
          setHistoricalData([]);
        }
      } finally {
        if (alive) {
          setLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      alive = false;
    };
  }, [chartRange, instrumentKey]);

  /* =====================================================
       CHART VALUES
    ===================================================== */

  const chartData = useMemo(() => {
    const values = historicalData
      .map((item) => {
        if (typeof item === "number" || typeof item === "string") {
          return numberValue(item, NaN);
        }

        return numberValue(item?.close ?? item?.ltp ?? item?.price, NaN);
      })
      .filter(Number.isFinite);

    /*
     * If historical API has no data yet,
     * show the current market price.
     */

    if (!values.length && ltp > 0) {
      return [ltp];
    }

    return values;
  }, [historicalData, ltp]);

  /* =====================================================
       CHART SVG
    ===================================================== */

  const chart = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 10;
    const paddingY = 20;

    if (!chartData.length) {
      return { line: "", area: "", min: 0, max: 0 };
    }

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const range = max - min || 1;
    const points = chartData.map((value, index) => {
      const x =
        chartData.length === 1
          ? width / 2
          : paddingX +
          (index / (chartData.length - 1)) * (width - paddingX * 2);
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
  }, [chartData]);

  /* =====================================================
       52 WEEK RANGE
    ===================================================== */

  const calculated52WeekLow = useMemo(() => {
    if (week52Low > 0) {
      return week52Low;
    }

    if (chartData.length) {
      return Math.min(...chartData);
    }

    return 0;
  }, [week52Low, chartData]);

  const calculated52WeekHigh = useMemo(() => {
    if (week52High > 0) {
      return week52High;
    }

    if (chartData.length) {
      return Math.max(...chartData);
    }

    return 0;
  }, [week52High, chartData]);

  /* =====================================================
       RANGE POSITION
    ===================================================== */

  function getRangePosition(current, lowValue, highValue) {
    const currentNumber = numberValue(current);
    const lowNumber = numberValue(lowValue);
    const highNumber = numberValue(highValue);

    if (!currentNumber || highNumber <= lowNumber) {
      return "50%";
    }

    const position =
      ((currentNumber - lowNumber) / (highNumber - lowNumber)) * 100;

    return `${Math.max(0, Math.min(100, position))}%`;
  }

  /* =====================================================
       ORDER
    ===================================================== */

  const effectivePrice =
    numberValue(priceLimit) > 0 ? numberValue(priceLimit) : ltp;
  const approximateRequired = numberValue(quantity) * effectivePrice;

  /* =====================================================
       FUNDAMENTALS
    ===================================================== */

  const fundamentals = useMemo(() => {
    const data = fundamentalData || snapshot?.fundamentals;

    return [
      { label: "Market Cap", value: data?.marketCap ?? "N/A" },
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

  /* =====================================================
       SHAREHOLDING
    ===================================================== */

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

  /* =====================================================
       MUTUAL FUNDS
    ===================================================== */

  const mutualFunds = useMemo(() => {
    const data = mutualFundData || snapshot?.mutualFunds;
    if (!Array.isArray(data)) return [];

    return data.map((fund, index) => ({
      name: fund.name || fund.fundName || `Fund ${index + 1}`,
      percentage: fund.percentage ?? fund.percent ?? fund.value ?? "N/A",
      value: fund.period
        ? `Latest quarter: ${fund.period}`
        : (fund.value ?? fund.marketValue ?? "N/A"),
      history: fund.history || [],
    }));
  }, [mutualFundData, snapshot]);

  /* =====================================================
       LAST UPDATE
    ===================================================== */

  const lastUpdate = snapshot?.timestamp
    ? new Date(snapshot.timestamp).toLocaleTimeString("en-IN")
    : "—";

  /* =====================================================
       LOADING SCREEN
    ===================================================== */

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

  /* =====================================================
       UI
    ===================================================== */

  return (
    <div className="precision-dashboard">
      <main className="precision-main">
        <div className="precision-content">
          {/* =================================================
                        LEFT
                    ================================================= */}

          <div className="precision-left">
            {/* =================================================
                            STOCK HEADER
                        ================================================= */}

            <section className="stock-card">
              <div className="stock-header">
                <div className="stock-main-info">
                  <div>
                    <div className="stock-meta">
                      <span>{symbol}</span>
                      <span className="stock-meta-dot" />
                      <span>{exchange}</span>
                    </div>

                    <h1>{symbol}</h1>

                    <div className="stock-price-row">
                      <span className="stock-price">{formatCurrency(ltp)}</span>

                      <span className={positive ? "stock-positive" : "stock-negative"}>
                        {change >= 0 ? "+" : ""}
                        {formatNumber(change)} ({formatPercent(changePercent)})
                        1D
                      </span>
                    </div>

                    {/* MARKET STATUS */}

                    <div className="stock-market-status">
                      <span className={marketOpen ? "market-dot live" : "market-dot"} />

                      <span>
                        {marketOpen
                          ? "Market open · live"
                          : "Market closed · latest available close"}
                      </span>
                    </div>

                    {/* ERROR */}

                    {marketError && (
                      <div className="detail-stock-error">{marketError}</div>
                    )}
                  </div>
                </div>

                {/* WATCHLIST */}

                <div className="stock-actions">
                  <button className={isWatchlisted ? "watchlisted" : ""} onClick={() => setIsWatchlisted((value) => !value)} aria-label="Watchlist">
                    {isWatchlisted ? "★" : "☆"}
                  </button>
                </div>
              </div>

              {/* =================================================
                                CHART
                            ================================================= */}

              <div className="chart-wrapper">
                <div className="chart-area">
                  {loadingHistory && (
                    <div className="chart-loading">Updating chart…</div>
                  )}

                  <svg className="stock-chart" viewBox="0 0 1000 300" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00b28e" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#00b28e" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {chart.area && (
                      <path d={chart.area} fill="url(#stockGradient)" />
                    )}

                    {chart.line && (
                      <polyline points={chart.line} fill="none" stroke="#00b28e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>

                  <div className="chart-current-price">
                    {formatCurrency(ltp)}
                  </div>
                </div>
              </div>

              {/* =================================================
                                CHART FOOTER
                            ================================================= */}

              <div className="chart-footer">
                <div className="chart-periods">
                  {RANGES.map((period) => (
                    <button key={period} className={chartRange === period ? "active" : ""} onClick={() => setChartRange(period)} disabled={loadingHistory}>
                      <p style={{ margin: "0", }}>
                        {period}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="chart-tools">
                  <button style={{ fontSize: "12px", }}>
                    Terminal
                    <i className="fa-solid fa-sliders" />
                  </button>
                </div>
              </div>
            </section>

            {/* =================================================
                            PERFORMANCE
                        ================================================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Performance</h2>
              </div>

              <div className="performance-card">
                {/* TODAY RANGE */}

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
                    <div className="range-marker" style={{ left: getRangePosition(ltp, low, high), }} />
                  </div>
                </div>

                {/* 52 WEEK RANGE */}

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
                    <div className="range-marker" style={{ left: getRangePosition(ltp, calculated52WeekLow, calculated52WeekHigh,), }} />
                  </div>
                </div>

                {/* PERFORMANCE STATS */}

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

            {/* =================================================
                            FUNDAMENTALS
                        ================================================= */}

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

            {/* =================================================
                            SHAREHOLDING
                        ================================================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Shareholding Pattern</h2>
              </div>

              <div className="shareholding-card">
                <div className="shareholding-periods">
                  {shareholdingPeriods.map((period) => (
                    <button key={period} className={selectedShareholdingPeriod === period ? "active" : ""} onClick={() => setSelectedShareholdingPeriod(period)}>
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
                          <p style={{ color: "black", margin: 0, fontWeight: 500, fontSize: 15, }}>
                            {item.percentage.toFixed(2)}%
                          </p>
                        </div>
                        <div className="shareholding-bar">
                          <div style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%`, }} />
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
                            MUTUAL FUNDS
                        ================================================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Mutual Funds Invested</h2>
              </div>

              <div className="mutual-fund-card">
                {mutualFunds.length > 0 ? (
                  mutualFunds.map((fund) => (
                    <div className="mutual-fund-row" key={fund.name}>
                      <div className="fund-icon">
                        <span>MF</span>
                      </div>
                      <div className="fund-name">
                        <p>{fund.name}</p>
                      </div>
                      <div className="fund-percentage">
                        {typeof fund.percentage === "number"
                          ? `${fund.percentage.toFixed(2)}%`
                          : fund.percentage}
                      </div>
                      <div className="fund-value">{fund.value}</div>
                    </div>
                  ))
                ) : (
                  <div>Mutual fund ownership data unavailable</div>
                )}
              </div>
            </section>
          </div>

          {/* =================================================
                        TRADING PANEL
                    ================================================= */}

          <div style={{ height: "fit-content", width: "25rem", minWidth: "20rem", position: "sticky", top: "140px", }}>
            <div className="trading-panel">
              {/* HEADER */}

              <div className="trading-header">
                <p style={{ margin: "0", fontSize: "1rem", fontWeight: "500", lineHeight: "1.357rem", }}>
                  {symbol}
                </p>

                <div className="trading-market-info">
                  <span>NSE</span>
                  <span>{formatCurrency(ltp)}</span>
                  <span>BSE</span>
                  <span>{bsePrice ? formatCurrency(bsePrice) : "—"}</span>
                  <span className={positive ? "positive" : "negative"}>
                    {formatPercent(changePercent)}
                  </span>
                </div>
              </div>

              {/* BUY / SELL */}

              <div className="order-tabs">
                <button className={orderType === "BUY" ? "active buy" : ""} onClick={() => setOrderType("BUY")}>
                  BUY
                </button>

                <button className={orderType === "SELL" ? "active sell" : ""} onClick={() => setOrderType("SELL")}>
                  SELL
                </button>
              </div>

              {/* BODY */}

              <div className="trading-body">
                <div style={{ borderBottom: "1px solid #e2e6ea", paddingBottom: ".5rem", }}>
                  {/* QUANTITY */}

                  <div className="order-field">
                    <div className="order-label">
                      <span>Qty</span>
                    </div>

                    <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                  </div>

                  {/* PRICE */}

                  <div className="order-field">
                    <div className="order-label">
                      <span>Price Limit</span>
                    </div>

                    <input type="number" min="0" value={priceLimit} placeholder={ltp ? String(ltp) : ""} onChange={(e) => setPriceLimit(e.target.value)} />
                  </div>
                </div>

                {/* SUMMARY */}

                <div className="order-summary">
                  <span>Balance : ₹0</span>

                  <div style={{ display: "flex", flexDirection: "column", }}>
                    <p style={{ margin: "0", paddingBottom: ".25rem", maxWidth: "5rem", textAlign: "end", }}>
                      Approx
                    </p>

                    <p style={{ margin: "0", }}>
                      {formatCurrency(approximateRequired)}
                    </p>
                  </div>
                </div>

                {/* MARKET CLOSED */}

                {!marketOpen && (
                  <div className="detail-stock-error">
                    Market is closed. Orders are disabled until the market
                    opens.
                  </div>
                )}

                {/* ORDER */}

                <button className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`} disabled={!marketOpen || !quantity || numberValue(quantity) <= 0}>
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