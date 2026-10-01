// import React, { useEffect, useState } from "react";

// const API_BASE = "http://localhost:5000";

// const AUTH_BASE = "http://localhost:3010";

// /*
// |--------------------------------------------------------------------------
// | Formatting helpers
// |--------------------------------------------------------------------------
// */

// const formatNumber = (value, digits = 2) => {
//   const number = Number(value);

//   if (!Number.isFinite(number)) {
//     return "0.00";
//   }

//   return number.toLocaleString("en-IN", {
//     minimumFractionDigits: digits,
//     maximumFractionDigits: digits,
//   });
// };

// const formatMoney = (value) => {
//   const number = Number(value || 0);

//   if (!Number.isFinite(number)) {
//     return "₹0.00";
//   }

//   return `${number < 0 ? "-" : ""}₹${Math.abs(number).toLocaleString("en-IN", {
//     minimumFractionDigits: 2,
//     maximumFractionDigits: 2,
//   })}`;
// };

// const formatPercent = (value) => {
//   const number = Number(value || 0);

//   if (!Number.isFinite(number)) {
//     return "0.00%";
//   }

//   return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
// };

// /*
// |--------------------------------------------------------------------------
// | Get logged-in user
// |--------------------------------------------------------------------------
// */

// const getUser = async () => {
//   const token =
//     localStorage.getItem("token") || localStorage.getItem("accessToken");

//   if (!token) {
//     throw new Error("Please login first.");
//   }

//   const headers = {
//     "Content-Type": "application/json",
//     Authorization: `Bearer ${token}`,
//   };

//   const response = await fetch(`${AUTH_BASE}/me`, {
//     method: "GET",
//     headers,
//   });

//   if (!response.ok) {
//     if (response.status === 401) {
//       localStorage.removeItem("token");
//     }

//     throw new Error(
//       response.status === 401
//         ? "Session expired. Please login again."
//         : `Unable to fetch user (${response.status})`,
//     );
//   }

//   return response.json();
// };

// /*
// |--------------------------------------------------------------------------
// | Get MF holdings
// |--------------------------------------------------------------------------
// */

// const getHoldings = async (userId) => {
//   const token =
//     localStorage.getItem("token") || localStorage.getItem("accessToken");

//   const headers = {
//     "Content-Type": "application/json",
//   };

//   if (token) {
//     headers.Authorization = `Bearer ${token}`;
//   }

//   const response = await fetch(
//     `${API_BASE}/api/mutual-funds/holdings/${userId}`,
//     {
//       method: "GET",
//       headers,
//     },
//   );

//   if (!response.ok) {
//     throw new Error("Unable to fetch mutual fund holdings");
//   }

//   return response.json();
// };

// /*
// |--------------------------------------------------------------------------
// | Dashboard
// |--------------------------------------------------------------------------
// */

// const DashboardSection1 = () => {
//   /*
//   |--------------------------------------------------------------------------
//   | Portfolio state
//   |--------------------------------------------------------------------------
//   */

//   const [holdings, setHoldings] = useState([]);

//   const [selectedHolding, setSelectedHolding] = useState(null);

//   const [summary, setSummary] = useState({
//     investedAmount: 0,
//     currentValue: 0,
//     todaysPnL: 0,
//     todaysReturnPercent: 0,
//     totalReturn: 0,
//     totalReturnPercent: 0,
//     xirr: null,
//   });

//   const [user, setUser] = useState(null);

//   const [loading, setLoading] = useState(true);

//   const [error, setError] = useState("");

//   /*
//   |--------------------------------------------------------------------------
//   | SELL state
//   |--------------------------------------------------------------------------
//   */

//   const [sellFund, setSellFund] = useState(null);

//   const [sellUnits, setSellUnits] = useState("");

//   const [sellLoading, setSellLoading] = useState(false);

//   const [sellError, setSellError] = useState("");

//   const [sellSuccess, setSellSuccess] = useState("");

//   /*
//   |--------------------------------------------------------------------------
//   | Open SELL modal
//   |--------------------------------------------------------------------------
//   */

//   const openSell = (fund) => {
//     setSellFund(fund);
//     setSellUnits("");
//     setSellError("");
//     setSellSuccess("");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Close SELL modal
//   |--------------------------------------------------------------------------
//   */

//   const closeSell = () => {
//     if (sellLoading) {
//       return;
//     }

//     setSellFund(null);
//     setSellUnits("");
//     setSellError("");
//     setSellSuccess("");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Get current logged-in user ID
//   |--------------------------------------------------------------------------
//   */

//   const getCurrentUserId = async () => {
//     const token =
//       localStorage.getItem("token") || localStorage.getItem("accessToken");

//     if (!token) {
//       throw new Error("Please login first.");
//     }

//     const response = await fetch(`${AUTH_BASE}/me`, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",

//         Authorization: `Bearer ${token}`,
//       },
//     });

//     if (!response.ok) {
//       throw new Error(
//         response.status === 401
//           ? "Session expired. Please login again."
//           : "Unable to fetch user.",
//       );
//     }

//     const data = await response.json();

//     const currentUser = data?.user || data;

//     const userId =
//       currentUser?.user_id || currentUser?.id || data?.userId || data?.id;

//     if (!userId) {
//       throw new Error("User ID not found.");
//     }

//     return userId;
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | SUBMIT SELL
//   |--------------------------------------------------------------------------
//   */

