// import React, { useEffect, useRef, useState } from "react";

// import axios from "axios";

// export default function SearchModal({ open, onClose, onSelectStock }) {
//   const [query, setQuery] = useState("");
//   const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const inputRef = useRef(null);
//   const modalRef = useRef(null);

//   // FOCUS
//   useEffect(() => {
//     if (open) {
//       setTimeout(() => {
//         inputRef.current?.focus();
//       }, 100);
//     }
//   }, [open]);

//   // RESET
//   useEffect(() => {
//     if (!open) {
//       setQuery("");
//       setResults([]);
//       setLoading(false);
//     }
//   }, [open]);

//   // SEARCH MARKET DATA
//   useEffect(() => {
//     if (!open) return;

//     const value = query.trim();

//     if (value.length < 2) {
//       setResults([]);
//       setLoading(false);
//       return;
//     }

//     const timer = setTimeout(async () => {
//       try {
//         setLoading(true);
//         const res = await axios.get("http://localhost:3008/search", { params: { q: value, } });

//         setResults(res.data?.results || []);
//       } catch (error) {
//         console.error("Search Error:", error);
//         setResults([]);
//       } finally { setLoading(false); }
//     }, 250);

//     return () => clearTimeout(timer);
//   }, [query, open]);

//   // OUTSIDE CLICK
//   useEffect(() => {
//     function handleClick(event) {
//       if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
//     }

//     if (open) document.addEventListener("mousedown", handleClick);

//     return () => {
//       document.removeEventListener("mousedown", handleClick);
//     };
//   }, [open, onClose]);

//   // SELECT
//   function selectStock(stock) {
//     onSelectStock(stock);
//     setQuery("");
//     setResults([]);
//     onClose();
//   }

//   // HIGHLIGHT
//   function highlight(text) {
//     if (!text) return "";
//     const search = query.trim();
//     if (!search) return text;

//     const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     const parts = text.split(new RegExp(`(${escaped})`, "gi"));

//     return parts.map((part, index) => {
//       if (part.toLowerCase() === search.toLowerCase()) return <strong key={index}>{part}</strong>;

//       return <span key={index}>{part}</span>;
//     });
//   }

//   if (!open) return null;

//   return (
//     <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.05)", }}>
//       <div ref={modalRef} style={{ position: "absolute", top: "120px", left: "50%", transform: "translateX(-50%)", width: "500px", background: "#fff", border: "1px solid #ddd", borderRadius: "10px", boxShadow: "0 10px 35px rgba(0,0,0,.15)", }}>
//         {/* SEARCH INPUT */}

//         <div style={{ padding: "14px" }}>
//           <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "8px", height: "48px", padding: "0 14px", }}>
//             <i className="fa-solid fa-magnifying-glass" style={{ color: "#777", marginRight: "10px" }} />

//             <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Stocks..." autoComplete="off" style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", }} />

//             {query && (
//               <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#777", }}
//                 onClick={() => { setQuery(""); setResults([]); }}>
//                 ×
//               </button>
//             )}
//           </div>
//         </div>

//         {/* SEARCH RESULTS */}

//         {query.trim().length >= 2 && (
//           <div style={{ borderTop: "1px solid #eee", maxHeight: "420px", overflowY: "auto", }}>
//             {/* LOADING */}
//             {loading && (
//               <div style={{ padding: "25px", textAlign: "center", color: "#777" }}>
//                 Searching...
//               </div>
//             )}

//             {/* NO RESULT */}
//             {!loading && results.length === 0 && (
//               <div style={{ padding: "30px", textAlign: "center", color: "#777" }}>
//                 No stocks found
//               </div>
//             )}

