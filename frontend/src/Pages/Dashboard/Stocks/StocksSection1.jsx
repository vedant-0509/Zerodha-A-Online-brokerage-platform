import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import axios from "axios";
import SearchModal from "./SearchModal";

export default function StocksSection1() {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);
    const [openSearch, setOpenSearch] = useState(false);

    useEffect(() => {
        if (search.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await axios.get(
                    `http://localhost:3001/search?q=${search}`
                );

                setResults(res.data);
            } catch (err) {
                console.log(err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
                <div className="StocksSection1-div" style={{ display: "flex", alignItems: "center", gap: "3rem", height: "3rem", fontWeight: "500", marginTop: ".75rem", }}>
                    <NavLink to="/dashboard/stocks/explore" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Explore
                    </NavLink>

                    <NavLink to="/dashboard/stocks/holdings" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Holdings
                    </NavLink>

                    <NavLink to="/dashboard/stocks/orders" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Orders
                    </NavLink>

                    <NavLink to="/dashboard/stocks/watchlist" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        Watchlist
                    </NavLink>

                    <NavLink to="/dashboard/stocks/detailStock" className={({ isActive }) => isActive ? "navlink active-link" : "navlink"}>
                        detailStock
                    </NavLink>
                </div>

                <div className="searchbar" style={{ marginLeft: "17rem", paddingTop: "1rem", position: "relative", }}>
                    <SearchModal open={openSearch} onClose={() => setOpenSearch(false)} />

                    <div className="searchbar" onClick={() => setOpenSearch(true)}>
                        <div style={{ border: "1px solid #ddd", padding: "12px", borderRadius: "8px", width: "350px", cursor: "pointer", }}>
                            <i className="fa-solid fa-magnifying-glass" style={{ marginRight: "10px", marginTop: ".2rem", }} />
                            Search Groww...
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}