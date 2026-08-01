import React, { useEffect, useState } from "react";
import axios from "axios";

export default function WatchlistDashboard() {
    const [stocks, setStocks] = useState([]);
    const userId = "aede73db-8748-11f1-a02f-24fbe3bcdb12";

    useEffect(() => {
        axios
            .get(`http://localhost:3008/watchlist/${userId}`)
            .then((res) => {
                setStocks(res.data);
            })
            .catch(console.error);
    }, []);

    return (
        <div className="watchlist-container">
            {/* Header Navigation */}
            <div className="watchlist-nav">
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <button className="nav-btn active" style={{ fontSize: "1rem" }}>Vedant's Watchlist</button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="watchlist-toolbar">
                <div className="searchbar">
                    <div style={{ border: "1px solid #ddd", padding: "12px", borderRadius: "8px", width: "350px", cursor: "pointer" }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ marginRight: "5px" }} />
                        <input type="text" placeholder='Search your watchlist' style={{ fontSize: "1rem", border: "none", width: "100%" }} />
                    </div>
                </div>

                <div className="toolbar-actions" style={{ width: "auto" }}>
                    <div>
                        <button className="btn btn-secondary">
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: ".45rem .2rem .45rem .2rem" }}>
                                <i class="fa-solid fa-plus" style={{ fontSize: ".85rem", fontWeight: "600" }}></i>
                                <p style={{ margin: "0", paddingLeft: ".35rem", fontWeight: "500" }}>Add stocks</p>
                            </div>
                        </button>
                    </div>
                    <div>
                        <button className="btn btn-secondary">
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: ".45rem .2rem .45rem .2rem" }}>
                                <i style={{ fontSize: ".95rem", fontWeight: "600" }} class="fa-regular fa-pen-to-square"></i>
                                <p style={{ margin: "0", paddingLeft: ".35rem", fontWeight: "500" }}>Edit</p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
                <table className="watchlist-table">
                    <thead>
                        <tr>
                            <th className="sortable text-left" style={{ width: "20%" }}>
                                <p style={{ margin: "0", marginLeft: "1.25rem", color: "#777" }}>Company ({stocks.length})</p>
                            </th>
                            <th className="sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color: "#777" }}>Mkt Price<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color: "#777" }}>1D Change<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="sortable" style={{ width: "10%", color: "#777" }}>
                                <p style={{ margin: "0", textAlign: "center" }}>1D Volume<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="text-right sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color: "#777" }}>52W PERF</p>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock, index) => (

                            <tr key={index} className="table-row">
                                <td className="company-cell" style={{ width: "20%" }}>
                                    <div className="company-info">
                                        <p style={{ margin: "0", marginLeft: "1rem" }}>{stock.instrument_name}</p>
                                    </div>
                                </td>

                                <td className="price-cell" style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        ₹{stock.current_price}
                                    </p>
                                </td>

                                <td className="change-cell" style={{ width: "10%", color: stock.change_percent >= 0 ? "#16a34a" : "#dc2626", fontWeight: "600", }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        {stock.change_percent >= 0 ? "+" : ""}
                                        {Number(stock.change_percent).toFixed(2)}%
                                    </p>
                                </td>

                                <td className="volume-cell" style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        {Number(stock.volume).toLocaleString()}
                                    </p>
                                </td>

                                <td style={{ width: "10%", paddingLeft: "0rem", paddingRight: "0rem" }}>
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

                                                <div style={{ position: "relative", width: `${BAR_WIDTH + BAR_PADDING * 2}px`, height: "22px" }}>
                                                    {/* Base Line */}
                                                    <div style={{ position: "absolute", left: `${BAR_PADDING}px`, width: `${BAR_WIDTH}px`, top: "10px", height: "3px", background: "#000" }} />

                                                    {/* Low */}
                                                    <div style={{ position: "absolute", left: `${BAR_PADDING - 2}px`, top: "0px", width: "5px", height: "22px", background: "#ef4444", borderRadius: "3px" }} />

                                                    {/* High */}
                                                    <div style={{ position: "absolute", left: `${BAR_PADDING + BAR_WIDTH - 2}px`, top: "0px", width: "5px", height: "22px", background: "#16a34a", borderRadius: "3px" }} />

                                                    {/* Current Price */}
                                                    <div style={{ position: "absolute", left: `${BAR_PADDING + currentPosition - DOT_SIZE / 2}px`, top: "0px", width: "5px", height: "22px", borderRadius: "3px", background: "#000" }} />
                                                </div>

                                                <div style={{ width: "auto", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "3px", }}>
                                                    <p style={{ margin: "0", paddingRight: "6rem" }}>{low}</p>
                                                    <p style={{ margin: "0" }}>{high}</p>
                                                </div>

                                            </div>
                                        );
                                    })()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >
        </div >
    );
}