//   const submitSell = async () => {
//     if (!sellFund) {
//       return;
//     }

//     const units = Number(sellUnits);

//     const availableUnits = Number(sellFund.units || 0);

//     const currentNav = Number(sellFund.currentNav || 0);

//     /*
//       ----------------------------------------------------------------------
//       Validate units
//       ----------------------------------------------------------------------
//       */

//     if (!Number.isFinite(units) || units <= 0) {
//       setSellError("Enter a valid number of units.");

//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       Cannot sell more than owned
//       ----------------------------------------------------------------------
//       */

//     if (units > availableUnits) {
//       setSellError(
//         `You can sell maximum ${formatNumber(availableUnits, 8)} units.`,
//       );

//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       Validate NAV
//       ----------------------------------------------------------------------
//       */

//     if (!Number.isFinite(currentNav) || currentNav <= 0) {
//       setSellError("Current NAV is not available.");

//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       Scheme code
//       ----------------------------------------------------------------------
//       */

//     const schemeCode =
//       sellFund.schemeCode ?? sellFund.scheme_code ?? sellFund.schemeId;

//     if (!schemeCode) {
//       setSellError("Scheme code is missing.");

//       return;
//     }

//     /*
//       ----------------------------------------------------------------------
//       Automatic sale amount
//       ----------------------------------------------------------------------
//       */

//     const amount = units * currentNav;

//     setSellLoading(true);
//     setSellError("");
//     setSellSuccess("");

//     try {
//       const userId = await getCurrentUserId();

//       const token =
//         localStorage.getItem("token") || localStorage.getItem("accessToken");

//       /*
//         ------------------------------------------------------------------
//         SELL API
//         ------------------------------------------------------------------
//         */

//       const response = await fetch(`${API_BASE}/api/mutual-funds/orders/sell`, {
//         method: "POST",

//         headers: {
//           "Content-Type": "application/json",

//           ...(token
//             ? {
//                 Authorization: `Bearer ${token}`,
//               }
//             : {}),
//         },

//         body: JSON.stringify({
//           userId,

//           schemeCode,

//           scheme_code: schemeCode,

//           units,

//           amount,
//         }),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             data?.error?.message ||
//             "Unable to place SELL order.",
//         );
//       }

//       /*
//         ------------------------------------------------------------------
//         Success
//         ------------------------------------------------------------------
//         */

//       setSellSuccess(
//         `SELL successful: ${formatNumber(units, 8)} units for ${formatMoney(
//           amount,
//         )}.`,
//       );

//       /*
//         ------------------------------------------------------------------
//         Refresh whole dashboard after a successful SELL.

//         This ensures:
//           - units update
//           - invested amount updates
//           - current value updates
//           - total return updates
//           - 1D return updates
//           - XIRR updates
//         ------------------------------------------------------------------
//         */

//       window.setTimeout(() => {
//         window.location.reload();
//       }, 1000);
//     } catch (sellRequestError) {
//       console.error("MF SELL error:", sellRequestError);

//       setSellError(sellRequestError.message || "Unable to place SELL order.");
//     } finally {
//       setSellLoading(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | LOAD DASHBOARD
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     let mounted = true;

//     const loadDashboard = async () => {
//       try {
//         setLoading(true);
//         setError("");

//         /*
//           ----------------------------------------------------------------
//           USER
//           ----------------------------------------------------------------
//           */

//         const userData = await getUser();

//         if (!mounted) {
//           return;
//         }

//         const currentUser = userData?.user || userData;

//         setUser(currentUser);

//         const userId =
//           currentUser?.user_id || currentUser?.id || userData?.userId;

//         if (!userId) {
//           throw new Error("User ID not found");
//         }

//         /*
//           ----------------------------------------------------------------
//           HOLDINGS
//           ----------------------------------------------------------------
//           */

//         const response = await getHoldings(userId);

//         if (!mounted) {
//           return;
//         }

//         const userHoldings = Array.isArray(response?.data)
//           ? response.data
//           : Array.isArray(response?.holdings)
//             ? response.holdings
//             : [];

//         setHoldings(userHoldings);

//         /*
//           ----------------------------------------------------------------
//           SUMMARY
//           ----------------------------------------------------------------
//           */

//         if (response?.summary) {
//           setSummary(response.summary);
//         } else {
//           setSummary({
//             investedAmount: 0,
//             currentValue: 0,
//             todaysPnL: 0,
//             todaysReturnPercent: 0,
//             totalReturn: 0,
//             totalReturnPercent: 0,
//             xirr: null,
//           });
//         }

//         /*
//           ----------------------------------------------------------------
//           SELECT FIRST HOLDING
//           ----------------------------------------------------------------
//           */

//         if (userHoldings.length > 0) {
//           setSelectedHolding(userHoldings[0]);
//         } else {
//           setSelectedHolding(null);
//         }
//       } catch (err) {
//         console.error("MF dashboard error:", err);

//         if (!mounted) {
//           return;
//         }

//         setError(err.message || "Unable to load dashboard");
//       } finally {
//         if (mounted) {
//           setLoading(false);
//         }
//       }
//     };

//     loadDashboard();

//     return () => {
//       mounted = false;
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Loading
//   |--------------------------------------------------------------------------
//   */

//   if (loading) {
//     return (
//       <div className="holdings-page">
//         <div className="holdings-loading">Loading mutual fund portfolio...</div>
//       </div>
//     );
//   }

