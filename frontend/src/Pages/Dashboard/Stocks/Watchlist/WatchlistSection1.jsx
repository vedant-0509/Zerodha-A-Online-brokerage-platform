import React from 'react';

export default function WatchlistDashboard() {
    const stocks = [
        {
            name: "Canara Bank",
            price: "₹124.28",
            change: "-0.44 (0.35%)",
            volume: "1,36,52,920",
            perfPercent: "75%",
            icon: <div className="icon-badge text-blue">▲</div>,
        },
        {
            name: "Eternal",
            price: "₹310.65",
            change: "-1.15 (0.37%)",
            volume: "3,24,31,887",
            perfPercent: "85%",
            icon: <div className="circle-badge" />,
        },
        {
            name: "Tata Steel",
            price: "₹186.92",
            change: "-0.35 (0.19%)",
            volume: "1,37,69,746",
            perfPercent: "60%",
            icon: <div className="square-badge" />,
        },
    ];

    return (
        <div className="watchlist-container">
            {/* Header Navigation */}
            <div className="watchlist-nav">
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <button className="nav-btn active" style={{ fontSize: "1rem" }}>Vedant's Watchlist</button>
                </div>

                <div style={{ marginBottom: ".75rem" }}>
                    <button className="nav-btn action" style={{ fontSize: "1rem", padding: "0" }}>
                        <i class="fa-solid fa-plus" style={{ fontSize: "1rem", fontWeight: "600" }}></i>
                        <p style={{ margin: "0", fontSize: "1.1rem", fontWeight: "500" }}>Watchlist</p>
                    </button>
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
                                <p style={{ margin: "0", marginLeft: "1.25rem",color:"#777" }}>Company ({stocks.length})</p>
                            </th>
                            <th className="sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color:"#777" }}>Trend</p>
                            </th>
                            <th className="sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color:"#777" }}>Mkt Price<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color:"#777" }}>1D Change<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="sortable" style={{ width: "10%", color:"#777" }}>
                                <p style={{ margin: "0", textAlign: "center" }}>1D Volume<span className="sort-icon">⇅</span></p>
                            </th>
                            <th className="text-right sortable" style={{ width: "10%" }}>
                                <p style={{ margin: "0", textAlign: "center", color:"#777" }}>52W PERF</p>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {stocks.map((stock, index) => (
                            <tr key={index} className="table-row">
                                <td className="company-cell" style={{ width: "20%" }}>
                                    <div className="company-info">
                                        <p style={{ margin: "0", marginLeft: "1rem" }}>{stock.name}</p>
                                        {/* <span className="company-name">{stock.name}</span> */}
                                    </div>
                                </td>
                                <td style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        <svg className="trend-sparkline" viewBox="0 0 100 30">
                                            <path d="M0 25 L10 15 L20 20 L30 10 L40 18 L50 5 L60 12 L70 22 L80 15 L90 8 L100 12" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </p>
                                </td>

                                <td className="price-cell" style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        {stock.price}
                                    </p>
                                </td>

                                <td className="change-cell negative" style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        {stock.change}
                                    </p>
                                </td>

                                <td className="volume-cell" style={{ width: "10%" }}>
                                    <p style={{ margin: "0", textAlign: "center" }}>
                                        {stock.volume}
                                    </p>
                                </td>

                                <td className="perf-cell" style={{ width: "10%" }}>
                                    <div className="range-bar-container">
                                        <div className="range-bar">
                                            <div className="range-indicator" style={{ left: stock.perfPercent }} />
                                            <p className="label-low" style={{ margin: "0" }}>L</p>
                                            <p className="label-high" style={{ margin: "0" }}>H</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}