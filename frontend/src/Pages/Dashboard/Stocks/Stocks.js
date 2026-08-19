import React from "react";
import { Routes, Route } from 'react-router-dom';

import StocksWrapper from "./StocksWrapper.jsx";

import Explore from './Explore/Explore.js';
import Holdings from './Holdings/Holdings.js';
import Orders from './Orders/Orders.js';
import Watchlist from './Watchlist/Watchlist.js';
import DetailStock from './detailStock.js/DetailStock.js';

export default function Stocks() {
    return (
        <>
            <StocksWrapper />
            <Routes>
                <Route index element={<Explore />} />
                <Route path="explore" element={<Explore />} />
                <Route path="holdings" element={<Holdings />} />
                <Route path="orders" element={<Orders />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="detailStock" element={<DetailStock />} />
            </Routes>
        </>
    );
}













// import React from "react";
// import { Routes, Route } from 'react-router-dom';

// import StocksWrapper from "./StocksWrapper.jsx";

// import Explore from './Explore/Explore.js';
// import Holdings from './Holdings/Holdings.js';
// import Orders from './Orders/Orders.js';
// import Watchlist from './Watchlist/Watchlist.js';
// import DetailStock from './detailStock.js/DetailStock.js';

// export default function Stocks() {
//     return (
//         <>
//             <StocksWrapper />
//             <Routes>
//                 <Route index element={<Explore />} />
//                 <Route path="explore" element={<Explore />} />
//                 <Route path="holdings" element={<Holdings />} />
//                 <Route path="orders" element={<Orders />} />
//                 <Route path="watchlist" element={<Watchlist />} />
//                 <Route path="detail/:instrumentKey" element={<DetailStock />} />
//             </Routes>
//         </>
//     );
// }