//   /*
//   |--------------------------------------------------------------------------
//   | Error
//   |--------------------------------------------------------------------------
//   */

//   if (error) {
//     return (
//       <div className="holdings-page">
//         <div className="holdings-loading">
//           <h3>{error}</h3>

//           {!user && <p>Please login to view your holdings.</p>}
//         </div>
//       </div>
//     );
//   }

//   /*
//   |--------------------------------------------------------------------------
//   | MAIN UI
//   |--------------------------------------------------------------------------
//   */

//   return (
//     <div className="holdings-page">
//       <div className="holdings-content">
//         {/* =========================================================
//             LEFT
//         ========================================================== */}

//         <div className="holdings-main">
//           {/* =====================================================
//               SUMMARY
//           ====================================================== */}

//           <div className="summary-card">
//             <div className="summary-top">
//               <div>
//                 <p
//                   className="summary-label"
//                   style={{
//                     margin: "0",
//                     marginBottom: ".5rem",
//                     fontSize: "1rem",
//                   }}
//                 >
//                   Current Value
//                 </p>

//                 <h1
//                   style={{
//                     fontSize: "1.25rem",
//                     fontWeight: "500",
//                   }}
//                 >
//                   {formatMoney(summary.currentValue)}
//                 </h1>
//               </div>

//               <button className="analyse-btn">Analyse</button>
//             </div>

//             <div className="summary-grid">
//               {/* INVESTED */}

//               <div>
//                 <p
//                   style={{
//                     margin: "0",
//                     textAlign: "start",
//                   }}
//                 >
//                   Invested Value
//                 </p>

//                 <h4>{formatMoney(summary.investedAmount)}</h4>
//               </div>

//               {/* RETURNS */}

//               <div
//                 style={{
//                   display: "flex",
//                   justifyContent: "space-between",
//                   gap: "5rem",
//                 }}
//               >
//                 {/* 1D */}

//                 <div>
//                   <p
//                     style={{
//                       margin: 0,
//                       textAlign: "end",
//                     }}
//                   >
//                     1D Returns
//                   </p>

//                   <div
//                     className={
//                       Number(summary.todaysPnL) >= 0 ? "profit" : "loss"
//                     }
//                   >
//                     <h4>{formatMoney(summary.todaysPnL)}</h4>

//                     <h4>{formatPercent(summary.todaysReturnPercent)}</h4>
//                   </div>
//                 </div>

//                 {/* TOTAL RETURN */}

//                 <div>
//                   <p
//                     style={{
//                       margin: 0,
//                       textAlign: "end",
//                     }}
//                   >
//                     Total Return
//                   </p>

//                   <div
//                     className={
//                       Number(summary.totalReturn) >= 0 ? "profit" : "loss"
//                     }
//                   >
//                     <h4>{formatMoney(summary.totalReturn)}</h4>

//                     <h4>{formatPercent(summary.totalReturnPercent)}</h4>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* =====================================================
//               TABLE
//           ====================================================== */}

//           <div className="table-card">
//             {holdings.length === 0 ? (
//               <div
//                 style={{
//                   padding: "3rem",
//                   textAlign: "center",
//                 }}
//               >
//                 <h3>No holdings yet</h3>

//                 <p>Your purchased mutual funds will appear here.</p>
//               </div>
//             ) : (
//               <table>
//                 <thead>
//                   <tr>
//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                         }}
//                       >
//                         Fund
//                       </p>
//                     </th>

//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                           textAlign: "end",
//                         }}
//                       >
//                         NAV
//                       </p>
//                     </th>

//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                           textAlign: "end",
//                         }}
//                       >
//                         1D Return
//                       </p>
//                     </th>

//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                           textAlign: "end",
//                         }}
//                       >
//                         Total Return
//                       </p>
//                     </th>

//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                           textAlign: "end",
//                         }}
//                       >
//                         Current Value
//                       </p>
//                     </th>

//                     <th>
//                       <p
//                         style={{
//                           margin: "0",
//                           textAlign: "center",
//                         }}
//                       >
//                         Action
//                       </p>
//                     </th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {holdings.map((fund) => {
//                     const todaysPnL = Number(fund.todaysPnL ?? 0);

//                     const totalReturn = Number(fund.totalReturn ?? 0);

//                     return (
//                       <tr
//                         key={fund.id ?? fund.schemeId}
//                         onClick={() => setSelectedHolding(fund)}
//                         style={{
//                           cursor: "pointer",
//                         }}
//                       >
//                         {/* FUND */}

//                         <td>
//                           <div className="stock-name">
//                             <strong>{fund.schemeName}</strong>

//                             <span>{fund.fundHouse}</span>
//                           </div>
//                         </td>

//                         {/* NAV */}

//                         <td>
//                           <p
//                             style={{
//                               margin: "0",
//                               textAlign: "end",
//                             }}
//                           >
//                             ₹{formatNumber(fund.currentNav)}
//                           </p>
//                         </td>

//                         {/* 1D */}

//                         <td>
//                           <div className={todaysPnL >= 0 ? "profit" : "loss"}>
//                             <p
//                               style={{
//                                 margin: "0",
//                                 textAlign: "end",
//                               }}
//                             >
//                               {formatMoney(todaysPnL)}
//                             </p>
//                           </div>

