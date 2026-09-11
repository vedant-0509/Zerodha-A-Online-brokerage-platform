import React from "react";

import DashboardSection1 from "./DashboardSection1.jsx";
import DashboardSection2 from "./DashboardSection2.jsx";
// import DashboardSection3 from "./DashboardSection3.jsx";
// import DashboardSection5 from "./DashboardSection5.jsx";



export default function DashboardWrapper() {
    return (
        <>
            <div className="home" style={{ paddingTop: "0rem" }}>
                <DashboardSection1 />
                <DashboardSection2 />
            </div>
        </>
    );
}
