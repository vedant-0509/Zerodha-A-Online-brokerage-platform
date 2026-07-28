import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ExploreSection4() {

    const [stocks, setStocks] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStocks();
    }, []);

    async function fetchStocks() {
        try {
            const response = await axios.get(
                "http://localhost:3001/most-traded-stocks"
            );

            setStocks(response.data);

        } catch (err) {
            console.log(err);
        }
    }

    return (
        <div style={{ marginTop: "4rem" }}>
            <h2 style={{ fontSize: "1.4rem", fontWeight: "500", marginBottom: "2rem" }}>Most traded stocks in MTF</h2>

            <div className="most-trade" style={{ display: "flex", alignItems:"center" }}>
                {stocks.map((stock) => (
                    <div key={stock.symbol} onClick={() => navigate(`/dashboard/stocks/explore/${stock.symbol}`)} style={{ display:"flex", flexDirection:"column", border: "1px solid #e6e6e6", borderRadius: "1rem", padding: "1rem", height: "auto", width:"auto", cursor: "pointer", marginRight:"1.5rem"}}>

                        {/* Logo */}
                        <div style={{ width: "45px", height: "45px", border: "1px solid #e6e6e6", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "500", fontSize: "1.1rem"}}>
                            {stock.symbol.replace(".NS", "").replace(".BO", "").substring(0, 3)}
                        </div>

                        {/* Company Name */}
                        <h4 style={{ marginTop: ".5rem", marginBottom: "1rem", fontSize: "1.1rem", fontWeight: "500", paddingRight:"1rem" }}>
                            {stock.name.length > 20 ? stock.name.substring(0, 20) + "..." : stock.name}
                        </h4>

                        {/* Price */}
                        <div style={{ fontSize: "1.2rem", fontWeight: "500", paddingRight:"1rem" }}>
                            ₹{Number(stock.price).toLocaleString()}
                        </div>

                        {/* Change */}
                        <div style={{ marginTop: ".2rem", color: stock.change_percent >= 0 ? "#00b386" : "#ff5c35", fontWeight: "500", fontSize: "1rem", paddingRight:"1rem"   }}>
                            {stock.change_value > 0 ? "+" : ""}
                            {Number(stock.change_value).toFixed(2)}
                            {" "}
                            ({stock.change_percent > 0 ? "+" : ""}  {Number(stock.change_percent).toFixed(2)}%)
                        </div>
                    </div>
                ))}
            </div>
        </div >
    );
}