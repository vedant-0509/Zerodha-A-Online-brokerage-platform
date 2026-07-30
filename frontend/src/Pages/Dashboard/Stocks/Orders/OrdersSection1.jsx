import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";


export default function OrdersSection1() {
    const userId = "aede73db-8748-11f1-a02f-24fbe3bcdb12";

    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        fetchOrders();
    }, []);

    async function fetchOrders() {
        try {
            const res = await axios.get(`http://localhost:3007/orders/${userId}`);

            setTransactions(res.data);
        } catch (err) {
            console.log(err);
        }
    }

    const formatMoney = (value) => {
        return `₹${Number(value).toLocaleString("en-IN")}`;
    };

    const statusDot = (status) => {
        if (status === "COMPLETED") {
            return "green";
        }

        if (status === "FAILED") {
            return "red";
        }

        return "orange";
    };

    return (
        <div className="history-page">
            <div className="filters">
                <button className="filter-btn">
                    Order Type
                    <ChevronDown size={16} />
                </button>

                <button className="filter-btn">
                    Status
                    <ChevronDown size={16} />
                </button>

                <button className="chip active">Purchase</button>
                <button className="chip">Redeem</button>
                <button className="chip">Failed</button>
                <button className="clear">Clear all</button>
            </div>

            {transactions.map((group) => (
                <div className="date-section" key={group.date} style={{ margin: ".5rem 1rem 2rem 1rem" }}>
                    <h3 className="date-heading" style={{ fontSize: "1.1rem" }}>{group.date}</h3>

                    <div className="transaction-table-wrapper" style={{ marginLeft: ".75rem" }}>
                        <table className="transaction-table">
                            <thead>
                                <tr>
                                    <th style={{ width: "50%" }}><p style={{ margin: "0", textAlign: "start", marginLeft: ".75rem" }}>Stocks</p></th>
                                    <th style={{ width: "10%" }}><p style={{ margin: "0", textAlign: "center" }}>Type</p></th>
                                    <th style={{ width: "10%" }}><p style={{ margin: "0", textAlign: "center" }}>Amount</p></th>
                                    <th style={{ width: "10%" }}><p style={{ margin: "0", textAlign: "center" }}>Time</p></th>
                                    <th style={{ width: "7%" }}><p style={{ margin: "0", textAlign: "center" }}>Status</p></th>
                                </tr>
                            </thead>

                            <tbody>
                                {group.items.map((item) => (
                                    <tr key={item.order_id}>
                                        <td className="fund-name"><p style={{ margin: "0", marginLeft: ".65rem" }}>{item.name}</p></td>

                                        <td><p style={{ margin: "0", textAlign: "center" }}>{item.type === "BUY" ? "One-time" : "Redeem"}</p></td>

                                        <td><p style={{ margin: "0", textAlign: "center" }}>{formatMoney(item.amount)}</p></td>

                                        <td><p style={{ margin: "0", textAlign: "center" }}>{item.time}</p></td>

                                        <td style={{ textAlign: "center" }}>
                                            <p style={{ margin: "0", textAlign: "end" }} className={`status-dot ${statusDot(item.status)}`}>
                                            </p>
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
