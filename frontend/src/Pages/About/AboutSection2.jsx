import React from "react";
import { Link } from "react-router-dom";


export default function AboutSection2() {
    return (
        <>
            <div style={{ borderTop: "0.2px solid rgba(0, 0, 0, 0.1)", marginTop:"3rem"}}></div>
            <h1 style={{ textAlign: "center", fontSize: "2.2rem", lineHeight: "1.5", fontWeight: "500", marginBottom: "20px", color: "#424242", marginTop: "3rem" }}>People</h1>
            <div style={{ display: "flex", justifyContent: "space-evenly", marginTop: "3rem", width: "auto", height: "auto", gap: "4rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginLeft: "10rem", width: "auto" }}>
                    <div>
                        <img src="/images/nithinKamath.jpg" style={{ borderRadius: "100%", width: "20rem", height: "20rem", marginBottom: "1rem" }} />
                    </div>
                    <h5 style={{ margin: "0", fontSize: "1.125rem", fontWeight: "400", color: "#424242" }}>Nithin Kamath</h5>
                    <p style={{ fontSize: ".9rem", opacity: ".75" }}>Founder, CEO</p>
                </div>
                <div className="about-section2" style={{ marginRight: "3rem", width: "50%", }}>
                    <p>Nithin bootstrapped and founded Zerodha in 2010 to overcome the hurdles he faced during his decade long stint as a trader. Today, Zerodha has changed the landscape of the Indian broking industry.</p>
                    <p>He is a member of the SEBI Secondary Market Advisory Committee (SMAC) and the Market Data Advisory Committee (MDAC).</p>
                    <p>Playing basketball is his zen.</p>
                    <p>Connect on <Link>Homepage</Link> / <Link>TradingQnA</Link> / <Link>Twitter</Link></p>
                </div>
            </div>
        </>
    );
}