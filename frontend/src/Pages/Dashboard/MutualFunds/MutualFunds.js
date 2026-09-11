import { Routes, Route } from "react-router-dom";

import MutualFundWrapper from "./MutualFundsWrapper";
import Explore from "./Explore/Explore.js";
import Dashboard from "./Dashboard/Dashboard.js";

export default function MutualFund() {
    return (
        <>
            <MutualFundWrapper />

            <Routes>
                <Route index element={<Explore />} />
                <Route path="explore" element={<Explore />} />
                <Route path="dashboard" element={<Dashboard />} />
            </Routes>
        </>
    );
}
