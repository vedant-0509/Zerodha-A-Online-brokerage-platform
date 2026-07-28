import React from "react";
import { Link } from "react-router-dom";

export default function SupportSection2() {
    return (
        <>
            <div style={{ marginTop: "2rem", marginBottom:"2rem"}}>
                <h2 style={{ margin: "0", textAlign: "center", width: "100%", marginTop: "2rem", fontSize: "2rem", lineHeight: "1.5", fontWeight: "500", marginBottom: "4rem" }}>To create  a ticket select a relevent topic</h2>

                <div className="linkHov2" style={{ display: "flex", flexWrap: "wrap", columnGap: "3.5rem", justifyContent: "space-around", marginBottom: "5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                        <h2 style={{ margin: "0", fontSize: "1.75rem" }}><i class="fa-solid fa-circle-user" style={{ paddingRight: ".5rem" }}></i>Account Opening</h2>

                        <ul style={{ lineHeight: "1.2", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem", marginTop: ".3rem" }}>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Online Account Opening</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Offline Account Opening</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Company, Partnership and HUF Account Opening</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>NRI Account Opening</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Charges at Zerodha</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Zerodha IDFC FIRST Bank 3-in-1 Account</Link></li>
                        </ul>
                    </div>


                    <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                        <h2 style={{ margin: "0", fontSize: "1.75rem" }}><i class="fa-solid fa-circle-user" style={{ paddingRight: ".5rem" }}></i>Trading</h2>

                        <ul style={{ lineHeight: "1.2", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem", marginTop: ".3rem" }}>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Kite Web and Mobile</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>GTT</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Trading FAQs</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Sentinel</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Kite API</Link></li>

                        </ul>
                    </div>



                    <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                        <h2 style={{ margin: "0", fontSize: "1.75rem" }}><i class="fa-solid fa-circle-user" style={{ paddingRight: ".5rem" }}></i>Your Zerodha Account</h2>

                        <ul style={{ lineHeight: "1.2", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem", marginTop: ".3rem" }}>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Login Credentials</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Account Modification and Segment Addition</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>DP ID and bank details</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Your Profile</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Transfer and conversion of shares</Link></li>
                        </ul>
                    </div>

                </div>

                <div className="linkHov2" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-evenly" }}>
                    <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                        <h2 style={{ margin: "0", fontSize: "1.75rem" }}><i class="fa-solid fa-circle-user" style={{ paddingRight: ".5rem" }}></i>Products & Services</h2>

                        <ul style={{ lineHeight: "1.2", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem", marginTop: ".3rem" }}>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Subscription Plans</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Mobile Application</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Frequently Asked Questions</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Developer Tools</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Desktop Application</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Notifications Center</Link></li>
                        </ul>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
                        <h2 style={{ margin: "0", fontSize: "1.75rem" }}><i class="fa-solid fa-circle-user" style={{ paddingRight: ".5rem" }}></i>Investments</h2>

                        <ul style={{ lineHeight: "1.2", color: "rgb(102, 102, 102)", padding: "0", marginLeft: "2rem", marginTop: ".3rem" }}>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Trading Help Center</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Dividend and Bonus Actions</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Market Alerts</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>NRI Account Opening</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Desktop Trading Platform</Link></li>
                            <li style={{ listStyle: "none", padding: ".55rem", paddingRight: "0" }}><Link style={{ textDecoration: "none", color: "#119cf2", fontSize: "1.25rem", fontWeight: "500", lineHeight: "1.3" }}>Research Reports</Link></li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );

}