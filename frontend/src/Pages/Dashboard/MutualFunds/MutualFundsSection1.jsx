import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";


export default function MutualFundSection1() {
    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
                <div className="StocksSection1-div" style={{ display: "flex", alignItems: "center", gap: "3rem", height: "3rem", fontWeight: "500", marginTop: ".75rem", }}>
                    <NavLink to="/dashboard/mutualFunds/explore" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Explore
                    </NavLink>

                    <NavLink to="/dashboard/mutualFunds/dashboard" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Dashboard
                    </NavLink>
                </div>
            </div>
        </>
    );
}