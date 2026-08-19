import React, { useEffect, useMemo, useState } from "react";
import detailStockSocket from "../../../../indexWebSocketConnection.js/detailStockWebSocketConnection";
import "./detailStock.css";

const API = process.env.REACT_APP_DETAIL_STOCK_API || "http://localhost:3011";
const DEFAULT_INSTRUMENT = "NSE_EQ|INE020B01018";
const RANGES = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"];

function money(v) {
  return `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function compact(v) {
  return Number(v || 0).toLocaleString("en-IN");
}
function pct(v) {
  const n = Number(v || 0);
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DetailStock({
  instrumentKey = DEFAULT_INSTRUMENT,
  symbol = "Siemens Energy India",
  exchange = "NSE",
}) {
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [range, setRange] = useState("1D");
  const [marketOpen, setMarketOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("");
  const [priceLimit, setPriceLimit] = useState("");

  useEffect(() => {
    let alive = true;
    const onSnapshot = (data) => {
      if (alive) {
        setSnapshot(data);
        setMarketOpen(Boolean(data.marketOpen));
        setLoading(false);
      }
    };
    const onTick = (data) => {
      if (alive && data?.instrumentKey === instrumentKey) {
        setSnapshot((s) => ({ ...s, ...data }));
        setMarketOpen(true);
      }
    };
    detailStockSocket.on("detailStock:snapshot", onSnapshot);
    detailStockSocket.on("detailStock:tick", onTick);
    const subscribe = () =>
      detailStockSocket.emit(
        "detailStock:subscribe",
        { instrumentKey },
        (ack) => {
          if (!ack?.success) setError(ack?.message || "Subscription failed");
        },
      );
    if (detailStockSocket.connected) subscribe();
    else detailStockSocket.once("connect", subscribe);
    return () => {
      alive = false;
      detailStockSocket.emit("detailStock:unsubscribe", { instrumentKey });
      detailStockSocket.off("detailStock:snapshot", onSnapshot);
      detailStockSocket.off("detailStock:tick", onTick);
      detailStockSocket.off("connect", subscribe);
    };
  }, [instrumentKey]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setHistoryLoading(true);
      const map = {
        "1D": ["minutes", "1"],
        "1W": ["minutes", "5"],
        "1M": ["days", "1"],
        "3M": ["days", "1"],
        "6M": ["days", "1"],
        "1Y": ["days", "1"],
        "3Y": ["weeks", "1"],
        "5Y": ["weeks", "1"],
        All: ["months", "1"],
      };
      const [unit, interval] = map[range];
      const from =
        range === "1D"
          ? daysAgo(1)
          : range === "1W"
            ? daysAgo(7)
            : range === "1M"
              ? daysAgo(31)
              : range === "3M"
                ? daysAgo(92)
                : range === "6M"
                  ? daysAgo(183)
                  : range === "1Y"
                    ? daysAgo(365)
                    : range === "3Y"
                      ? daysAgo(1095)
                      : range === "5Y"
                        ? daysAgo(1825)
                        : "2000-01-01";
      try {
        const res = await fetch(
          `${API}/api/detail-stock/history/${encodeURIComponent(instrumentKey)}?unit=${unit}&interval=${interval}&from=${from}&to=${new Date().toISOString().slice(0, 10)}`,
        );
        const json = await res.json();
        if (alive) setHistory(json.data || []);
      } catch (e) {
        if (alive) setError("Unable to load historical chart");
      } finally {
        if (alive) setHistoryLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [instrumentKey, range]);

  const chart = useMemo(() => {
    const values = history.map((x) => Number(x.close)).filter(Number.isFinite);
    if (!values.length && snapshot?.price) values = [Number(snapshot.price)];
    const width = 1000,
      height = 300,
      pad = 18,
      min = Math.min(...values),
      max = Math.max(...values),
      den = max - min || 1;
    const points = values.map(
      (v, i) =>
        `${pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2)},${height - pad - ((v - min) / den) * (height - pad * 2)}`,
    );
    return {
      points: points.join(" "),
      area: points.length
        ? `M ${points.join(" L ")} L ${width - pad},${height} L ${pad},${height} Z`
        : "",
      min,
      max,
    };
  }, [history, snapshot]);

  const current = Number(snapshot?.price || 0);
  const previous = Number(snapshot?.previousClose || 0);
  const change = current - previous;
  const changePct = previous ? (change / previous) * 100 : 0;
  const positive = change >= 0;
  const approx = Number(quantity || 0) * Number(priceLimit || current || 0);

  if (loading && !snapshot)
    return (
      <div className="ds-page">
        <div className="ds-loading">Loading stock details…</div>
      </div>
    );

  return (
    <div className="ds-page">
      <div className="ds-main">
        <section className="ds-card ds-quote-card">
          <div className="ds-stock-head">
            <div>
              <div className="ds-meta">
                <span>{exchange}</span>
                <span>•</span>
                <span>{instrumentKey}</span>
              </div>
              <h1>{symbol}</h1>
              <div className="ds-price-row">
                <strong>{money(current)}</strong>
                <span className={positive ? "ds-positive" : "ds-negative"}>
                  {positive ? "+" : ""}
                  {money(change)} ({pct(changePct)}) 1D
                </span>
              </div>
              <div className="ds-market-state">
                <span className={marketOpen ? "dot live" : "dot"}></span>
                {marketOpen
                  ? "Market open · live"
                  : "Market closed · showing latest available close"}
              </div>
            </div>
            <button className="ds-icon-btn" aria-label="Bookmark">
              ☆
            </button>
          </div>
          {error && <div className="ds-error">{error}</div>}
          <div className="ds-chart-wrap">
            {historyLoading && (
              <div className="ds-chart-loading">Updating chart…</div>
            )}
            <svg
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
              className="ds-chart"
            >
              <defs>
                <linearGradient id="dsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00b28e" stopOpacity=".24" />
                  <stop offset="100%" stopColor="#00b28e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#dsGrad)" />
              <polyline
                points={chart.points}
                fill="none"
                stroke="#00b28e"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="ds-chart-footer">
            <div className="ds-periods">
              {RANGES.map((x) => (
                <button
                  key={x}
                  onClick={() => setRange(x)}
                  className={range === x ? "active" : ""}
                >
                  {x}
                </button>
              ))}
            </div>
            <span className="ds-source">{history.length} candles</span>
          </div>
        </section>

        <section className="ds-section">
          <h2>Performance</h2>
          <div className="ds-card ds-performance">
            <Range
              labelLeft="Today's low"
              left={snapshot?.low}
              labelRight="Today's high"
              right={snapshot?.high}
              current={current}
            />
            <Range
              labelLeft="Previous close"
              left={snapshot?.previousClose}
              labelRight="Current"
              right={current}
              current={current}
            />
            <div className="ds-stats">
              <Stat label="Open price" value={snapshot?.open} />
              <Stat label="Previous close" value={snapshot?.previousClose} />
              <Stat label="Live volume" value={snapshot?.volume} />
              <Stat
                label="Last update"
                value={
                  snapshot?.timestamp
                    ? new Date(snapshot.timestamp).toLocaleTimeString("en-IN")
                    : "—"
                }
              />
            </div>
          </div>
        </section>

        <section className="ds-section">
          <h2>Fundamentals</h2>
          <div className="ds-card ds-fund-grid">
            <Stat
              label="Market status"
              value={marketOpen ? "Open" : "Closed"}
            />
            <Stat label="Last price" value={money(current)} raw />
            <Stat label="Day high" value={snapshot?.high} />
            <Stat label="Day low" value={snapshot?.low} />
            <Stat label="Previous close" value={snapshot?.previousClose} />
            <Stat label="Volume" value={compact(snapshot?.volume)} raw />
          </div>
        </section>
      </div>

      <aside className="ds-order-card ds-card">
        <h3>{symbol}</h3>
        <div className="ds-order-meta">
          {exchange} · {money(current)}{" "}
          <span className={positive ? "ds-positive" : "ds-negative"}>
            ({pct(changePct)})
          </span>
        </div>
        <div className="ds-order-tabs">
          <button className="buy">BUY</button>
          <button>SELL</button>
        </div>
        <label>
          Quantity
          <input
            type="number"
            min="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label>
          Price limit
          <input
            type="number"
            min="0"
            value={priceLimit}
            placeholder={String(current || "")}
            onChange={(e) => setPriceLimit(e.target.value)}
          />
        </label>
        <div className="ds-approx">
          <span>Approx. required</span>
          <strong>{money(approx)}</strong>
        </div>
        <button className="ds-buy-btn">BUY</button>
        <p className="ds-disclaimer">
          Demo trading UI. This module does not place real orders.
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, value, raw = false }) {
  return (
    <div className="ds-stat">
      <span>{label}</span>
      <strong>
        {raw
          ? value
          : value == null
            ? "—"
            : typeof value === "number"
              ? money(value)
              : value}
      </strong>
    </div>
  );
}
function Range({ labelLeft, left, labelRight, right, current }) {
  const lo = Number(left || 0),
    hi = Number(right || 0),
    cur = Number(current || 0);
  const pos =
    hi > lo ? Math.max(1, Math.min(99, ((cur - lo) / (hi - lo)) * 100)) : 50;
  return (
    <div className="ds-range">
      <div className="ds-range-title">
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
      <div className="ds-range-values">
        <strong>{money(lo)}</strong>
        <strong>{money(hi)}</strong>
      </div>
      <div className="ds-range-line">
        <i style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}