import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import ExploreSection6 from "./ExploreSection6.jsx"

export default function ExploreSection5() {
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

            setSummary(
                res.data.summary || {
                    currentValue: 0,
                    totalInvestment: 0,
                    totalReturn: 0,
                    totalReturnPercent: 0,
                    todaysPnL: 0,
                },
            );

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

    const formatMoney = (value) => {
        const num = Number(value || 0);
        return `${num < 0 ? "-" : ""}₹${Math.abs(num).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    return (
        <div style={{ display: "sticky", top: "0", left: "75%", zIndex: "-1" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "500", lineHeight: "1.5", color: "#424242", marginBottom: "1.2rem", marginTop:"0"}}            >
                Your's Investments
            </h2>

            <div style={{ border: "1px solid #e5e5e5", borderRadius: "20px", padding: "1.3rem 1.3rem .4rem 1.3rem", background: "#fff", marginBottom: "1.5rem", }}>
                <p style={{ color: "#666", fontSize: "1rem", marginBottom: ".3rem", marginTop:"0"}}>Current</p>

                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#424242", }}>{formatMoney(summary.currentValue)}</h1>

                <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px dashed #ddd", }} />

                <ExploreSection6 title="1D Returns" value={summary.todaysPnL} percent={summary.todaysReturnPercent} />
                <ExploreSection6 title="Total Returns" value={summary.totalReturn} percent={summary.totalReturnPercent} />
                <ExploreSection6 title="Invested" value={summary.totalInvestment} />
                <ExploreSection6 title="Current Value" value={summary.currentValue} />
            </div>
        </div>
    );
}
