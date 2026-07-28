import React from "react";

import PricingSection1 from "./PricingSection1.jsx";
import PricingSection2 from "./PricingSection2.jsx";


export default function PricingWrapper() {
    return (
        <>
            <div className="home">
                <PricingSection1 />
                <PricingSection2 />
            </div>
        </>
    );
}
