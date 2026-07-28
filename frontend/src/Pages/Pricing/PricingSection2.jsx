import React from "react";

export default function PricingSection2() {
    return (
        <>
            <div style={{ borderTop: "0.2px solid rgba(0, 0, 0, 0.1)" }}></div>

            <div style={{ marginTop: "3rem" }}>
                <h2 style={{ fontWeight: "500", color: "#387ed1", marginLeft: "2rem", marginTop: "0", marginBottom: "1.25rem" }}>Brokerage calculator</h2>

                <ul style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem" }}>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>Call & Trade and RMS auto-squareoff: Additional charges of ₹50 + GST per order.</li>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>Digital contract notes will be sent via e-mail</li>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>Physical copies of contract notes, if required, shall be charged ₹20 per contract note. Courier charges apply.</li>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>For NRI account (non-PIS), 0.5% or ₹100 per executed order for equity (whichever is lower).</li>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>For NRI account (PIS), 0.5% or ₹200 per executed order for equity (whichever is lower).</li>
                    <li style={{ listStyle: "none", padding: ".65rem" }}><i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingRight: ".75rem", scale: ".95" }}></i>If the account is in debit balance, any order placed will be charged ₹40 per executed order instead of ₹20 per executed order.</li>
                </ul>
            </div>


            <div style={{ marginTop: "7rem", marginBottom: "4rem", direction: "rtl", textAlign: "right" }}>
                <h2 style={{ fontWeight: "500", color: "#387ed1", marginRight: "2rem", marginTop: "0", marginBottom: "1.25rem" }}>Important Trading Charges & Policies</h2>

                <ul style={{ fontSize: "1.25rem", lineHeight: "1.8", color: "rgb(102, 102, 102)", padding: "0", marginRight: "2rem" }}>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>Securities Transaction Tax (STT) and other statutory charges are levied as per government regulations.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>Exchange Transaction Charges are applicable on all executed orders and may vary across segments.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>GST is charged at the prevailing rate on brokerage, transaction charges, and other applicable fees.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>Stamp Duty is collected as per state and central government guidelines and is applicable on buy-side transactions.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>Demat Debit Charges may apply when shares are sold from your demat account.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                    <li style={{ listStyle: "none", padding: ".65rem", direction: "ltr" }}>Charges and taxes are subject to revision by regulatory authorities, exchanges, or depositories without prior notice.<i class="fa-solid fa-circle-dot" style={{ color: "#387ed1", paddingLeft: ".75rem", scale: ".95" }}></i></li>
                </ul>
            </div>
        </>
    );
}