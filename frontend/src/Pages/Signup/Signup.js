import React from "react";
import { Routes, Route } from 'react-router-dom';


import SignupWrapper from "./SignupWrapper.jsx";
// import Stock from './Stocks/Stocks.js';
// import MutualFunds from './MutualFunds/MutualFunds.js';


export default function Signup() {
    return (
        <>
            <SignupWrapper />
            {/* <Routes>
                <Route path="stocks/*" element={<Stock />} />
                <Route path="mutualFunds" element={<MutualFunds />} />
            </Routes> */}
        </>
    );
}