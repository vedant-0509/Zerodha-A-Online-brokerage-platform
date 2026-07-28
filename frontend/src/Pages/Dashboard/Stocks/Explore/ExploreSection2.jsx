import { useEffect, useState } from "react";
import axios from "axios";

export default function ExploreSection2() {
    const [sectors, setSectors] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const response = await axios.get("http://localhost:3001/sector-trends");
            setSectors(response.data);
        } catch (err) {
            console.error(err);
        }
    }

    const sectorIcons = {
        "Financial Services": "fa-solid fa-dollar-sign",
        "Oil & Gas": "fa-solid fa-oil-well",
        Automobile: "fa-solid fa-car",
        FMCG: "fa-solid fa-cart-shopping",
        IT: "fa-solid fa-computer",
        Healthcare: "fa-solid fa-briefcase-medical",
        "Capital Goods": "fa-solid fa-coins",
        Telecom: "fa-solid fa-satellite-dish",
        Power: "fa-solid fa-bolt",
        "Metals & Mining": "fa-solid fa-person-digging",
        Construction: "fa-solid fa-city",
        "Consumer Services": "fa-solid fa-headset",
        Cement: "fa-solid fa-trowel",
        Chemicals: "fa-solid fa-flask-vial",
        Realty: "fa-solid fa-house",

        // Optional fallback icons
        "Consumer Durables": "fa-solid fa-couch",
        Services: "fa-solid fa-briefcase",
    };

    return (
        <>
            <div style={{ width: "53.49rem" }}>

                <div style={{ marginTop: "4rem", marginBottom: "2rem" }}>
                    <h2 style={{ margin: "0px 0px 1.2rem", fontSize: "1.4rem", fontWeight: 500, }}>
                        Sectors trending today
                    </h2>
                </div>

                <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "1rem", overflow: "hidden" }}>
                    {/* Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ height: "56.587px" }}>
                            <tr style={{ borderBottom: "1px solid #ececec" }}>
                                <th style={{ padding: "1rem", textAlign: "center", fontWeight: 500, width: "16rem", fontSize: "1.1rem" }}>
                                    <p style={{ margin: "0", marginRight: "1rem" }}>Sector</p>
                                </th>
                                <th style={{ padding: "1rem", textAlign: "left", fontWeight: 500, width: "42.5%", fontSize: "1.1rem", }}>
                                    <p style={{ margin: "0", paddingLeft: "5.4rem" }}> Gainers/Losers</p>
                                </th>
                                <th style={{ padding: "1rem", textAlign: "right", fontWeight: 500, width: "25%", fontSize: "1.1rem" }}>
                                    <p style={{ margin: "0", paddingRight: "1.3rem" }}>1D price change</p>
                                </th>
                            </tr>
                        </thead>

                        <tbody className="table">
                            {sectors.map((sector, index) => {
                                const total = sector.total;
                                const gainPercent = total === 0 ? 0 : (sector.gainers / total) * 100;

                                return (
                                    <tr key={index} style={{ borderBottom: index !== sectors.length - 1 ? "1px solid #ececec" : "none" }}>
                                        {/* Sector */}
                                        <td style={{ padding: ".75rem" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingLeft: "1rem", }}>
                                                <i className={sectorIcons[sector.sector] || "fa-solid fa-chart-line"} style={{ fontSize: "20px", color: "#6b7280", width: "24px", textAlign: "center", marginLeft: ".5rem" }}></i>
                                                <span style={{ fontWeight: 500, color: "#40455a", marginLeft: ".75rem" }}>{sector.sector}</span>
                                            </div>
                                        </td>

                                        {/* Gainers / Losers */}
                                        <td style={{ padding: ".75rem" }}>
                                            <div style={{ width: "90%" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "1.1rem", color: "#40455a" }}>
                                                    <span style={{ marginLeft: ".3rem" }}>{sector.gainers}</span>

                                                    <span style={{ marginRight: ".3rem" }}>{sector.losers}</span>
                                                </div>

                                                <div style={{ display: "flex", height: "3px", borderRadius: "20px", overflow: "hidden" }}>
                                                    <div style={{ width: `${gainPercent}%`, background: "#00c087" }} />
                                                    <div style={{ width: `${100 - gainPercent}%`, background: "#f15b3d" }} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Change */}
                                        <td style={{ padding: ".75rem", textAlign: "center", fontWeight: 500, color: sector.avg_change >= 0 ? "#00c087" : "#f15b3d" }}>
                                            <p style={{ margin: "0", fontSize: "1.1rem" }}>
                                                {sector.avg_change > 0 ? "+" : ""}
                                                {Number(sector.avg_change).toFixed(2)}%
                                            </p>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
