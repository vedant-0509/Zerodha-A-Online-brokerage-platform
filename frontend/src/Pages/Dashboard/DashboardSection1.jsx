// import React from "react";
// import { Link } from "react-router-dom";

// export default function DashboardSection1() {
//     return (
//         <>
//             <div style={{ height: "3rem", display: "flex", justifyContent: "space-between", marginTop: "-2.5rem", marginBottom: ".5rem", alignItems: "center" }}>
//                 <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>

//                     <div className="stocks-div">
//                         <Link to="/dashboard/stocks" style={{ textDecoration: "none" }}>
//                             <h2 style={{ margin: "0", fontSize: "1.5rem" }}>Stocks</h2>
//                         </Link>
//                     </div>

//                     <div className="mutualfund-div">
//                         <Link to="/dashboard/mutualFunds" style={{ textDecoration: "none" }}>
//                             <h2 style={{ margin: "0", fontSize: "1.5rem" }}>Mutual Funds</h2>
//                         </Link>
//                     </div>
//                 </div>

//                 <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>

//                     <div className="">notification</div>

//                     <div className="">user icon</div>

//                 </div>
//             </div>
//         </>
//     );
// }

import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

export default function DashboardSection1() {
    const location = useLocation();

    const pathname = location.pathname.toLowerCase();

    const isStocks = pathname.startsWith("/dashboard/stocks");

    const isMutualFunds = pathname.startsWith("/dashboard/mutualfunds");

    return (
        <>
            {/* =========================================================
                TOP DASHBOARD HEADER
            ========================================================= */}
            <div
                style={{
                    height: "3rem",
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: "-2.5rem",
                    marginBottom: ".5rem",
                    alignItems: "center",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "2rem",
                        alignItems: "center",
                    }}
                >
                    <div className="stocks-div">
                        <Link
                            to="/dashboard/stocks"
                            style={{
                                textDecoration: "none",
                            }}
                        >
                            <h2
                                style={{
                                    margin: "0",
                                    fontSize: "1.5rem",
                                }}
                            >
                                Stocks
                            </h2>
                        </Link>
                    </div>

                    <div className="mutualfund-div">
                        <Link
                            to="/dashboard/mutualFunds"
                            style={{
                                textDecoration: "none",
                            }}
                        >
                            <h2
                                style={{
                                    margin: "0",
                                    fontSize: "1.5rem",
                                }}
                            >
                                Mutual Funds
                            </h2>
                        </Link>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "2rem",
                        alignItems: "center",
                    }}
                >
                    <div className="">notification</div>

                    <div className="">user icon</div>
                </div>
            </div>

            {/* =========================================================
                STOCKS TABS
            ========================================================= */}
            {isStocks && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3.8rem",
                        borderBottom: "1px solid #eeeeee",
                        marginTop: "1.5rem",
                        marginBottom: "3rem",
                    }}
                >
                    <NavLink
                        to="/dashboard/stocks"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Explore
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/dashboard/stocks/holdings"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Holdings
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/dashboard/stocks/orders"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Orders
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/dashboard/stocks/watchlist"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Watchlist
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>
                </div>
            )}

            {/* =========================================================
                MUTUAL FUNDS TABS
            ========================================================= */}
            {isMutualFunds && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3.8rem",
                        borderBottom: "1px solid #eeeeee",
                        marginTop: "1.5rem",
                        marginBottom: "3rem",
                    }}
                >
                    <NavLink
                        to="/dashboard/mutualFunds"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Explore
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/dashboard/mutualFunds/portfolio"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Portfolio
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>

                    <NavLink
                        to="/dashboard/mutualFunds/orders"
                        end
                        style={({ isActive }) => ({
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "3.5rem",
                            paddingBottom: ".75rem",
                            textDecoration: "none",
                            fontSize: "1.5rem",
                            fontWeight: "500",
                            color: isActive ? "#387ed1" : "#424242",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                Orders
                                {isActive && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            left: 0,
                                            right: 0,
                                            bottom: "-1px",
                                            height: "2.5px",
                                            background: "#387ed1",
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </NavLink>
                </div>
            )}
        </>
    );
}
