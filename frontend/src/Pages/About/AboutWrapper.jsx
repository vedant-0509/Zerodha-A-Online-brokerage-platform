import React from "react";

import AboutSection1 from "./AboutSection1.jsx";
import AboutSection2 from "./AboutSection2.jsx";


export default function AboutWrapper() {
    return (
        <>
            <div className="home">
                <AboutSection1 />
                <AboutSection2 />
            </div>
        </>
    );
}
    