import React from "react";
import { Link } from "react-router-dom";


export default function DashboardSection1() {
    return (
        <>
            <div style={{ height: "3rem", display: "flex", justifyContent: "space-between", marginTop: "-2.5rem", marginBottom: ".5rem", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>

                    <div className="stocks-div">
                        <Link to="/dashboard/stocks" style={{ textDecoration: "none" }}>
                            <h2 style={{ margin: "0", fontSize: "1.5rem" }}>Stocks</h2>
                        </Link>
                    </div>

                    <div className="mutualfund-div">
                        <Link to="/dashboard/mutualFunds" style={{ textDecoration: "none" }}>
                            <h2 style={{ margin: "0", fontSize: "1.5rem" }}>Mutual Funds</h2>
                        </Link>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
                    {/* <div className="searchbar">
                        <div style={{ border: "2px solid black", padding: ".5rem", borderRadius: ".6rem", borderColor: "#dedede" }}>
                            <i style={{ color: "#dedede", paddingLeft: ".25rem", paddingRight: ".5rem", scale: "1.2" }} class="fa-solid fa-magnifying-glass"></i>
                            <input type="text" placeholder="Search Groww.." style={{ height: "1.2rem", border: "none", width: "15rem", fontSize: "1.1rem", color: "#474747" }} />
                        </div>
                    </div> */}

                    <div className="">notification</div>

                    <div className="">user icon</div>

                </div>
            </div>
        </>
    );
}