// import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import axios from "axios";

// const API = "http://localhost:3001";

// const POPULAR_FUNDS = [
//     {
//         id: "sbi-gold",
//         name: "SBI Gold Direct Plan-Growth",
//         returns: "+36.00%",
//         icon: (
//             <svg viewBox="0 0 24 24" className="fund-svg">
//                 <circle cx="12" cy="7.5" r="3.2" />
//                 <circle cx="7.5" cy="14" r="3.2" />
//                 <circle cx="16.5" cy="14" r="3.2" />
//                 <path d="M11 11.5h2V20h-2z" />
//             </svg>
//         ),
//         iconClass: "sbi-icon",
//     },
//     {
//         id: "bandhan-small",
//         name: "Bandhan Small Cap Fund",
//         returns: "+25.44%",
//         icon: (
//             <svg viewBox="0 0 24 24" className="fund-svg flame-svg">
//                 <path d="M12 2.5C11.5 6 7 9.5 7 14c0 2.8 2.2 5 5 5s5-2.2 5-5c0-4.5-4.5-8-5-11.5zm0 15c-1.7 0-3-1.3-3-3 0-1.8 1.8-3.4 3-5.2 1.2 1.8 3 3.4 3 5.2 0 1.7-1.3 3-3 3z" />
//             </svg>
//         ),
//         iconClass: "bandhan-icon",
//     },
//     {
//         id: "hdfc-mid",
//         name: "HDFC Mid Cap Fund",
//         returns: "+18.33%",
//         icon: (
//             <div className="hdfc-symbol">
//                 <div></div>
//                 <div></div>
//                 <div></div>
//                 <div></div>
//             </div>
//         ),
//         iconClass: "hdfc-icon",
//     },
//     {
//         id: "parag-parikh",
//         name: "Parag Parikh Flexi Cap Fund",
//         returns: "+13.33%",
//         icon: (
//             <svg viewBox="0 0 24 24" className="fund-svg parag-svg">
//                 <path d="M19 12c.6 0 1-.4 1-1s-.4-1-1-1h-1.1c-.5-2.8-2.6-5-5.4-5.7V3.5c0-.8-.7-1.5-1.5-1.5S9.5 2.7 9.5 3.5v.8C6.7 5 4.6 7.2 4.1 10H3c-.6 0-1 .4-1 1s.4 1 1 1h.6c.2 1.8 1 3.4 2.3 4.5l-1.6 1.6c-.4.4-.4 1 0 1.4.2.2.5.3.7.3s.5-.1.7-.3l1.8-1.8c1.3.8 2.8 1.3 4.5 1.3s3.2-.5 4.5-1.3l1.8 1.8c.2.2.5.3.7.3s.5-.1.7-.3c.4-.4.4-1 0-1.4L18.4 16.5c1.3-1.1 2.1-2.7 2.3-4.5H19zm-7 4c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" />
//             </svg>
//         ),
//         iconClass: "parag-icon",
//     },
//     {
//         id: "nippon-small",
//         name: "Nippon India Small Cap Fund",
//         returns: "+31.20%",
//         iconText: "N",
//         iconClass: "nippon-icon",
//     },
//     {
//         id: "icici-tech",
//         name: "ICICI Prudential Technology Fund",
//         returns: "+22.15%",
//         iconText: "ICICI",
//         iconClass: "icici-icon",
//     },
//     {
//         id: "axis-bluechip",
//         name: "Axis Bluechip Fund",
//         returns: "+16.80%",
//         icon: (
//             <svg viewBox="0 0 24 24" className="fund-svg">
//                 <path d="M12 4L3 20h6l3-6 3 6h6z" />
//             </svg>
//         ),
//         iconClass: "axis-icon",
//     },
//     {
//         id: "mirae-large",
//         name: "Mirae Asset Large Cap Fund",
//         returns: "+14.50%",
//         iconText: "MA",
//         iconClass: "mirae-icon",
//     },
// ];

// export default function ExploreSection1() {
//     const navigate = useNavigate();

//     const [activeTab, setActiveTab] = useState("Gainers");
//     const [stocks, setStocks] = useState([]);
//     const [loading, setLoading] = useState(false);

//     useEffect(() => {
//         const fetchMovers = async () => {
//             try {
//                 setLoading(true);

