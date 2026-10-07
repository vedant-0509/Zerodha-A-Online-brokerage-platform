import React, { useEffect, useRef, useState } from "react";
import { api } from "../../../api/client";

export default function SearchModal({ open, onClose, onSelectStock }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const value = query.trim();

    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);

        const res = await api.get("/stocks/search", {
          params: { q: value },
          signal: controller.signal,
        });

        const rows = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.results)
            ? res.data.results
            : [];

        setResults(rows);
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || controller.signal.aborted) {
          return;
        }

        console.error("Search Error:", error);
        setResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  useEffect(() => {
    function handleClick(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (open) document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  function selectStock(stock) {
    onSelectStock(stock);
    setQuery("");
    setResults([]);
    onClose();
  }

  function highlight(text) {
    if (!text) return "";

    const search = query.trim();
    if (!search) return text;

    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = String(text).split(new RegExp(`(${escaped})`, "gi"));

    return parts.map((part, index) => {
      if (part.toLowerCase() === search.toLowerCase()) {
        return <strong key={index}>{part}</strong>;
      }

      return <span key={index}>{part}</span>;
    });
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.05)",
      }}
    >
      <div
        ref={modalRef}
        style={{
          position: "absolute",
          top: "120px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "500px",
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: "10px",
          boxShadow: "0 10px 35px rgba(0,0,0,.15)",
        }}
      >
        <div style={{ padding: "14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ddd",
              borderRadius: "8px",
              height: "48px",
              padding: "0 14px",
            }}
          >
            <i
              className="fa-solid fa-magnifying-glass"
              style={{ color: "#777", marginRight: "10px" }}
            />

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Stocks..."
              autoComplete="off"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "16px",
              }}
            />

            {query && (
              <button
                type="button"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#777",
                }}
                onClick={() => {
                  setQuery("");
                  setResults([]);
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {query.trim().length >= 2 && (
          <div
            style={{
              borderTop: "1px solid #eee",
              maxHeight: "420px",
              overflowY: "auto",
            }}
          >
            {loading && (
              <div style={{ padding: "25px", textAlign: "center", color: "#777" }}>
                Searching...
              </div>
            )}

            {!loading && results.length === 0 && (
              <div style={{ padding: "30px", textAlign: "center", color: "#777" }}>
                No stocks found
              </div>
            )}

            {!loading &&
              results.map((stock) => (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid #f1f1f1",
                  }}
                  key={stock.instrument_key || stock.symbol}
                  onClick={() => selectStock(stock)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#f8f8f8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#fff";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#555",
                      }}
                    >
                      <i className="fa-solid fa-arrow-trend-up" />
                    </div>

                    <div style={{ marginLeft: "12px" }}>
                      <div
                        style={{
                          fontSize: "15px",
                          fontWeight: "500",
                          color: "#424242",
                        }}
                      >
                        {highlight(stock.name || stock.symbol)}
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#999",
                          marginTop: "3px",
                        }}
                      >
                        Stock{" | "}{stock.symbol}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "500",
                        color: "#424242",
                      }}
                    >
                      ₹
                      {Number(stock.price || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color:
                          Number(stock.change_percent || 0) >= 0
                            ? "#00a878"
                            : "#ef4444",
                      }}
                    >
                      {Number(stock.change_percent || 0) >= 0 ? "+" : ""}
                      {Number(stock.change_percent || 0).toFixed(2)}%
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