//                           <small
//                             className={
//                               Number(fund.todaysReturnPercent) >= 0
//                                 ? "profit"
//                                 : "loss"
//                             }
//                           >
//                             <p
//                               style={{
//                                 margin: "0",
//                                 textAlign: "end",
//                               }}
//                             >
//                               {formatPercent(fund.todaysReturnPercent)}
//                             </p>
//                           </small>
//                         </td>

//                         {/* TOTAL RETURN */}

//                         <td>
//                           <div className={totalReturn >= 0 ? "profit" : "loss"}>
//                             <p
//                               style={{
//                                 margin: "0",
//                                 textAlign: "end",
//                               }}
//                             >
//                               {formatMoney(totalReturn)}
//                             </p>
//                           </div>

//                           <small
//                             className={
//                               Number(fund.totalReturnPercent) >= 0
//                                 ? "profit"
//                                 : "loss"
//                             }
//                           >
//                             <p
//                               style={{
//                                 margin: "0",
//                                 textAlign: "end",
//                               }}
//                             >
//                               {formatPercent(fund.totalReturnPercent)}
//                             </p>
//                           </small>
//                         </td>

//                         {/* CURRENT VALUE */}

//                         <td>
//                           <p
//                             style={{
//                               margin: "0",
//                               textAlign: "end",
//                             }}
//                           >
//                             {formatMoney(fund.currentValue)}
//                           </p>
//                         </td>

//                         {/* SELL */}

//                         <td>
//                           <div
//                             style={{
//                               display: "flex",
//                               justifyContent: "center",
//                             }}
//                             onClick={(event) => event.stopPropagation()}
//                           >
//                             <button
//                               type="button"
//                               onClick={() => openSell(fund)}
//                               style={{
//                                 border: "none",
//                                 borderRadius: "7px",
//                                 padding: "8px 18px",
//                                 background: "#e7f8f2",
//                                 color: "#00a878",
//                                 fontSize: "14px",
//                                 fontWeight: 600,
//                                 cursor: "pointer",
//                               }}
//                             >
//                               Sell
//                             </button>
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             )}
//           </div>
//         </div>

//         {/* =========================================================
//             RIGHT SIDEBAR
//         ========================================================== */}

//         <div className="holding-sidebar">
//           {selectedHolding ? (
//             <div>
//               <h2>{selectedHolding.schemeName}</h2>

//               <h4>{selectedHolding.fundHouse}</h4>

//               <hr />

//               <div className="sidebar-row">
//                 <span>Units</span>

//                 <strong>{formatNumber(selectedHolding.units, 4)}</strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>Current NAV</span>

//                 <strong>{formatMoney(selectedHolding.currentNav)}</strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>Current Value</span>

//                 <strong>{formatMoney(selectedHolding.currentValue)}</strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>Invested</span>

//                 <strong>{formatMoney(selectedHolding.investedAmount)}</strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>1D Return</span>

//                 <strong
//                   className={
//                     Number(selectedHolding.todaysPnL) >= 0 ? "profit" : "loss"
//                   }
//                 >
//                   {formatMoney(selectedHolding.todaysPnL)}
//                 </strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>Total Return</span>

//                 <strong
//                   className={
//                     Number(selectedHolding.totalReturn) >= 0 ? "profit" : "loss"
//                   }
//                 >
//                   {formatMoney(selectedHolding.totalReturn)}
//                 </strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>1D %</span>

//                 <strong
//                   className={
//                     Number(selectedHolding.todaysReturnPercent) >= 0
//                       ? "profit"
//                       : "loss"
//                   }
//                 >
//                   {formatPercent(selectedHolding.todaysReturnPercent)}
//                 </strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>Total %</span>

//                 <strong
//                   className={
//                     Number(selectedHolding.totalReturnPercent) >= 0
//                       ? "profit"
//                       : "loss"
//                   }
//                 >
//                   {formatPercent(selectedHolding.totalReturnPercent)}
//                 </strong>
//               </div>

//               <div className="sidebar-row">
//                 <span>NAV Date</span>

//                 <strong>{selectedHolding.navDate || "-"}</strong>
//               </div>

//               {/* SELL FROM SIDEBAR TOO */}

//               <div
//                 style={{
//                   marginTop: "20px",
//                 }}
//               >
//                 <button
//                   type="button"
//                   onClick={() => openSell(selectedHolding)}
//                   style={{
//                     width: "100%",
//                     border: "none",
//                     borderRadius: "7px",
//                     padding: "10px",
//                     background: "#e7f8f2",
//                     color: "#00a878",
//                     fontSize: "14px",
//                     fontWeight: 600,
//                     cursor: "pointer",
//                   }}
//                 >
//                   Sell
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <div className="empty-sidebar">
//               <h3>No Holdings</h3>

//               <p>Your purchased mutual funds will appear here.</p>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* =========================================================
//           SELL MODAL
//       ========================================================== */}

//       {sellFund && (
//         <div
//           style={{
//             position: "fixed",
//             inset: 0,
//             background: "rgba(0,0,0,0.25)",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             zIndex: 1000,
//           }}
//           onClick={() => {
//             if (!sellLoading) {
//               closeSell();
//             }
//           }}
//         >
//           <div
//             style={{
//               width: "380px",
//               background: "#fff",
//               borderRadius: "12px",
//               padding: "24px",
//               boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
//             }}
//             onClick={(event) => event.stopPropagation()}
//           >
//             {/* HEADER */}

