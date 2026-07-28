// import React from "react";
// import { Link } from "react-router-dom";

// export default function StocksSection1() {
//     return (
//         <>
//             <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
//                 <div className="StocksSection1-div" style={{ display: "flex", alignItems: "center", gap: "3rem", height: "3rem", fontWeight: "500", marginTop: ".75rem" }}>
//                     <div>
//                         <Link to="/dashboard/stocks/explore" style={{ textDecoration: "none", fontSize: "1.4rem" }}>Explore</Link>
//                     </div>
//                     <div>
//                         <Link to="/dashboard/stocks/holdings" style={{ textDecoration: "none", fontSize: "1.4rem" }}>Holdings</Link>
//                     </div>
//                     <div>
//                         <Link to="/dashboard/stocks/positions" style={{ textDecoration: "none", fontSize: "1.4rem" }}>Positions</Link>
//                     </div>
//                     <div>
//                         <Link to="/dashboard/stocks/orders" style={{ textDecoration: "none", fontSize: "1.4rem" }}>Orders</Link>
//                     </div>
//                     <div>
//                         <Link to="/dashboard/stocks/watchlist" style={{ textDecoration: "none", fontSize: "1.4rem" }}>Watchlist</Link>
//                     </div>
//                 </div>

//                 <div className="searchbar" style={{ marginLeft: "17rem", paddingTop: "1rem" }}>
//                     <div style={{ border: "2px solid black", padding: ".5rem", borderRadius: ".6rem", borderColor: "#dedede", height: "1.4rem" }}>
//                         <i style={{ color: "#dedede", paddingLeft: "0.1rem", paddingRight: ".3rem", fontSize: "1.25rem" }} class="fa-solid fa-magnifying-glass"></i>
//                         <input type="text" placeholder="Search Groww.." style={{ height: "1.2rem", border: "none", width: "18rem", fontSize: "1.1rem", color: "#474747" }} />
//                     </div>
//                 </div>
//             </div>
//         </>
//     );
// }





import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import SearchModal from "./SearchModal";


export default function StocksSection1() {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (search.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await axios.get(
                    `http://localhost:3001/search?q=${search}`,
                );

                setResults(res.data);
            } catch (err) {
                console.log(err);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);
    const [openSearch, setOpenSearch] = useState(false);

    return (
        <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", }}>
                <div className="StocksSection1-div" style={{ display: "flex", alignItems: "center", gap: "3rem", height: "3rem", fontWeight: "500", marginTop: ".75rem", }}>
                    <Link to="/dashboard/stocks/explore" style={{ textDecoration: "none", fontSize: "1.4rem" }}>
                        Explore
                    </Link>

                    <Link to="/dashboard/stocks/holdings" style={{ textDecoration: "none", fontSize: "1.4rem" }}>
                        Holdings
                    </Link>

                    <Link to="/dashboard/stocks/positions" style={{ textDecoration: "none", fontSize: "1.4rem" }}>
                        Positions
                    </Link>

                    <Link to="/dashboard/stocks/orders" style={{ textDecoration: "none", fontSize: "1.4rem" }}>
                        Orders
                    </Link>

                    <Link to="/dashboard/stocks/watchlist" style={{ textDecoration: "none", fontSize: "1.4rem" }}>
                        Watchlist
                    </Link>
                </div>

                <div className="searchbar" style={{ marginLeft: "17rem", paddingTop: "1rem", position: "relative", }}>
                    <SearchModal open={openSearch} onClose={() => setOpenSearch(false)} />

                    <div className="searchbar" onClick={() => setOpenSearch(true)}>
                        <div style={{ border: "1px solid #ddd", padding: "12px", borderRadius: "8px", width: "350px", cursor: "pointer" }}>
                            <i className="fa-solid fa-magnifying-glass" style={{ marginRight: "10px", marginTop:".2rem"}} />
                            Search Groww...
                        </div>
                    </div>
                    
                </div>
            </div>
        </>
    );
}