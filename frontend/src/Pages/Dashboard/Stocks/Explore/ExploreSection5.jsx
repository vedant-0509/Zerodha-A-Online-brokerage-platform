import React, { useEffect, useState } from "react";
import axios from "axios";

import ExploreSection6 from "./ExploreSection6.jsx";

const AUTH_API = "http://localhost:3010";
const HOLDINGS_API = "http://localhost:3006";

export default function ExploreSection5() {
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");


    // GET LOGGED-IN USER
    useEffect(() => {
        loadUserHoldings();
    }, []);

    async function loadUserHoldings() {
        try {
            setLoading(true);
            setError("");


            // GET TOKEN
            const token = localStorage.getItem("token");

            if (!token) {
                setError("Please login first.");
                setLoading(false);
                return;
            }

            // GET CURRENT USER
            const userResponse = await axios.get(`${AUTH_API}/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });


            if (!userResponse.data.success) {
                setError("Unable to get user information.");
                setLoading(false);
                return;
            }

            const user = userResponse.data.user;


            // GET USER ID
            const userId = user.user_id;

            if (!userId) {
                setError("User ID not found.");
                setLoading(false);
                return;
            }


            // GET HOLDINGS FOR THAT USER
            const holdingsResponse = await axios.get(
                `${HOLDINGS_API}/holdings/${userId}`,
            );

            const data = holdingsResponse.data;

            // SET SUMMARY
            setSummary({
                currentValue: Number(data.summary?.currentValue || 0),
                totalInvestment: Number(data.summary?.totalInvestment || 0),
                totalReturn: Number(data.summary?.totalReturn || 0),
                totalReturnPercent: Number(data.summary?.totalReturnPercent || 0),
                todaysPnL: Number(data.summary?.todaysPnL || 0),
                todaysReturnPercent: Number(data.summary?.todaysReturnPercent || 0),
            });


            // SET HOLDINGS
            const userHoldings = data.holdings || [];
            setHoldings(userHoldings);


            // SELECT FIRST HOLDINg
            if (userHoldings.length > 0) {
                setSelectedHolding(userHoldings[0]);
            } else {
                setSelectedHolding(null);
            }
        } catch (err) {
            console.error("Failed to load holdings:", err);

            if (err.response?.status === 401) {
                // Invalid/expired JWT
                localStorage.removeItem("token");
                localStorage.removeItem("user");

                setError("Your session has expired. Please login again.");
            } else {
                setError(err.response?.data?.message || "Unable to load investments.");
            }
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


    // LOADING
    if (loading) {
        return (
            <div style={{ position: "sticky", top: "0", zIndex: "1", }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: "500", lineHeight: "1.5", color: "#424242", marginBottom: "1.2rem", marginTop: "0", }}>
                    Your's Investments
                </h2>

                <div style={{ border: "1px solid #e5e5e5", borderRadius: "20px", padding: "1.3rem", background: "#fff", marginBottom: "1.5rem", }}>
                    <p style={{ color: "#666", margin: 0, }}>
                        Loading investments...
                    </p>
                </div>
            </div>
        );
    }


    // ERROR
    if (error) {
        return (
            <div style={{ position: "sticky", top: "0", zIndex: "1", }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: "500", color: "#424242", marginBottom: "1.2rem", marginTop: "0", }}>
                    Your's Investments
                </h2>

                <div style={{ border: "1px solid #e5e5e5", borderRadius: "20px", padding: "1.3rem", background: "#fff", }}>
                    <p style={{ color: "#d9534f", margin: 0, }}>
                        {error}
                    </p>
                </div>
            </div>
        );
    }


    // MAIN UI
    return (
        <div style={{ position: "sticky", top: "0", left: "75%", zIndex: "1", }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "500", lineHeight: "1.5", color: "#424242", marginBottom: "1.2rem", marginTop: "0", }}>
                Your's Investments
            </h2>

            <div style={{ border: "1px solid #e5e5e5", borderRadius: "20px", padding: "1.3rem 1.3rem .4rem 1.3rem", background: "#fff", marginBottom: "1.5rem", }}>
                
                {/* CURRENT VALUE */}
                <p style={{ color: "#666", fontSize: "1rem", marginBottom: ".3rem", marginTop: "0", }}>
                    Current
                </p>

                <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#424242", }}>
                    {formatMoney(summary.currentValue)}
                </h1>

                <hr style={{ margin: "1rem 0", border: "none", borderTop: "1px dashed #ddd", }} />

                {/* 1D RETURNS */}
                <ExploreSection6 title="1D Returns" value={summary.todaysPnL} percent={summary.todaysReturnPercent} />

                {/* TOTAL RETURNS */}
                <ExploreSection6 title="Total Returns" value={summary.totalReturn} percent={summary.totalReturnPercent} />

                {/* INVESTED */}
                <ExploreSection6 title="Invested" value={summary.totalInvestment} />

                {/* CURRENT VALUE */}
                <ExploreSection6 title="Current Value" value={summary.currentValue} />
            </div>


            {holdings.length === 0 && (
                <div style={{ border: "1px solid #e5e5e5", borderRadius: "20px", padding: "1.3rem", background: "#fff", }}>
                    <p style={{ margin: 0, color: "#666", }}>
                        You don't have any investments yet.
                    </p>
                </div>
            )}
        </div>
    );
}
