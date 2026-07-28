import React from "react";

export default function leftDiv({ url, p1, p2, p3, padding, height, width }) {
    return (
        <>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: padding }}>
                <div >
                    <img src={`/images/${url}`} className="logo" style={{ width: width, height: height, marginBottom: "1.75rem" }} />
                </div>

                <span>{p1}</span>
                <span>{p2}</span>
                <span>{p3}</span>
            </div>
        </>
    );
}