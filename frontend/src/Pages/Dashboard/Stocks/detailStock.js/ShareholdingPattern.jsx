import React, { useMemo, useState } from "react";
import {
  Search, Bell, User, LayoutDashboard, TrendingUp, Bookmark, BarChart2, History, Settings, ChevronRight, Info, Maximize2, Star, ArrowUpRight, ArrowDownRight, Newspaper, CalendarDays, CandlestickChart, Wallet, PieChart,
} from "lucide-react";

export default function ShareholdingPattern() {
  const [orderType, setOrderType] = useState("BUY");
  const [deliveryType, setDeliveryType] = useState("Delivery");
  const [activeTab, setActiveTab] = useState("Overview");
  const [chartRange, setChartRange] = useState("1D");
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [priceLimit, setPriceLimit] = useState(3721.8);

  const navItems = [
    { icon: LayoutDashboard, label: "Market Overview" },
    { icon: TrendingUp, label: "Investments", active: true },
    { icon: Bookmark, label: "Watchlist" },
    { icon: BarChart2, label: "Analytics" },
    { icon: History, label: "History" },
  ];

  const fundamentals = [
    { label: "Market Cap", value: "₹1,15,809 Cr" },
    { label: "ROE", value: "27.22%" },
    { label: "P/E Ratio (TTM)", value: "88.42" },
    { label: "EPS (TTM)", value: "36.78" },
    { label: "P/B Ratio", value: "24.07" },
    { label: "Dividend Yield", value: "0.12%" },
    { label: "Industry P/E", value: "30.90" },
    { label: "Book Value", value: "₹135.12" },
    { label: "Debt to Equity", value: "0.04" },
    { label: "Face Value", value: "₹2" },
  ];

  const shareholding = [
    { label: "Promoters", percentage: 75.0, },
    { label: "Retail And Others", percentage: 11.09, },
    { label: "Mutual Funds", percentage: 5.96, },
    { label: "Foreign Institutions", percentage: 4.82, },
    { label: "Domestic Institutions", percentage: 3.13, },
  ];

  const mutualFunds = [
    { name: "SBI Large & Midcap Fund", percentage: "1.24%", value: "₹142.8 Cr", },
    { name: "HDFC Flexi Cap Fund", percentage: "0.91%", value: "₹104.5 Cr", },
    { name: "ICICI Prudential Bluechip Fund", percentage: "0.76%", value: "₹87.4 Cr", },
    { name: "Axis Growth Opportunities Fund", percentage: "0.58%", value: "₹66.8 Cr", },
  ];

  const chartData = useMemo(() => {
    const data = {
      "1D": [3312, 3340, 3324, 3380, 3362, 3420, 3408, 3475, 3450, 3512, 3490, 3555, 3528, 3590, 3568, 3648,],
      "1W": [3260, 3290, 3275, 3330, 3360, 3315, 3400, 3375, 3450, 3410, 3495, 3520, 3480, 3580, 3620, 3648,],
      "1M": [2980, 3040, 3005, 3120, 3085, 3190, 3150, 3250, 3210, 3330, 3290, 3410, 3380, 3500, 3570, 3648,],
      "3M": [2710, 2780, 2750, 2860, 2820, 2950, 2910, 3050, 2980, 3150, 3210, 3280, 3400, 3470, 3560, 3648,],
      "6M": [2410, 2500, 2470, 2600, 2550, 2720, 2680, 2850, 2780, 2960, 3050, 3180, 3260, 3400, 3520, 3648,],
      "1Y": [2115, 2250, 2180, 2390, 2510, 2440, 2680, 2750, 2920, 2850, 3070, 3180, 3290, 3420, 3570, 3648,],
      "3Y": [1350, 1450, 1520, 1490, 1660, 1810, 1750, 1940, 2120, 2050, 2300, 2520, 2680, 2920, 3250, 3648,],
      "5Y": [950, 1100, 1030, 1280, 1420, 1380, 1650, 1840, 1730, 2100, 2250, 2470, 2690, 2950, 3300, 3648,],
      All: [600, 740, 680, 920, 1050, 990, 1300, 1450, 1600, 1840, 2050, 2350, 2600, 2950, 3300, 3648,],
    };

    return data[chartRange] || data["1D"];
  }, [chartRange]);

  const chart = useMemo(() => {
    const width = 1000;
    const height = 300;
    const paddingX = 10;
    const paddingY = 20;

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);

    const points = chartData.map((value, index) => {
      const x = paddingX + (index / (chartData.length - 1)) * (width - paddingX * 2);
      const y = height - paddingY - ((value - min) / (max - min || 1)) * (height - paddingY * 2);

      return `${x},${y}`;
    });

    return {
      line: points.join(" "),
      area: `M ${points[0]} L ${points.join(" L ",)} L ${width - paddingX},${height} L ${paddingX},${height} Z`,
      min,
      max,
    };
  }, [chartData]);

  const approximateRequired = Number(quantity || 0) * Number(priceLimit || 0);

  const formatCurrency = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, }).format(value);

  return (
    <div className="precision-dashboard">
      <main className="precision-main">
        {/* CONTENT */}

        <div className="precision-content">
          <div className="precision-left">
            {/* ================= STOCK HEADER ================= */}

            <section className="stock-card">
              <div className="stock-header">
                <div className="stock-main-info">
                  <div>
                    <div className="stock-meta">
                      <span>ENRIN</span>

                      <span className="stock-meta-dot" />

                      <span>NSE</span>
                    </div>

                    <h1>Siemens Energy India</h1>

                    <div className="stock-price-row">
                      <span className="stock-price">₹3,648.80</span>

                      <span className="stock-positive">
                        396.60 (12.19%)1D
                      </span>
                    </div>
                  </div>
                </div>

                <div className="stock-actions">
                  <button className={isWatchlisted ? "watchlisted" : ""} onClick={() => setIsWatchlisted(!isWatchlisted)}                  >
                    {isWatchlisted ? (
                      <Bookmark size={18} fill="currentColor" />
                    ) : (
                      <Bookmark size={18} />
                    )}
                  </button>
                </div>
              </div>

              {/* ================= CHART ================= */}

              <div className="chart-wrapper">
                <div className="chart-area">

                  <svg className="stock-chart" viewBox="0 0 1000 300" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00b28e" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#00b28e" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    <path d={chart.area} fill="url(#stockGradient)" />

                    <polyline points={chart.line} fill="none" stroke="#00b28e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                  <div className="chart-current-price">₹3,648.80</div>
                </div>
              </div>

              <div className="chart-footer">
                <div className="chart-periods">
                  {["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "All"].map(
                    (period) => (
                      <button key={period} className={chartRange === period ? "active" : ""} onClick={() => setChartRange(period)}>
                        <p style={{ margin: "0" }}>{period}</p>
                      </button>
                    ),
                  )}
                </div>

                <div className="chart-tools">
                  <button style={{ fontSize: "12px" }}>
                    Terminal
                    <i class="fa-solid fa-sliders"></i>
                  </button>
                </div>
              </div>
            </section>

            {/* ================= PERFORMANCE ================= */}

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
                    <p>₹3,426.40</p>
                    <p>₹3,735.00</p>
                  </div>

                  <div className="range-line">
                    <div className="range-marker" style={{ left: "72%", }} />
                  </div>
                </div>

                {/* 52 WEEK */}

                <div className="range-block">
                  <div className="range-title">
                    <p>52 week low</p>
                    <p>52 week high</p>
                  </div>

                  <div className="range-values">
                    <p>₹2,115.00</p>
                    <p>₹3,968.00</p>
                  </div>

                  <div className="range-line">
                    <div className="range-marker" style={{ left: "83%", }} />
                  </div>
                </div>

                <div className="performance-stats">
                  <div>
                    <span>Open price</span>
                    <p>₹3,450.00</p>
                  </div>

                  <div>
                    <span>Previous close</span>
                    <p>₹3,252.20</p>
                  </div>

                  <div>
                    <span>Live volume</span>
                    <p>₹79,73,925</p>
                  </div>

                  <div>
                    <span>Upper circuit</span>
                    <p>₹4,378.50</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ================= FUNDAMENTALS ================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Fundamentals</h2>
              </div>

              <div className="fundamentals-card">

                {fundamentals.map((item) => (
                  <div className="fundamental-row" key={item.label}>
                    <span>{item.label}</span>
                    <p>{item.value}</p>
                  </div>
                ))}

              </div>
            </section>

            {/* ================= SHAREHOLDING ================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Shareholding Pattern</h2>
              </div>

              <div className="shareholding-card">
                <div className="shareholding-periods">
                  {["Jun '26", "Mar '26", "Dec '25", "Sep '25", "Jun '25"].map(
                    (period, index) => (
                      <button key={period} className={index === 4 ? "active" : ""}>
                        {period}
                      </button>
                    ),
                  )}
                </div>

                <div className="shareholding-list">
                  {shareholding.map((item) => (
                    <div className="shareholding-row" key={item.label}>
                      <div className="shareholding-label">
                        <span>{item.label}</span>
                        <p style={{ color: "black", margin: "0", fontWeight: "500", fontSize: "15px" }}>{item.percentage.toFixed(2)}%</p>
                      </div>

                      <div className="shareholding-bar">
                        <div style={{ width: `${item.percentage}%`, }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ================= MUTUAL FUNDS ================= */}

            <section className="content-section">
              <div className="section-heading">
                <h2>Mutual Funds Invested</h2>
              </div>

              <div className="mutual-fund-card">
                {mutualFunds.map((fund) => (
                  <div className="mutual-fund-row" key={fund.name}>
                    <div className="fund-icon">
                      <Wallet size={18} />
                    </div>

                    <div className="fund-name">
                      <p>{fund.name}</p>
                    </div>
                    <div className="fund-percentage">{fund.percentage}</div>
                    <div className="fund-value">{fund.value}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ================= TRADING PANEL ================= */}

          <div style={{ height: "fit-content", width: "25rem", minWidth: "20rem", position:"sticky", top:"140px"}}>
            <div className="trading-panel">
              <div className="trading-header">
                <p style={{ margin: "0", fontSize: "1rem", fontWeight: "500", lineHeight: "1.357rem" }}>Siemens Energy India</p>

                <div className="trading-market-info">
                  <span>NSE</span>
                  <span>₹3,648.80</span>
                  <span>BSE</span>
                  <span>₹3,648.75</span>

                  <span className="positive">+12.20%</span>
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

              <div className="trading-body">
                <div style={{ borderBottom: "1px solid #e2e6ea", paddingBottom: ".5rem" }}>
                  {/* QUANTITY */}
                  <div className="order-field">
                    <div className="order-label">
                      <span>Qty BSE</span>
                    </div>

                    <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
                  </div>

                  {/* PRICE */}
                  <div className="order-field">
                    <div className="order-label">
                      <span>Price Limit</span>
                    </div>

                    <input type="number" value={priceLimit} onChange={(e) => setPriceLimit(e.target.value)} />
                  </div>
                </div>


                {/* ORDER SUMMARY */}
                <div className="order-summary">
                  <span>Balance : ₹0</span>

                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <p style={{ margin: "0", paddingBottom: ".25rem", maxWidth: "5rem", textAlign: "end" }}>Approx</p>
                    <p style={{ margin: "0" }}>{formatCurrency(approximateRequired)}</p>
                  </div>
                </div>

                {/* BUY BUTTON */}

                <button className={`place-order ${orderType === "BUY" ? "buy-button" : "sell-button"}`}>
                  {orderType}
                </button>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};