//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 alignItems: "flex-start",
//                 marginBottom: "18px",
//               }}
//             >
//               <div>
//                 <h3
//                   style={{
//                     margin: 0,
//                     fontSize: "18px",
//                   }}
//                 >
//                   SELL
//                 </h3>

//                 <p
//                   style={{
//                     margin: "6px 0 0",
//                     color: "#666",
//                     fontSize: "13px",
//                   }}
//                 >
//                   {sellFund.schemeName}
//                 </p>

//                 <small
//                   style={{
//                     color: "#888",
//                   }}
//                 >
//                   {sellFund.fundHouse}
//                 </small>
//               </div>

//               <button
//                 type="button"
//                 onClick={closeSell}
//                 disabled={sellLoading}
//                 style={{
//                   border: "none",
//                   background: "transparent",
//                   fontSize: "22px",
//                   cursor: "pointer",
//                 }}
//               >
//                 ×
//               </button>
//             </div>

//             {/* NAV */}

//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 marginBottom: "8px",
//                 fontSize: "13px",
//               }}
//             >
//               <span>Current NAV</span>

//               <strong>₹{formatNumber(sellFund.currentNav)}</strong>
//             </div>

//             {/* AVAILABLE UNITS */}

//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 marginBottom: "16px",
//                 fontSize: "13px",
//               }}
//             >
//               <span>Available Units</span>

//               <strong>{formatNumber(sellFund.units, 8)}</strong>
//             </div>

//             {/* UNITS INPUT */}

//             <label
//               style={{
//                 display: "block",
//                 marginBottom: "7px",
//                 fontSize: "13px",
//                 color: "#555",
//               }}
//             >
//               Units
//             </label>

//             <input
//               type="number"
//               min="0"
//               max={sellFund.units}
//               step="0.00000001"
//               value={sellUnits}
//               onChange={(event) => setSellUnits(event.target.value)}
//               placeholder="Enter units"
//               disabled={sellLoading}
//               autoFocus
//               style={{
//                 width: "100%",
//                 boxSizing: "border-box",
//                 padding: "11px 12px",
//                 border: "1px solid #ddd",
//                 borderRadius: "7px",
//                 fontSize: "14px",
//                 outline: "none",
//               }}
//             />

//             {/* AUTOMATIC TOTAL */}

//             <div
//               style={{
//                 display: "flex",
//                 justifyContent: "space-between",
//                 marginTop: "14px",
//                 fontSize: "14px",
//               }}
//             >
//               <span
//                 style={{
//                   color: "#777",
//                 }}
//               >
//                 Total Amount
//               </span>

//               <strong>
//                 {formatMoney(
//                   Number(sellUnits || 0) * Number(sellFund.currentNav || 0),
//                 )}
//               </strong>
//             </div>

//             {/* ERROR */}

//             {sellError && (
//               <div
//                 style={{
//                   marginTop: "12px",
//                   padding: "9px 10px",
//                   borderRadius: "6px",
//                   background: "#fff1f1",
//                   color: "#dc2626",
//                   fontSize: "12px",
//                 }}
//               >
//                 {sellError}
//               </div>
//             )}

//             {/* SUCCESS */}

//             {sellSuccess && (
//               <div
//                 style={{
//                   marginTop: "12px",
//                   padding: "9px 10px",
//                   borderRadius: "6px",
//                   background: "#ecfdf5",
//                   color: "#059669",
//                   fontSize: "12px",
//                 }}
//               >
//                 {sellSuccess}
//               </div>
//             )}

//             {/* CONFIRM */}

//             <button
//               type="button"
//               disabled={sellLoading || !sellUnits}
//               onClick={submitSell}
//               style={{
//                 width: "100%",
//                 marginTop: "18px",
//                 border: "none",
//                 borderRadius: "7px",
//                 padding: "11px",
//                 background: "#ef4444",
//                 color: "#fff",
//                 fontSize: "14px",
//                 fontWeight: 600,
//                 cursor: sellLoading ? "not-allowed" : "pointer",
//                 opacity: sellLoading || !sellUnits ? 0.6 : 1,
//               }}
//             >
//               {sellLoading ? "Processing..." : "Confirm SELL"}
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default DashboardSection1;




















import React, { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000";
const AUTH_BASE = "http://localhost:3010";

/*
|--------------------------------------------------------------------------
| Formatting helpers
|--------------------------------------------------------------------------
*/

const formatNumber = (value, digits = 2) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00";
  }

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const formatMoney = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "₹0.00";
  }

  return `${number < 0 ? "-" : ""}₹${Math.abs(number).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value) => {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0.00%";
  }

  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}%`;
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
    throw new Error("Please login first.");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${AUTH_BASE}/me`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
    }

    throw new Error(
      response.status === 401
        ? "Session expired. Please login again."
        : `Unable to fetch user (${response.status})`,
    );
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| Get MF holdings
|--------------------------------------------------------------------------
*/

const getHoldings = async () => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api/mutual-funds/holdings`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Unable to fetch mutual fund holdings");
  }

  return response.json();
};

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
*/

