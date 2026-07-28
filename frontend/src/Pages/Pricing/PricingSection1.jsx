import React from "react";

export default function PricingSection1() {
    return (
        <>
            <h2 style={{ marginBottom: "0", fontWeight: "500", color: "#424242", textAlign: "center" }}>Charges</h2>
            <p style={{ color: "#424242", textAlign: "center", fontSize: "1.25rem" }}>List of all charges and taxes</p>

            <div style={{ display: "flex", justifyContent: 'space-between', alignItems: "center", marginTop: "2rem", marginBottom: "5rem", marginLeft: "2.5rem", marginRight: "2.5rem" }}>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "25.166rem" }}>
                    <img src="images/pricing0.jpg" style={{ width: "250px", height: "auto" }} />
                    <h2 style={{ color: "#424242", marginTop: "0", marginBottom: "1.4rem" }}>Free equity delivery</h2>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>All equity investments (NSE, BSE)</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>are absolutely free — ₹ 0 brokerage.</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "25.166rem" }}>
                    <img src="images/intradayTrades.jpg" style={{ width: "250px", height: "auto" }} />
                    <h2 style={{ color: "#424242", marginTop: "0", marginBottom: "1.4rem" }}>Intraday and F&O trades</h2>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>Flat ₹ 20 or 0.03% (whichever is lower) per</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>executed order on intraday trades across</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>equity, currency, and commodity trades.</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>Flat ₹20 on all option trades.</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "25.166rem" }}>
                    <img src="images/pricing0.jpg" style={{ width: "250px", height: "auto" }} />
                    <h2 style={{ color: "#424242", marginTop: "0", marginBottom: "1.4rem" }}>Free direct MF</h2>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>All direct mutual fund investments are</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>absolutely free — ₹ 0 commissions & DP</span>
                    <span style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "#666" }}>charges.</span>
                </div>
            </div>
        </>
    );
}