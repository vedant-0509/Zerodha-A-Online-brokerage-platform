import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:3007";

export default function OrdersSection1() {
    const [transactions, setTransactions] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [typeFilter, setTypeFilter] = useState("ALL");

    const [statusFilter, setStatusFilter] = useState("ALL");


    /* FETCH ORDERS */
    useEffect(() => {
        fetchOrders();
    }, []);

    async function fetchOrders() {
        try {
            setLoading(true);
            setError("");

            const token = localStorage.getItem("token");


            /* USER NOT LOGGED IN */
            if (!token) {
                setError("Please login first.");
                setTransactions([]);
                return;
            }


            /* API REQUEST */
            const response = await axios.get(`${API_URL}/orders`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            setTransactions(Array.isArray(response.data) ? response.data : []);

        } catch (error) {
            console.error("Fetch Orders Error:", error);


            /* TOKEN EXPIRED */
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                setError("Your session has expired. Please login again.");
                return;
            }

            setError(error.response?.data?.message || "Unable to load orders.");

        } finally {
            setLoading(false);
        }
    }


    /* FILTER ORDERS */
    const filteredTransactions = useMemo(() => {
        return transactions
            .map((group) => ({
                ...group,

                items: group.items.filter((item) => {
                    const typeMatch = typeFilter === "ALL" || item.type === typeFilter;

                    const statusMatch =
                        statusFilter === "ALL" || item.status === statusFilter;

                    return typeMatch && statusMatch;
                }),
            }))

            .filter((group) => group.items.length > 0);

    }, [transactions, typeFilter, statusFilter]);


    /* MONEY FORMAT */
    const formatMoney = (value) => {
        const amount = Number(value || 0);

        return `₹${amount.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };


    /* STATUS DOT */
    const statusDot = (status) => {
        switch (status) {
            case "COMPLETED": return "green";
            case "FAILED": return "red";
            case "CANCELLED": return "red";
            case "PENDING": return "orange";
            default: return "orange";
        }
    };


    /* ORDER TYPE DISPLAY*/
    const formatOrderType = (type) => {
        if (type === "BUY") return "Purchase";
        if (type === "SELL") return "Redeem";
        return type;
    };


    /*CLEAR FILTERS*/
    const clearFilters = () => {
        setTypeFilter("ALL");
        setStatusFilter("ALL");
    };


    /*   LOADING   */
    if (loading) {
        return (
            <div className="history-page">
                <p>Loading orders...</p>
            </div>
        );
    }


    /* UI */
    return (
        <div className="history-page">
            {/*FILTERS*/}

            <div className="filters">
                {/* ORDER TYPE */}

                <div style={{ position: "relative", }}>
                    <button type="button" className="filter-btn">
                        Order Type
                        <ChevronDown size={16} />
                    </button>

                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", }}>
                        <option value="ALL">All</option>
                        <option value="BUY">Purchase</option>
                        <option value="SELL">Redeem</option>
                    </select>
                </div>


                {/* STATUS */}
                <div style={{ position: "relative", }}>
                    <button type="button" className="filter-btn">
                        Status
                        <ChevronDown size={16} />
                    </button>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", }}>
                        <option value="ALL">All</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="PENDING">Pending</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </div>


                {/* PURCHASE */}
                <button type="button" className={`chip ${typeFilter === "BUY" && statusFilter === "ALL" ? "active" : ""}`} onClick={() => { setTypeFilter("BUY"); setStatusFilter("ALL"); }}>
                    Purchase
                </button>


                {/* REDEEM */}
                <button type="button" className={`chip ${typeFilter === "SELL" && statusFilter === "ALL" ? "active" : ""}`} onClick={() => { setTypeFilter("SELL"); setStatusFilter("ALL"); }}>
                    Redeem
                </button>


                {/* FAILED */}
                <button type="button" className={`chip ${statusFilter === "FAILED" ? "active" : ""}`} onClick={() => { setTypeFilter("ALL"); setStatusFilter("FAILED"); }}>
                    Failed
                </button>


                {/* CLEAR */}
                <button type="button" className="clear" onClick={clearFilters}>
                    Clear all
                </button>
            </div>


            {/*ERROR*/}
            {error && (
                <div style={{ padding: "1rem", color: "#d32f2f", }}>
                    {error}
                </div>
            )}


            {/* NO ORDERS*/}
            {!error && filteredTransactions.length === 0 && (
                <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#777", }}>
                    No orders found.
                </div>
            )}


            {/*ORDERS*/}
            {filteredTransactions.map((group) => (
                <div className="date-section" key={group.date} style={{ margin: ".5rem 1rem 2rem 1rem", }}>
                    <h3 className="date-heading" style={{ fontSize: "1.1rem", }}>
                        {group.date}
                    </h3>

                    <div className="transaction-table-wrapper" style={{ marginLeft: ".75rem", }}>
                        <table className="transaction-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "50%", }}>
                                        <p style={{ margin: 0, textAlign: "start", marginLeft: ".75rem", }}>Stocks</p>
                                    </th>

                                    <th style={{ width: "10%", }}>
                                        <p style={{ margin: 0, textAlign: "center", }}>Type</p>
                                    </th>

                                    <th style={{ width: "10%", }}>
                                        <p style={{ margin: 0, textAlign: "center", }}>Amount</p>
                                    </th>

                                    <th style={{ width: "10%", }}>
                                        <p style={{ margin: 0, textAlign: "center", }}>Time</p>
                                    </th>

                                    <th style={{ width: "7%", }}>
                                        <p style={{ margin: 0, textAlign: "center", }}>Status</p>
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {group.items.map((item) => (
                                    <tr key={item.order_id}>
                                        <td className="fund-name">
                                            <p style={{ margin: 0, marginLeft: ".65rem", }}>{item.name}</p>
                                        </td>

                                        <td>
                                            <p style={{ margin: 0, textAlign: "center", }}>{formatOrderType(item.type)}</p>
                                        </td>

                                        <td>
                                            <p style={{ margin: 0, textAlign: "center", }}>{formatMoney(item.amount)}</p>
                                        </td>

                                        <td>
                                            <p style={{ margin: 0, textAlign: "center", }}>{item.time}</p>
                                        </td>

                                        <td style={{ textAlign: "center", }}>
                                            <p title={item.status} className={`status-dot ${statusDot(item.status)}`} style={{ margin: 0, textAlign: "end", }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}
