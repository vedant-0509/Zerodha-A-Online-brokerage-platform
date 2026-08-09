import { useEffect, useState } from "react";
import axios from "axios";
import "./Holdings.css";

export default function Holdings() {
    const [summary, setSummary] = useState({
        currentValue: 0,
        totalInvestment: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        todaysPnL: 0,
        todaysReturnPercent: 0,
    });

    const [holdings, setHoldings] = useState([]);
    const [selectedHolding, setSelectedHolding] = useState(null);

    const [user, setUser] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // LOAD LOGGED-IN USER

    useEffect(() => {
        loadUser();
    }, []);

    async function loadUser() {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                setError("Please login first.");
                setLoading(false);
                return;
            }

            const res = await axios.get("http://localhost:3010/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.data.success) {
                throw new Error("Unable to load user");
            }

            setUser(res.data.user);

            // Now load this user's holdings
            await fetchHoldings(res.data.user.user_id);
        } catch (err) {
            console.error("User loading error:", err);

            if (err.response?.status === 401) {
                localStorage.removeItem("token");

                setError("Session expired. Please login again.");
            } else {
                setError(err.response?.data?.message || "Unable to load account.");
            }

            setLoading(false);
        }
    }

    // LOAD HOLDINGS
    async function fetchHoldings(userId) {
        try {
            setLoading(true);

            const res = await axios.get(`http://localhost:3006/holdings/${userId}`);

            const data = res.data;

            setSummary(
                data.summary || {
                    currentValue: 0,
                    totalInvestment: 0,
                    totalReturn: 0,
                    totalReturnPercent: 0,
                    todaysPnL: 0,
                    todaysReturnPercent: 0,
                },
            );

            const userHoldings = data.holdings || [];

            setHoldings(userHoldings);

            if (userHoldings.length > 0) {
                setSelectedHolding(userHoldings[0]);
            } else {
                setSelectedHolding(null);
            }
        } catch (err) {
            console.error("Holdings loading error:", err);

            setError(err.response?.data?.message || "Unable to load holdings.");
        } finally {
            setLoading(false);
        }
    }


    // FORMAT MONEY
    const formatMoney = (value) => {
        const num = Number(value || 0);

        return `${num < 0 ? "-" : ""}₹${Math.abs(num).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };


    // FORMAT PERCENT
    const formatPercent = (value) => {
        const num = Number(value || 0);

        return `${num.toFixed(2)}%`;
    };


    // PURCHASE DATE
    const formatDate = (date) => {
        if (!date) {
            return "-";
        }

        return new Date(date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "numeric",
            year: "2-digit",
        });
    };


    // LOADING
    if (loading) {
        return <div className="holdings-loading">Loading holdings...</div>
    }


    // ERROR
    if (error) {
        return (
            <div className="holdings-loading">
                <h3>{error}</h3>

                {!user && <p>Please login to view your holdings.</p>}
            </div>
        );
    }


    // MAIN UI
    return (
        <div className="holdings-page">
            <div className="holdings-content">
                {/* LEFT */}
                <div className="holdings-main">
                    {/* SUMMARY */}
                    <div className="summary-card">
                        <div className="summary-top">
                            <div>
                                <p className="summary-label" style={{ margin: "0", marginBottom: ".5rem", fontSize: "1rem", }}>
                                    Current Value
                                </p>

                                <h1 style={{ fontSize: "1.25rem", fontWeight: "500", }}>
                                    {formatMoney(summary.currentValue)}
                                </h1>
                            </div>

                            <button className="analyse-btn">Analyse</button>
                        </div>

                        <div className="summary-grid">
                            {/* INVESTED */}
                            <div>
                                <p style={{ margin: "0", textAlign: "start", }}>
                                    Invested Value
                                </p>

                                <h4>{formatMoney(summary.totalInvestment)}</h4>
                            </div>

                            {/* RETURNS */}

                            <div style={{ display: "flex", justifyContent: "space-between", gap: "5rem", }}>
                                {/* 1D */}

                                <div>
                                    <p style={{ margin: 0, textAlign: "end", }}>
                                        1D Returns
                                    </p>

                                    <div className={Number(summary.todaysPnL) >= 0 ? "profit" : "loss"}>
                                        <h4>{formatMoney(summary.todaysPnL)}</h4>

                                        <h4>{formatPercent(summary.todaysReturnPercent)}</h4>
                                    </div>
                                </div>

                                {/* TOTAL RETURN */}
                                <div>
                                    <p style={{ margin: "0", textAlign: "end", }}>
                                        Total Return
                                    </p>

                                    <div className={Number(summary.totalReturn) >= 0 ? "profit" : "loss"}>
                                        <h4>{formatMoney(summary.totalReturn)}</h4>

                                        <h4>{formatPercent(summary.totalReturnPercent)}</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLE */}

                    <div className="table-card">
                        {holdings.length === 0 ? (
                            <div style={{ padding: "3rem", textAlign: "center", }}>
                                <h3>No holdings yet</h3>

                                <p>Your purchased stocks will appear here.</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th><p style={{ margin: "0" }}>Stock</p></th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end", }}>LTP</p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end", }}>Day Change</p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end", }}>Total Return</p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end", }}>Current Value</p>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {holdings.map((stock) => (
                                        <tr key={stock.holding_id} onClick={() => setSelectedHolding(stock)} style={{ cursor: "pointer", }}>

                                            {/* STOCK */}
                                            <td>
                                                <div className="stock-name">
                                                    <strong>{stock.name}</strong>
                                                    <span>{stock.symbol}</span>
                                                </div>
                                            </td>


                                            {/* LTP */}
                                            <td>
                                                <p style={{ margin: "0", textAlign: "end", }}>
                                                    {formatMoney(stock.current_price)}
                                                </p>
                                            </td>


                                            {/* DAY CHANGE */}
                                            <td>
                                                <div className={Number(stock.day_pnl) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end", }}>
                                                        {formatMoney(stock.day_pnl)}
                                                    </p>
                                                </div>

                                                <small className={Number(stock.day_change_percent) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end", }}>
                                                        {formatPercent(stock.day_change_percent)}
                                                    </p>
                                                </small>
                                            </td>


                                            {/* TOTAL RETURN */}
                                            <td>
                                                <div className={Number(stock.total_return) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end", }}>
                                                        {formatMoney(stock.total_return)}
                                                    </p>
                                                </div>

                                                <small className={Number(stock.total_return) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end", }}>
                                                        {formatPercent(stock.total_return_percent)}
                                                    </p>
                                                </small>
                                            </td>


                                            {/* CURRENT VALUE */}
                                            <td>
                                                <p style={{ margin: "0", textAlign: "end", }}>
                                                    {formatMoney(stock.current_value)}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>


                {/* RIGHT SIDEBAR */}
                <div className="holding-sidebar">
                    {selectedHolding ? (
                        <div>
                            <h2>{selectedHolding.symbol}</h2>
                            <h4>{selectedHolding.name}</h4>
                            <hr />

                            <div className="sidebar-row">
                                <span>Quantity</span>
                                <strong>{selectedHolding.quantity}</strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Current Price</span>
                                <strong>{formatMoney(selectedHolding.current_price)}</strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Current Value</span>
                                <strong>{formatMoney(selectedHolding.current_value)}</strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Total Return</span>

                                <strong className={Number(selectedHolding.total_return) >= 0 ? "profit" : "loss"}>
                                    {formatMoney(selectedHolding.total_return)}
                                </strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Today's P/L</span>

                                <strong className={Number(selectedHolding.day_pnl) >= 0 ? "profit" : "loss"}>
                                    {formatMoney(selectedHolding.day_pnl)}
                                </strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Purchase Date</span>
                                <strong>{formatDate(selectedHolding.purchase_date)}</strong>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-sidebar">
                            <h3>No Holdings</h3>
                            <p>Your purchased stocks will appear here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
