import React from "react";

import ExploreSection1 from "./ExploreSection1.jsx";
import ExploreSection2 from "./ExploreSection2.jsx";
import ExploreSection3 from "./ExploreSection3.jsx";
import ExploreSection5 from "./ExploreSection5.jsx";
import TransactionHistory from "./TransactionHistory.jsx";


export default function ExploreWrapper() {
    return (
        <>
            <div className="home" style={{ paddingTop: "0" }}>
                <div style={{ display: "grid", gridTemplateColumns:"auto 1fr", gap:"2.5rem", alignItems:"start", marginTop:"1.5rem"}}>
                    <div className="left-panel">
                        <ExploreSection1 />
                        <ExploreSection2 />
                    </div>

                    <div className="right-panel" style={{width:"auto", position:"sticky", top:"120px"}}>
                        <ExploreSection5 />
                    </div>
                </div>

                <ExploreSection3 />
                <TransactionHistory />
            </div>
        </>
    );
}
