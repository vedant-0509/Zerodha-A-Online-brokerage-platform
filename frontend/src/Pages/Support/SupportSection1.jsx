import React from "react";

import { Link } from "react-router-dom";

export default function SupportSection1() {
    return (
        <>
            <div className="home-section3" style={{ backgroundColor: "#119cf2", color: "white", fontSize: "1.2rem" }}>
                <div className="container" style={{ marginTop: "6rem", color: "white" }}>
                    <div style={{ width: "100%" }}>
                        <h2 style={{ color: "white", margin: "0", textAlign: "center", width: "100%", marginTop: "2rem" }}>Support Portal</h2>

                        <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "1rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                                <h3 style={{ lineHeight: "1.5", fontWeight: "500", fontSize: "1.85rem", width: "fit-content", borderBottom: "2px solid white" }}>Search for an answer or browse help topics to create a ticket</h3>

                                <input placeholder="Eg: how do i activate F&O, why is my order getting rejected.." style={{ height: "3rem", width: "35rem", borderRadius: ".5rem", border: "none", paddingLeft: "1rem", fontSize: "1.05rem", fontWeight: "400", marginTop: "-.5rem", marginBottom: "1rem" }}></input>

                                <div className="linkHov" style={{ fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3", display: "flex", flexDirection: "column", height: "auto", width: "fit-content", rowGap: ".75rem", marginTop: "1rem", marginBottom: "2rem" }}>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Track account opening</Link>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Track segment activation</Link>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Kite user manual</Link>
                                </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                                <h3 style={{ lineHeight: "1.5", fontWeight: "500", fontSize: "1.85rem", width: "fit-content", borderBottom: "2px solid white" }}>Featured</h3>

                                <div className="linkHov" style={{ fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3", display: "flex", flexDirection: "column", justifyContent: "", height: "auto", width: "auto", rowGap: ".75rem", marginTop: ".5rem", marginBottom: "2rem", width: "fit-content" }}>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Track account opening</Link>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Track segment activation</Link>
                                    <Link style={{ textDecoration: "none", color: "white" }}>Intraday margins</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}