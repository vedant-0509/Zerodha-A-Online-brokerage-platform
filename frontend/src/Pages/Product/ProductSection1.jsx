import React from "react";
import { Link } from "react-router-dom";

export default function ProductSection1() {
    return (
        <>
            <div className="home-section1" style={{marginTop:"-1rem"}}>
                <h1 style={{fontSize: "1.9rem", lineHeight: "1.25", fontWeight: "500", margin: ".67em 0", textAlign: "center", color: "#424242", marginBottom:"1.75rem"}}>Zerodha Products</h1>
                <p style={{margin:"0"}}>Sleek, modern, and intuitive trading platforms</p>
                <p style={{margin:"0", paddingTop:".5rem"}}>Check out our investment offerings</p>
            </div>
            <div style={{ borderTop: "0.2px solid rgba(0, 0, 0, 0.1)", marginBottom:"5rem" }}></div>
        </>
    );
}