import React from "react";

import DashboardSection1 from "./DashboardSection1.jsx";
import DashboardSection2 from "./DashboardSection2.jsx";



export default function DashboardWrapper() {
    return (
        <>
            <div className="home" style={{position:"sticky", top:"0", paddingBottom:"0", backgroundColor:"white", zIndex:"1"}}>
                <DashboardSection1 />
                <DashboardSection2 />
            </div>
        </>
    );
}
    