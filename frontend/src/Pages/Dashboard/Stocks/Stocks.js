import React from "react";
import { Routes, Route } from 'react-router-dom';

import StocksWrapper from "./StocksWrapper.jsx";

import Explore from './Explore/Explore.js';
import Holdings from './Holdings/Holdings.js';

export default function Stocks() {
    return (
        <>
            <StocksWrapper />
            <Routes>
                <Route index element={<Explore />} />
                <Route path="explore" element={<Explore />} />

                <Route path="holdings" element={<Holdings />} />
                
                {/* // <Route path="positions" element={<Temp />} />
                // <Route path="orders" element={<Temp />} />
                // <Route path="watchlist" element={<Temp />} /> */}
            </Routes>
        </>
    );
}
