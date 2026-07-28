import React from "react";

import SupportSection1 from "./SupportSection1.jsx";
import SupportSection2 from "./SupportSection2.jsx";


export default function SupportWrapper() {
    return (
        <>
            <div className="home">
                <SupportSection1 />
                <SupportSection2 />
            </div>
        </>
    );
}
