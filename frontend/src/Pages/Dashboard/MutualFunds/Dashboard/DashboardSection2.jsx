// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";
// import axios from "axios";

// /*
// |--------------------------------------------------------------------------
// | Mutual Fund Backend
// |--------------------------------------------------------------------------
// | Based on your current backend/server.js:
// |
// | app.use('/api/mutual-funds', mutualFundRoutes);
// |
// | Server:
// | http://localhost:5000
// |
// */

// const API_BASE = process.env.REACT_APP_MF_API_URL || "http://localhost:5000";

// const MF_API_PATH = "/api/mutual-funds";

// const MF_FILTERS_PATH = "/api/mutual-funds/filters";

// const PAGE_SIZE = 20;

// /*
// |--------------------------------------------------------------------------
// | Allowed UI risks
// |--------------------------------------------------------------------------
// */

// const RISK_ORDER = [
//   "Low",
//   "Low to Moderate",
//   "Moderate",
//   "Moderately High",
//   "High",
//   "Very High",
// ];

// /*
// |--------------------------------------------------------------------------
// | Fund type labels
// |--------------------------------------------------------------------------
// */

// const TYPE_LABELS = {
//   EQUITY: "Equity",
//   DEBT: "Debt",
//   HYBRID: "Hybrid",
//   COMMODITY: "Commodities",
// };

// const TYPE_ORDER = ["EQUITY", "DEBT", "HYBRID", "COMMODITY"];

// /*
// |--------------------------------------------------------------------------
// | Default filters
// |--------------------------------------------------------------------------
// */

// const DEFAULT_FILTERS = {
//   fundTypes: [],
//   categories: [],
//   risks: [],
//   ratings: [],
//   fundHouses: [],
//   indexOnly: false,
//   quickFilter: "",
//   search: "",
//   sortBy: "name",
//   sortDirection: "asc",
// };

// /*
// |--------------------------------------------------------------------------
// | Axios client
// |--------------------------------------------------------------------------
// */

// const api = axios.create({
//   baseURL: API_BASE,
//   timeout: 30000,
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("token");

//   if (token) {
//     config.headers = config.headers || {};

//     config.headers.Authorization = `Bearer ${token}`;
//   }

//   return config;
// });

// api.interceptors.response.use(
//   (response) => response,
//   (error) => {
//     if (error?.response?.status === 401) {
//       window.dispatchEvent(new Event("auth-expired"));
//     }

//     return Promise.reject(error);
//   },
// );

// /*
// |--------------------------------------------------------------------------
// | Helpers
// |--------------------------------------------------------------------------
// */

// function unique(values) {
//   return [...new Set((values || []).filter(Boolean))];
// }

// // function displayName(value) {
// //   let name = String(value || "Unnamed Mutual Fund")
// //     .replace(/\s+/g, " ")
// //     .trim();

// //   name = name
// //     .replace(/\s*-\s*Direct Plan\s*-\s*/gi, " Direct ")
// //     .replace(/\s*-\s*Regular Plan\s*-\s*/gi, " Regular ")
// //     .replace(/\s*-\s*/g, " ")
// //     .replace(/\s+/g, " ")
// //     .trim();

// //   return name;
// // }

// function displayName(value) {
//   return String(
//     value || "Unnamed Mutual Fund"
//   )
//     .replace(/\s+/g, " ")
//     .trim();
// }

// function getBaseFundName(name) {
//   return String(name || "")
//     .replace(/\s*-\s*Direct Plan\s*-\s*Growth\s*$/i, "")
//     .replace(/\s*-\s*Direct Plan\s*-\s*IDCW\s*$/i, "")
//     .replace(/\s*-\s*Regular Plan\s*-\s*Growth\s*$/i, "")
//     .replace(/\s*-\s*Regular Plan\s*-\s*IDCW\s*$/i, "")
//     .trim();
// }

// function getPlanOption(name) {
//   const value = String(name || "");

//   const match = value.match(
//     /-\s*(Direct Plan|Regular Plan)\s*-\s*(Growth|IDCW)\s*$/i
//   );

//   if (!match) {
//     return "";
//   }

//   return `${match[1]} • ${match[2]}`;
// }

// /*
// |--------------------------------------------------------------------------
// | Category display mapping
// |--------------------------------------------------------------------------
// */

// const CATEGORY_LABELS = {
//   "INDEX FUND": "Index Fund",
//   "SMALL CAP": "Small Cap",
//   "MID CAP": "Mid Cap",
//   "LARGE CAP": "Large Cap",
//   "LARGE AND MID CAP": "Large & Mid Cap",
//   "LARGE & MID CAP": "Large & Mid Cap",
//   "FLEXI CAP": "Flexi Cap",
//   "MULTI CAP": "Multi Cap",
//   "MULTI ASSET ALLOCATION": "Multi Asset Allocation",
//   "BALANCED HYBRID": "Balanced Hybrid",
//   "AGGRESSIVE HYBRID": "Aggressive Hybrid",
//   "CONSERVATIVE HYBRID": "Conservative Hybrid",
//   "DYNAMIC ASSET ALLOCATION": "Dynamic Asset Allocation",
//   "EQUITY SAVINGS": "Equity Savings",
//   "CREDIT RISK": "Credit Risk",
//   "CORPORATE BOND": "Corporate Bond",
//   "BANKING AND PSU": "Banking & PSU",
//   "DYNAMIC BOND": "Dynamic Bond",
//   "FIXED MATURITY": "Fixed Maturity",
//   "FLOATING RATE": "Floating Rate",
//   GOLD: "Gold",
//   SILVER: "Silver",
//   THEMATIC: "Thematic",
//   SECTORAL: "Sectoral",
//   ARBITRAGE: "Arbitrage",
//   INTERNATIONAL: "International",
// };

// function prettyCategory(value) {
//   if (!value) {
//     return "";
//   }

//   const text = String(value).trim().replace(/_/g, " ").replace(/\s+/g, " ");

//   const upper = text.toUpperCase();

//   if (CATEGORY_LABELS[upper]) {
//     return CATEGORY_LABELS[upper];
//   }

//   return text
//     .split(" ")
//     .map((word) => {
//       if (!word) {
//         return word;
//       }

//       return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
//     })
//     .join(" ");
// }

// /*
// |--------------------------------------------------------------------------
// | Category shown in table
// |--------------------------------------------------------------------------
// */

// function displayCategory(fund) {
//   const type = TYPE_LABELS[fund?.fund_type] || "";

//   let rawCategory =
//     fund?.fund_sub_category || fund?.scheme_category || fund?.category || "";

//   rawCategory = String(rawCategory)
//     .replace(/^Equity Scheme\s*-\s*/i, "")
//     .replace(/^Debt Scheme\s*-\s*/i, "")
//     .replace(/^Hybrid Scheme\s*-\s*/i, "")
//     .replace(/^Other Scheme\s*-\s*/i, "")
//     .replace(/^Solution Oriented Scheme\s*-\s*/i, "")
//     .trim();

//   const normalized = rawCategory.replace(/_/g, " ").trim().toUpperCase();

//   /*
//   |--------------------------------------------------------------------------
//   | Do not show:
//   | Equity INDEX_FUND
//   |
//   | Show:
//   | Equity
//   |--------------------------------------------------------------------------
//   */

//   if (!rawCategory || normalized === "OTHER" || normalized === "INDEX FUND") {
//     return type || "Other";
//   }

//   const category = prettyCategory(rawCategory);

//   return type ? `${type} ${category}` : category;
// }

// /*
// |--------------------------------------------------------------------------
// | Formatting
// |--------------------------------------------------------------------------
// */

// function formatReturn(value) {
//   if (
//     value === null ||
//     value === undefined ||
//     value === "" ||
//     !Number.isFinite(Number(value))
//   ) {
//     return "--";
//   }

//   const number = Number(value);

//   return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
// }

// function formatNav(value) {
//   if (
//     value === null ||
//     value === undefined ||
//     !Number.isFinite(Number(value))
//   ) {
//     return "--";
//   }

//   return Number(value).toFixed(2);
// }

// function formatDate(value) {
//   if (!value) {
//     return "--";
//   }

//   return String(value).slice(0, 10);
// }

// function returnClass(value) {
//   if (
//     value === null ||
//     value === undefined ||
//     !Number.isFinite(Number(value))
//   ) {
//     return "";
//   }

//   return Number(value) >= 0 ? "mf2-positive" : "mf2-negative";
// }

// function riskClass(risk) {
//   return String(risk || "")
//     .toLowerCase()
//     .replace(/\s+/g, "-");
// }

// function getInitials(name) {
//   const words = displayName(name)
//     .replace(/[^a-zA-Z0-9 ]/g, "")
//     .split(" ")
//     .filter(Boolean);

//   if (!words.length) {
//     return "MF";
//   }

//   if (words.length === 1) {
//     return words[0].slice(0, 2).toUpperCase();
//   }

//   return `${words[0][0]}${words[1][0]}`.toUpperCase();
// }

// function categoryLabel(value) {
//   return prettyCategory(
//     String(value || "")
//       .replace(/^Equity Scheme\s*-\s*/i, "")
//       .replace(/^Debt Scheme\s*-\s*/i, "")
//       .replace(/^Hybrid Scheme\s*-\s*/i, "")
//       .replace(/^Other Scheme\s*-\s*/i, "")
//       .replace(/^Solution Oriented Scheme\s*-\s*/i, "")
//       .trim(),
//   );
// }

// /*
// |--------------------------------------------------------------------------
// | UI helpers
// |--------------------------------------------------------------------------
// */

// function Check({ checked }) {
//   return (
//     <span className={`mf-check ${checked ? "checked" : ""}`}>
//       {checked ? "✓" : ""}
//     </span>
//   );
// }

// function FilterButton({ label, active, count, onClick }) {
//   return (
//     <button
//       type="button"
//       className={`mf2-filter-button ${active ? "active" : ""}`}
//       onClick={onClick}
//     >
//       <span>{label}</span>

//       {count > 0 && <span className="mf2-filter-count">{count}</span>}

//       <span className={`mf2-down ${active ? "up" : ""}`}>
//         <i className="fa-solid fa-caret-down"></i>
//       </span>
//     </button>
//   );
// }

// function FilterFooter({ onClear, onApply }) {
//   return (
//     <div className="mf2-footer">
//       <button type="button" className="mf2-footer-clear" onClick={onClear}>
//         Clear All
//       </button>

//       <button type="button" className="mf2-footer-apply" onClick={onApply}>
//         Apply
//       </button>
//     </div>
//   );
// }

// function SortButton({ label, column, applied, onSort }) {
//   const active = applied.sortBy === column;

//   return (
//     <button type="button" className="mf2-sort" onClick={() => onSort(column)}>
//       <p>{label}</p>

//       <div>
//         <span
//           className={
//             active && applied.sortDirection === "desc"
//               ? "sort-arrow down"
//               : "sort-arrow"
//           }
//         >
//           <div
//             style={{
//               marginTop: ".25rem",
//             }}
//           >
//             <i
//               className="fa-solid fa-angle-down"
//               style={{
//                 rotate: "180deg",
//                 scale: "1.4",
//                 color: "black",
//               }}
//             ></i>
//           </div>
//         </span>
//       </div>
//     </button>
//   );
// }

