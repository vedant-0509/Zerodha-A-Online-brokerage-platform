import React, { useEffect, useRef, useState } from "react";

import axios from "axios";

export default function SearchModal({ open, onClose, onSelectStock }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const modalRef = useRef(null);

    // FOCUS
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    }, [open]);


    // RESET
    useEffect(() => {
        if (!open) {
            setQuery("");
            setResults([]);
            setLoading(false);
        }
    }, [open]);


    // SEARCH MARKET DATA
    useEffect(() => {
        if (!open) return;

        const value = query.trim();

        if (value.length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setLoading(true);

                const res = await axios.get("http://localhost:3008/search", {
                    params: {
                        q: value,
                    },
                });

                setResults(res.data?.results || []);
            } catch (error) {
                console.error("Search Error:", error);
                setResults([]);
                
            } finally {
                setLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [query, open]);


    // OUTSIDE CLICK
    useEffect(() => {
        function handleClick(event) {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        }

        if (open) {
            document.addEventListener("mousedown", handleClick);
        }

        return () => {
            document.removeEventListener("mousedown", handleClick);
        };
    }, [open, onClose]);


    // SELECT
    function selectStock(stock) {
        onSelectStock(stock);
        setQuery("");
        setResults([]);
        onClose();
    }


    // HIGHLIGHT
    function highlight(text) {
        if (!text) return "";

        const search = query.trim();

        if (!search) return text;

        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const parts = text.split(new RegExp(`(${escaped})`, "gi"));

        return parts.map((part, index) => {
            if (part.toLowerCase() === search.toLowerCase()) {
                return <strong key={index}>{part}</strong>;
            }

            return <span key={index}>{part}</span>;
        });
    }

    if (!open) return null;

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.05)", }}>
            <div ref={modalRef} style={{ position: "absolute", top: "120px", left: "50%", transform: "translateX(-50%)", width: "500px", background: "#fff", border: "1px solid #ddd", borderRadius: "10px", boxShadow: "0 10px 35px rgba(0,0,0,.15)", }}>
                {/* SEARCH INPUT */}

                <div style={{ padding: "14px", }}>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "8px", height: "48px", padding: "0 14px", }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ color: "#777", marginRight: "10px", }} />

                        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Stocks..." autoComplete="off" style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", }} />

                        {query && (
                            <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#777", }}
                                onClick={() => {
                                    setQuery("");

                                    setResults([]);
                                }}>
                                ×
                            </button>
                        )}
                    </div>
                </div>

                {/* SEARCH RESULTS */}

                {query.trim().length >= 2 && (
                    <div style={{ borderTop: "1px solid #eee", maxHeight: "420px", overflowY: "auto", }}>

                        {/* LOADING */}
                        {loading && (<div style={{ padding: "25px", textAlign: "center", color: "#777", }}>
                            Searching...
                        </div>
                        )}


                        {/* NO RESULT */}
                        {!loading && results.length === 0 && (
                            <div style={{ padding: "30px", textAlign: "center", color: "#777", }}>
                                No stocks found
                            </div>
                        )}


                        {/* RESULTS */}
                        {!loading &&
                            results.map((stock) => (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer", borderBottom: "1px solid #f1f1f1", }}
                                    key={stock.instrument_key}
                                    onClick={() => selectStock(stock)}

                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "#f8f8f8";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "#fff";
                                    }}>


                                    {/* LEFT */}
                                    <div style={{ display: "flex", alignItems: "center", }}>
                                        <div style={{ width: "38px", height: "38px", border: "1px solid #ddd", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", }}>
                                            <i className="fa-solid fa-arrow-trend-up" />
                                        </div>

                                        <div style={{ marginLeft: "12px", }}>
                                            <div style={{ fontSize: "15px", fontWeight: "500", color: "#424242", }}>
                                                {highlight(stock.name)}
                                            </div>

                                            <div style={{ fontSize: "12px", color: "#999", marginTop: "3px", }}>
                                                Stock
                                                {" | "}
                                                {stock.symbol}
                                            </div>
                                        </div>
                                    </div>


                                    {/* RIGHT */}
                                    <div style={{ textAlign: "right", }}>
                                        <div style={{ fontSize: "13px", fontWeight: "500", color: "#424242", }}>
                                            ₹
                                            {Number(stock.price).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                            })}
                                        </div>

                                        <div style={{ fontSize: "12px", color: Number(stock.change_percent) >= 0 ? "#00a878" : "#ef4444", }}>
                                            {Number(stock.change_percent) >= 0 ? "+" : ""}
                                            {Number(stock.change_percent).toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </div>
    );
}































// import { useEffect, useState } from "react";
// import axios from "axios";

// export default function SearchModal({ open, onClose }) {
//     const [query, setQuery] = useState("");
//     const [results, setResults] = useState([]);
//     const [loading, setLoading] = useState(false);

//     // Get logged-in user's ID
//     const getUserId = () => {
//         try {
//             const user = JSON.parse(localStorage.getItem("user"));

//             if (user?.user_id) {
//                 return user.user_id;
//             }

//             const storedUserId = localStorage.getItem("userId");

//             if (storedUserId) {
//                 return storedUserId;
//             }

//             return null;
//         } catch (error) {
//             console.error("User ID Error:", error);
//             return localStorage.getItem("userId");
//         }
//     };

//     const userId = getUserId();

//     useEffect(() => {
//         if (!open) {
//             setQuery("");
//             setResults([]);
//             return;
//         }

//         // ------------------------------------
//         // SHOW USER WATCHLIST AT START
//         // ------------------------------------
//         const fetchWatchlist = async () => {
//             if (!userId) {
//                 console.log("User ID not found");
//                 setResults([]);
//                 return;
//             }

//             try {
//                 setLoading(true);

//                 const res = await axios.get(
//                     `http://localhost:3008/watchlist/${userId}`
//                 );

//                 const watchlist = res.data || [];

//                 // Convert watchlist response to same format
//                 // expected by this component
//                 const formatted = watchlist.map((stock) => ({
//                     instrument_key: stock.instrument_key,
//                     name: stock.instrument_name,
//                     symbol:
//                         stock.trading_symbol ||
//                         stock.symbol ||
//                         stock.instrument_key,
//                     exchange: stock.exchange,
//                     isWatchlist: true,
//                 }));

//                 setResults(formatted);
//             } catch (err) {
//                 console.error("Watchlist Fetch Error:", err);
//                 setResults([]);
//             } finally {
//                 setLoading(false);
//             }
//         };

//         fetchWatchlist();
//     }, [open, userId]);

//     // ------------------------------------
//     // SEARCH MARKET STOCKS
//     // ------------------------------------
//     useEffect(() => {
//         if (!open) {
//             return;
//         }

//         // No search query -> show watchlist
//         if (query.trim().length === 0) {
//             const fetchWatchlist = async () => {
//                 if (!userId) return;

//                 try {
//                     const res = await axios.get(
//                         `http://localhost:3008/watchlist/${userId}`
//                     );

//                     const formatted = (res.data || []).map((stock) => ({
//                         instrument_key: stock.instrument_key,
//                         name: stock.instrument_name,
//                         symbol:
//                             stock.trading_symbol ||
//                             stock.symbol ||
//                             stock.instrument_key,
//                         exchange: stock.exchange,
//                         isWatchlist: true,
//                     }));

//                     setResults(formatted);
//                 } catch (err) {
//                     console.error(err);
//                     setResults([]);
//                 }
//             };

//             fetchWatchlist();
//             return;
//         }

//         // Don't search for one character
//         if (query.trim().length < 2) {
//             setResults([]);
//             return;
//         }

//         const timer = setTimeout(async () => {
//             try {
//                 setLoading(true);

//                 const res = await axios.get(
//                     "http://localhost:3001/search",
//                     {
//                         params: {
//                             q: query.trim(),
//                         },
//                     }
//                 );

//                 setResults(res.data || []);
//             } catch (err) {
//                 console.error("Search Error:", err);
//                 setResults([]);
//             } finally {
//                 setLoading(false);
//             }
//         }, 250);

//         return () => clearTimeout(timer);
//     }, [query, open, userId]);

//     // ------------------------------------
//     // ADD STOCK TO WATCHLIST
//     // ------------------------------------
//     const addToWatchlist = async (stock) => {
//         if (!userId) {
//             alert("Please login first.");
//             return;
//         }

//         try {
//             await axios.post(
//                 "http://localhost:3008/watchlist",
//                 {
//                     user_id: userId,
//                     instrument_key: stock.instrument_key,
//                 }
//             );

//             console.log("Added to watchlist:", stock.instrument_key);

//             // Close modal after successful addition
//             onClose();

//         } catch (err) {
//             console.error("Add Watchlist Error:", err);

//             if (
//                 err.response?.status === 409 ||
//                 err.response?.data?.message
//                     ?.toLowerCase()
//                     .includes("already")
//             ) {
//                 console.log("Stock already exists in watchlist");
//                 onClose();
//                 return;
//             }

//             alert(
//                 err.response?.data?.message ||
//                 "Unable to add stock to watchlist"
//             );
//         }
//     };

//     if (!open) return null;

//     return (
//         <div className="search-overlay" onClick={onClose}>
//             <div
//                 className="search-modal"
//                 onClick={(e) => e.stopPropagation()}
//             >

//                 <div className="search-input">
//                     <i className="fa-solid fa-magnifying-glass"></i>

//                     <input
//                         autoFocus
//                         placeholder="Search Stocks..."
//                         value={query}
//                         onChange={(e) => setQuery(e.target.value)}
//                     />
//                 </div>

//                 <div className="search-results">

//                     {loading && (
//                         <div
//                             style={{
//                                 textAlign: "center",
//                                 padding: "1rem",
//                             }}
//                         >
//                             Searching...
//                         </div>
//                     )}

//                     {!loading &&
//                         results.length === 0 &&
//                         query.length >= 2 && (
//                             <div
//                                 style={{
//                                     textAlign: "center",
//                                     padding: "1rem",
//                                 }}
//                             >
//                                 No stocks found
//                             </div>
//                         )}

//                     {!loading &&
//                         results.map((stock) => (

//                             <div
//                                 key={stock.instrument_key}
//                                 className="result"
//                                 onClick={() => addToWatchlist(stock)}
//                             >

//                                 <div>

//                                     <div
//                                         style={{
//                                             height: "2.5rem",
//                                             width: "2.5rem",
//                                             border: "2px solid balck",
//                                             borderRadius: "50%",
//                                             backgroundColor: "#f7f7f7",
//                                             alignItems: "center",
//                                             justifyContent: "center",
//                                             marginLeft: ".5rem",
//                                         }}
//                                     >

//                                         <div
//                                             style={{
//                                                 fontSize: ".9rem",
//                                                 color: "#4f4f4f",
//                                             }}
//                                         >
//                                             <i className="fa-solid fa-arrow-trend-up"></i>
//                                         </div>

//                                     </div>

//                                     <div
//                                         style={{
//                                             display: "flex",
//                                             flexDirection: "column",
//                                             marginLeft: "1.5rem",
//                                             alignItems: "baseline",
//                                         }}
//                                     >

//                                         <div className="name">
//                                             {stock.name}
//                                         </div>

//                                         <div className="symbol">
//                                             Stock |{" "}
//                                             {(
//                                                 stock.symbol ||
//                                                 stock.trading_symbol ||
//                                                 stock.instrument_key
//                                             ).split(".")[0]}
//                                         </div>

//                                     </div>

//                                 </div>

//                                 <div
//                                     style={{
//                                         alignItems: "center",
//                                     }}
//                                 >

//                                     <div
//                                         className="exchange"
//                                         style={{
//                                             cursor: "default",
//                                         }}
//                                     >

//                                         <p
//                                             style={{
//                                                 margin: "0",
//                                                 padding: "1px",
//                                             }}
//                                         >

//                                             {stock.instrument_key?.split(
//                                                 "|"
//                                             )[0] === "NSE_EQ" ? (

//                                                 <img
//                                                     style={{
//                                                         height: "1.2rem",
//                                                         width: "auto",
//                                                         paddingTop: "1px",
//                                                     }}
//                                                     src="/images/nselogo.png"
//                                                     alt="NSE Logo"
//                                                 />

//                                             ) : (

//                                                 <img
//                                                     style={{
//                                                         height: ".65rem",
//                                                         width: "auto",
//                                                     }}
//                                                     src="/images/bselogo.png"
//                                                     alt="BSE Logo"
//                                                 />

//                                             )}

//                                         </p>

//                                     </div>

//                                     <div
//                                         style={{
//                                             height: "2.5rem",
//                                             width: "2.5rem",
//                                             alignItems: "center",
//                                             justifyContent: "center",
//                                             marginLeft: ".56rem",
//                                             fontSize: ".9rem",
//                                             color: "#4f4f4f",
//                                             marginRight: ".35rem",
//                                         }}
//                                     >

//                                         <i
//                                             className={
//                                                 stock.isWatchlist
//                                                     ? "fa-solid fa-bookmark"
//                                                     : "fa-regular fa-bookmark"
//                                             }
//                                         ></i>

//                                     </div>

//                                 </div>

//                             </div>

//                         ))}

//                 </div>
//             </div>
//         </div>
//     );
// }