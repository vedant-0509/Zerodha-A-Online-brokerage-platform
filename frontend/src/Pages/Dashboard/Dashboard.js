import React from "react";
import { Routes, Route } from 'react-router-dom';


import DashboardWrapper from "./DashboardWrapper.jsx";
import Stock from './Stocks/Stocks.js';
import MutualFunds from './MutualFunds/MutualFunds.js';


export default function Dashboard() {
    return (
        <>
            <DashboardWrapper />
            <Routes>
                <Route path="stocks/*" element={<Stock />} />
                <Route path="mutualFunds" element={<MutualFunds />} />
            </Routes>
        </>
    );
}