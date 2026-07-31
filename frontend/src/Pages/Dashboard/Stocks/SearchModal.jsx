import { useEffect, useState } from "react";
import axios from "axios";
export default function SearchModal({ open, onClose }) {

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);

    useEffect(() => {

        if (!open) {
            setQuery("");
            setResults([]);
            return;
        }

        if (query.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await axios.get("http://localhost:3001/search", { params: { q: query } });
                setResults(res.data);
            } catch (err) {
                console.log(err);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [query, open]);

    if (!open) return null;

    return (
        <div className="search-overlay" onClick={onClose}>
            <div className="search-modal" onClick={(e) => e.stopPropagation()}>

                <div className="search-input">
                    <i className="fa-solid fa-magnifying-glass"></i>
                    <input autoFocus placeholder="Search Stocks..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>

                <div className="search-results">
                    {results.map((stock) => (
                        <div key={stock.instrument_key} className="result" onClick={() => { onClose() }}>
                            <div>
                                <div style={{ height: "2.5rem", width: "2.5rem", border: "2px solid balck", borderRadius: "50%", backgroundColor: "#f7f7f7", alignItems: "center", justifyContent: "center", marginLeft: ".5rem" }}>
                                    <div style={{ fontSize: ".9rem", color: "#4f4f4f" }}>
                                        <i class="fa-solid fa-arrow-trend-up"></i>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", marginLeft: "1.5rem", alignItems:"baseline"}}>
                                    <div className="name">{stock.name}</div>
                                    <div className="symbol">Stock | {stock.symbol.split(".")[0]}</div>
                                </div>
                            </div>



                            <div style={{ alignItems: "center" }}>
                                <div className="exchange" style={{cursor:"default"}}>
                                    <p style={{ margin: "0", padding: "1px" }}>
                                        {stock.instrument_key.split("|")[0] === "NSE_EQ" ? (
                                            <img style={{height:"1.2rem", width:"auto", paddingTop:"1px"}} src="/images/nselogo.png" alt="NSE Logo" />) : (
                                            <img style={{height:".65rem", width:"auto"}} src="/images/bselogo.png" alt="BSE Logo" />)
                                        }
                                    </p>
                                </div>

                                <div style={{ height: "2.5rem", width: "2.5rem", alignItems: "center", justifyContent: "center", marginLeft: ".56rem", fontSize: ".9rem", color: "#4f4f4f", marginRight:".35rem" }}>
                                    <i class="fa-regular fa-bookmark"></i>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}