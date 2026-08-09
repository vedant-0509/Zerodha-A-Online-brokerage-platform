import React, { useEffect, useState } from "react";
import axios from "axios";
import SearchModal from "../SearchModal";

export default function WatchlistSection1() {
    const [stocks, setStocks] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [error, setError] = useState("");


    // GET LOGGED-IN USER
    useEffect(() => {
        loadUser();
    }, []);

    async function loadUser() {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                setError("Please login first");
                setLoading(false);
                return;
            }

            const res = await axios.get("http://localhost:3010/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.data?.success && res.data?.user) {
                setUser(res.data.user);
                await fetchWatchlist(res.data.user.user_id);
            }
        } catch (err) {
            console.error("User Error:", err);
            setError(err.response?.data?.message || "Unable to get logged-in user");
            setLoading(false);
        }
    }


    // FETCH USER WATCHLIST
    async function fetchWatchlist(userId) {
        try {
            setLoading(true);
            const res = await axios.get(`http://localhost:3008/watchlist/${userId}`);

            setStocks(res.data?.stocks || []);
        } catch (err) {
            console.error("Watchlist Error:", err);
            setError(err.response?.data?.message || "Unable to fetch watchlist");
        } finally {
            setLoading(false);
        }
    }


    // ADD STOCK
    async function handleAddStock(stock) {
        try {
            if (!user?.user_id) {
                alert("Please login first");
                return;
            }

            const res = await axios.post("http://localhost:3008/watchlist", {
                userId: user.user_id,
                instrumentKey: stock.instrument_key,
            });

            if (res.data?.success) {
                // Close search
                setSearchOpen(false);
                // Refresh watchlist
                await fetchWatchlist(user.user_id);
            }
        } catch (err) {
            console.error("Add Stock Error:", err);
            alert(err.response?.data?.message || "Unable to add stock");
        }
    }


    // REMOVE STOCK
    async function handleRemoveStock(stock) {
        try {
            if (!user?.user_id) {
                return;
            }

            await axios.delete(
                `http://localhost:3008/watchlist/${user.user_id}/${encodeURIComponent(
                    stock.instrument_key,
                )}`,
            );

            await fetchWatchlist(user.user_id);
        } catch (err) {
            console.error("Remove Stock Error:", err);
        }
    }


    // FORMAT MONEY
    function formatMoney(value) {
        return `₹${Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    }


    // FORMAT VOLUME
    function formatVolume(value) {
        return Number(value || 0).toLocaleString("en-IN");
    }

    // 52 WEEK STYLE
    // Your current database has day_high/day_low.
    // Until you have 52-week high/low columns,
    // we use the available range.

    function RangeBar({ low, high, current }) {
        const min = Number(low || 0);
        const max = Number(high || 0);
        const price = Number(current || 0);
        const width = 130;
        let position = width / 2;

        if (max > min) {
            position = ((price - min) / (max - min)) * width;
            position = Math.max(5, Math.min(width - 5, position));
        }

        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", }}>
                <div style={{ position: "relative", width: `${width}px`, height: "20px", }}>
                    {/* LINE */}
                    <div style={{ position: "absolute", left: 0, right: 0, top: "9px", height: "3px", background: "#e5e7eb", }} />

                    {/* CURRENT */}
                    <div style={{ position: "absolute", left: `${position}px`, top: "3px", width: "5px", height: "15px", borderRadius: "3px", background: "#424242", transform: "translateX(-50%)", }} />
                </div>

                <div style={{ width: `${width}px`, display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#999", }}>
                    <span>L</span>

                    <span>H</span>
                </div>
            </div>
        );
    }


    // LOADING
    if (loading) {
        return (
            <div style={{ padding: "50px", textAlign: "center", color: "#777", }}>
                Loading watchlist...
            </div>
        );
    }


    // ERROR
    if (error && !user) {
        return (
            <div style={{ padding: "50px", textAlign: "center", color: "#dc2626", }}>
                {error}
            </div>
        );
    }


    // UI
    return (
        <div className="watchlist-container" style={{ border: "1px solid #e5e5e5", borderRadius: "24px", overflow: "hidden", background: "#fff", }}>
            {/* HEADER */}
            <div style={{ display: "flex", alignItems: "center", gap: "38px", height: "88px", padding: "0 28px", borderBottom: "1px solid #e5e5e5", }}>
                <button style={{ border: "none", background: "transparent", fontSize: "19px", fontWeight: "600", color: "#424242", cursor: "default", height: "100%", }}>
                    {user?.full_name ? `${user.full_name.split(" ")[0]}'s Watchlist` : "My Watchlist"}
                </button>

                <button onClick={() => setSearchOpen(true)} style={{ border: "none", background: "transparent", color: "#00b386", fontSize: "18px", cursor: "pointer", fontWeight: "500", }}>
                    + Watchlist
                </button>
            </div>


            {/* TOOLBAR */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 20px", borderBottom: "1px solid #e5e5e5", }}>

                {/* SEARCH */}
                <button onClick={() => setSearchOpen(true)} style={{ width: "400px", height: "50px", border: "1px solid #ddd", borderRadius: "9px", background: "#fff", display: "flex", alignItems: "center", padding: "0 15px", cursor: "text", color: "#777", fontSize: "16px", }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: "12px", }} />
                    Search your watchlist
                </button>


                {/* ACTIONS */}
                <div style={{ display: "flex", gap: "12px", }}>
                    <button onClick={() => setSearchOpen(true)} style={{ height: "50px", padding: "0 22px", border: "1px solid #ddd", borderRadius: "9px", background: "#fff", cursor: "pointer", fontSize: "15px", color: "#424242", }}>
                        <i className="fa-solid fa-plus" /> Add stocks
                    </button>

                    <button style={{ height: "50px", padding: "0 22px", border: "1px solid #ddd", borderRadius: "9px", background: "#fff", cursor: "pointer", fontSize: "15px", color: "#424242", }}>
                        <i className="fa-regular fa-pen-to-square" /> Edit
                    </button>
                </div>
            </div>

            {/* TABLE */}

            <div style={{ overflowX: "auto", }}>
                <table style={{ width: "100%", borderCollapse: "collapse", }}>
                    <thead>
                        <tr style={{ background: "#fafafa", }}>
                            <th style={{ padding: "18px", textAlign: "left", color: "#777", width: "25%", }}>
                                Company ({stocks.length})
                            </th>

                            <th style={{ padding: "18px", textAlign: "center", color: "#777", width: "10%" }}>
                                Mkt price
                            </th>

                            <th style={{ padding: "18px", textAlign: "center", color: "#777", width: "10%" }}>
                                1D change
                            </th>

                            <th style={{ width: "10%", padding: "18px", textAlign: "center", color: "#777", }}>
                                1D vol
                            </th>

                            <th style={{ padding: "18px", width: "10%", textAlign: "center", color: "#777", }}>
                                52W perf
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {stocks.map((stock) => {
                            const positive = Number(stock.change_percent) >= 0;

                            return (
                                <tr key={stock.watchlist_id} style={{ borderTop: "1px solid #eee", }}>

                                    {/* COMPANY */}
                                    <td style={{ padding: "20px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "14px", }}>
                                            <div>
                                                <div style={{ fontWeight: "600", color: "#424242", }}>
                                                    {stock.name}
                                                </div>

                                                <div style={{ fontSize: "12px", color: "#999", marginTop: "4px", }}>
                                                    {stock.symbol}
                                                </div>
                                            </div>
                                        </div>
                                    </td>


                                    {/* PRICE */}
                                    <td style={{ textAlign: "center", color: "#424242", }}>
                                        {formatMoney(stock.price)}
                                    </td>


                                    {/* CHANGE */}
                                    <td style={{ textAlign: "center", color: positive ? "#00a878" : "#ef4444", fontWeight: "600", }}>
                                        {positive ? "+" : ""}
                                        {formatMoney(stock.change_value)} ({positive ? "+" : ""}
                                        {Number(stock.change_percent).toFixed(2)}
                                        %)
                                    </td>


                                    {/* VOLUME */}
                                    <td style={{ textAlign: "center", color: "#424242", }}>
                                        {formatVolume(stock.volume)}
                                    </td>


                                    {/* RANGE */}
                                    <td style={{ width: "10%", paddingLeft: "0rem", paddingRight: "0rem", }}>
                                        {(() => {
                                            const low = Number(stock.day_low);
                                            const high = Number(stock.day_high);
                                            const current = Number(stock.current_price);
                                            const BAR_PADDING = 10;
                                            const DOT_SIZE = 12;
                                            const BAR_WIDTH = 130;
                                            const range = high - low;

                                            let currentPosition = range === 0 ? BAR_WIDTH / 2 : ((current - low) / range) * BAR_WIDTH;
                                            currentPosition = Math.max(DOT_SIZE / 2, Math.min(BAR_WIDTH - DOT_SIZE / 2, currentPosition));

                                            return (
                                                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", }}>
                                                    <div style={{ position: "relative", width: `${BAR_WIDTH + BAR_PADDING * 2}px`, height: "22px", }}>
                                                        {/* Base Line */}
                                                        <div style={{ position: "absolute", left: `${BAR_PADDING}px`, width: `${BAR_WIDTH}px`, top: "10px", height: "3px", background: "#000", }} />

                                                        {/* Low */}
                                                        <div style={{ position: "absolute", left: `${BAR_PADDING - 2}px`, top: "0px", width: "5px", height: "22px", background: "#ef4444", borderRadius: "3px", }} />

                                                        {/* High */}
                                                        <div style={{ position: "absolute", left: `${BAR_PADDING + BAR_WIDTH - 2}px`, top: "0px", width: "5px", height: "22px", background: "#16a34a", borderRadius: "3px", }} />

                                                        {/* Current Price */}
                                                        <div style={{ position: "absolute", left: `${BAR_PADDING + currentPosition - DOT_SIZE / 2}px`, top: "0px", width: "5px", height: "22px", borderRadius: "3px", background: "#000", }} />
                                                    </div>

                                                    <div style={{ width: "auto", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "3px", }}>
                                                        <p style={{ margin: "0", paddingRight: "6rem" }}>
                                                            {low}
                                                        </p>
                                                        <p style={{ margin: "0" }}>{high}</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>


            {/* EMPTY WATCHLIST */}
            {stocks.length === 0 && (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "#777", }}>
                    <div style={{ fontSize: "40px", marginBottom: "15px", }}>
                        🔭
                    </div>

                    <h3 style={{ margin: "0 0 8px", color: "#424242", }}>
                        No stocks in your watchlist
                    </h3>

                    <p>Search for stocks and add them to your watchlist.</p>

                    <button onClick={() => setSearchOpen(true)} style={{ marginTop: "15px", padding: "10px 20px", border: "none", borderRadius: "7px", background: "#00b386", color: "#fff", cursor: "pointer", }}>
                        Add stocks
                    </button>
                </div>
            )}


            {/* SEARCH MODAL */}
            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} onSelectStock={handleAddStock} />
        </div>
    );
}
