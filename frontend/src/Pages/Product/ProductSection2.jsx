import React from "react";
import { Link } from "react-router-dom";

import ImgInfoDiv from "./ImgInfoDiv.jsx";

export default function ProductSection2() {
    return (
        <>
            <div style={{ display: "flex", alignItems: "center", flexDirection:"column", height:"auto", width:"auto", textAlign:"center", margin:"0 auto", lineHeight:"1.8", marginTop:"8rem", marginBottom:"7rem"}}>

                <h2 style={{color:"#424242", marginTop:"0", marginBottom:"1rem"}}>The Zerodha Universe</h2>
                <p style={{ color:"#424242", fontSize:"1.25rem", marginTop:'.5rem', marginBottom:"4.5rem"}}>Extend your trading and investment experience even further with our partner platforms</p>

                <div style={{display:"flex", justifyContent:"space-evenly", alignItems:"center", gap:"4rem", height:"auto", width:"auto"}}>

                    <div className="universe-div1" style={{height:"26.25rem"}}>
                        <ImgInfoDiv url="zerodhaFundhouse.png" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." padding="4rem" height="3.438rem" width="12.387rem"/>

                        <ImgInfoDiv url="streakLogo.png" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." height="3.438rem" width="10.404rem" />
                    </div>

                    <div className="universe-div2"  style={{height:"26.25rem"}}>

                        <ImgInfoDiv url="dittoLogo.png" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." padding="4rem" height="3.438rem" width="8.964rem"/>

                        <ImgInfoDiv url="smallcaseLogo.png" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." height="3.438rem" width="13.154rem" />
                    </div>
                    
                    <div className="universe-div3" style={{height:"26.25rem"}}>
                        <ImgInfoDiv url="goldenpiLogo.png" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." padding="4rem" height="3.438rem" width="12.093rem"/>

                        <ImgInfoDiv url="sensibullLogo.jpg" p1="Our asset management venture" p2="that is creating simple and transparent index" p3="funds to help you save for your goals." height="3.5rem" width="14.305rem"/>

                    </div>
                    
                </div>
            </div>

            <div className="home-section1">
                <button style={{marginTop:"-1rem"}}>Sign up for free</button>
            </div>
        </>
    );
}