// /*
// |--------------------------------------------------------------------------
// | Main component
// |--------------------------------------------------------------------------
// */

// export default function DashboardSection2() {
//   const [funds, setFunds] = useState([]);

//   const [total, setTotal] = useState(0);

//   const [page, setPage] = useState(1);

//   const [hasMore, setHasMore] = useState(true);

//   const [loading, setLoading] = useState(false);

//   const [initialLoading, setInitialLoading] = useState(true);

//   const [error, setError] = useState("");

//   const [filterData, setFilterData] = useState({
//     fundHouses: [],
//     categoryGroups: {
//       EQUITY: [],
//       DEBT: [],
//       HYBRID: [],
//       COMMODITY: [],
//     },
//     risks: RISK_ORDER,
//     ratings: [5, 4, 3, 2, 1],
//   });

//   const [applied, setApplied] = useState(DEFAULT_FILTERS);

//   const [pending, setPending] = useState(DEFAULT_FILTERS);

//   const [openMenu, setOpenMenu] = useState(null);

//   const [categoryType, setCategoryType] = useState(null);

//   const [fundHouseSearch, setFundHouseSearch] = useState("");

//   const [searchInput, setSearchInput] = useState("");

//   /*
//   |--------------------------------------------------------------------------
//   | Refs
//   |--------------------------------------------------------------------------
//   */

//   const requestRef = useRef(null);

//   const requestIdRef = useRef(0);

//   const loadingRef = useRef(false);

//   const hasMoreRef = useRef(true);

//   const pageRef = useRef(1);

//   const tableScrollRef = useRef(null);

//   const sentinelRef = useRef(null);

//   /*
//   |--------------------------------------------------------------------------
//   | Hover + BUY/SELL state
//   |--------------------------------------------------------------------------
//   */

//   const [hoveredFund, setHoveredFund] = useState(null);

//   const [tradeFund, setTradeFund] = useState(null);

//   const [tradeType, setTradeType] = useState(null);

//   const [tradeValue, setTradeValue] = useState("");

//   const [tradeLoading, setTradeLoading] = useState(false);

//   const [tradeError, setTradeError] = useState("");

//   const [tradeSuccess, setTradeSuccess] = useState("");

//   /*
//   |--------------------------------------------------------------------------
//   | BUY / SELL
//   |--------------------------------------------------------------------------
//   */

//   const openTrade = (fund, type) => {
//     setTradeFund(fund);
//     setTradeType(type);
//     setTradeValue("");
//     setTradeError("");
//     setTradeSuccess("");
//   };

//   const closeTrade = () => {
//     if (tradeLoading) {
//       return;
//     }

//     setTradeFund(null);
//     setTradeType(null);
//     setTradeValue("");
//     setTradeError("");
//     setTradeSuccess("");
//   };

//   const getCurrentUserId = async () => {
//     const token = localStorage.getItem("token");

//     if (!token) {
//       throw new Error("Please login first.");
//     }

//     const response = await axios.get("http://localhost:3010/me", {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     });

//     const currentUser = response?.data?.user || response?.data;

//     const userId =
//       currentUser?.user_id ??
//       currentUser?.id ??
//       response?.data?.userId ??
//       response?.data?.id;

//     if (!userId) {
//       throw new Error("Unable to identify logged-in user.");
//     }

//     return userId;
//   };

//   const submitTrade = async () => {
//     if (!tradeFund || !tradeType) {
//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       User enters UNITS only.
//       Amount = units × NAV.
//       ----------------------------------------------------------------------
//       */

//     const units = Number(tradeValue);

//     const nav = Number(tradeFund.current_nav);

//     if (!Number.isFinite(units) || units <= 0) {
//       setTradeError("Enter a valid number of units.");

//       return;
//     }

//     if (!Number.isFinite(nav) || nav <= 0) {
//       setTradeError("Current NAV is not available.");

//       return;
//     }

//     const schemeCode =
//       tradeFund.scheme_code ?? tradeFund.schemeCode ?? tradeFund.id;

//     if (!schemeCode) {
//       setTradeError("Scheme code is missing.");

//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       Automatic amount
//       ----------------------------------------------------------------------
//       */

//     const amount = units * nav;

//     /*
//       ----------------------------------------------------------------------
//       SELL validation

//       For the All Mutual Funds page, SELL should only work when
//       the user owns the fund.

//       We load current holdings before SELL and validate units.
//       ----------------------------------------------------------------------
//       */

//     setTradeLoading(true);
//     setTradeError("");
//     setTradeSuccess("");

//     try {
//       const userId = await getCurrentUserId();

//       /*
//         --------------------------------------------------------------------
//         SELL: verify holding
//         --------------------------------------------------------------------
//         */

//       if (tradeType === "SELL") {
//         const holdingResponse = await api.get(
//           `${MF_API_PATH}/holdings/${userId}`,
//         );

//         const holdingData = holdingResponse?.data || {};

//         const holdings = Array.isArray(holdingData.data)
//           ? holdingData.data
//           : Array.isArray(holdingData.holdings)
//             ? holdingData.holdings
//             : [];

//         const holding = holdings.find(
//           (item) =>
//             String(item.schemeCode ?? item.scheme_code ?? item.schemeId) ===
//             String(schemeCode),
//         );

//         if (!holding) {
//           throw new Error("You do not own this mutual fund.");
//         }

//         const availableUnits = Number(holding.units || 0);

//         if (units > availableUnits) {
//           throw new Error(`You can sell maximum ${availableUnits} units.`);
//         }
//       }

//       /*
//         --------------------------------------------------------------------
//         BUY
//         --------------------------------------------------------------------
//         */

//       if (tradeType === "BUY") {
//         await api.post(`${MF_API_PATH}/orders/buy`, {
//           userId,
//           schemeCode,
//           scheme_code: schemeCode,

//           /*
//                 User enters units.
//                 Backend can use amount if required.
//               */
//           units,
//           amount,
//         });

//         setTradeSuccess(
//           `BUY successful: ${units} units for ₹${amount.toLocaleString(
//             "en-IN",
//             {
//               minimumFractionDigits: 2,
//               maximumFractionDigits: 2,
//             },
//           )}.`,
//         );
//       }

//       /*
//         --------------------------------------------------------------------
//         SELL
//         --------------------------------------------------------------------
//         */

//       if (tradeType === "SELL") {
//         await api.post(`${MF_API_PATH}/orders/sell`, {
//           userId,
//           schemeCode,
//           scheme_code: schemeCode,

//           units,
//           amount,
//         });

//         setTradeSuccess(
//           `SELL successful: ${units} units for ₹${amount.toLocaleString(
//             "en-IN",
//             {
//               minimumFractionDigits: 2,
//               maximumFractionDigits: 2,
//             },
//           )}.`,
//         );
//       }

//       /*
//         --------------------------------------------------------------------
//         Close modal after success.
//         --------------------------------------------------------------------
//         */

//       window.setTimeout(() => {
//         closeTrade();
//       }, 1200);
//     } catch (error) {
//       console.error(`[MF ${tradeType}] order error:`, error);

