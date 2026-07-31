import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";


import Holdings from "../Holdings/Holding.jsx";


export default function ExploreSection1() {

    const [stocks, setStocks] = useState([]);
    const [activeTab, setActiveTab] = useState("gainers");
    const navigate = useNavigate();

    useEffect(() => {
        fetchData("gainers");
    }, []);

    async function fetchData(type) {
        try {
            let url = "";
            if (type === "gainers") url = "http://localhost:3001/top-gainers";
            else if (type === "losers") url = "http://localhost:3001/top-losers";
            else url = "http://localhost:3001/volume-shockers";

            const response = await axios.get(url);
            setStocks(response.data);
            setActiveTab(type);
        }
        catch (err) {
            console.log(err);
        }
    }

    return (
        <>
            <div style={{ display: "flex", flexDirection: "column", width: "53.49rem" }}>
                <h2 style={{ margin: "0", marginBottom: "1.2rem", fontSize: "1.4rem", fontWeight: "500", marginTop:"0rem"}}>Top movers today</h2>

                <div className="btnhov" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>

                    <button onClick={() => fetchData("gainers")} className={activeTab === "gainers" ? "clicked" : ""}>Gainers</button>
                    <button onClick={() => fetchData("losers")} className={activeTab === "losers" ? "clicked" : ""}>Losers</button>
                    <button onClick={() => fetchData("volume")} className={activeTab === "volume" ? "clicked" : ""}>Volume Shockers</button>

                    <div className="info-hov" style={{ fontSize: "1.4rem", color: "#387ed1", marginLeft: "26.7rem", zIndex: "0" }}>
                        <div className="tooltip">Values will update After market</div>
                        <i class="fa-solid fa-circle-info"></i>
                    </div>

                </div>

                <div style={{ border: "1px solid #ddd", borderRadius: "16px", marginTop: "1.2rem", overflow: "hidden", width: "fit-content" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", marginRight: "1rem" }}>
                        <thead>
                            <tr className="gainerloserdiv2">
                                <th style={{ width: "20rem" }}><p style={{ paddingLeft: "24%", margin: "0" }}>Company</p></th>
                                <th style={{ width: "4.5rem" }}><div><p>Symbol</p></div></th>
                                <th style={{ width: "6rem" }}><div><p>Price</p></div></th>
                                <th style={{ width: "6rem" }}><div><p>Change %</p></div></th>
                                <th style={{ width: "6rem" }}><div><p>Volume</p></div></th>
                            </tr>
                        </thead>

                        <tbody className="table">
                            {stocks.map((stock, index) => (
                                <tr key={index} style={{ borderTop: "1px solid #eee" }} onClick={() => navigate(`/dashboard/stocks/explore/${stock.symbol}`)} className="gainerloserdiv">

                                    <td style={{ width: "20rem" }}><p>{stock.name}</p></td>

                                    <td style={{ width: "4.5rem" }}>
                                        <div><p style={{ padding: "0", textAlign: "center" }}>{stock.exchange}</p></div>
                                    </td>

                                    <td style={{ width: "6rem" }}>
                                        <div><p style={{ padding: "0", textAlign: "center" }}>₹{stock.price}</p></div>
                                    </td>

                                    <td style={{ width: "6rem", color: stock.change_percent >= 0 ? "green" : "red" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5px" }}>
                                            <p style={{ paddingLeft: ".5rem" }}>{Number(stock.change_percent).toFixed(2)}%</p>
                                            <p style={{ padding: "0" }}>{Number(stock.change_points) > 0 ? "+" : ""}{Number(stock.change_points).toFixed(2)}</p>
                                        </div>
                                    </td>

                                    <td style={{ width: "6rem" }}>
                                        <div><p style={{ padding: "0", textAlign: "center" }}>{Number(stock.volume).toLocaleString()}</p></div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div >
        </>
    );
}