import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "/api/mutual-funds";

const AUTH_API = "/api/auth";

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
  const [topHasMore, setTopHasMore] = useState(false);
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
        setTopHasMore(Boolean(topData.hasMore));

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
          const token = localStorage.getItem("token");

          if (!token) {
            return;
          }

          // Phase 2: portfolio identity is derived from the verified JWT.
          const portfolioResponse = await axios.get(`${API}/holdings`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

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

    if (!topHasMore) {
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

      setTopHasMore(Boolean(data.hasMore));
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
                <div style={{ padding: "1rem", color: "#777" }}>
                  Loading top returns...
                </div>
              )}

              {!loading && funds.length === 0 && (
                <div style={{ padding: "1rem", color: "#777" }}>
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
                    style={{ cursor: "pointer" }}
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

            {!loading && topHasMore && (
              <button
                type="button"
                className="all-funds-link"
                onClick={loadMore}
                disabled={loadingMore}
              >
                <span>{loadingMore ? "Loading..." : "Load More"}</span>
              </button>
            )}

            {/* =================================================
                ALL MUTUAL FUNDS
            ================================================== */}

            <button
              type="button"
              className="all-funds-link"
              onClick={handleAllMutualFunds}
              style={{ marginLeft: "1rem" }}
            >
              <span>All Mutual Funds</span>
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
                    className="investment-value"
                    style={{
                      color:
                        portfolio.todaysPnL == null
                          ? "inherit"
                          : Number(portfolio.todaysPnL) >= 0
                            ? "#00B386"
                            : "#EF4444",
                      fontWeight: "600",
                    }}
                  >
                    {portfolio.todaysPnL == null
                      ? "-"
                      : `${formatMoney(portfolio.todaysPnL)} (${formatPercent(portfolio.todaysReturnPercent)})`}
                  </span>
                </div>

                {/* TOTAL */}

                <div className="investment-row">
                  <span className="investment-label">Total returns</span>

                  <span
                    className="investment-value"
                    style={{
                      color:
                        portfolio.totalReturn == null
                          ? "inherit"
                          : Number(portfolio.totalReturn) >= 0
                            ? "#00B386"
                            : "#ef4444",
                      fontWeight: "600",
                    }}
                  >
                    {portfolio.totalReturn == null
                      ? "-"
                      : `${formatMoney(portfolio.totalReturn)} (${formatPercent(portfolio.totalReturnPercent)})`}
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

                  <span
                    className="investment-value dark-value"
                    style={{
                      color:
                        portfolio.xirr == null
                          ? "inherit"
                          : portfolio.xirr >= 0
                            ? "#00B386"
                            : "#EF4444",
                    }}
                  >
                    {portfolio.xirr == null
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





























// import React, { useEffect, useState } from "react";

// import axios from "axios";
// import { useNavigate } from "react-router-dom";

// const API = "/api/mutual-funds";

// const AUTH_API = "/api/auth";

// const INITIAL_LIMIT = 8;

// const ICON_CLASSES = [
//   "sbi-icon",
//   "bandhan-icon",
//   "hdfc-icon",
//   "parag-icon",
//   "nippon-icon",
//   "icici-icon",
//   "axis-icon",
//   "mirae-icon",
// ];

// function getInitials(name = "") {
//   const words = name
//     .replace(/[^a-zA-Z0-9 ]/g, " ")
//     .split(/\s+/)
//     .filter(Boolean);

//   if (!words.length) {
//     return "MF";
//   }

//   if (words.length === 1) {
//     return words[0].slice(0, 2).toUpperCase();
//   }

//   return `${words[0][0]}${words[1][0]}`.toUpperCase();
// }

// export default function ExploreSection1() {
//   const navigate = useNavigate();

//   const [funds, setFunds] = useState([]);

//   const [portfolio, setPortfolio] = useState({
//     currentValue: 0,
//     investedAmount: 0,
//     totalReturn: 0,
//     totalReturnPercent: 0,
//     todaysPnL: 0,
//     todaysReturnPercent: 0,
//     xirr: null,
//   });

//   const [navDate, setNavDate] = useState(null);
//   const [totalHouses, setTotalHouses] = useState(0);
//   const [loading, setLoading] = useState(true);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState("");

//   const formatMoney = (value) => {
//     const num = Number(value || 0);

//     if (!Number.isFinite(num)) {
//       return "₹0.00";
//     }

//     return `${num < 0 ? "-" : ""}₹${Math.abs(num).toLocaleString("en-IN", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })}`;
//   };

//   const formatPercent = (value) => {
//     const num = Number(value || 0);

//     if (!Number.isFinite(num)) {
//       return "0.00%";
//     }

//     return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
//   };

//   const formatDate = (value) => {
//     if (!value) {
//       return "-";
//     }

//     const date = new Date(value);

//     if (Number.isNaN(date.getTime())) {
//       return "-";
//     }

//     return date.toLocaleDateString("en-IN", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Get logged-in user
//   |--------------------------------------------------------------------------
//   */

//   const getUser = async () => {
//     const token =
//       localStorage.getItem("token") || localStorage.getItem("accessToken");

//     if (!token) {
//       return null;
//     }

//     const response = await fetch(`${AUTH_API}/me`, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     if (!response.ok) {
//       return null;
//     }

//     return response.json();
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Load initial Explore data
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     let cancelled = false;

//     async function loadExplore() {
//       setLoading(true);
//       setError("");

//       try {
//         /*
//         --------------------------------------------------------------
//         Top returns
//         --------------------------------------------------------------
//         */

//         const topResponse = await axios.get(`${API}/top-returns`, {
//           params: {
//             limit: INITIAL_LIMIT,
//             offset: 0,
//           },
//         });

//         if (cancelled) {
//           return;
//         }

//         const topData = topResponse?.data || {};

//         const topFunds = Array.isArray(topData.data) ? topData.data : [];

//         setFunds(topFunds);

//         setTotalHouses(Number(topData.totalHouses || 0));

//         setNavDate(topFunds[0]?.navDate || topData.navDate || null);

//         /*
//         --------------------------------------------------------------
//         User + portfolio
//         --------------------------------------------------------------

//         Portfolio errors must NOT break
//         Top Returns.
//         --------------------------------------------------------------
//         */

//         try {
//           const token = localStorage.getItem("token");

//           if (!token) {
//             return;
//           }

//           // Phase 2: portfolio identity is derived from the verified JWT.
//           const portfolioResponse = await axios.get(`${API}/holdings`, {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           });

//           if (cancelled) {
//             return;
//           }

//           if (portfolioResponse?.data?.summary) {
//             setPortfolio(portfolioResponse.data.summary);
//           }
//         } catch (portfolioError) {
//           console.error("MF portfolio loading error:", portfolioError);
//         }
//       } catch (err) {
//         if (cancelled) {
//           return;
//         }

//         console.error("Failed to load mutual-fund Explore:", err);

//         setFunds([]);
//         setTotalHouses(0);
//         setNavDate(null);

//         setError("Unable to load mutual funds.");
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     }

//     loadExplore();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Load More
//   |--------------------------------------------------------------------------
//   */

//   const loadMore = async () => {
//     if (loadingMore) {
//       return;
//     }

//     if (funds.length >= totalHouses) {
//       return;
//     }

//     setLoadingMore(true);

//     try {
//       const response = await axios.get(`${API}/top-returns`, {
//         params: {
//           limit: INITIAL_LIMIT,
//           offset: funds.length,
//         },
//       });

//       const data = response?.data || {};

//       const newFunds = Array.isArray(data.data) ? data.data : [];

//       setFunds((previous) => {
//         const existing = new Set(
//           previous.map((fund) => String(fund.schemeCode ?? fund.schemeId)),
//         );

//         const uniqueFunds = newFunds.filter(
//           (fund) => !existing.has(String(fund.schemeCode ?? fund.schemeId)),
//         );

//         return [...previous, ...uniqueFunds];
//       });

//       if (data.totalHouses !== undefined) {
//         setTotalHouses(Number(data.totalHouses));
//       }
//     } catch (err) {
//       console.error("Failed to load more mutual funds:", err);
//     } finally {
//       setLoadingMore(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | All Mutual Funds
//   |--------------------------------------------------------------------------
//   */

//   const handleAllMutualFunds = () => {
//     navigate("/dashboard/mutualFunds/all");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Render
//   |--------------------------------------------------------------------------
//   */

//   return (
//     <div className="explore-section-wrapper">
//       <main className="explore-dashboard">
//         <div className="dashboard-layout">
//           {/* =====================================================
//               LEFT COLUMN
//           ====================================================== */}

//           <section className="popular-funds-section">
//             <h2 className="section-title">Top Returns Today</h2>

//             {navDate && (
//               <div
//                 style={{
//                   fontSize: "12px",
//                   color: "#777",
//                   marginBottom: "12px",
//                 }}
//               >
//                 NAV date: {formatDate(navDate)}
//               </div>
//             )}

//             <div className="funds-grid">
//               {loading && (
//                 <div style={{ padding: "1rem", color: "#777" }}>
//                   Loading top returns...
//                 </div>
//               )}

//               {!loading && funds.length === 0 && (
//                 <div style={{ padding: "1rem", color: "#777" }}>
//                   {error || "No daily return data available yet."}
//                 </div>
//               )}

//               {!loading &&
//                 funds.map((fund, index) => (
//                   <article
//                     key={fund.schemeId || fund.schemeCode}
//                     className="fund-card"
//                     onClick={() =>
//                       navigate(
//                         `/dashboard/mutualFunds/${encodeURIComponent(
//                           fund.schemeCode,
//                         )}`,
//                       )
//                     }
//                     style={{ cursor: "pointer" }}
//                   >
//                     <div>
//                       <div
//                         className={`fund-icon ${ICON_CLASSES[index % ICON_CLASSES.length]
//                           }`}
//                       >
//                         <span
//                           style={{
//                             fontSize: "13px",
//                             fontWeight: 700,
//                           }}
//                         >
//                           {getInitials(fund.fundHouse || fund.schemeName)}
//                         </span>
//                       </div>

//                       <h3 className="fund-name">{fund.schemeName}</h3>
//                     </div>

//                     <div className="fund-bottom">
//                       <span
//                         className="fund-return"
//                         style={{
//                           color:
//                             Number(fund.dayReturn) >= 0 ? "#00a878" : "#ef4444",
//                         }}
//                       >
//                         {formatPercent(fund.dayReturn)}
//                       </span>

//                       <span className="fund-period">1D</span>
//                     </div>
//                   </article>
//                 ))}
//             </div>

//             {/* =================================================
//                 LOAD MORE
//             ================================================== */}

//             {!loading && funds.length < totalHouses && (
//               <button
//                 type="button"
//                 className="all-funds-link chip"
//                 onClick={loadMore}
//                 disabled={loadingMore}
//               >
//                 <span>{loadingMore ? "Loading..." : "Load More"}</span>
//               </button>
//             )}

//             {/* =================================================
//                 ALL MUTUAL FUNDS
//             ================================================== */}

//             <button
//               type="button"
//               className="all-funds-link chip"
//               onClick={handleAllMutualFunds}
//               style={{ marginLeft: "1rem" }}
//             >
//               <span>All Mutual Funds</span>
//             </button>
//           </section>

//           {/* =====================================================
//               RIGHT COLUMN
//               SAME EXISTING STYLE
//           ====================================================== */}

//           <aside className="investments-section">
//             <h2 className="section-title">Your Investments</h2>

//             <div className="investment-card">
//               <div>
//                 <span className="current-label">Current</span>

//                 <div className="current-value">
//                   {formatMoney(portfolio.currentValue)}
//                 </div>
//               </div>

//               <hr className="investment-divider" />

//               <div className="investment-stats">
//                 {/* 1D */}

//                 <div className="investment-row">
//                   <span className="investment-label">1D returns</span>

//                   <span
//                     className="investment-value"
//                     style={{
//                       color:
//                         portfolio.todaysPnL == null
//                           ? "inherit"
//                           : Number(portfolio.todaysPnL) >= 0
//                             ? "#00B386"
//                             : "#EF4444",
//                       fontWeight: "600",
//                     }}
//                   >
//                     {portfolio.todaysPnL == null
//                       ? "-"
//                       : `${formatMoney(portfolio.todaysPnL)} (${formatPercent(portfolio.todaysReturnPercent)})`}
//                   </span>
//                 </div>

//                 {/* TOTAL */}

//                 <div className="investment-row">
//                   <span className="investment-label">Total returns</span>

//                   <span
//                     className="investment-value"
//                     style={{
//                       color:
//                         portfolio.totalReturn == null
//                           ? "inherit"
//                           : Number(portfolio.totalReturn) >= 0
//                             ? "#00B386"
//                             : "#ef4444",
//                       fontWeight: "600",
//                     }}
//                   >
//                     {portfolio.totalReturn == null
//                       ? "-"
//                       : `${formatMoney(portfolio.totalReturn)} (${formatPercent(portfolio.totalReturnPercent)})`}
//                   </span>
//                 </div>

//                 {/* INVESTED */}

//                 <div className="investment-row">
//                   <span className="investment-label">Invested</span>

//                   <span className="investment-value dark-value">
//                     {formatMoney(portfolio.investedAmount)}
//                   </span>
//                 </div>

//                 {/* CURRENT */}

//                 <div className="investment-row">
//                   <span className="investment-label">Current Value</span>

//                   <span className="investment-value dark-value">
//                     {formatMoney(portfolio.currentValue)}
//                   </span>
//                 </div>

//                 {/* XIRR */}

//                 <div className="investment-row">
//                   <span className="investment-label">XIRR</span>

//                   <span
//                     className="investment-value dark-value"
//                     style={{
//                       color:
//                         portfolio.xirr == null
//                           ? "inherit"
//                           : portfolio.xirr >= 0
//                             ? "#00B386"
//                             : "#EF4444",
//                     }}
//                   >
//                     {portfolio.xirr == null
//                       ? "-"
//                       : formatPercent(portfolio.xirr)}
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </aside>
//         </div>
//       </main>
//     </div>
//   );
// }
























// import React, { useEffect, useRef, useState } from "react";

// import axios from "axios";
// import { useNavigate } from "react-router-dom";

// const API = "/api/mutual-funds";

// const AUTH_API = "/api/auth";

// const INITIAL_LIMIT = 8;

// const ICON_CLASSES = [
//   "sbi-icon",
//   "bandhan-icon",
//   "hdfc-icon",
//   "parag-icon",
//   "nippon-icon",
//   "icici-icon",
//   "axis-icon",
//   "mirae-icon",
// ];

// function getInitials(name = "") {
//   const words = name
//     .replace(/[^a-zA-Z0-9 ]/g, " ")
//     .split(/\s+/)
//     .filter(Boolean);

//   if (!words.length) {
//     return "MF";
//   }

//   if (words.length === 1) {
//     return words[0].slice(0, 2).toUpperCase();
//   }

//   return `${words[0][0]}${words[1][0]}`.toUpperCase();
// }

// export default function ExploreSection1() {
//   const navigate = useNavigate();

//   const [funds, setFunds] = useState([]);

//   const [portfolio, setPortfolio] = useState({
//     currentValue: 0,
//     investedAmount: 0,
//     totalReturn: 0,
//     totalReturnPercent: 0,
//     todaysPnL: 0,
//     todaysReturnPercent: 0,
//     xirr: null,
//   });

//   const [navDate, setNavDate] = useState(null);
//   const [totalHouses, setTotalHouses] = useState(0);
//   const [topHasMore, setTopHasMore] = useState(false);
//   const topOffsetRef = useRef(0);
//   const [loading, setLoading] = useState(true);
//   const [loadingMore, setLoadingMore] = useState(false);
//   const [error, setError] = useState("");

//   const formatMoney = (value) => {
//     const num = Number(value || 0);

//     if (!Number.isFinite(num)) {
//       return "₹0.00";
//     }

//     return `${num < 0 ? "-" : ""}₹${Math.abs(num).toLocaleString("en-IN", {
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     })}`;
//   };

//   const formatPercent = (value) => {
//     const num = Number(value || 0);

//     if (!Number.isFinite(num)) {
//       return "0.00%";
//     }

//     return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
//   };

//   const formatDate = (value) => {
//     if (!value) {
//       return "-";
//     }

//     const date = new Date(value);

//     if (Number.isNaN(date.getTime())) {
//       return "-";
//     }

//     return date.toLocaleDateString("en-IN", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     });
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Get logged-in user
//   |--------------------------------------------------------------------------
//   */

//   const getUser = async () => {
//     const token =
//       localStorage.getItem("token") || localStorage.getItem("accessToken");

//     if (!token) {
//       return null;
//     }

//     const response = await fetch(`${AUTH_API}/me`, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     if (!response.ok) {
//       return null;
//     }

//     return response.json();
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Load initial Explore data
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     let cancelled = false;

//     async function loadExplore() {
//       setLoading(true);
//       setError("");

//       try {
//         /*
//         --------------------------------------------------------------
//         Top returns
//         --------------------------------------------------------------
//         */

//         const topResponse = await axios.get(`${API}/top-returns`, {
//           params: {
//             limit: INITIAL_LIMIT,
//             offset: 0,
//           },
//         });

//         if (cancelled) {
//           return;
//         }

//         const topData = topResponse?.data || {};

//         const topFunds = Array.isArray(topData.data) ? topData.data : [];

//         setFunds(topFunds);
//         topOffsetRef.current = topFunds.length;

//         setTotalHouses(Number(topData.totalHouses || 0));
//         setTopHasMore(Boolean(topData.hasMore));

//         setNavDate(topFunds[0]?.navDate || topData.navDate || null);

//         /*
//         --------------------------------------------------------------
//         User + portfolio
//         --------------------------------------------------------------

//         Portfolio errors must NOT break
//         Top Returns.
//         --------------------------------------------------------------
//         */

//         try {
//           const token = localStorage.getItem("token");

//           if (!token) {
//             return;
//           }

//           // Phase 2: portfolio identity is derived from the verified JWT.
//           const portfolioResponse = await axios.get(`${API}/holdings`, {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           });

//           if (cancelled) {
//             return;
//           }

//           if (portfolioResponse?.data?.summary) {
//             setPortfolio(portfolioResponse.data.summary);
//           }
//         } catch (portfolioError) {
//           console.error("MF portfolio loading error:", portfolioError);
//         }
//       } catch (err) {
//         if (cancelled) {
//           return;
//         }

//         console.error("Failed to load mutual-fund Explore:", err);

//         setFunds([]);
//         setTotalHouses(0);
//         setNavDate(null);

//         setError("Unable to load mutual funds.");
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     }

//     loadExplore();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Load More
//   |--------------------------------------------------------------------------
//   */

//   const loadMore = async () => {
//     if (loadingMore) {
//       return;
//     }

//     if (!topHasMore) {
//       return;
//     }

//     setLoadingMore(true);

//     try {
//       const response = await axios.get(`${API}/top-returns`, {
//         params: {
//           limit: INITIAL_LIMIT,
//           offset: topOffsetRef.current,
//         },
//       });

//       const data = response?.data || {};

//       const newFunds = Array.isArray(data.data) ? data.data : [];
//       const returned = Number(data.returned || newFunds.length || 0);
//       const responseOffset = Number(data.offset || topOffsetRef.current);
//       topOffsetRef.current = responseOffset + returned;

//       setFunds((previous) => {
//         const existing = new Set(
//           previous.map((fund) => String(fund.schemeCode ?? fund.schemeId)),
//         );

//         const uniqueFunds = newFunds.filter(
//           (fund) => !existing.has(String(fund.schemeCode ?? fund.schemeId)),
//         );

//         return [...previous, ...uniqueFunds];
//       });

//       if (data.totalHouses !== undefined) {
//         setTotalHouses(Number(data.totalHouses));
//       }

//       setTopHasMore(Boolean(data.hasMore));
//     } catch (err) {
//       console.error("Failed to load more mutual funds:", err);
//     } finally {
//       setLoadingMore(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | All Mutual Funds
//   |--------------------------------------------------------------------------
//   */

//   const handleAllMutualFunds = () => {
//     navigate("/dashboard/mutualFunds/all");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Render
//   |--------------------------------------------------------------------------
//   */

//   return (
//     <div className="explore-section-wrapper">
//       <main className="explore-dashboard">
//         <div className="dashboard-layout">
//           {/* =====================================================
//               LEFT COLUMN
//           ====================================================== */}

//           <section className="popular-funds-section">
//             <h2 className="section-title">Top Returns Today</h2>

//             {navDate && (
//               <div
//                 style={{
//                   fontSize: "12px",
//                   color: "#777",
//                   marginBottom: "12px",
//                 }}
//               >
//                 NAV date: {formatDate(navDate)}
//               </div>
//             )}

//             <div className="funds-grid">
//               {loading && (
//                 <div style={{ padding: "1rem", color: "#777" }}>
//                   Loading top returns...
//                 </div>
//               )}

//               {!loading && funds.length === 0 && (
//                 <div style={{ padding: "1rem", color: "#777" }}>
//                   {error || "No daily return data available yet."}
//                 </div>
//               )}

//               {!loading &&
//                 funds.map((fund, index) => (
//                   <article
//                     key={fund.schemeId || fund.schemeCode}
//                     className="fund-card"
//                     onClick={() =>
//                       navigate(
//                         `/dashboard/mutualFunds/${encodeURIComponent(
//                           fund.schemeCode,
//                         )}`,
//                       )
//                     }
//                     style={{ cursor: "pointer" }}
//                   >
//                     <div>
//                       <div
//                         className={`fund-icon ${ICON_CLASSES[index % ICON_CLASSES.length]
//                           }`}
//                       >
//                         <span
//                           style={{
//                             fontSize: "13px",
//                             fontWeight: 700,
//                           }}
//                         >
//                           {getInitials(fund.fundHouse || fund.schemeName)}
//                         </span>
//                       </div>

//                       <h3 className="fund-name">{fund.schemeName}</h3>
//                     </div>

//                     <div className="fund-bottom">
//                       <span
//                         className="fund-return"
//                         style={{
//                           color:
//                             Number(fund.dayReturn) >= 0 ? "#00a878" : "#ef4444",
//                         }}
//                       >
//                         {formatPercent(fund.dayReturn)}
//                       </span>

//                       <span className="fund-period">1D</span>
//                     </div>
//                   </article>
//                 ))}
//             </div>

//             {/* =================================================
//                 LOAD MORE
//             ================================================== */}

//             {!loading && topHasMore && (
//               <button
//                 type="button"
//                 className="all-funds-link"
//                 onClick={loadMore}
//                 disabled={loadingMore}
//               >
//                 <span>{loadingMore ? "Loading..." : "Load More"}</span>
//               </button>
//             )}

//             {/* =================================================
//                 ALL MUTUAL FUNDS
//             ================================================== */}

//             <button
//               type="button"
//               className="all-funds-link"
//               onClick={handleAllMutualFunds}
//               style={{ marginLeft: "1rem" }}
//             >
//               <span>All Mutual Funds</span>
//             </button>
//           </section>

//           {/* =====================================================
//               RIGHT COLUMN
//               SAME EXISTING STYLE
//           ====================================================== */}

//           <aside className="investments-section">
//             <h2 className="section-title">Your Investments</h2>

//             <div className="investment-card">
//               <div>
//                 <span className="current-label">Current</span>

//                 <div className="current-value">
//                   {formatMoney(portfolio.currentValue)}
//                 </div>
//               </div>

//               <hr className="investment-divider" />

//               <div className="investment-stats">
//                 {/* 1D */}

//                 <div className="investment-row">
//                   <span className="investment-label">1D returns</span>

//                   <span
//                     className="investment-value"
//                     style={{
//                       color:
//                         portfolio.todaysPnL == null
//                           ? "inherit"
//                           : Number(portfolio.todaysPnL) >= 0
//                             ? "#00B386"
//                             : "#EF4444",
//                       fontWeight: "600",
//                     }}
//                   >
//                     {portfolio.todaysPnL == null
//                       ? "-"
//                       : `${formatMoney(portfolio.todaysPnL)} (${formatPercent(portfolio.todaysReturnPercent)})`}
//                   </span>
//                 </div>

//                 {/* TOTAL */}

//                 <div className="investment-row">
//                   <span className="investment-label">Total returns</span>

//                   <span
//                     className="investment-value"
//                     style={{
//                       color:
//                         portfolio.totalReturn == null
//                           ? "inherit"
//                           : Number(portfolio.totalReturn) >= 0
//                             ? "#00B386"
//                             : "#ef4444",
//                       fontWeight: "600",
//                     }}
//                   >
//                     {portfolio.totalReturn == null
//                       ? "-"
//                       : `${formatMoney(portfolio.totalReturn)} (${formatPercent(portfolio.totalReturnPercent)})`}
//                   </span>
//                 </div>

//                 {/* INVESTED */}

//                 <div className="investment-row">
//                   <span className="investment-label">Invested</span>

//                   <span className="investment-value dark-value">
//                     {formatMoney(portfolio.investedAmount)}
//                   </span>
//                 </div>

//                 {/* CURRENT */}

//                 <div className="investment-row">
//                   <span className="investment-label">Current Value</span>

//                   <span className="investment-value dark-value">
//                     {formatMoney(portfolio.currentValue)}
//                   </span>
//                 </div>

//                 {/* XIRR */}

//                 <div className="investment-row">
//                   <span className="investment-label">XIRR</span>

//                   <span
//                     className="investment-value dark-value"
//                     style={{
//                       color:
//                         portfolio.xirr == null
//                           ? "inherit"
//                           : portfolio.xirr >= 0
//                             ? "#00B386"
//                             : "#EF4444",
//                     }}
//                   >
//                     {portfolio.xirr == null
//                       ? "-"
//                       : formatPercent(portfolio.xirr)}
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </aside>
//         </div>
//       </main>
//     </div>
//   );
// }