//       setTradeError(
//         error?.response?.data?.message ||
//         error?.response?.data?.error?.message ||
//         error?.message ||
//         `Unable to place ${tradeType} order.`,
//       );
//     } finally {
//       setTradeLoading(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Search debounce
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const timer = window.setTimeout(() => {
//       const value = searchInput.trim();

//       setApplied((old) =>
//         old.search === value
//           ? old
//           : {
//             ...old,
//             search: value,
//           },
//       );

//       setPending((old) => ({
//         ...old,
//         search: value,
//       }));
//     }, 350);

//     return () => window.clearTimeout(timer);
//   }, [searchInput]);

//   /*
//   |--------------------------------------------------------------------------
//   | Fetch filter metadata
//   |--------------------------------------------------------------------------
//   */

//   const fetchFilters = useCallback(async () => {
//     try {
//       const response = await api.get(MF_FILTERS_PATH);

//       const data = response?.data?.data || response?.data || {};

//       setFilterData({
//         fundHouses: Array.isArray(data.fundHouses) ? data.fundHouses : [],

//         categoryGroups: data.categoryGroups || {
//           EQUITY: [],
//           DEBT: [],
//           HYBRID: [],
//           COMMODITY: [],
//         },

//         risks: Array.isArray(data.risks)
//           ? data.risks.filter((risk) => RISK_ORDER.includes(risk))
//           : RISK_ORDER,

//         ratings: Array.isArray(data.ratings)
//           ? data.ratings
//             .map(Number)
//             .filter((rating) => [1, 2, 3, 4, 5].includes(rating))
//           : [5, 4, 3, 2, 1],
//       });
//     } catch (err) {
//       console.error("[MF] Filter metadata error:", err);
//     }
//   }, []);

//   useEffect(() => {
//     fetchFilters();
//   }, [fetchFilters]);

//   /*
//   |--------------------------------------------------------------------------
//   | Build request params
//   |--------------------------------------------------------------------------
//   */

//   const buildParams = useCallback((filterState, pageNumber) => {
//     const params = {
//       page: pageNumber,
//       limit: PAGE_SIZE,

//       sortBy: filterState.sortBy,

//       sortDirection: filterState.sortDirection,
//     };

//     if (filterState.search) {
//       params.search = filterState.search;
//     }

//     if (filterState.fundTypes.length) {
//       params.fundType = filterState.fundTypes.join(",");
//     }

//     if (filterState.categories.length) {
//       params.category = filterState.categories.join(",");
//     }

//     if (filterState.risks.length) {
//       params.risk = filterState.risks.join(",");
//     }

//     if (filterState.fundHouses.length) {
//       params.fundHouse = filterState.fundHouses.join(",");
//     }

//     if (filterState.ratings.length) {
//       params.ratingMin = Math.min(...filterState.ratings);
//     }

//     if (filterState.indexOnly || filterState.quickFilter === "indexonly") {
//       params.indexOnly = "true";
//     }

//     if (filterState.quickFilter && filterState.quickFilter !== "indexonly") {
//       params.quickFilter = filterState.quickFilter;
//     }

//     return params;
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Fetch funds
//   |--------------------------------------------------------------------------
//   */

//   const fetchFunds = useCallback(
//     async (pageNumber, reset = false, filterState = applied) => {
//       if (loadingRef.current) {
//         return;
//       }

//       if (!reset && !hasMoreRef.current) {
//         return;
//       }

//       if (requestRef.current) {
//         requestRef.current.abort();
//       }

//       const controller = new AbortController();

//       requestRef.current = controller;

//       const requestId = ++requestIdRef.current;

//       loadingRef.current = true;

//       setLoading(true);

//       if (reset) {
//         setInitialLoading(true);
//       }

//       setError("");

//       try {
//         const response = await api.get(MF_API_PATH, {
//           params: buildParams(filterState, pageNumber),

//           signal: controller.signal,
//         });

//         if (requestId !== requestIdRef.current) {
//           return;
//         }

//         const data = response?.data?.data || response?.data || {};

//         const rows = Array.isArray(data.funds) ? data.funds : [];

//         const nextHasMore = Boolean(data.hasMore);

//         const nextPage = Number(data.page || pageNumber);

//         setTotal(Number(data.total || 0));

//         setHasMore(nextHasMore);

//         hasMoreRef.current = nextHasMore;

//         setPage(nextPage);

//         pageRef.current = nextPage;

//         setFunds((old) => {
//           if (reset) {
//             return rows;
//           }

//           const seen = new Set(
//             old.map((item) =>
//               String(item.scheme_code ?? item.schemeCode ?? item.id),
//             ),
//           );

//           return [
//             ...old,

//             ...rows.filter(
//               (item) =>
//                 !seen.has(
//                   String(item.scheme_code ?? item.schemeCode ?? item.id),
//                 ),
//             ),
//           ];
//         });
//       } catch (err) {
//         if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
//           return;
//         }

//         console.error("[MF] API error:", err);

//         if (requestId === requestIdRef.current) {
//           setError(
//             err?.response?.data?.message ||
//             err?.message ||
//             "Unable to load mutual funds",
//           );

//           if (reset) {
//             setFunds([]);

//             setTotal(0);
//           }
//         }
//       } finally {
//         if (requestId === requestIdRef.current) {
//           loadingRef.current = false;

//           setLoading(false);

//           setInitialLoading(false);
//         }
//       }
//     },
//     [applied, buildParams],
//   );

//   /*
//   |--------------------------------------------------------------------------
//   | Reload on filters
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     pageRef.current = 1;

//     hasMoreRef.current = true;

//     setPage(1);

//     setFunds([]);

//     fetchFunds(1, true, applied);

//     return () => {
//       requestRef.current?.abort();
//     };
//   }, [applied, fetchFunds]);

//   /*
//   |--------------------------------------------------------------------------
//   | Infinite scrolling
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const root = tableScrollRef.current;

//     const target = sentinelRef.current;

//     if (!root || !target) {
//       return undefined;
//     }

//     const observer = new IntersectionObserver(
//       (entries) => {
//         if (
//           entries[0].isIntersecting &&
//           !loadingRef.current &&
//           hasMoreRef.current
//         ) {
//           fetchFunds(pageRef.current + 1, false, applied);
//         }
//       },
//       {
//         root,
//         rootMargin: "500px 0px",
//       },
//     );

//     observer.observe(target);

//     return () => observer.disconnect();
//   }, [applied, fetchFunds, funds.length]);

//   /*
//   |--------------------------------------------------------------------------
//   | Filter helpers
//   |--------------------------------------------------------------------------
//   */

//   const togglePendingArray = (key, value) => {
//     setPending((old) => ({
//       ...old,

//       [key]: old[key].includes(value)
//         ? old[key].filter((item) => item !== value)
//         : [...old[key], value],
//     }));
//   };

//   const selectType = (type) => {
//     setCategoryType(type);
//   };

//   const toggleAllCategoriesForType = (type) => {
//     const values = filterData.categoryGroups[type] || [];

//     setPending((old) => {
//       const allSelected =
//         values.length > 0 &&
//         values.every((value) => old.categories.includes(value));

//       return {
//         ...old,

//         fundTypes: allSelected
//           ? old.fundTypes.filter((value) => value !== type)
//           : unique([...old.fundTypes, type]),

//         categories: allSelected
//           ? old.categories.filter((value) => !values.includes(value))
//           : unique([...old.categories, ...values]),
//       };
//     });
//   };

//   const applyPending = () => {
//     setApplied({
//       ...pending,
//     });

//     setOpenMenu(null);

//     setCategoryType(null);
//   };

//   const clearPending = () => {
//     setPending({
//       ...DEFAULT_FILTERS,

//       search: searchInput.trim(),
//     });
//   };

//   const clearAll = () => {
//     setPending({
//       ...DEFAULT_FILTERS,
//     });

//     setApplied({
//       ...DEFAULT_FILTERS,
//     });

//     setSearchInput("");

//     setOpenMenu(null);

//     setCategoryType(null);
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Fund house search
//   |--------------------------------------------------------------------------
//   */

//   const [filteredHouses, setFilteredHouses] = useState([]);

//   useEffect(() => {
//     const query = fundHouseSearch.trim().toLowerCase();

//     const houses = filterData.fundHouses.filter(
//       (house) => !query || String(house).toLowerCase().includes(query),
//     );

//     setFilteredHouses(houses);
//   }, [filterData.fundHouses, fundHouseSearch]);

//   /*
//   |--------------------------------------------------------------------------
//   | Active counts
//   |--------------------------------------------------------------------------
//   */

//   const activeCategoryCount =
//     applied.fundTypes.length + applied.categories.length;

//   const activeRiskCount = applied.risks.length;

//   const activeRatingCount = applied.ratings.length;

//   const activeHouseCount = applied.fundHouses.length;

//   /*
//   |--------------------------------------------------------------------------
//   | Sort
//   |--------------------------------------------------------------------------
//   */

//   const sort = (column) => {
//     const nextDirection =
//       applied.sortBy === column && applied.sortDirection === "desc"
//         ? "asc"
//         : "desc";

//     const next = {
//       ...applied,

//       sortBy: column,

//       sortDirection: nextDirection,
//     };

//     setApplied(next);

//     setPending(next);
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Quick filters
//   |--------------------------------------------------------------------------
//   */

//   const quickFilter = (value) => {
//     const next = {
//       ...DEFAULT_FILTERS,
//       ...applied,

//       quickFilter: value,
//     };

//     setApplied(next);

//     setPending(next);
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Menu handling
//   |--------------------------------------------------------------------------
//   */

//   const toggleMenu = (name) => {
//     setOpenMenu((old) => (old === name ? null : name));

//     if (name !== "categories") {
//       setCategoryType(null);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Outside click
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const handleOutside = (event) => {
//       if (!event.target.closest(".mf2-filter-area")) {
//         setOpenMenu(null);

//         setCategoryType(null);
//       }
//     };

//     document.addEventListener("mousedown", handleOutside);

//     return () => {
//       document.removeEventListener("mousedown", handleOutside);
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Render
//   |--------------------------------------------------------------------------
//   */

//   return (
//     <div
//       className="home"
//       style={{
//         paddingTop: "0rem",
//       }}
//     >
//       <section className="mf2-page">
//         {/* Heading */}

//         <div className="mf2-heading-row">
//           <div>
//             <h2>All Mutual Funds</h2>
//           </div>

//           <div className="mf2-search-box">
//             <span>
//               <i
//                 className="fa-solid fa-magnifying-glass"
//                 style={{
//                   scale: ".55",
//                   color: "black",
//                   paddingBottom: "13px",
//                 }}
//               />
//             </span>

//             <input
//               value={searchInput}
//               onChange={(event) => setSearchInput(event.target.value)}
//               placeholder="Search mutual funds"
//             />

//             {searchInput && (
//               <button
//                 type="button"
//                 onClick={() => setSearchInput("")}
//                 style={{
//                   paddingRight: "10px",
//                 }}
//               >
//                 <i
//                   className="fa-solid fa-xmark"
//                   style={{
//                     fontSize: ".95rem",
//                     color: "black",
//                   }}
//                 ></i>
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Toolbar */}

//         <div className="mf2-toolbar mf2-filter-area">
//           <FilterButton
//             label="Categories"
//             active={openMenu === "categories"}
//             count={activeCategoryCount}
//             onClick={() => toggleMenu("categories")}
//           />

//           <FilterButton
//             label="Risk"
//             active={openMenu === "risk"}
//             count={activeRiskCount}
//             onClick={() => toggleMenu("risk")}
//           />

//           <FilterButton
//             label="Ratings"
//             active={openMenu === "ratings"}
//             count={activeRatingCount}
//             onClick={() => toggleMenu("ratings")}
//           />

//           <FilterButton
//             label="Fund House"
//             active={openMenu === "houses"}
//             count={activeHouseCount}
//             onClick={() => toggleMenu("houses")}
//           />

//           <span className="mf2-divider" />

//           <button
//             type="button"
//             className={`mf2-chip ${applied.quickFilter === "indexonly" ? "active" : ""
//               }`}
//             onClick={() =>
//               quickFilter(
//                 applied.quickFilter === "indexonly" ? "" : "indexonly",
//               )
//             }
//           >
//             Index only
//           </button>

//           <button
//             type="button"
//             className={`mf2-chip ${applied.quickFilter === "flexicap" ? "active" : ""
//               }`}
//             onClick={() =>
//               quickFilter(applied.quickFilter === "flexicap" ? "" : "flexicap")
//             }
//           >
//             Flexi Cap
//           </button>

//           <button
//             type="button"
//             className={`mf2-chip ${applied.quickFilter === "sectoral" ? "active" : ""
//               }`}
//             onClick={() =>
//               quickFilter(applied.quickFilter === "sectoral" ? "" : "sectoral")
//             }
//           >
//             Sectoral
//           </button>

//           <button
//             type="button"
//             className={`mf2-chip ${applied.quickFilter === "5plus" ? "active" : ""
//               }`}
//             onClick={() =>
//               quickFilter(applied.quickFilter === "5plus" ? "" : "5plus")
//             }
//           >
//             5 ★
//           </button>

//           <button
//             type="button"
//             className={`mf2-chip ${applied.quickFilter === "largecap" ? "active" : ""
//               }`}
//             onClick={() =>
//               quickFilter(applied.quickFilter === "largecap" ? "" : "largecap")
//             }
//           >
//             Large Cap
//           </button>

//           <button type="button" className="mf2-clear-top" onClick={clearAll}>
//             Clear All
//           </button>

//           {/* Categories dropdown */}

//           {openMenu === "categories" && (
//             <div className="mf2-popover mf2-category-popover">
//               {!categoryType ? (
//                 <>
//                   <div className="mf2-index-toggle-row">
//                     <span>Index Funds only</span>

//                     <button
//                       type="button"
//                       className={`mf2-switch ${pending.indexOnly ? "on" : ""}`}
//                       onClick={() =>
//                         setPending((old) => ({
//                           ...old,

//                           indexOnly: !old.indexOnly,
//                         }))
//                       }
//                     >
//                       <span />
//                     </button>
//                   </div>

//                   <div className="mf2-popover-scroll">
//                     {TYPE_ORDER.map((type) => {
//                       const values = filterData.categoryGroups[type] || [];

//                       const allSelected =
//                         values.length > 0 &&
//                         values.every((value) =>
//                           pending.categories.includes(value),
//                         );

//                       const selected =
//                         pending.fundTypes.includes(type) || allSelected;

//                       return (
//                         <div className="mf2-category-row" key={type}>
//                           <button
//                             type="button"
//                             className="mf2-option"
//                             onClick={() => toggleAllCategoriesForType(type)}
//                           >
//                             <Check checked={selected} />

//                             <span>{TYPE_LABELS[type]}</span>
//                           </button>

//                           <button
//                             type="button"
//                             className="mf2-category-arrow"
//                             onClick={() => selectType(type)}
//                           >
//                             <i
//                               className="fa-solid fa-angle-down"
//                               style={{
//                                 rotate: "270deg",
//                                 scale: ".5",
//                               }}
//                             ></i>
//                           </button>
//                         </div>
//                       );
//                     })}
//                   </div>

//                   <FilterFooter onClear={clearPending} onApply={applyPending} />
//                 </>
//               ) : (
//                 <>
//                   <button
//                     type="button"
//                     className="mf2-back"
//                     onClick={() => setCategoryType(null)}
//                   >
//                     ←<strong>{TYPE_LABELS[categoryType]}</strong>
//                   </button>

//                   <div className="mf2-popover-scroll">
//                     {(filterData.categoryGroups[categoryType] || []).map(
//                       (category) => (
//                         <button
//                           key={category}
//                           type="button"
//                           className="mf2-option"
//                           onClick={() =>
//                             togglePendingArray("categories", category)
//                           }
//                         >
//                           <Check
//                             checked={pending.categories.includes(category)}
//                           />

//                           <span>{categoryLabel(category)}</span>
//                         </button>
//                       ),
//                     )}
//                   </div>

//                   <FilterFooter
//                     onClear={() =>
//                       setPending((old) => ({
//                         ...old,
//                         categories: [],
//                       }))
//                     }
//                     onApply={applyPending}
//                   />
//                 </>
//               )}
//             </div>
//           )}

//           {/* Risk dropdown */}

//           {openMenu === "risk" && (
//             <div className="mf2-popover mf2-small-popover">
//               <div className="mf2-popover-title">Risk</div>

//               <div className="mf2-popover-scroll">
//                 {RISK_ORDER.map((risk) => (
//                   <button
//                     key={risk}
//                     type="button"
//                     className="mf2-option"
//                     onClick={() => togglePendingArray("risks", risk)}
//                   >
//                     <Check checked={pending.risks.includes(risk)} />

//                     <span>{risk}</span>
//                   </button>
//                 ))}
//               </div>

//               <FilterFooter
//                 onClear={() =>
//                   setPending((old) => ({
//                     ...old,
//                     risks: [],
//                   }))
//                 }
//                 onApply={applyPending}
//               />
//             </div>
//           )}

//           {/* Ratings dropdown */}

//           {openMenu === "ratings" && (
//             <div className="mf2-popover mf2-small-popover">
//               <div className="mf2-popover-title">Ratings</div>

//               <div className="mf2-popover-scroll">
//                 {[5, 4, 3, 2, 1].map((rating) => (
//                   <button
//                     key={rating}
//                     type="button"
//                     className="mf2-option"
//                     onClick={() => togglePendingArray("ratings", rating)}
//                   >
//                     <Check checked={pending.ratings.includes(rating)} />

//                     <span>{rating} ★</span>
//                   </button>
//                 ))}
//               </div>

//               <FilterFooter
//                 onClear={() =>
//                   setPending((old) => ({
//                     ...old,
//                     ratings: [],
//                   }))
//                 }
//                 onApply={applyPending}
//               />
//             </div>
//           )}

//           {/* Fund house dropdown */}

//           {openMenu === "houses" && (
//             <div className="mf2-popover mf2-house-popover">
//               <div className="mf2-house-search">
//                 <span>
//                   <i
//                     className="fa-solid fa-magnifying-glass"
//                     style={{
//                       scale: "0.55",
//                       color: "black",
//                       paddingBottom: "13px",
//                     }}
//                   ></i>
//                 </span>

//                 <input
//                   value={fundHouseSearch}
//                   onChange={(event) => setFundHouseSearch(event.target.value)}
//                   placeholder="Search fund house"
//                 />
//               </div>

//               <div className="mf2-popover-scroll">
//                 {filteredHouses.map((house) => (
//                   <button
//                     type="button"
//                     className="mf2-option"
//                     key={house}
//                     onClick={() => togglePendingArray("fundHouses", house)}
//                   >
//                     <Check checked={pending.fundHouses.includes(house)} />

//                     <span>{house}</span>
//                   </button>
//                 ))}
//               </div>

//               <FilterFooter
//                 onClear={() =>
//                   setPending((old) => ({
//                     ...old,
//                     fundHouses: [],
//                   }))
//                 }
//                 onApply={applyPending}
//               />
//             </div>
//           )}
//         </div>

//         {/* Error */}

//         {error && (
//           <div className="mf2-error">
//             <span>{error}</span>

//             <button type="button" onClick={() => fetchFunds(1, true, applied)}>
//               Retry
//             </button>
//           </div>
//         )}

//         {/* Table */}

//         <div className="mf2-table-card">
//           <div className="mf2-table-scroll" ref={tableScrollRef}>
//             <table className="mf2-table">
//               <thead>
//                 <tr>
//                   <th className="name-col">
//                     <p
//                       style={{
//                         marginLeft: "8rem",
//                       }}
//                     >
//                       Fund Name
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         marginLeft: "2.5rem",
//                       }}
//                     >
//                       Category
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         textAlign: "end",
//                         margin: "0",
//                       }}
//                     >
//                       <SortButton
//                         label="1Y"
//                         column="1y"
//                         applied={applied}
//                         onSort={sort}
//                       />
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         textAlign: "end",
//                         margin: "0",
//                       }}
//                     >
//                       <SortButton
//                         label="3Y"
//                         column="3y"
//                         applied={applied}
//                         onSort={sort}
//                       />
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         textAlign: "end",
//                         margin: "0",
//                       }}
//                     >
//                       <SortButton
//                         label="5Y"
//                         column="5y"
//                         applied={applied}
//                         onSort={sort}
//                       />
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         textAlign: "end",
//                         margin: "0",
//                       }}
//                     >
//                       <SortButton
//                         label="Rating"
//                         column="rating"
//                         applied={applied}
//                         onSort={sort}
//                       />
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         marginLeft: "1rem",
//                       }}
//                     >
//                       Risk
//                     </p>
//                   </th>

//                   <th>
//                     <p
//                       style={{
//                         marginLeft: ".25rem",
//                       }}
//                     >
//                       NAV
//                     </p>
//                   </th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {/* LOADING */}

//                 {initialLoading && (
//                   <tr>
//                     <td colSpan="8" className="mf2-state">
//                       Loading mutual funds...
//                     </td>
//                   </tr>
//                 )}

//                 {/* EMPTY */}

//                 {!initialLoading && !funds.length && (
//                   <tr>
//                     <td colSpan="8" className="mf2-state">
//                       No mutual funds found.
//                     </td>
//                   </tr>
//                 )}

//                 {/* DATA */}

//                 {funds.map((fund) => {
//                   const schemeCode =
//                     fund.scheme_code ?? fund.schemeCode ?? fund.id;
//                   const isHovered = hoveredFund === String(schemeCode);

//                   return (
//                     <tr
//                       key={schemeCode}
//                       onMouseEnter={() => setHoveredFund(String(schemeCode))}
//                       onMouseLeave={() => setHoveredFund(null)}
//                     >
//                       <td className="mf2-name-cell">
//                         <span className="mf2-logo">
//                           {getInitials(fund.fund_house || fund.scheme_name)}
//                         </span>

//                         <span className="mf2-name-text">
//                           <strong>{getBaseFundName(fund.scheme_name)}</strong>
//                           <small>{getPlanOption(fund.scheme_name)}</small>
//                           <small>{fund.fund_house || "--"}</small>
//                         </span>
//                       </td>

//                       {/* ================================================= 
//           FIXED CATEGORY CELL WITH ACTION BUTTON OVERLAY 
//          ================================================== */}
//                       <td style={{ padding: 0, position: "relative" }}>
//                         <div
//                           style={{
//                             position: "relative",
//                             width: "100%",
//                             height: "100%",
//                             minHeight: "48px",
//                             display: "flex",
//                             alignItems: "center",
//                             padding: "0 12px",
//                           }}
//                         >
//                           {/* Default Category Label */}
//                           {!isHovered && (
//                             <span
//                               style={{
//                                 display: "block",
//                                 whiteSpace: "nowrap",
//                                 overflow: "hidden",
//                                 textOverflow: "ellipsis",
//                                 width: "100%",
//                               }}
//                             >
//                               {displayCategory(fund)}
//                             </span>
//                           )}

//                           {/* Action Buttons Overlay */}
//                           {isHovered && (
//                             <div
//                               style={{
//                                 position: "absolute",
//                                 inset: 0,
//                                 display: "flex",
//                                 alignItems: "center",
//                                 justifyContent: "center",
//                                 gap: "8px",
//                                 backgroundColor: "#f5f5f5", // Match row hover background
//                                 zIndex: 2,
//                                 padding: "0 12px",
//                               }}
//                             >
//                               <button
//                                 type="button"
//                                 onClick={(event) => {
//                                   event.stopPropagation();
//                                   openTrade(fund, "BUY");
//                                 }}
//                                 style={{
//                                   border: "none",
//                                   borderRadius: "6px",
//                                   padding: "8px 0",
//                                   background: "#00a878",
//                                   color: "#fff",
//                                   fontSize: "12px",
//                                   fontWeight: 600,
//                                   cursor: "pointer",
//                                   whiteSpace: "nowrap",
//                                   flex: 1,
//                                   maxWidth: "80px",
//                                 }}
//                               >
//                                 BUY
//                               </button>

//                               <button
//                                 type="button"
//                                 onClick={(event) => {
//                                   event.stopPropagation();
//                                   openTrade(fund, "SELL");
//                                 }}
//                                 style={{
//                                   border: "none",
//                                   borderRadius: "6px",
//                                   padding: "8px 0",
//                                   background: "#ef4444",
//                                   color: "#fff",
//                                   fontSize: "12px",
//                                   fontWeight: 600,
//                                   cursor: "pointer",
//                                   whiteSpace: "nowrap",
//                                   flex: 1,
//                                   maxWidth: "80px",
//                                 }}
//                               >
//                                 SELL
//                               </button>
//                             </div>
//                           )}
//                         </div>
//                       </td>

//                       {/* 1Y */}

//                       <td
//                         className={returnClass(fund.return_1y)}
//                         title={`Reference NAV date: ${formatDate(
//                           fund.return_1y_nav_date,
//                         )}`}
//                       >
//                         <p style={{ textAlign: "end" }}>
//                           {formatReturn(fund.return_1y)}
//                         </p>
//                       </td>

//                       {/* 3Y */}

//                       <td
//                         className={returnClass(fund.return_3y)}
//                         title={`Reference NAV date: ${formatDate(
//                           fund.return_3y_nav_date,
//                         )}`}
//                       >
//                         <p style={{ textAlign: "end" }}>
//                           {formatReturn(fund.return_3y)}
//                         </p>
//                       </td>

//                       {/* 5Y */}

//                       <td
//                         className={returnClass(fund.return_5y)}
//                         title={`Reference NAV date: ${formatDate(fund.return_5y_nav_date)}`}
//                       >
//                         <p style={{ textAlign: "end" }}>
//                           {formatReturn(fund.return_5y)}
//                         </p>
//                       </td>

//                       {/* RATING */}

//                       <td>
//                         {fund.rating ? (
//                           <p style={{ textAlign: "center" }}>
//                             <span className="mf2-rating">{fund.rating} ★</span>
//                           </p>
//                         ) : (
//                           "--"
//                         )}
//                       </td>

//                       {/* RISK */}

//                       <td>
//                         {fund.risk ? (
//                           <span className={`mf2-risk ${riskClass(fund.risk)}`}>
//                             <p style={{ marginLeft: "1rem" }}>{fund.risk}</p>
//                           </span>
//                         ) : (
//                           "--"
//                         )}
//                       </td>

//                       {/* NAV */}

//                       <td className="mf2-nav">{formatNav(fund.current_nav)}</td>
//                     </tr>
//                   );
//                 })}

//                 {/* INFINITE SCROLL SENTINEL */}

//                 <tr ref={sentinelRef}>
//                   <td colSpan="8" className="mf2-sentinel">
//                     {loading && !initialLoading
//                       ? "Loading more funds…"
//                       : !hasMore && funds.length
//                         ? `All ${total.toLocaleString(
//                           "en-IN",
//                         )} mutual funds loaded.`
//                         : ""}
//                   </td>
//                 </tr>
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {/* ==========================================================
//             BUY / SELL MODAL
//         =========================================================== */}

//         {tradeFund && (
//           <div
//             onClick={() => {
//               if (!tradeLoading) {
//                 closeTrade();
//               }
//             }}
//             style={{
//               position: "fixed",
//               inset: 0,
//               background: "rgba(0,0,0,0.25)",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               zIndex: 1000,
//             }}
//           >
//             <div
//               onClick={(event) => event.stopPropagation()}
//               style={{
//                 width: "380px",
//                 background: "#fff",
//                 borderRadius: "12px",
//                 padding: "24px",
//                 boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
//               }}
//             >
//               {/* Header */}

//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "space-between",
//                   alignItems: "flex-start",
//                   marginBottom: "18px",
//                 }}
//               >
//                 <div>
//                   <h3 style={{ margin: 0, fontSize: "18px" }}>{tradeType}</h3>

//                   <p
//                     style={{
//                       margin: "6px 0 0",
//                       color: "#666",
//                       fontSize: "13px",
//                     }}
//                   >
//                     {displayName(tradeFund.scheme_name)}
//                   </p>

//                   <small style={{ color: "#888" }}>
//                     {tradeFund.fund_house}
//                   </small>
//                 </div>

//                 <button
//                   type="button"
//                   onClick={closeTrade}
//                   disabled={tradeLoading}
//                   style={{
//                     border: "none",
//                     background: "transparent",
//                     fontSize: "22px",
//                     cursor: "pointer",
//                   }}
//                 >
//                   ×
//                 </button>
//               </div>

//               {/* NAV + UNITS */}

//               <div style={{ marginBottom: "16px" }}>
//                 {/* Current NAV */}

//                 <div
//                   style={{
//                     display: "flex",
//                     justifyContent: "space-between",
//                     marginBottom: "8px",
//                     fontSize: "13px",
//                   }}
//                 >
//                   <span>Current NAV</span>

//                   <strong>₹{formatNav(tradeFund.current_nav)}</strong>
//                 </div>

//                 {/* Units */}

//                 <label
//                   style={{
//                     display: "block",
//                     marginBottom: "7px",
//                     fontSize: "13px",
//                     color: "#555",
//                   }}
//                 >
//                   Units
//                 </label>

//                 <input
//                   type="number"
//                   min="0"
//                   step="0.00000001"
//                   value={tradeValue}
//                   onChange={(event) => setTradeValue(event.target.value)}
//                   placeholder="Enter units"
//                   disabled={tradeLoading}
//                   autoFocus
//                   style={{
//                     width: "100%",
//                     boxSizing: "border-box",
//                     padding: "11px 12px",
//                     border: "1px solid #ddd",
//                     borderRadius: "7px",
//                     fontSize: "14px",
//                     outline: "none",
//                   }}
//                 />

//                 {/* Automatic amount */}

//                 <div
//                   style={{
//                     display: "flex",
//                     justifyContent: "space-between",
//                     marginTop: "14px",
//                     fontSize: "14px",
//                   }}
//                 >
//                   <span style={{ color: "#777" }}>Total Amount</span>

//                   <strong>
//                     ₹
//                     {(
//                       Number(tradeValue || 0) *
//                       Number(tradeFund.current_nav || 0)
//                     ).toLocaleString("en-IN", {
//                       minimumFractionDigits: 2,

//                       maximumFractionDigits: 2,
//                     })}
//                   </strong>
//                 </div>
//               </div>

//               {/* Error */}

//               {tradeError && (
//                 <div
//                   style={{
//                     marginBottom: "12px",
//                     padding: "9px 10px",
//                     borderRadius: "6px",
//                     background: "#fff1f1",
//                     color: "#dc2626",
//                     fontSize: "12px",
//                   }}
//                 >
//                   {tradeError}
//                 </div>
//               )}
//               {/* Success */}

//               {tradeSuccess && (
//                 <div
//                   style={{
//                     marginBottom: "12px",
//                     padding: "9px 10px",
//                     borderRadius: "6px",
//                     background: "#ecfdf5",
//                     color: "#059669",
//                     fontSize: "12px",
//                   }}
//                 >
//                   {tradeSuccess}
//                 </div>
//               )}

//               {/* Confirm */}
//               <button
//                 type="button"
//                 disabled={tradeLoading || !tradeValue}
//                 onClick={submitTrade}
//                 style={{
//                   width: "100%",
//                   border: "none",
//                   borderRadius: "7px",
//                   padding: "11px",
//                   background: tradeType === "BUY" ? "#00a878" : "#ef4444",
//                   color: "#fff",
//                   fontSize: "14px",
//                   fontWeight: 600,
//                   cursor: tradeLoading ? "not-allowed" : "pointer",
//                   opacity: tradeLoading || !tradeValue ? 0.6 : 1,
//                 }}
//               >
//                 {tradeLoading ? "Processing..." : `Confirm ${tradeType}`}
//               </button>
//             </div>
//           </div>
//         )}
//       </section>
//     </div>
//   );
// }









































import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";

/*
|--------------------------------------------------------------------------
| Mutual Fund Backend
|--------------------------------------------------------------------------
| Based on your current backend/server.js:
|
| app.use('/api/mutual-funds', mutualFundRoutes);
|
| Server:
| http://localhost:5000
|
*/

const API_BASE = process.env.REACT_APP_MF_API_URL || "http://localhost:5000";

const MF_API_PATH = "/api/mutual-funds";

const MF_FILTERS_PATH = "/api/mutual-funds/filters";

const PAGE_SIZE = 20;

/*
|--------------------------------------------------------------------------
| Allowed UI risks
|--------------------------------------------------------------------------
*/

const RISK_ORDER = [
  "Low",
  "Low to Moderate",
  "Moderate",
  "Moderately High",
  "High",
  "Very High",
];

/*
|--------------------------------------------------------------------------
| Fund type labels
|--------------------------------------------------------------------------
*/

const TYPE_LABELS = {
  EQUITY: "Equity",
  DEBT: "Debt",
  HYBRID: "Hybrid",
  COMMODITY: "Commodities",
};

const TYPE_ORDER = ["EQUITY", "DEBT", "HYBRID", "COMMODITY"];

/*
|--------------------------------------------------------------------------
| Default filters
|--------------------------------------------------------------------------
*/

const DEFAULT_FILTERS = {
  fundTypes: [],
  categories: [],
  risks: [],
  ratings: [],
  fundHouses: [],
  indexOnly: false,
  quickFilter: "",
  search: "",
  sortBy: "name",
  sortDirection: "asc",
};

/*
|--------------------------------------------------------------------------
| Axios client
|--------------------------------------------------------------------------
*/

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers = config.headers || {};

    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new Event("auth-expired"));
    }

    return Promise.reject(error);
  },
);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