//                 // Replace this endpoint with your existing endpoint if required.
//                 const response = await axios.get(`${API}/api/top-movers`, {
//                     params: {
//                         type: activeTab,
//                     },
//                 });

//                 const data = Array.isArray(response.data)
//                     ? response.data
//                     : response.data?.data || [];

//                 setStocks(data);
//             } catch (error) {
//                 console.error("Failed to fetch top movers:", error);
//                 setStocks([]);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchMovers();
//     }, [activeTab]);

//     const openStock = (stock) => {
//         if (!stock) return;

//         const symbol = stock.symbol || stock.trading_symbol || stock.instrument_key;

//         if (symbol) {
//             navigate(`/stock/${encodeURIComponent(symbol)}`);
//         }
//     };

//     const getPrice = (stock) => {
//         const value =
//             stock.price ?? stock.last_price ?? stock.ltp ?? stock.close ?? 0;

//         return Number(value) || 0;
//     };

//     const getChangePercent = (stock) => {
//         const value =
//             stock.changePercent ??
//             stock.change_percent ??
//             stock.change_percentage ??
//             stock.pChange ??
//             0;

//         return Number(value) || 0;
//     };

//     const getChangePoints = (stock) => {
//         const value =
//             stock.changePoints ?? stock.change_points ?? stock.change ?? 0;

//         return Number(value) || 0;
//     };

//     const getVolume = (stock) => {
//         const value =
//             stock.volume ?? stock.totalTradedVolume ?? stock.total_traded_volume ?? 0;

//         return Number(value) || 0;
//     };

//     return (
//         <div className="explore-section-wrapper">
//             <main className="explore-dashboard">
//                 {/* ==========================================
//                     POPULAR FUNDS + YOUR INVESTMENTS
//                 =========================================== */}
//                 <div className="dashboard-layout">
//                     {/* LEFT COLUMN */}
//                     <section className="popular-funds-section">
//                         <h2 className="section-title">Popular Funds</h2>

//                         <div className="funds-grid">
//                             {POPULAR_FUNDS.map((fund) => (
//                                 <article key={fund.id} className="fund-card">
//                                     <div>
//                                         <div className={`fund-icon ${fund.iconClass}`}>
//                                             {fund.icon ?? fund.iconText}
//                                         </div>

//                                         <h3 className="fund-name">{fund.name}</h3>
//                                     </div>

//                                     <div className="fund-bottom">
//                                         <span className="fund-return">{fund.returns}</span>

//                                         <span className="fund-period">3Y</span>
//                                     </div>
//                                 </article>
//                             ))}
//                         </div>

//                         <a href="#all-mutual-funds" className="all-funds-link">
//                             <span>All Mutual Funds</span>
//                             <span className="all-funds-arrow">›</span>
//                         </a>
//                     </section>

//                     {/* RIGHT COLUMN */}
//                     <aside className="investments-section">
//                         <h2 className="section-title">Your Investments</h2>

//                         <div className="investment-card">
//                             <div>
//                                 <span className="current-label">Current</span>

//                                 <div className="current-value">₹72,127</div>
//                             </div>

//                             <hr className="investment-divider" />

//                             <div className="investment-stats">
//                                 <div className="investment-row">
//                                     <span className="investment-label">1D returns</span>

//                                     <span className="investment-value loss-value">
//                                         -135.62 (0.19%)
//                                     </span>
//                                 </div>

//                                 <div className="investment-row">
//                                     <span className="investment-label">Total returns</span>

//                                     <span className="investment-value gain-value">
//                                         +2,130 (3.04%)
//                                     </span>
//                                 </div>

//                                 <div className="investment-row">
//                                     <span className="investment-label">Invested</span>

//                                     <span className="investment-value dark-value">₹69,997</span>
//                                 </div>

//                                 <div className="investment-row">
//                                     <span className="investment-label">XIRR</span>

//                                     <span className="investment-value dark-value">4.71%</span>
//                                 </div>
//                             </div>
//                         </div>
//                     </aside>
//                 </div>
//             </main>
//         </div>
//     );
// }

import React, { useEffect, useState } from "react";

import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000/api/mutual-funds";

const AUTH_API = "http://localhost:3010";

const INITIAL_LIMIT = 8;

