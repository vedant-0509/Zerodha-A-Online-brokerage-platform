// require("dotenv").config();

// const mysql = require("mysql2/promise");
// const axios = require("axios");

// // MySQL
// const db = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "root",
//     database: "zerodha",
// });

// // Upstox
// const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;


// // Date whose close should become previous_close
// const PREVIOUS_DATE = "2026-07-23";

// async function updatePreviousClose(PREVIOUS_DATE) {
//     console.log(`\nFetching Previous Close (${await(PREVIOUS_DATE)})...\n`);

//     const [stocks] = await db.execute(`
//         SELECT DISTINCT instrument_key
//         FROM market_gainerloser
//         ORDER BY instrument_key
//     `);

//     console.log(`Found ${stocks.length} stocks\n`);

//     PREVIOUS_DATE = await(PREVIOUS_DATE);

//     for (const stock of stocks) {
//         try {
//             const url = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(stock.instrument_key)}/days/1/${PREVIOUS_DATE}/${PREVIOUS_DATE}`;

//             const { data } = await axios.get(url, {
//                 headers: {
//                     Authorization: `Bearer ${ACCESS_TOKEN}`,
//                     Accept: "application/json",
//                 },
//             });

//             const candle = data?.data?.candles?.[0];

//             if (!candle) {
//                 console.log(`No candle : ${stock.instrument_key}`);
//                 continue;
//             }

//             const previousClose = candle[4];

//             await db.execute(`
//                 UPDATE market_gainerloser
//                 SET
//                     previous_close=?,
//                     trading_date=?
//                 WHERE instrument_key=?
//                 `, [
//                 previousClose,
//                 PREVIOUS_DATE,
//                 stock.instrument_key
//             ]);

//             console.log(`✅ ${stock.instrument_key} -> Previous Close = ${previousClose}`);

//         } catch (err) {
//             console.log(`❌ ${stock.instrument_key}`);

//             if (err.response) {
//                 console.log(err.response.data);
//             } else {
//                 console.log(err.message);
//             }
//         }
//     }

//     console.log("\n🎉 Previous Close Updated Successfully.");
//     await db.end();
// }

// // module.exports = updatePreviousClose;

// updatePreviousClose(PREVIOUS_DATE);






































require("dotenv").config();

const mysql = require("mysql2/promise");
const axios = require("axios");

// Upstox
const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

/**
 * Updates previous_close for every stock using the closing candle of `previousDate`.
 * Accepts a shared db pool (passed in from server.js) so we don't open a second pool.
 */
async function updatePreviousClose(db, previousDate) {
    console.log(`\nFetching Previous Close (${previousDate})...\n`);

    const [stocks] = await db.execute(`
        SELECT DISTINCT instrument_key
        FROM market_gainerloser
        ORDER BY instrument_key
    `);

    console.log(`Found ${stocks.length} stocks\n`);

    for (const stock of stocks) {
        try {
            const url = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(stock.instrument_key)}/days/1/${previousDate}/${previousDate}`;

            const { data } = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    Accept: "application/json",
                },
            });

            const candle = data?.data?.candles?.[0];

            if (!candle) {
                console.log(`No candle : ${stock.instrument_key}`);
                continue;
            }

            const previousClose = candle[4];

            await db.execute(`
                UPDATE market_gainerloser
                SET
                    previous_close = ?,
                    trading_date = ?
                WHERE instrument_key = ?
            `, [
                previousClose,
                previousDate,
                stock.instrument_key
            ]);

            console.log(`✅ ${stock.instrument_key} -> Previous Close = ${previousClose}`);

        } catch (err) {
            console.log(`❌ ${stock.instrument_key}`);

            if (err.response) {
                console.log(err.response.data);
            } else {
                console.log(err.message);
            }
        }
    }

    console.log("\n🎉 Previous Close Updated Successfully.");
}

module.exports = updatePreviousClose;

// Allow standalone manual runs too: `node reInit.js 2026-07-23`
// (only runs when this file is executed directly, not when required by server.js)
if (require.main === module) {
    const db = mysql.createPool({
        host: "localhost",
        user: "root",
        password: "root",
        database: "zerodha",
    });

    const dateArg = process.argv[2] || new Date().toISOString().slice(0, 10);

    updatePreviousClose(db, dateArg)
        .then(() => db.end())
        .catch((err) => {
            console.error(err);
            return db.end();
        });
}