import React from "react";

import HomeSection1 from "./HomeSection1.jsx";
import HomeSection2 from "./HomeSection2.jsx";
import HomeSection3 from "./HomeSection3.jsx";
import HomeSection4 from "./HomeSection4.jsx";
import HomeSection5 from "./HomeSection5.jsx";
import HomeSection6 from "./HomeSection6.jsx";

export default function HomeWrapper() {
    return (
        <>
            <div className="home">
                <HomeSection1 />
                <HomeSection2 />
                <HomeSection3 />
                <HomeSection4 />
                <HomeSection5 />
                <HomeSection6 />
            </div>
        </>
    );
}
