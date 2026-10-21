import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import axios from "axios";
import {
    invalidateDashboardCache,
    notifyDashboardDataChanged,
} from "../../../../utils/dashboardRequestCache";

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
    const [refreshing, setRefreshing] = useState(false);

    // SELL ORDER
    const [sellHolding, setSellHolding] = useState(null);
    const [sellQuantity, setSellQuantity] = useState("");
    const [sellLoading, setSellLoading] = useState(false);
    const [sellError, setSellError] = useState("");
    const [sellSuccess, setSellSuccess] = useState("");

    // LOAD LOGGED-IN USER

    useEffect(() => {
        loadUser();
    }, []);

    useEffect(() => {
        const handleDashboardChange = (event) => {
            const { type, source } = event.detail || {};
            if (!["trade", "all"].includes(type) || source === "holdings") return;

            invalidateDashboardCache();
            fetchHoldings({ silent: true, force: true });
        };

        window.addEventListener("dashboard:data-changed", handleDashboardChange);
        return () => window.removeEventListener("dashboard:data-changed", handleDashboardChange);
    }, []);

    async function loadUser() {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                setError("Please login first.");
                setLoading(false);
                return;
            }

            const res = await axios.get("/api/auth/me", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.data.success) {
                throw new Error("Unable to load user");
            }

            setUser(res.data.user);

            // Now load this user's holdings
            await fetchHoldings();
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
    async function fetchHoldings({ silent = false, force = false } = {}) {
        try {
            if (!silent) setLoading(true);
            setError("");

            const token = localStorage.getItem("token");

            const url = force ? `/api/holdings?__refresh=${Date.now()}` : "/api/holdings";
            const res = await axios.get(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

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
            if (!silent) setLoading(false);
        }
    }

    async function refreshHoldings() {
        if (refreshing) return;
        setRefreshing(true);
        invalidateDashboardCache();
        try {
            await fetchHoldings({ silent: true, force: true });
        } finally {
            setRefreshing(false);
        }
    }

    // SELL ORDER
    function openSell(stock, e) {
        e?.stopPropagation();

        setSellHolding(stock);
        setSellQuantity("");
        setSellError("");
        setSellSuccess("");
    }

    function closeSell() {
        if (sellLoading) return;

        setSellHolding(null);
        setSellQuantity("");
        setSellError("");
        setSellSuccess("");
    }

    async function submitSell(e) {
        e.preventDefault();

        if (!sellHolding) return;

        const quantity = Number(sellQuantity);
        const availableQuantity = Number(sellHolding.quantity);
        const instrumentKey =
            sellHolding.instrumentKey ||
            sellHolding.instrument_key ||
            sellHolding.instrumentId ||
            sellHolding.instrument_id;

        if (!instrumentKey) {
            setSellError("Instrument key is missing for this holding.");
            return;
        }

        if (!Number.isInteger(quantity) || quantity <= 0) {
            setSellError("Enter a valid quantity.");
            return;
        }

        if (quantity > availableQuantity) {
            setSellError(`You can sell maximum ${availableQuantity} shares.`);
            return;
        }

        setSellLoading(true);
        setSellError("");
        setSellSuccess("");

        try {
            const token = localStorage.getItem("token");

            const payload = {
                symbol: sellHolding.symbol,
                instrumentKey,
                transactionType: "SELL",
                quantity,
                orderType: "MARKET",
                product: "CNC",
            };

            const idempotencyKey =
                window.crypto?.randomUUID?.() ||
                `${Date.now()}-${Math.random().toString(36).slice(2)}`;

            const response = await axios.post("/api/detail-stock/order", payload, {
                timeout: 10000,
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    "Idempotency-Key": idempotencyKey,
                },
            });

            if (!response.data?.success) {
                throw new Error(response.data?.message || "Sell order failed.");
            }

            const result = response.data?.data || {};
            const executedQuantity = Number(result.quantity ?? quantity);
            const executedPrice = Number(
                result.price ?? sellHolding.current_price ?? 0,
            );

            setSellSuccess(
                `SELL order completed for ${executedQuantity} shares at ${formatMoney(executedPrice)}.`,
            );

            setSellQuantity("");

            // Refresh mounted portfolio sections after a successful simulated SELL.
            notifyDashboardDataChanged("trade", "holdings");
            await fetchHoldings({ force: true });

            setTimeout(() => {
                setSellHolding(null);
                setSellSuccess("");
            }, 1200);
        } catch (err) {
            console.error("Sell order error:", err);

            setSellError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Unable to place sell order.",
            );
        } finally {
            setSellLoading(false);
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
        return <div className="holdings-loading">Loading holdings...</div>;
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
                        <div className="summary-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                            <div>
                                <p className="summary-label" style={{ margin: "0", marginBottom: ".5rem", fontSize: "1rem", }}>
                                    Current Value
                                </p>

                                <h1 style={{ fontSize: "1.25rem", fontWeight: "500" }}>
                                    {formatMoney(summary.currentValue)}
                                </h1>
                            </div>
                            <button
                                type="button"
                                onClick={refreshHoldings}
                                disabled={refreshing}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "10px 14px", border: "1px solid #ddd", borderRadius: "9px", background: "#fff", color: "#424242", cursor: refreshing ? "wait" : "pointer", opacity: refreshing ? 0.7 : 1 }}
                            >
                                <RefreshCw size={16} />
                                {refreshing ? "Refreshing..." : "Refresh"}
                            </button>
                        </div>

                        <div className="summary-grid">
                            {/* INVESTED */}
                            <div>
                                <p style={{ margin: "0", textAlign: "start" }}>
                                    Invested Value
                                </p>

                                <h4>{formatMoney(summary.totalInvestment)}</h4>
                            </div>

                            {/* RETURNS */}

                            <div style={{ display: "flex", justifyContent: "space-between", gap: "5rem", }}>
                                {/* 1D */}

                                <div>
                                    <p style={{ margin: 0, textAlign: "end" }}>1D Returns</p>

                                    <div className={Number(summary.todaysPnL) >= 0 ? "profit" : "loss"}>
                                        <h4>{formatMoney(summary.todaysPnL)}</h4>

                                        <h4>{formatPercent(summary.todaysReturnPercent)}</h4>
                                    </div>
                                </div>

                                {/* TOTAL RETURN */}
                                <div>
                                    <p style={{ margin: "0", textAlign: "end" }}>Total Return</p>

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
                            <div style={{ padding: "3rem", textAlign: "center" }}>
                                <h3>No holdings yet</h3>

                                <p>Your purchased stocks will appear here.</p>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <p style={{ margin: "0" }}>Stock</p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end" }}>LTP</p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end" }}>
                                                Day Change
                                            </p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end" }}>
                                                Total Return
                                            </p>
                                        </th>

                                        <th>
                                            <p style={{ margin: "0", textAlign: "end" }}>
                                                Current Value
                                            </p>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {holdings.map((stock) => (
                                        <tr
                                            key={stock.holding_id}
                                            onClick={() => setSelectedHolding(stock)}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {/* STOCK */}
                                            <td>
                                                <div className="stock-name">
                                                    <strong>{stock.name}</strong>
                                                    <span>{stock.symbol}</span>
                                                </div>
                                            </td>

                                            {/* LTP */}
                                            <td>
                                                <p style={{ margin: "0", textAlign: "end" }}>
                                                    {formatMoney(stock.current_price)}
                                                </p>
                                            </td>

                                            {/* DAY CHANGE */}
                                            <td>
                                                <div className={Number(stock.day_pnl) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end" }}>
                                                        {formatMoney(stock.day_pnl)}
                                                    </p>
                                                </div>

                                                <small className={Number(stock.day_change_percent) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end" }}>
                                                        {formatPercent(stock.day_change_percent)}
                                                    </p>
                                                </small>
                                            </td>

                                            {/* TOTAL RETURN */}
                                            <td>
                                                <div className={Number(stock.total_return) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end" }}>
                                                        {formatMoney(stock.total_return)}
                                                    </p>
                                                </div>

                                                <small className={Number(stock.total_return) >= 0 ? "profit" : "loss"}>
                                                    <p style={{ margin: "0", textAlign: "end" }}>
                                                        {formatPercent(stock.total_return_percent)}
                                                    </p>
                                                </small>
                                            </td>

                                            {/* CURRENT VALUE */}
                                            <td>
                                                <p style={{ margin: "0", textAlign: "end" }}>
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

                {/* SELL MODAL */}
                {sellHolding && (
                    <div onClick={closeSell} style={{ position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.28)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, }}>
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: "475px", maxWidth: "calc(100vw - 56px)", background: "#fff", borderRadius: "15px", padding: "28px 30px 30px", boxSizing: "border-box", boxShadow: "0 18px 55px rgba(0, 0, 0, 0.20)", }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", }}>
                                <h2 style={{ margin: 0, fontSize: "23px", fontWeight: 600, color: "#111", }}>
                                    SELL
                                </h2>

                                <button
                                    type="button"
                                    onClick={closeSell}
                                    disabled={sellLoading}
                                    aria-label="Close sell dialog"
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        fontSize: "28px",
                                        lineHeight: 1,
                                        cursor: sellLoading ? "not-allowed" : "pointer",
                                        color: "#111",
                                        padding: "0 2px",
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            <div style={{ color: "#666", fontSize: "16px", lineHeight: 1.45, marginBottom: "22px", }}>
                                <div style={{ fontWeight: 500, color: "#555" }}>
                                    {sellHolding.name}
                                </div>
                                <div>{sellHolding.symbol}</div>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", }}>
                                <span style={{ color: "#444" }}>Current Price</span>
                                <strong style={{ color: "black", fontSize: "16px", fontWeight: "600" }}>
                                    {formatMoney(sellHolding.current_price)}
                                </strong>
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", }}>
                                <span style={{ color: "#444" }}>Available Quantity</span>
                                <strong style={{ color: "black", fontSize: "16px", fontWeight: "600" }}>
                                    {sellHolding.quantity}
                                </strong>
                            </div>

                            <form onSubmit={submitSell}>
                                <label style={{ display: "block", color: "#444444", fontSize: "15px", marginBottom: "7px", }}>
                                    Quantity
                                </label>

                                <input
                                    type="number"
                                    min="1"

                                    step="1"
                                    placeholder="Enter quantity"
                                    value={sellQuantity}
                                    onChange={(e) => setSellQuantity(e.target.value)}
                                    disabled={sellLoading}
                                    style={{
                                        width: "100%",
                                        height: "45px",
                                        boxSizing: "border-box",
                                        padding: "0 15px",
                                        border: "1px solid #ddd",
                                        borderRadius: "9px",
                                        fontSize: "17px",
                                        outline: "none",
                                        marginBottom: "20px",
                                        marginTop: "3px"
                                    }}
                                />

                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", }}>
                                    <span style={{ color: "#444444", fontSize: "15px" }}>
                                        Total Amount
                                    </span>

                                    <strong style={{ color: "black", fontSize: "16px", fontWeight: "600" }}>
                                        {formatMoney(Number(sellQuantity || 0) * Number(sellHolding.current_price || 0))}
                                    </strong>
                                </div>

                                {sellError && (
                                    <div style={{ background: "#fff0f0", border: "none", color: "#EF4444", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", fontSize: "14px", }}>
                                        {sellError}
                                    </div>
                                )}

                                {sellSuccess && (
                                    <div
                                        style={{
                                            background: "#edf9f3",
                                            border: "1px solid #c9efda",
                                            color: "#079447",
                                            borderRadius: "8px",
                                            padding: "10px 12px",
                                            marginBottom: "14px",
                                            fontSize: "14px",
                                        }}
                                    >
                                        {sellSuccess}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={sellLoading}
                                    style={{
                                        width: "100%",
                                        height: "50px",
                                        border: "none",
                                        borderRadius: "8px",
                                        background: sellLoading ? "#f59a9a" : "#EF4444",
                                        color: "#fff",
                                        fontSize: "17px",
                                        fontWeight: 700,
                                        cursor: sellLoading ? "not-allowed" : "pointer",
                                    }}
                                >
                                    {sellLoading ? "SELLING..." : "Confirm Sell"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

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
                                <span>1D Change</span>

                                <strong className={Number(selectedHolding.day_pnl) >= 0 ? "profit" : "loss"}>
                                    {formatMoney(selectedHolding.day_pnl)}
                                </strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Purchase Date</span>
                                <strong>{formatDate(selectedHolding.purchase_date)}</strong>
                            </div>

                            <button
                                type="button"
                                onClick={(e) => openSell(selectedHolding, e)}
                                style={{ width: "100%", marginTop: "24px", padding: "11px 16px", border: "none", borderRadius: "8px", background: "#EF4444", color: "white", fontWeight: 600, fontSize: "18px", cursor: "pointer", }}>
                                Sell
                            </button>
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