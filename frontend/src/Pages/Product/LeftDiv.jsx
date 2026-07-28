import React from "react";
import { Link } from "react-router-dom";

export default function leftDiv({ url, name, desc, gplay, appStore, height, width }) {
    return (
        <>

            { }
            <div style={{ display: "flex", justifyContent: "space-evenly", alignItems: "center", marginBottom: "4rem" }}>
                <div style={{ width: "40rem", height: "auto", textAlign: "center" }}>
                    <img src={`/images/${url}`} className="logo" style={{ width: width || "100%", height: height || "100%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", width: "30.6666666667%" }}>
                    <h2 style={{ margin: "0", color: "#424242" }}>{name}</h2>
                    <p style={{ color: "#424242", fontSize: "1.25rem" }}>{desc}</p>
                    <div>
                        <a href=""><img src={`/images/${gplay}`} className="logo" style={{ width: "9.492rem", height: "2.813rem", marginRight: "1.5rem" }} /></a>
                        <a href=""><img src={`/images/${appStore}`} className="logo" style={{ width: "9.492rem", height: "2.813rem" }} /></a>
                    </div>
                </div>
            </div>
        </>
    );
}