const ICON_CLASSES = [
  "sbi-icon",
  "bandhan-icon",
  "hdfc-icon",
  "parag-icon",
  "nippon-icon",
  "icici-icon",
  "axis-icon",
  "mirae-icon",
];

function getInitials(name = "") {
  const words = name
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "MF";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function ExploreSection1() {
  const navigate = useNavigate();

  const [funds, setFunds] = useState([]);

  const [portfolio, setPortfolio] = useState({
    currentValue: 0,
    investedAmount: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    todaysPnL: 0,
    todaysReturnPercent: 0,
    xirr: null,
  });

  const [navDate, setNavDate] = useState(null);

  const [totalHouses, setTotalHouses] = useState(0);

  const [loading, setLoading] = useState(true);

  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState("");

  const formatMoney = (value) => {
    const num = Number(value || 0);

    if (!Number.isFinite(num)) {
      return "₹0.00";
    }

    return `${num < 0 ? "-" : ""}₹${Math.abs(num).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatPercent = (value) => {
    const num = Number(value || 0);

    if (!Number.isFinite(num)) {
      return "0.00%";
    }

    return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Get logged-in user
  |--------------------------------------------------------------------------
  */

  const getUser = async () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("accessToken");

    if (!token) {
      return null;
    }

    const response = await fetch(`${AUTH_API}/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  };

  /*
  |--------------------------------------------------------------------------
  | Load initial Explore data
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadExplore() {
      setLoading(true);
      setError("");

      try {
        /*
        --------------------------------------------------------------
        Top returns
        --------------------------------------------------------------
        */

        const topResponse = await axios.get(`${API}/top-returns`, {
          params: {
            limit: INITIAL_LIMIT,
            offset: 0,
          },
        });

        if (cancelled) {
          return;
        }

        const topData = topResponse?.data || {};

        const topFunds = Array.isArray(topData.data) ? topData.data : [];

        setFunds(topFunds);

        setTotalHouses(Number(topData.totalHouses || 0));

        setNavDate(topFunds[0]?.navDate || topData.navDate || null);

        /*
        --------------------------------------------------------------
        User + portfolio
        --------------------------------------------------------------

        Portfolio errors must NOT break
        Top Returns.
        --------------------------------------------------------------
        */

        try {
          const userResponse = await getUser();

          const userId =
            userResponse?.user?.user_id ||
            userResponse?.user?.id ||
            userResponse?.userId ||
            userResponse?.id;

          if (!userId) {
            return;
          }

          const portfolioResponse = await axios.get(
            `${API}/holdings/${userId}`,
          );

          if (cancelled) {
            return;
          }

          if (portfolioResponse?.data?.summary) {
            setPortfolio(portfolioResponse.data.summary);
          }
        } catch (portfolioError) {
          console.error("MF portfolio loading error:", portfolioError);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load mutual-fund Explore:", err);

        setFunds([]);
        setTotalHouses(0);
        setNavDate(null);

        setError("Unable to load mutual funds.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadExplore();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Load More
  |--------------------------------------------------------------------------
  */

  const loadMore = async () => {
    if (loadingMore) {
      return;
    }

    if (funds.length >= totalHouses) {
      return;
    }

    setLoadingMore(true);

    try {
      const response = await axios.get(`${API}/top-returns`, {
        params: {
          limit: INITIAL_LIMIT,
          offset: funds.length,
        },
      });

      const data = response?.data || {};

      const newFunds = Array.isArray(data.data) ? data.data : [];

      setFunds((previous) => {
        const existing = new Set(
          previous.map((fund) => String(fund.schemeCode ?? fund.schemeId)),
        );

        const uniqueFunds = newFunds.filter(
          (fund) => !existing.has(String(fund.schemeCode ?? fund.schemeId)),
        );

        return [...previous, ...uniqueFunds];
      });

      if (data.totalHouses !== undefined) {
        setTotalHouses(Number(data.totalHouses));
      }
    } catch (err) {
      console.error("Failed to load more mutual funds:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | All Mutual Funds
  |--------------------------------------------------------------------------
  */

  const handleAllMutualFunds = () => {
    navigate("/dashboard/mutualFunds/all");
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div className="explore-section-wrapper">
      <main className="explore-dashboard">
        <div className="dashboard-layout">
          {/* =====================================================
              LEFT COLUMN
          ====================================================== */}

          <section className="popular-funds-section">
            <h2 className="section-title">Top Returns Today</h2>

            {navDate && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#777",
                  marginBottom: "12px",
                }}
              >
                NAV date: {formatDate(navDate)}
              </div>
            )}

            <div className="funds-grid">
              {loading && (
                <div
                  style={{
                    padding: "1rem",
                    color: "#777",
                  }}
                >
                  Loading top returns...
                </div>
              )}

              {!loading && funds.length === 0 && (
                <div
                  style={{
                    padding: "1rem",
                    color: "#777",
                  }}
                >
                  {error || "No daily return data available yet."}
                </div>
              )}

              {!loading &&
                funds.map((fund, index) => (
                  <article
                    key={fund.schemeId || fund.schemeCode}
                    className="fund-card"
                    onClick={() =>
                      navigate(
                        `/dashboard/mutualFunds/${encodeURIComponent(
                          fund.schemeCode,
                        )}`,
                      )
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div
                        className={`fund-icon ${ICON_CLASSES[index % ICON_CLASSES.length]
                          }`}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {getInitials(fund.fundHouse || fund.schemeName)}
                        </span>
                      </div>

                      <h3 className="fund-name">{fund.schemeName}</h3>
                    </div>

                    <div className="fund-bottom">
                      <span
                        className="fund-return"
                        style={{
                          color:
                            Number(fund.dayReturn) >= 0 ? "#00a878" : "#ef4444",
                        }}
                      >
                        {formatPercent(fund.dayReturn)}
                      </span>

                      <span className="fund-period">1D</span>
                    </div>
                  </article>
                ))}
            </div>

            {/* =================================================
                LOAD MORE
            ================================================== */}

            {!loading && funds.length < totalHouses && (
              <button
                type="button"
                className="all-funds-link"
                onClick={loadMore}
                disabled={loadingMore}
              >
                <span>{loadingMore ? "Loading..." : "Load More"}</span>

                <span className="all-funds-arrow">›</span>
              </button>
            )}

            {/* =================================================
                ALL MUTUAL FUNDS
            ================================================== */}

            <button type="button" className="all-funds-link" onClick={handleAllMutualFunds}>
              <span>All Mutual Funds</span>

              <span className="all-funds-arrow">›</span>
            </button>
          </section>

          {/* =====================================================
              RIGHT COLUMN
              SAME EXISTING STYLE
          ====================================================== */}

          <aside className="investments-section">
            <h2 className="section-title">Your Investments</h2>

            <div className="investment-card">
              <div>
                <span className="current-label">Current</span>

                <div className="current-value">
                  {formatMoney(portfolio.currentValue)}
                </div>
              </div>

              <hr className="investment-divider" />

              <div className="investment-stats">
                {/* 1D */}

                <div className="investment-row">
                  <span className="investment-label">1D returns</span>

                  <span
                    className={`investment-value ${Number(portfolio.todaysPnL) >= 0
                        ? "gain-value"
                        : "loss-value"
                      }`}
                  >
                    {formatMoney(portfolio.todaysPnL)} (
                    {formatPercent(portfolio.todaysReturnPercent)})
                  </span>
                </div>

                {/* TOTAL */}

                <div className="investment-row">
                  <span className="investment-label">Total returns</span>

                  <span
                    className={`investment-value ${Number(portfolio.totalReturn) >= 0
                        ? "gain-value"
                        : "loss-value"
                      }`}
                  >
                    {formatMoney(portfolio.totalReturn)} (
                    {formatPercent(portfolio.totalReturnPercent)})
                  </span>
                </div>

                {/* INVESTED */}

                <div className="investment-row">
                  <span className="investment-label">Invested</span>

                  <span className="investment-value dark-value">
                    {formatMoney(portfolio.investedAmount)}
                  </span>
                </div>

                {/* CURRENT */}

                <div className="investment-row">
                  <span className="investment-label">Current Value</span>

                  <span className="investment-value dark-value">
                    {formatMoney(portfolio.currentValue)}
                  </span>
                </div>

                {/* XIRR */}

                <div className="investment-row">
                  <span className="investment-label">XIRR</span>

                  <span className="investment-value dark-value">
                    {portfolio.xirr === null || portfolio.xirr === undefined
                      ? "-"
                      : formatPercent(portfolio.xirr)}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
