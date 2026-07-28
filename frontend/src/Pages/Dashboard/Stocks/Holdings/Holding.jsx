import { useEffect, useState } from "react";
import axios from "axios";
import "./Holdings.css";
import dayjs from 'dayjs';

export default function Holdings() {

    const userId = "aede73db-8748-11f1-a02f-24fbe3bcdb12";

    const [summary, setSummary] = useState({
        currentValue: 0,
        totalInvestment: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        todaysPnL: 0,
    });

    const [holdings, setHoldings] = useState([]);
    const [selectedHolding, setSelectedHolding] = useState(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHoldings();
    }, []);

    async function fetchHoldings() {
        try {
            setLoading(true);

            const res = await axios.get(`http://localhost:3006/holdings/${userId}`);

            setSummary(res.data.summary || {
                currentValue: 0,
                totalInvestment: 0,
                totalReturn: 0,
                totalReturnPercent: 0,
                todaysPnL: 0,
            });

            setHoldings(res.data.holdings || []);

            if (res.data.holdings?.length > 0) {
                setSelectedHolding(res.data.holdings[0]);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    }

    // const formatMoney = (value) => {
    //     return Number(value || 0).toLocaleString("en-IN", {
    //         minimumFractionDigits: 2,
    //         maximumFractionDigits: 2,
    //     });
    // };


    const formatMoney = (value) => {
        const num = Number(value || 0);
        return `${num < 0 ? '-' : ''}₹${Math.abs(num).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    if (loading) {
        return <div className="holdings-loading">Loading...</div>;
    }

    return (
        <div className="holdings-page">
            <div className="holdings-content">

                {/* LEFT */}
                <div className="holdings-main">
                    {/* SUMMARY CARD */}
                    <div className="summary-card">
                        <div className="summary-top">
                            <div>
                                <p className="summary-label" style={{ margin: "0", marginBottom: ".5rem", fontSize: "1rem" }}>Current Value</p>
                                <h1 style={{ fontSize: "1.25rem", fontWeight: "500" }}>{formatMoney(summary.currentValue)}</h1>
                            </div>

                            <button className="analyse-btn">Analyse</button>
                        </div>

                        <div className="summary-grid">
                            <div>
                                <p style={{ margin: "0", textAlign: "start" }}>Invested Value</p>
                                <h4>{formatMoney(summary.totalInvestment)}</h4>
                            </div>


                            <div style={{ display: "flex", justifyContent: "space-between", gap: "5rem" }}>
                                <div>
                                    <p style={{ margin: 0, textAlign: "end" }}>1D Returns</p>
                                    <div className={summary.todaysPnL >= 0 ? "profit" : "loss"}>
                                        <h4>{formatMoney(summary.todaysPnL)}</h4>
                                        <h4>{summary.todaysReturnPercent.toFixed(2)}%</h4>
                                    </div>
                                </div>

                                <div>
                                    <p style={{ margin: "0", textAlign: "end" }}>Total Return</p>
                                    <div className={summary.totalReturn >= 0 ? "profit" : "loss"}>
                                        <h4>{summary.totalReturn < 0 ? `-₹${Math.abs(summary.totalReturn).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `₹${summary.totalReturn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</h4>
                                        <h4>{summary.totalReturnPercent.toFixed(2)}%</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLE */}
                    <div className="table-card">
                        <table>
                            <thead>
                                <tr>
                                    <th><p style={{ margin: "0" }}>Stock</p></th>
                                    <th><p style={{ margin: "0", textAlign: "end" }}>LTP</p></th>
                                    <th><p style={{ margin: "0", textAlign: "end" }}>Day Change</p></th>
                                    <th><p style={{ margin: "0", textAlign: "end" }}>Total Return</p></th>
                                    <th><p style={{ margin: "0", textAlign: "end" }}>Current Value</p></th>

                                </tr>
                            </thead>

                            <tbody>
                                {holdings.map((stock) => (
                                    <tr key={stock.holding_id} onClick={() => setSelectedHolding(stock)}>
                                        <td>
                                            <div className="stock-name">
                                                <strong>{stock.name}</strong>
                                                <span>{stock.symbol}</span>
                                            </div>
                                        </td>

                                        {/* <td>{stock.quantity}</td> */}

                                        {/* <td>{formatMoney(stock.average_price)}</td> */}

                                        <td><p style={{ margin: "0", textAlign: "end" }}>{formatMoney(stock.current_price)}</p></td>

                                        <td>
                                            <div className={stock.day_pnl >= 0 ? "profit" : "loss"}><p style={{ margin: "0", textAlign: "end" }}>{formatMoney(stock.day_pnl)}</p></div>

                                            <small className={stock.day_change_percent >= 0 ? "profit" : "loss"}>
                                                <p style={{ margin: "0", textAlign: "end" }}>
                                                    {stock.day_change_percent.toFixed(2)}%
                                                </p>
                                            </small>
                                        </td>

                                        <td>
                                            <div className={stock.total_return >= 0 ? "profit" : "loss"}>
                                                <p style={{ margin: "0", textAlign: "end" }}>
                                                    {formatMoney(stock.total_return)}
                                                </p>
                                            </div>

                                            <small className={stock.total_return >= 0 ? "profit" : "loss"}>
                                                <p style={{ margin: "0", textAlign: "end" }}>
                                                    {stock.total_return_percent.toFixed(2)}%
                                                </p>
                                            </small>
                                        </td>

                                        <td>
                                            <p style={{ margin: "0", textAlign: "end" }}>
                                                {formatMoney(stock.current_value)}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RIGHT PANEL */}
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

                            {/* <div className="sidebar-row">
                                <span>Average Price</span>
                                <strong>{formatMoney(selectedHolding.average_price)}</strong>
                            </div> */}

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
                                <strong className={selectedHolding.total_return >= 0 ? "profit" : "loss"}>
                                    {formatMoney(selectedHolding.total_return)}
                                </strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Today's P/L</span>
                                <strong className={selectedHolding.day_pnl >= 0 ? "profit" : "loss"}>
                                    {formatMoney(selectedHolding.day_pnl)}
                                </strong>
                            </div>

                            <div className="sidebar-row">
                                <span>Purchase Date</span>

                                <strong>{new Date(selectedHolding.purchase_date).toLocaleDateString('en-GB', {day: 'numeric', month: 'numeric', year: '2-digit'})}</strong>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-sidebar">
                            <h3>Select a holding</h3>
                            <p>Click any stock to see detailed information.</p>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}