const DashboardSection1 = () => {
  /*
  |--------------------------------------------------------------------------
  | Portfolio state
  |--------------------------------------------------------------------------
  */

  const [holdings, setHoldings] = useState([]);
  const [selectedHolding, setSelectedHolding] = useState(null);

  const [summary, setSummary] = useState({
    investedAmount: 0,
    currentValue: 0,
    todaysPnL: 0,
    todaysReturnPercent: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    xirr: null,
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | SELL state
  |--------------------------------------------------------------------------
  */

  const [sellFund, setSellFund] = useState(null);
  const [sellUnits, setSellUnits] = useState("");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellError, setSellError] = useState("");
  const [sellSuccess, setSellSuccess] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Open SELL modal
  |--------------------------------------------------------------------------
  */

  const openSell = (fund) => {
    setSellFund(fund);
    setSellUnits("");
    setSellError("");
    setSellSuccess("");
  };

  /*
  |--------------------------------------------------------------------------
  | Close SELL modal
  |--------------------------------------------------------------------------
  */

  const closeSell = () => {
    if (sellLoading) {
      return;
    }

    setSellFund(null);
    setSellUnits("");
    setSellError("");
    setSellSuccess("");
  };

  /*
  |--------------------------------------------------------------------------
  | Get current logged-in user ID
  |--------------------------------------------------------------------------
  */

  /*
  |--------------------------------------------------------------------------
  | SUBMIT SELL
  |--------------------------------------------------------------------------
  */

  const submitSell = async () => {
    if (!sellFund) {
      return;
    }

    const units = Number(sellUnits);
    const availableUnits = Number(sellFund.units || 0);
    const currentNav = Number(sellFund.currentNav || 0);

    /*
      ----------------------------------------------------------------------
      Validate units
      ----------------------------------------------------------------------
      */

    if (!Number.isFinite(units) || units <= 0) {
      setSellError("Enter a valid number of units.");

      return;
    }

    /*
      ----------------------------------------------------------------------
      Cannot sell more than owned
      ----------------------------------------------------------------------
      */

    if (units > availableUnits) {
      setSellError(
        `You can sell maximum ${formatNumber(availableUnits, 8)} units.`,
      );

      return;
    }

    /*
      ----------------------------------------------------------------------
      Validate NAV
      ----------------------------------------------------------------------
      */

    if (!Number.isFinite(currentNav) || currentNav <= 0) {
      setSellError("Current NAV is not available.");

      return;
    }

    /*
      ----------------------------------------------------------------------
      Scheme code
      ----------------------------------------------------------------------
      */

    const schemeCode =
      sellFund.schemeCode ?? sellFund.scheme_code ?? sellFund.schemeId;

    if (!schemeCode) {
      setSellError("Scheme code is missing.");

      return;
    }

    /*
      ----------------------------------------------------------------------
      Automatic sale amount
      ----------------------------------------------------------------------
      */

    const amount = units * currentNav;

    setSellLoading(true);
    setSellError("");
    setSellSuccess("");

    try {
      const token =
        localStorage.getItem("token") || localStorage.getItem("accessToken");

      /*
        ------------------------------------------------------------------
        SELL API
        ------------------------------------------------------------------
        */

      const response = await fetch(`${API_BASE}/api/mutual-funds/orders/sell`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          ...(token
            ? {
              Authorization: `Bearer ${token}`,
            }
            : {}),
        },

        body: JSON.stringify({
          schemeCode,

          scheme_code: schemeCode,

          units,

          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
          data?.error?.message ||
          "Unable to place SELL order.",
        );
      }

      /*
        ------------------------------------------------------------------
        Success
        ------------------------------------------------------------------
        */

      setSellSuccess(
        `SELL successful: ${formatNumber(units, 8)} units for ${formatMoney(
          amount,
        )}.`,
      );

      /*
        ------------------------------------------------------------------
        Refresh whole dashboard after a successful SELL.

        This ensures:
          - units update
          - invested amount updates
          - current value updates
          - total return updates
          - 1D return updates
          - XIRR updates
        ------------------------------------------------------------------
        */

      window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (sellRequestError) {
      console.error("MF SELL error:", sellRequestError);

      setSellError(sellRequestError.message || "Unable to place SELL order.");
    } finally {
      setSellLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | LOAD DASHBOARD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        /*
          ----------------------------------------------------------------
          USER
          ----------------------------------------------------------------
          */

        const userData = await getUser();

        if (!mounted) {
          return;
        }

        const currentUser = userData?.user || userData;
        setUser(currentUser);

        /*
          ----------------------------------------------------------------
          HOLDINGS

          The backend derives userId from the verified JWT.
          ----------------------------------------------------------------
          */

        const response = await getHoldings();

        if (!mounted) {
          return;
        }

        const userHoldings = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.holdings)
            ? response.holdings
            : [];

        setHoldings(userHoldings);

        /*
          ----------------------------------------------------------------
          SUMMARY
          ----------------------------------------------------------------
          */

        if (response?.summary) {
          setSummary(response.summary);
        } else {
          setSummary({
            investedAmount: 0,
            currentValue: 0,
            todaysPnL: 0,
            todaysReturnPercent: 0,
            totalReturn: 0,
            totalReturnPercent: 0,
            xirr: null,
          });
        }

        /*
          ----------------------------------------------------------------
          SELECT FIRST HOLDING
          ----------------------------------------------------------------
          */

        if (userHoldings.length > 0) {
          setSelectedHolding(userHoldings[0]);
        } else {
          setSelectedHolding(null);
        }
      } catch (err) {
        console.error("MF dashboard error:", err);

        if (!mounted) {
          return;
        }

        setError(err.message || "Unable to load dashboard");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="holdings-page">
        <div className="holdings-loading">Loading mutual fund portfolio...</div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Error
  |--------------------------------------------------------------------------
  */

  if (error) {
    return (
      <div className="holdings-page">
        <div className="holdings-loading">
          <h3>{error}</h3>

          {!user && <p>Please login to view your holdings.</p>}
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="holdings-page">
      <div className="holdings-content">
        {/* =========================================================
            LEFT
        ========================================================== */}

        <div className="holdings-main">
          {/* =====================================================
              SUMMARY
          ====================================================== */}

          <div className="summary-card">
            <div className="summary-top">
              <div>
                <p
                  className="summary-label"
                  style={{
                    margin: "0",
                    marginBottom: ".5rem",
                    fontSize: "1rem",
                  }}
                >
                  Current Value
                </p>

                <h1
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "500",
                  }}
                >
                  {formatMoney(summary.currentValue)}
                </h1>
              </div>

              <button className="analyse-btn">Analyse</button>
            </div>

            <div className="summary-grid">
              {/* INVESTED */}

              <div>
                <p
                  style={{
                    margin: "0",
                    textAlign: "start",
                  }}
                >
                  Invested Value
                </p>

                <h4>{formatMoney(summary.investedAmount)}</h4>
              </div>

              {/* RETURNS */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "5rem",
                }}
              >
                {/* 1D */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      textAlign: "end",
                    }}
                  >
                    1D Returns
                  </p>

                  <div
                    className={
                      Number(summary.todaysPnL) >= 0 ? "profit" : "loss"
                    }
                  >
                    <h4>{formatMoney(summary.todaysPnL)}</h4>

                    <h4>{formatPercent(summary.todaysReturnPercent)}</h4>
                  </div>
                </div>

                {/* TOTAL RETURN */}

                <div>
                  <p
                    style={{
                      margin: 0,
                      textAlign: "end",
                    }}
                  >
                    Total Return
                  </p>

                  <div
                    className={
                      Number(summary.totalReturn) >= 0 ? "profit" : "loss"
                    }
                  >
                    <h4>{formatMoney(summary.totalReturn)}</h4>

                    <h4>{formatPercent(summary.totalReturnPercent)}</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              TABLE
          ====================================================== */}

          <div className="table-card">
            {holdings.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", }}>
                <h3>No holdings yet</h3>

                <p>Your purchased mutual funds will appear here.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>
                      <p style={{ margin: "0", }}>
                        Fund
                      </p>
                    </th>

                    <th>
                      <p style={{ margin: "0", textAlign: "end", }}>
                        NAV
                      </p>
                    </th>

                    <th>
                      <p style={{ margin: "0", textAlign: "end", }}>
                        1D Return
                      </p>
                    </th>

                    <th>
                      <p style={{ margin: "0", textAlign: "end", }}>
                        Total Return
                      </p>
                    </th>

                    <th>
                      <p style={{ margin: "0", textAlign: "end", }}>
                        Current Value
                      </p>
                    </th>

                    <th>
                      <p style={{ margin: "0", textAlign: "center", }}>
                        Action
                      </p>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {holdings.map((fund) => {
                    const todaysPnL = Number(fund.todaysPnL ?? 0);

                    const totalReturn = Number(fund.totalReturn ?? 0);

                    return (
                      <tr key={fund.id ?? fund.schemeId} onClick={() => setSelectedHolding(fund)} style={{ cursor: "pointer", }}>
                        {/* FUND */}

                        <td>
                          <div className="stock-name">
                            <strong>{fund.schemeName}</strong>

                            <span>{fund.fundHouse}</span>
                          </div>
                        </td>

                        {/* NAV */}

                        <td>
                          <p style={{ margin: "0", textAlign: "end", }}>
                            ₹{formatNumber(fund.currentNav)}
                          </p>
                        </td>

                        {/* 1D */}

                        <td>
                          <div className={todaysPnL >= 0 ? "profit" : "loss"}>
                            <p style={{ margin: "0", textAlign: "end", }}>
                              {formatMoney(todaysPnL)}
                            </p>
                          </div>

                          <small
                            className={
                              Number(fund.todaysReturnPercent) >= 0
                                ? "profit"
                                : "loss"
                            }
                          >
                            <p style={{ margin: "0", textAlign: "end", }}>
                              {formatPercent(fund.todaysReturnPercent)}
                            </p>
                          </small>
                        </td>

                        {/* TOTAL RETURN */}

                        <td>
                          <div className={totalReturn >= 0 ? "profit" : "loss"}>
                            <p style={{ margin: "0", textAlign: "end", }}>
                              {formatMoney(totalReturn)}
                            </p>
                          </div>

                          <small className={Number(fund.totalReturnPercent) >= 0 ? "profit" : "loss"}>
                            <p style={{ margin: "0", textAlign: "end", }}>
                              {formatPercent(fund.totalReturnPercent)}
                            </p>
                          </small>
                        </td>

                        {/* CURRENT VALUE */}

                        <td>
                          <p style={{ margin: "0", textAlign: "end", }}>
                            {formatMoney(fund.currentValue)}
                          </p>
                        </td>

                        {/* SELL */}

                        <td>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                            }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openSell(fund)}
                              style={{
                                border: "none",
                                borderRadius: "7px",
                                padding: "8px 18px",
                                background: "#e7f8f2",
                                color: "#00a878",
                                fontSize: "14px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Sell
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* =========================================================
            RIGHT SIDEBAR
        ========================================================== */}

        <div className="holding-sidebar">
          {selectedHolding ? (
            <div>
              <h2>{selectedHolding.schemeName}</h2>

              <h4>{selectedHolding.fundHouse}</h4>

              <hr />

              <div className="sidebar-row">
                <span>Units</span>

                <strong>{formatNumber(selectedHolding.units, 4)}</strong>
              </div>

              <div className="sidebar-row">
                <span>Current NAV</span>

                <strong>{formatMoney(selectedHolding.currentNav)}</strong>
              </div>

              <div className="sidebar-row">
                <span>Current Value</span>

                <strong>{formatMoney(selectedHolding.currentValue)}</strong>
              </div>

              <div className="sidebar-row">
                <span>Invested</span>

                <strong>{formatMoney(selectedHolding.investedAmount)}</strong>
              </div>

              <div className="sidebar-row">
                <span>1D Return</span>

                <strong
                  className={
                    Number(selectedHolding.todaysPnL) >= 0 ? "profit" : "loss"
                  }
                >
                  {formatMoney(selectedHolding.todaysPnL)}
                </strong>
              </div>

              <div className="sidebar-row">
                <span>Total Return</span>

                <strong
                  className={
                    Number(selectedHolding.totalReturn) >= 0 ? "profit" : "loss"
                  }
                >
                  {formatMoney(selectedHolding.totalReturn)}
                </strong>
              </div>

              <div className="sidebar-row">
                <span>1D %</span>

                <strong
                  className={
                    Number(selectedHolding.todaysReturnPercent) >= 0
                      ? "profit"
                      : "loss"
                  }
                >
                  {formatPercent(selectedHolding.todaysReturnPercent)}
                </strong>
              </div>

              <div className="sidebar-row">
                <span>Total %</span>

                <strong
                  className={
                    Number(selectedHolding.totalReturnPercent) >= 0
                      ? "profit"
                      : "loss"
                  }
                >
                  {formatPercent(selectedHolding.totalReturnPercent)}
                </strong>
              </div>

              <div className="sidebar-row">
                <span>NAV Date</span>

                <strong>{selectedHolding.navDate || "-"}</strong>
              </div>

              {/* SELL FROM SIDEBAR TOO */}

              <div
                style={{
                  marginTop: "20px",
                }}
              >
                <button
                  type="button"
                  onClick={() => openSell(selectedHolding)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: "7px",
                    padding: "10px",
                    background: "#e7f8f2",
                    color: "#00a878",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sell
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-sidebar">
              <h3>No Holdings</h3>

              <p>Your purchased mutual funds will appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================
          SELL MODAL
      ========================================================== */}

      {sellFund && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            if (!sellLoading) {
              closeSell();
            }
          }}
        >
          <div
            style={{
              width: "380px",
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            {/* HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "18px",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                  }}
                >
                  SELL
                </h3>

                <p
                  style={{
                    margin: "6px 0 0",
                    color: "#666",
                    fontSize: "13px",
                  }}
                >
                  {sellFund.schemeName}
                </p>

                <small
                  style={{
                    color: "#888",
                  }}
                >
                  {sellFund.fundHouse}
                </small>
              </div>

              <button
                type="button"
                onClick={closeSell}
                disabled={sellLoading}
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

            {/* NAV */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                fontSize: "13px",
              }}
            >
              <span>Current NAV</span>

              <strong>₹{formatNumber(sellFund.currentNav)}</strong>
            </div>

            {/* AVAILABLE UNITS */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              <span>Available Units</span>

              <strong>{formatNumber(sellFund.units, 8)}</strong>
            </div>

            {/* UNITS INPUT */}

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
              max={sellFund.units}
              step="0.00000001"
              value={sellUnits}
              onChange={(event) => setSellUnits(event.target.value)}
              placeholder="Enter units"
              disabled={sellLoading}
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

            {/* AUTOMATIC TOTAL */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "14px",
                fontSize: "14px",
              }}
            >
              <span
                style={{
                  color: "#777",
                }}
              >
                Total Amount
              </span>

              <strong>
                {formatMoney(
                  Number(sellUnits || 0) * Number(sellFund.currentNav || 0),
                )}
              </strong>
            </div>

            {/* ERROR */}

            {sellError && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "9px 10px",
                  borderRadius: "6px",
                  background: "#fff1f1",
                  color: "#dc2626",
                  fontSize: "12px",
                }}
              >
                {sellError}
              </div>
            )}

            {/* SUCCESS */}

            {sellSuccess && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "9px 10px",
                  borderRadius: "6px",
                  background: "#ecfdf5",
                  color: "#059669",
                  fontSize: "12px",
                }}
              >
                {sellSuccess}
              </div>
            )}

            {/* CONFIRM */}

            <button
              type="button"
              disabled={sellLoading || !sellUnits}
              onClick={submitSell}
              style={{
                width: "100%",
                marginTop: "18px",
                border: "none",
                borderRadius: "7px",
                padding: "11px",
                background: "#ef4444",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: sellLoading ? "not-allowed" : "pointer",
                opacity: sellLoading || !sellUnits ? 0.6 : 1,
              }}
            >
              {sellLoading ? "Processing..." : "Confirm SELL"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardSection1;
