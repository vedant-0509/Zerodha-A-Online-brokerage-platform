import React from "react";
import StockDashboard from "./StockDashboard.jsx";

export default function DetailStockWrapper() {
    return (
        <>
            <div className="home" style={{ paddingTop: "1.5rem" }}>
                <StockDashboard />
            </div>
        </>
    );
}