// function displayName(value) {
//   let name = String(value || "Unnamed Mutual Fund")
//     .replace(/\s+/g, " ")
//     .trim();

//   name = name
//     .replace(/\s*-\s*Direct Plan\s*-\s*/gi, " Direct ")
//     .replace(/\s*-\s*Regular Plan\s*-\s*/gi, " Regular ")
//     .replace(/\s*-\s*/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();

//   return name;
// }

function displayName(value) {
  return String(
    value || "Unnamed Mutual Fund"
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getBaseFundName(name) {
  return String(name || "")
    .replace(/\s*-\s*Direct Plan\s*-\s*Growth\s*$/i, "")
    .replace(/\s*-\s*Direct Plan\s*-\s*IDCW\s*$/i, "")
    .replace(/\s*-\s*Regular Plan\s*-\s*Growth\s*$/i, "")
    .replace(/\s*-\s*Regular Plan\s*-\s*IDCW\s*$/i, "")
    .trim();
}

function getPlanOption(name) {
  const value = String(name || "");

  const match = value.match(
    /-\s*(Direct Plan|Regular Plan)\s*-\s*(Growth|IDCW)\s*$/i
  );

  if (!match) {
    return "";
  }

  return `${match[1]} • ${match[2]}`;
}

/*
|--------------------------------------------------------------------------
| Category display mapping
|--------------------------------------------------------------------------
*/

const CATEGORY_LABELS = {
  "INDEX FUND": "Index Fund",
  "SMALL CAP": "Small Cap",
  "MID CAP": "Mid Cap",
  "LARGE CAP": "Large Cap",
  "LARGE AND MID CAP": "Large & Mid Cap",
  "LARGE & MID CAP": "Large & Mid Cap",
  "FLEXI CAP": "Flexi Cap",
  "MULTI CAP": "Multi Cap",
  "MULTI ASSET ALLOCATION": "Multi Asset Allocation",
  "BALANCED HYBRID": "Balanced Hybrid",
  "AGGRESSIVE HYBRID": "Aggressive Hybrid",
  "CONSERVATIVE HYBRID": "Conservative Hybrid",
  "DYNAMIC ASSET ALLOCATION": "Dynamic Asset Allocation",
  "EQUITY SAVINGS": "Equity Savings",
  "CREDIT RISK": "Credit Risk",
  "CORPORATE BOND": "Corporate Bond",
  "BANKING AND PSU": "Banking & PSU",
  "DYNAMIC BOND": "Dynamic Bond",
  "FIXED MATURITY": "Fixed Maturity",
  "FLOATING RATE": "Floating Rate",
  GOLD: "Gold",
  SILVER: "Silver",
  THEMATIC: "Thematic",
  SECTORAL: "Sectoral",
  ARBITRAGE: "Arbitrage",
  INTERNATIONAL: "International",
};

function prettyCategory(value) {
  if (!value) {
    return "";
  }

  const text = String(value).trim().replace(/_/g, " ").replace(/\s+/g, " ");

  const upper = text.toUpperCase();

  if (CATEGORY_LABELS[upper]) {
    return CATEGORY_LABELS[upper];
  }

  return text
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/*
|--------------------------------------------------------------------------
| Category shown in table
|--------------------------------------------------------------------------
*/

function displayCategory(fund) {
  const type = TYPE_LABELS[fund?.fund_type] || "";

  let rawCategory =
    fund?.fund_sub_category || fund?.scheme_category || fund?.category || "";

  rawCategory = String(rawCategory)
    .replace(/^Equity Scheme\s*-\s*/i, "")
    .replace(/^Debt Scheme\s*-\s*/i, "")
    .replace(/^Hybrid Scheme\s*-\s*/i, "")
    .replace(/^Other Scheme\s*-\s*/i, "")
    .replace(/^Solution Oriented Scheme\s*-\s*/i, "")
    .trim();

  const normalized = rawCategory.replace(/_/g, " ").trim().toUpperCase();

  /*
  |--------------------------------------------------------------------------
  | Do not show:
  | Equity INDEX_FUND
  |
  | Show:
  | Equity
  |--------------------------------------------------------------------------
  */

  if (!rawCategory || normalized === "OTHER" || normalized === "INDEX FUND") {
    return type || "Other";
  }

  const category = prettyCategory(rawCategory);

  return type ? `${type} ${category}` : category;
}

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

function formatReturn(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  const number = Number(value);

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatNav(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  return Number(value).toFixed(2);
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  return String(value).slice(0, 10);
}

function returnClass(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "";
  }

  return Number(value) >= 0 ? "mf2-positive" : "mf2-negative";
}

function riskClass(risk) {
  return String(risk || "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getInitials(name) {
  const words = displayName(name)
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean);

  if (!words.length) {
    return "MF";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function categoryLabel(value) {
  return prettyCategory(
    String(value || "")
      .replace(/^Equity Scheme\s*-\s*/i, "")
      .replace(/^Debt Scheme\s*-\s*/i, "")
      .replace(/^Hybrid Scheme\s*-\s*/i, "")
      .replace(/^Other Scheme\s*-\s*/i, "")
      .replace(/^Solution Oriented Scheme\s*-\s*/i, "")
      .trim(),
  );
}

/*
|--------------------------------------------------------------------------
| UI helpers
|--------------------------------------------------------------------------
*/

function Check({ checked }) {
  return (
    <span className={`mf-check ${checked ? "checked" : ""}`}>
      {checked ? "✓" : ""}
    </span>
  );
}

function FilterButton({ label, active, count, onClick }) {
  return (
    <button
      type="button"
      className={`mf2-filter-button ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>

      {count > 0 && <span className="mf2-filter-count">{count}</span>}

      <span className={`mf2-down ${active ? "up" : ""}`}>
        <i className="fa-solid fa-caret-down"></i>
      </span>
    </button>
  );
}

function FilterFooter({ onClear, onApply }) {
  return (
    <div className="mf2-footer">
      <button type="button" className="mf2-footer-clear" onClick={onClear}>
        Clear All
      </button>

      <button type="button" className="mf2-footer-apply" onClick={onApply}>
        Apply
      </button>
    </div>
  );
}

function SortButton({ label, column, applied, onSort }) {
  const active = applied.sortBy === column;

  return (
    <button type="button" className="mf2-sort" onClick={() => onSort(column)}>
      <p>{label}</p>

      <div>
        <span
          className={
            active && applied.sortDirection === "desc"
              ? "sort-arrow down"
              : "sort-arrow"
          }
        >
          <div
            style={{
              marginTop: ".25rem",
            }}
          >
            <i
              className="fa-solid fa-angle-down"
              style={{
                rotate: "180deg",
                scale: "1.4",
                color: "black",
              }}
            ></i>
          </div>
        </span>
      </div>
    </button>
  );
}

/*
|--------------------------------------------------------------------------
| Main component
|--------------------------------------------------------------------------
*/

export default function DashboardSection2() {
  const [funds, setFunds] = useState([]);

  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);

  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);

  const [error, setError] = useState("");

  const [filterData, setFilterData] = useState({
    fundHouses: [],
    categoryGroups: {
      EQUITY: [],
      DEBT: [],
      HYBRID: [],
      COMMODITY: [],
    },
    risks: RISK_ORDER,
    ratings: [5, 4, 3, 2, 1],
  });

  const [applied, setApplied] = useState(DEFAULT_FILTERS);

  const [pending, setPending] = useState(DEFAULT_FILTERS);

  const [openMenu, setOpenMenu] = useState(null);

  const [categoryType, setCategoryType] = useState(null);

  const [fundHouseSearch, setFundHouseSearch] = useState("");

  const [searchInput, setSearchInput] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Refs
  |--------------------------------------------------------------------------
  */

  const requestRef = useRef(null);

  const requestIdRef = useRef(0);

  const loadingRef = useRef(false);

  const hasMoreRef = useRef(true);

  const pageRef = useRef(1);

  const tableScrollRef = useRef(null);

  const sentinelRef = useRef(null);

  /*
  |--------------------------------------------------------------------------
  | Hover + BUY/SELL state
  |--------------------------------------------------------------------------
  */

  const [hoveredFund, setHoveredFund] = useState(null);

  const [tradeFund, setTradeFund] = useState(null);

  const [tradeType, setTradeType] = useState(null);

  const [tradeValue, setTradeValue] = useState("");

  const [tradeLoading, setTradeLoading] = useState(false);

  const [tradeError, setTradeError] = useState("");

  const [tradeSuccess, setTradeSuccess] = useState("");

  /*
  |--------------------------------------------------------------------------
  | BUY / SELL
  |--------------------------------------------------------------------------
  */

  const openTrade = (fund, type) => {
    setTradeFund(fund);
    setTradeType(type);
    setTradeValue("");
    setTradeError("");
    setTradeSuccess("");
  };

  const closeTrade = () => {
    if (tradeLoading) {
      return;
    }

    setTradeFund(null);
    setTradeType(null);
    setTradeValue("");
    setTradeError("");
    setTradeSuccess("");
  };

  const submitTrade = async () => {
    if (!tradeFund || !tradeType) {
      return;
    }

    /*
      ----------------------------------------------------------------------
      User enters UNITS only.
      Amount = units × NAV.
      ----------------------------------------------------------------------
      */

    const units = Number(tradeValue);

    const nav = Number(tradeFund.current_nav);

    if (!Number.isFinite(units) || units <= 0) {
      setTradeError("Enter a valid number of units.");

      return;
    }

    if (!Number.isFinite(nav) || nav <= 0) {
      setTradeError("Current NAV is not available.");

      return;
    }

    const schemeCode =
      tradeFund.scheme_code ?? tradeFund.schemeCode ?? tradeFund.id;

    if (!schemeCode) {
      setTradeError("Scheme code is missing.");

      return;
    }

    /*
      ----------------------------------------------------------------------
      Automatic amount
      ----------------------------------------------------------------------
      */

    const amount = units * nav;

    /*
      ----------------------------------------------------------------------
      SELL validation

      For the All Mutual Funds page, SELL should only work when
      the user owns the fund.

      We load current holdings before SELL and validate units.
      ----------------------------------------------------------------------
      */

    setTradeLoading(true);
    setTradeError("");
    setTradeSuccess("");

    try {
      /*
        --------------------------------------------------------------------
        SELL: verify holding
        --------------------------------------------------------------------
        */

      if (tradeType === "SELL") {
        const holdingResponse = await api.get(
          `${MF_API_PATH}/holdings`,
        );

        const holdingData = holdingResponse?.data || {};

        const holdings = Array.isArray(holdingData.data)
          ? holdingData.data
          : Array.isArray(holdingData.holdings)
            ? holdingData.holdings
            : [];

        const holding = holdings.find(
          (item) =>
            String(item.schemeCode ?? item.scheme_code ?? item.schemeId) ===
            String(schemeCode),
        );

        if (!holding) {
          throw new Error("You do not own this mutual fund.");
        }

        const availableUnits = Number(holding.units || 0);

        if (units > availableUnits) {
          throw new Error(`You can sell maximum ${availableUnits} units.`);
        }
      }

      /*
        --------------------------------------------------------------------
        BUY
        --------------------------------------------------------------------
        */

      if (tradeType === "BUY") {
        await api.post(`${MF_API_PATH}/orders/buy`, {
          schemeCode,
          scheme_code: schemeCode,

          /*
                User enters units.
                Backend can use amount if required.
              */
          units,
        });

        setTradeSuccess(
          `BUY successful: ${units} units for ₹${amount.toLocaleString(
            "en-IN",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}.`,
        );
      }

      /*
        --------------------------------------------------------------------
        SELL
        --------------------------------------------------------------------
        */

      if (tradeType === "SELL") {
        await api.post(`${MF_API_PATH}/orders/sell`, {
          schemeCode,
          scheme_code: schemeCode,

          units,
          amount,
        });

        setTradeSuccess(
          `SELL successful: ${units} units for ₹${amount.toLocaleString(
            "en-IN",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )}.`,
        );
      }

      /*
        --------------------------------------------------------------------
        Close modal after success.
        --------------------------------------------------------------------
        */

      window.setTimeout(() => {
        closeTrade();
      }, 1200);
    } catch (error) {
      console.error(`[MF ${tradeType}] order error:`, error);

      setTradeError(
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.message ||
        `Unable to place ${tradeType} order.`,
      );
    } finally {
      setTradeLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Search debounce
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchInput.trim();

      setApplied((old) =>
        old.search === value
          ? old
          : {
            ...old,
            search: value,
          },
      );

      setPending((old) => ({
        ...old,
        search: value,
      }));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  /*
  |--------------------------------------------------------------------------
  | Fetch filter metadata
  |--------------------------------------------------------------------------
  */

  const fetchFilters = useCallback(async () => {
    try {
      const response = await api.get(MF_FILTERS_PATH);

      const data = response?.data?.data || response?.data || {};

      setFilterData({
        fundHouses: Array.isArray(data.fundHouses) ? data.fundHouses : [],

        categoryGroups: data.categoryGroups || {
          EQUITY: [],
          DEBT: [],
          HYBRID: [],
          COMMODITY: [],
        },

        risks: Array.isArray(data.risks)
          ? data.risks.filter((risk) => RISK_ORDER.includes(risk))
          : RISK_ORDER,

        ratings: Array.isArray(data.ratings)
          ? data.ratings
            .map(Number)
            .filter((rating) => [1, 2, 3, 4, 5].includes(rating))
          : [5, 4, 3, 2, 1],
      });
    } catch (err) {
      console.error("[MF] Filter metadata error:", err);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  /*
  |--------------------------------------------------------------------------
  | Build request params
  |--------------------------------------------------------------------------
  */

  const buildParams = useCallback((filterState, pageNumber) => {
    const params = {
      page: pageNumber,
      limit: PAGE_SIZE,

      sortBy: filterState.sortBy,

      sortDirection: filterState.sortDirection,
    };

    if (filterState.search) {
      params.search = filterState.search;
    }

    if (filterState.fundTypes.length) {
      params.fundType = filterState.fundTypes.join(",");
    }

    if (filterState.categories.length) {
      params.category = filterState.categories.join(",");
    }

    if (filterState.risks.length) {
      params.risk = filterState.risks.join(",");
    }

    if (filterState.fundHouses.length) {
      params.fundHouse = filterState.fundHouses.join(",");
    }

    if (filterState.ratings.length) {
      params.ratingMin = Math.min(...filterState.ratings);
    }

    if (filterState.indexOnly || filterState.quickFilter === "indexonly") {
      params.indexOnly = "true";
    }

    if (filterState.quickFilter && filterState.quickFilter !== "indexonly") {
      params.quickFilter = filterState.quickFilter;
    }

    return params;
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Fetch funds
  |--------------------------------------------------------------------------
  */

  const fetchFunds = useCallback(
    async (pageNumber, reset = false, filterState = applied) => {
      if (loadingRef.current) {
        return;
      }

      if (!reset && !hasMoreRef.current) {
        return;
      }

      if (requestRef.current) {
        requestRef.current.abort();
      }

      const controller = new AbortController();

      requestRef.current = controller;

      const requestId = ++requestIdRef.current;

      loadingRef.current = true;

      setLoading(true);

      if (reset) {
        setInitialLoading(true);
      }

      setError("");

      try {
        const response = await api.get(MF_API_PATH, {
          params: buildParams(filterState, pageNumber),

          signal: controller.signal,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        const data = response?.data?.data || response?.data || {};

        const rows = Array.isArray(data.funds) ? data.funds : [];

        const nextHasMore = Boolean(data.hasMore);

        const nextPage = Number(data.page || pageNumber);

        setTotal(Number(data.total || 0));

        setHasMore(nextHasMore);

        hasMoreRef.current = nextHasMore;

        setPage(nextPage);

        pageRef.current = nextPage;

        setFunds((old) => {
          if (reset) {
            return rows;
          }

          const seen = new Set(
            old.map((item) =>
              String(item.scheme_code ?? item.schemeCode ?? item.id),
            ),
          );

          return [
            ...old,

            ...rows.filter(
              (item) =>
                !seen.has(
                  String(item.scheme_code ?? item.schemeCode ?? item.id),
                ),
            ),
          ];
        });
      } catch (err) {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
          return;
        }

        console.error("[MF] API error:", err);

        if (requestId === requestIdRef.current) {
          setError(
            err?.response?.data?.message ||
            err?.message ||
            "Unable to load mutual funds",
          );

          if (reset) {
            setFunds([]);

            setTotal(0);
          }
        }
      } finally {
        if (requestId === requestIdRef.current) {
          loadingRef.current = false;

          setLoading(false);

          setInitialLoading(false);
        }
      }
    },
    [applied, buildParams],
  );

  /*
  |--------------------------------------------------------------------------
  | Reload on filters
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    pageRef.current = 1;

    hasMoreRef.current = true;

    setPage(1);

    setFunds([]);

    fetchFunds(1, true, applied);

    return () => {
      requestRef.current?.abort();
    };
  }, [applied, fetchFunds]);

  /*
  |--------------------------------------------------------------------------
  | Infinite scrolling
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const root = tableScrollRef.current;

    const target = sentinelRef.current;

    if (!root || !target) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingRef.current &&
          hasMoreRef.current
        ) {
          fetchFunds(pageRef.current + 1, false, applied);
        }
      },
      {
        root,
        rootMargin: "500px 0px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [applied, fetchFunds, funds.length]);

  /*
  |--------------------------------------------------------------------------
  | Filter helpers
  |--------------------------------------------------------------------------
  */

  const togglePendingArray = (key, value) => {
    setPending((old) => ({
      ...old,

      [key]: old[key].includes(value)
        ? old[key].filter((item) => item !== value)
        : [...old[key], value],
    }));
  };

  const selectType = (type) => {
    setCategoryType(type);
  };

  const toggleAllCategoriesForType = (type) => {
    const values = filterData.categoryGroups[type] || [];

    setPending((old) => {
      const allSelected =
        values.length > 0 &&
        values.every((value) => old.categories.includes(value));

      return {
        ...old,

        fundTypes: allSelected
          ? old.fundTypes.filter((value) => value !== type)
          : unique([...old.fundTypes, type]),

        categories: allSelected
          ? old.categories.filter((value) => !values.includes(value))
          : unique([...old.categories, ...values]),
      };
    });
  };

  const applyPending = () => {
    setApplied({
      ...pending,
    });

    setOpenMenu(null);

    setCategoryType(null);
  };

  const clearPending = () => {
    setPending({
      ...DEFAULT_FILTERS,

      search: searchInput.trim(),
    });
  };

  const clearAll = () => {
    setPending({
      ...DEFAULT_FILTERS,
    });

    setApplied({
      ...DEFAULT_FILTERS,
    });

    setSearchInput("");

    setOpenMenu(null);

    setCategoryType(null);
  };

  /*
  |--------------------------------------------------------------------------
  | Fund house search
  |--------------------------------------------------------------------------
  */

  const [filteredHouses, setFilteredHouses] = useState([]);

  useEffect(() => {
    const query = fundHouseSearch.trim().toLowerCase();

    const houses = filterData.fundHouses.filter(
      (house) => !query || String(house).toLowerCase().includes(query),
    );

    setFilteredHouses(houses);
  }, [filterData.fundHouses, fundHouseSearch]);

  /*
  |--------------------------------------------------------------------------
  | Active counts
  |--------------------------------------------------------------------------
  */

  const activeCategoryCount =
    applied.fundTypes.length + applied.categories.length;

  const activeRiskCount = applied.risks.length;

  const activeRatingCount = applied.ratings.length;

  const activeHouseCount = applied.fundHouses.length;

  /*
  |--------------------------------------------------------------------------
  | Sort
  |--------------------------------------------------------------------------
  */

  const sort = (column) => {
    const nextDirection =
      applied.sortBy === column && applied.sortDirection === "desc"
        ? "asc"
        : "desc";

    const next = {
      ...applied,

      sortBy: column,

      sortDirection: nextDirection,
    };

    setApplied(next);

    setPending(next);
  };

  /*
  |--------------------------------------------------------------------------
  | Quick filters
  |--------------------------------------------------------------------------
  */

  const quickFilter = (value) => {
    const next = {
      ...DEFAULT_FILTERS,
      ...applied,

      quickFilter: value,
    };

    setApplied(next);

    setPending(next);
  };

  /*
  |--------------------------------------------------------------------------
  | Menu handling
  |--------------------------------------------------------------------------
  */

  const toggleMenu = (name) => {
    setOpenMenu((old) => (old === name ? null : name));

    if (name !== "categories") {
      setCategoryType(null);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Outside click
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const handleOutside = (event) => {
      if (!event.target.closest(".mf2-filter-area")) {
        setOpenMenu(null);

        setCategoryType(null);
      }
    };

    document.addEventListener("mousedown", handleOutside);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <div
      className="home"
      style={{
        paddingTop: "0rem",
      }}
    >
      <section className="mf2-page">
        {/* Heading */}

        <div className="mf2-heading-row">
          <div>
            <h2>All Mutual Funds</h2>
          </div>

          <div className="mf2-search-box">
            <span>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{
                  scale: ".55",
                  color: "black",
                  paddingBottom: "13px",
                }}
              />
            </span>

            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search mutual funds"
            />

            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                style={{
                  paddingRight: "10px",
                }}
              >
                <i
                  className="fa-solid fa-xmark"
                  style={{
                    fontSize: ".95rem",
                    color: "black",
                  }}
                ></i>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}

        <div className="mf2-toolbar mf2-filter-area">
          <FilterButton
            label="Categories"
            active={openMenu === "categories"}
            count={activeCategoryCount}
            onClick={() => toggleMenu("categories")}
          />

          <FilterButton
            label="Risk"
            active={openMenu === "risk"}
            count={activeRiskCount}
            onClick={() => toggleMenu("risk")}
          />

          <FilterButton
            label="Ratings"
            active={openMenu === "ratings"}
            count={activeRatingCount}
            onClick={() => toggleMenu("ratings")}
          />

          <FilterButton
            label="Fund House"
            active={openMenu === "houses"}
            count={activeHouseCount}
            onClick={() => toggleMenu("houses")}
          />

          <span className="mf2-divider" />

          <button
            type="button"
            className={`mf2-chip ${applied.quickFilter === "indexonly" ? "active" : ""
              }`}
            onClick={() =>
              quickFilter(
                applied.quickFilter === "indexonly" ? "" : "indexonly",
              )
            }
          >
            Index only
          </button>

          <button
            type="button"
            className={`mf2-chip ${applied.quickFilter === "flexicap" ? "active" : ""
              }`}
            onClick={() =>
              quickFilter(applied.quickFilter === "flexicap" ? "" : "flexicap")
            }
          >
            Flexi Cap
          </button>

          <button
            type="button"
            className={`mf2-chip ${applied.quickFilter === "sectoral" ? "active" : ""
              }`}
            onClick={() =>
              quickFilter(applied.quickFilter === "sectoral" ? "" : "sectoral")
            }
          >
            Sectoral
          </button>

          <button
            type="button"
            className={`mf2-chip ${applied.quickFilter === "5plus" ? "active" : ""
              }`}
            onClick={() =>
              quickFilter(applied.quickFilter === "5plus" ? "" : "5plus")
            }
          >
            5 ★
          </button>

          <button
            type="button"
            className={`mf2-chip ${applied.quickFilter === "largecap" ? "active" : ""
              }`}
            onClick={() =>
              quickFilter(applied.quickFilter === "largecap" ? "" : "largecap")
            }
          >
            Large Cap
          </button>

          <button type="button" className="mf2-clear-top" onClick={clearAll}>
            Clear All
          </button>

          {/* Categories dropdown */}

          {openMenu === "categories" && (
            <div className="mf2-popover mf2-category-popover">
              {!categoryType ? (
                <>
                  <div className="mf2-index-toggle-row">
                    <span>Index Funds only</span>

                    <button
                      type="button"
                      className={`mf2-switch ${pending.indexOnly ? "on" : ""}`}
                      onClick={() =>
                        setPending((old) => ({
                          ...old,

                          indexOnly: !old.indexOnly,
                        }))
                      }
                    >
                      <span />
                    </button>
                  </div>

                  <div className="mf2-popover-scroll">
                    {TYPE_ORDER.map((type) => {
                      const values = filterData.categoryGroups[type] || [];

                      const allSelected =
                        values.length > 0 &&
                        values.every((value) =>
                          pending.categories.includes(value),
                        );

                      const selected =
                        pending.fundTypes.includes(type) || allSelected;

                      return (
                        <div className="mf2-category-row" key={type}>
                          <button
                            type="button"
                            className="mf2-option"
                            onClick={() => toggleAllCategoriesForType(type)}
                          >
                            <Check checked={selected} />

                            <span>{TYPE_LABELS[type]}</span>
                          </button>

                          <button
                            type="button"
                            className="mf2-category-arrow"
                            onClick={() => selectType(type)}
                          >
                            <i
                              className="fa-solid fa-angle-down"
                              style={{
                                rotate: "270deg",
                                scale: ".5",
                              }}
                            ></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <FilterFooter onClear={clearPending} onApply={applyPending} />
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="mf2-back"
                    onClick={() => setCategoryType(null)}
                  >
                    ←<strong>{TYPE_LABELS[categoryType]}</strong>
                  </button>

                  <div className="mf2-popover-scroll">
                    {(filterData.categoryGroups[categoryType] || []).map(
                      (category) => (
                        <button
                          key={category}
                          type="button"
                          className="mf2-option"
                          onClick={() =>
                            togglePendingArray("categories", category)
                          }
                        >
                          <Check
                            checked={pending.categories.includes(category)}
                          />

                          <span>{categoryLabel(category)}</span>
                        </button>
                      ),
                    )}
                  </div>

                  <FilterFooter
                    onClear={() =>
                      setPending((old) => ({
                        ...old,
                        categories: [],
                      }))
                    }
                    onApply={applyPending}
                  />
                </>
              )}
            </div>
          )}

          {/* Risk dropdown */}

          {openMenu === "risk" && (
            <div className="mf2-popover mf2-small-popover">
              <div className="mf2-popover-title">Risk</div>

              <div className="mf2-popover-scroll">
                {RISK_ORDER.map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    className="mf2-option"
                    onClick={() => togglePendingArray("risks", risk)}
                  >
                    <Check checked={pending.risks.includes(risk)} />

                    <span>{risk}</span>
                  </button>
                ))}
              </div>

              <FilterFooter
                onClear={() =>
                  setPending((old) => ({
                    ...old,
                    risks: [],
                  }))
                }
                onApply={applyPending}
              />
            </div>
          )}

          {/* Ratings dropdown */}

          {openMenu === "ratings" && (
            <div className="mf2-popover mf2-small-popover">
              <div className="mf2-popover-title">Ratings</div>

              <div className="mf2-popover-scroll">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className="mf2-option"
                    onClick={() => togglePendingArray("ratings", rating)}
                  >
                    <Check checked={pending.ratings.includes(rating)} />

                    <span>{rating} ★</span>
                  </button>
                ))}
              </div>

              <FilterFooter
                onClear={() =>
                  setPending((old) => ({
                    ...old,
                    ratings: [],
                  }))
                }
                onApply={applyPending}
              />
            </div>
          )}

          {/* Fund house dropdown */}

          {openMenu === "houses" && (
            <div className="mf2-popover mf2-house-popover">
              <div className="mf2-house-search">
                <span>
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{
                      scale: "0.55",
                      color: "black",
                      paddingBottom: "13px",
                    }}
                  ></i>
                </span>

                <input
                  value={fundHouseSearch}
                  onChange={(event) => setFundHouseSearch(event.target.value)}
                  placeholder="Search fund house"
                />
              </div>

              <div className="mf2-popover-scroll">
                {filteredHouses.map((house) => (
                  <button
                    type="button"
                    className="mf2-option"
                    key={house}
                    onClick={() => togglePendingArray("fundHouses", house)}
                  >
                    <Check checked={pending.fundHouses.includes(house)} />

                    <span>{house}</span>
                  </button>
                ))}
              </div>

              <FilterFooter
                onClear={() =>
                  setPending((old) => ({
                    ...old,
                    fundHouses: [],
                  }))
                }
                onApply={applyPending}
              />
            </div>
          )}
        </div>

        {/* Error */}

        {error && (
          <div className="mf2-error">
            <span>{error}</span>

            <button type="button" onClick={() => fetchFunds(1, true, applied)}>
              Retry
            </button>
          </div>
        )}

        {/* Table */}

        <div className="mf2-table-card">
          <div className="mf2-table-scroll" ref={tableScrollRef}>
            <table className="mf2-table">
              <thead>
                <tr>
                  <th className="name-col">
                    <p
                      style={{
                        marginLeft: "8rem",
                      }}
                    >
                      Fund Name
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        marginLeft: "2.5rem",
                      }}
                    >
                      Category
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        textAlign: "end",
                        margin: "0",
                      }}
                    >
                      <SortButton
                        label="1Y"
                        column="1y"
                        applied={applied}
                        onSort={sort}
                      />
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        textAlign: "end",
                        margin: "0",
                      }}
                    >
                      <SortButton
                        label="3Y"
                        column="3y"
                        applied={applied}
                        onSort={sort}
                      />
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        textAlign: "end",
                        margin: "0",
                      }}
                    >
                      <SortButton
                        label="5Y"
                        column="5y"
                        applied={applied}
                        onSort={sort}
                      />
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        textAlign: "end",
                        margin: "0",
                      }}
                    >
                      <SortButton
                        label="Rating"
                        column="rating"
                        applied={applied}
                        onSort={sort}
                      />
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        marginLeft: "1rem",
                      }}
                    >
                      Risk
                    </p>
                  </th>

                  <th>
                    <p
                      style={{
                        marginLeft: ".25rem",
                      }}
                    >
                      NAV
                    </p>
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* LOADING */}

                {initialLoading && (
                  <tr>
                    <td colSpan="8" className="mf2-state">
                      Loading mutual funds...
                    </td>
                  </tr>
                )}

                {/* EMPTY */}

                {!initialLoading && !funds.length && (
                  <tr>
                    <td colSpan="8" className="mf2-state">
                      No mutual funds found.
                    </td>
                  </tr>
                )}

                {/* DATA */}

                {funds.map((fund) => {
                  const schemeCode =
                    fund.scheme_code ?? fund.schemeCode ?? fund.id;
                  const isHovered = hoveredFund === String(schemeCode);

                  return (
                    <tr
                      key={schemeCode}
                      onMouseEnter={() => setHoveredFund(String(schemeCode))}
                      onMouseLeave={() => setHoveredFund(null)}
                    >
                      <td className="mf2-name-cell">
                        <span className="mf2-logo">
                          {getInitials(fund.fund_house || fund.scheme_name)}
                        </span>

                        <span className="mf2-name-text">
                          <strong>{getBaseFundName(fund.scheme_name)}</strong>
                          <small>{getPlanOption(fund.scheme_name)}</small>
                          <small>{fund.fund_house || "--"}</small>
                        </span>
                      </td>

                      {/* ================================================= 
          FIXED CATEGORY CELL WITH ACTION BUTTON OVERLAY 
         ================================================== */}
                      <td style={{ padding: 0, position: "relative" }}>
                        <div
                          style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            minHeight: "48px",
                            display: "flex",
                            alignItems: "center",
                            padding: "0 12px",
                          }}
                        >
                          {/* Default Category Label */}
                          {!isHovered && (
                            <span
                              style={{
                                display: "block",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                width: "100%",
                              }}
                            >
                              {displayCategory(fund)}
                            </span>
                          )}

                          {/* Action Buttons Overlay */}
                          {isHovered && (
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                backgroundColor: "#f5f5f5", // Match row hover background
                                zIndex: 2,
                                padding: "0 12px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTrade(fund, "BUY");
                                }}
                                style={{
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "8px 0",
                                  background: "#00a878",
                                  color: "#fff",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  maxWidth: "80px",
                                }}
                              >
                                BUY
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openTrade(fund, "SELL");
                                }}
                                style={{
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "8px 0",
                                  background: "#ef4444",
                                  color: "#fff",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  flex: 1,
                                  maxWidth: "80px",
                                }}
                              >
                                SELL
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 1Y */}

                      <td
                        className={returnClass(fund.return_1y)}
                        title={`Reference NAV date: ${formatDate(
                          fund.return_1y_nav_date,
                        )}`}
                      >
                        <p style={{ textAlign: "end" }}>
                          {formatReturn(fund.return_1y)}
                        </p>
                      </td>

                      {/* 3Y */}

                      <td
                        className={returnClass(fund.return_3y)}
                        title={`Reference NAV date: ${formatDate(
                          fund.return_3y_nav_date,
                        )}`}
                      >
                        <p style={{ textAlign: "end" }}>
                          {formatReturn(fund.return_3y)}
                        </p>
                      </td>

                      {/* 5Y */}

                      <td
                        className={returnClass(fund.return_5y)}
                        title={`Reference NAV date: ${formatDate(fund.return_5y_nav_date)}`}
                      >
                        <p style={{ textAlign: "end" }}>
                          {formatReturn(fund.return_5y)}
                        </p>
                      </td>

                      {/* RATING */}

                      <td>
                        {fund.rating ? (
                          <p style={{ textAlign: "center" }}>
                            <span className="mf2-rating">{fund.rating} ★</span>
                          </p>
                        ) : (
                          "--"
                        )}
                      </td>

                      {/* RISK */}

                      <td>
                        {fund.risk ? (
                          <span className={`mf2-risk ${riskClass(fund.risk)}`}>
                            <p style={{ marginLeft: "1rem" }}>{fund.risk}</p>
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>

                      {/* NAV */}

                      <td className="mf2-nav">{formatNav(fund.current_nav)}</td>
                    </tr>
                  );
                })}

                {/* INFINITE SCROLL SENTINEL */}

                <tr ref={sentinelRef}>
                  <td colSpan="8" className="mf2-sentinel">
                    {loading && !initialLoading
                      ? "Loading more funds…"
                      : !hasMore && funds.length
                        ? `All ${total.toLocaleString(
                          "en-IN",
                        )} mutual funds loaded.`
                        : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ==========================================================
            BUY / SELL MODAL
        =========================================================== */}

        {tradeFund && (
          <div
            onClick={() => {
              if (!tradeLoading) {
                closeTrade();
              }
            }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "380px",
                background: "#fff",
                borderRadius: "12px",
                padding: "24px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              }}
            >
              {/* Header */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>{tradeType}</h3>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    {displayName(tradeFund.scheme_name)}
                  </p>

                  <small style={{ color: "#888" }}>
                    {tradeFund.fund_house}
                  </small>
                </div>

                <button
                  type="button"
                  onClick={closeTrade}
                  disabled={tradeLoading}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: "22px",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              {/* NAV + UNITS */}

              <div style={{ marginBottom: "16px" }}>
                {/* Current NAV */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    fontSize: "13px",
                  }}
                >
                  <span>Current NAV</span>

                  <strong>₹{formatNav(tradeFund.current_nav)}</strong>
                </div>

                {/* Units */}

                <label
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    fontSize: "13px",
                    color: "#555",
                  }}
                >
                  Units
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.00000001"
                  value={tradeValue}
                  onChange={(event) => setTradeValue(event.target.value)}
                  placeholder="Enter units"
                  disabled={tradeLoading}
                  autoFocus
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "11px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "7px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />

                {/* Automatic amount */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "14px",
                    fontSize: "14px",
                  }}
                >
                  <span style={{ color: "#777" }}>Total Amount</span>

                  <strong>
                    ₹
                    {(
                      Number(tradeValue || 0) *
                      Number(tradeFund.current_nav || 0)
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,

                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
              </div>

              {/* Error */}

              {tradeError && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    background: "#fff1f1",
                    color: "#dc2626",
                    fontSize: "12px",
                  }}
                >
                  {tradeError}
                </div>
              )}
              {/* Success */}

              {tradeSuccess && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "9px 10px",
                    borderRadius: "6px",
                    background: "#ecfdf5",
                    color: "#059669",
                    fontSize: "12px",
                  }}
                >
                  {tradeSuccess}
                </div>
              )}

              {/* Confirm */}
              <button
                type="button"
                disabled={tradeLoading || !tradeValue}
                onClick={submitTrade}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "7px",
                  padding: "11px",
                  background: tradeType === "BUY" ? "#00a878" : "#ef4444",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: tradeLoading ? "not-allowed" : "pointer",
                  opacity: tradeLoading || !tradeValue ? 0.6 : 1,
                }}
              >
                {tradeLoading ? "Processing..." : `Confirm ${tradeType}`}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
