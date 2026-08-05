// require("dotenv").config();

// const mysql = require("mysql2/promise");
// const axios = require("axios");

// const db = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "root",
//     database: "zerodha",
// });

// async function updateMarketData() {
//     console.log("Updating Market Data...");

//     try {
//         // fetch all instrument keys
//         const [stocks] = await db.execute(`
//             SELECT instrument_key
//             FROM instruments_master
//             ORDER BY instrument_key
//         `);

//         console.log(`Found ${stocks.length} stocks`);

//         const instrumentKeys = stocks.map(x => x.instrument_key);

//         // Upstox accepts 500 instruments/request

//         const chunkSize = 500;

//         for (let i = 0; i < instrumentKeys.length; i += chunkSize) {

//             const chunk = instrumentKeys.slice(i, i + chunkSize);

//             const response = await axios.get(
//                 "https://api.upstox.com/v2/market-quote/quotes",
//                 {
//                     headers: {
//                         Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
//                     },
//                     params: {
//                         instrument_key: chunk.join(",")
//                     }
//                 }
//             );

//             const quotes = response.data.data;

//             for (const key in quotes) {

//                 const q = quotes[key];

//                 await db.execute(
//                     `
//                     UPDATE market_stocks_data
//                     SET
//                         price=?,
//                         change_value=?,
//                         change_percent=?,
//                         open_price=?,
//                         previous_close=?,
//                         day_high=?,
//                         day_low=?,
//                         volume=?,
//                         updated_at=NOW()

//                     WHERE instrument_key=?
//                     `,
//                     [
//                         q.last_price,
//                         q.last_price - q.ohlc.close,
//                         ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100,
//                         q.ohlc.open,
//                         q.ohlc.close,
//                         q.ohlc.high,
//                         q.ohlc.low,
//                         q.volume,
//                         key
//                     ]
//                 );

//             }

//             console.log(`Updated ${Math.min(i + chunkSize, instrumentKeys.length)} stocks`);

//         }

//         console.log("Market Data Updated Successfully");

//     }

//     catch (err) {

//         console.log(err.response?.data || err.message);

//     }

// }

// // module.exports = updateMarketData;






































// require("dotenv").config();

// const { startScheduler } = require("./marketScheduler");

// const { alreadyUpdatedToday, saveUpdateLog } = require("./marketUpdateLog");

// const { updateMarketData } = require("./marketUpdateService");

// const { isMarketOpen } = require("../indexMarket/isMarketOpen");

// require("./app");

// async function bootstrap(){

//     console.log("Starting Holdings Server...");

//     if(isMarketOpen()){

//         console.log("Market Open.");

//         console.log("Serving DB Data.");

//     }
//     else{

//         console.log("Market Closed.");

//         const updated = await alreadyUpdatedToday();

//         if(updated){

//             console.log("Today's data already updated.");

//         }
//         else{

//             console.log("Updating today's closing prices...");

//             await updateMarketData();

//             await saveUpdateLog();

//             console.log("Done.");

//         }

//     }

//     startScheduler();

// }

// bootstrap();
























































require("dotenv").config();

const { startScheduler } = require("./marketScheduler");
const { alreadyUpdatedToday, saveUpdateLog } = require("./marketUpdateLog");
const { updateMarketData } = require("./marketUpdateService");
const { isMarketOpen } = require("../indexMarket/isMarketOpen");


require("./app");


async function bootstrap() {

    console.log("Starting Holdings Server...");

    if (isMarketOpen()) {

        console.log("Market Open");
        console.log("Serving DB Data");

    } else {

        console.log("Market Closed");

        const updated = await alreadyUpdatedToday();

        if (updated) {

            console.log("Today's data already updated.");

        } else {

            console.log("Updating Today's Closing Prices...");

            const success = await updateMarketData();

            if (success) {

                await saveUpdateLog();

                console.log("Today's Closing Prices Saved.");

            }
            else {

                console.log("Market update failed.");

                console.log("Log not saved.");

            }

            console.log("Today's Closing Prices Saved.");

        }

    }

    startScheduler();

}

bootstrap();