//             {/* RESULTS */}
//             {!loading &&
//               results.map((stock) => (
//                 <div
//                   style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer", borderBottom: "1px solid #f1f1f1", }}
//                   key={stock.instrument_key}
//                   onClick={() => selectStock(stock)}
//                   onMouseEnter={(e) => { e.currentTarget.style.background = "#f8f8f8"; }}
//                   onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
//                   {/* LEFT */}
//                   <div style={{ display: "flex", alignItems: "center" }}>
//                     <div style={{ width: "38px", height: "38px", border: "1px solid #ddd", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", }}>
//                       <i className="fa-solid fa-arrow-trend-up" />
//                     </div>

//                     <div style={{ marginLeft: "12px" }}>
//                       <div style={{ fontSize: "15px", fontWeight: "500", color: "#424242", }}>
//                         {highlight(stock.name)}
//                       </div>

//                       <div style={{ fontSize: "12px", color: "#999", marginTop: "3px", }}>
//                         Stock
//                         {" | "}
//                         {stock.symbol}
//                       </div>
//                     </div>
//                   </div>

//                   {/* RIGHT */}
//                   <div style={{ textAlign: "right" }}>
//                     <div style={{ fontSize: "13px", fontWeight: "500", color: "#424242", }}>
//                       ₹
//                       {Number(stock.price).toLocaleString("en-IN", {
//                         minimumFractionDigits: 2,
//                       })}
//                     </div>

//                     <div style={{ fontSize: "12px", color: Number(stock.change_percent) >= 0 ? "#00a878" : "#ef4444", }}>
//                       {Number(stock.change_percent) >= 0 ? "+" : ""}
//                       {Number(stock.change_percent).toFixed(2)}%
//                     </div>
//                   </div>
//                 </div>
//               ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
























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
        const res = await axios.get("/api/watchlist/search", { params: { q: value, } });

        setResults(res.data?.results || []);
      } catch (error) {
        console.error("Search Error:", error);
        setResults([]);
      } finally { setLoading(false); }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, open]);

  // OUTSIDE CLICK
  useEffect(() => {
    function handleClick(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
    }

    if (open) document.addEventListener("mousedown", handleClick);

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
      if (part.toLowerCase() === search.toLowerCase()) return <strong key={index}>{part}</strong>;

      return <span key={index}>{part}</span>;
    });
  }

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.05)", }}>
      <div ref={modalRef} style={{ position: "absolute", top: "120px", left: "50%", transform: "translateX(-50%)", width: "500px", background: "#fff", border: "1px solid #ddd", borderRadius: "10px", boxShadow: "0 10px 35px rgba(0,0,0,.15)", }}>
        {/* SEARCH INPUT */}

        <div style={{ padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: "8px", height: "48px", padding: "0 14px", }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: "#777", marginRight: "10px" }} />

            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Stocks..." autoComplete="off" style={{ flex: 1, border: "none", outline: "none", fontSize: "16px", }} />

            {query && (
              <button style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#777", }}
                onClick={() => { setQuery(""); setResults([]); }}>
                ×
              </button>
            )}
          </div>
        </div>

        {/* SEARCH RESULTS */}

        {query.trim().length >= 2 && (
          <div style={{ borderTop: "1px solid #eee", maxHeight: "420px", overflowY: "auto", }}>
            {/* LOADING */}
            {loading && (
              <div style={{ padding: "25px", textAlign: "center", color: "#777" }}>
                Searching...
              </div>
            )}

            {/* NO RESULT */}
            {!loading && results.length === 0 && (
              <div style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                No stocks found
              </div>
            )}

            {/* RESULTS */}
            {!loading &&
              results.map((stock) => (
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", cursor: "pointer", borderBottom: "1px solid #f1f1f1", }}
                  key={stock.instrument_key}
                  onClick={() => selectStock(stock)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f8f8f8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                  {/* LEFT */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ width: "38px", height: "38px", border: "1px solid #ddd", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", }}>
                      <i className="fa-solid fa-arrow-trend-up" />
                    </div>

                    <div style={{ marginLeft: "12px" }}>
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
                  <div style={{ textAlign: "right" }}>
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
