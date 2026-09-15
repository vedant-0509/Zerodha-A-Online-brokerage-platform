// require("dotenv").config();

// const mysql = require("mysql2/promise");
// const axios = require("axios");

// const db = mysql.createPool({
//     host: "localhost",
//     user: "root",
//     password: "root",
//     database: "zerodha",
// });

//  const express = require("express");
// const cors = require("cors");

// const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

// async function updateMarketData() {
//     console.log("Updating Market Data...");

//     try {
//         const [stocks] = await db.execute(`
//             SELECT instrument_key
//             FROM market_stocks_data
//             ORDER BY instrument_key
//         `);

//         console.log(`Found ${stocks.length} Stocks`);

//         const instrumentKeys = stocks.map(x => x.instrument_key);
//         const chunkSize = 500;

//         for (let i = 0; i < instrumentKeys.length; i += chunkSize) {
//             const chunk = instrumentKeys.slice(i, i + chunkSize);

//             const response = await axios.get(
//                 "https://api.upstox.com/v2/market-quote/quotes",{
//                     headers: {Authorization: `Bearer ${ACCESS_TOKEN}`},
//                     params: {instrument_key: chunk.join(",")}
//                 }
//             );

//             const quotes = response.data.data;

//             for (const key in quotes) {
//                 const q = quotes[key];

//                 await db.execute(`
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
//                 `,
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
//                     ]);
//             }
//             console.log(`Updated ${Math.min(i + chunkSize, instrumentKeys.length)} Stocks`);
//         }
//         console.log("Market Data Updated Successfully");
//         return true;
//     }
//     catch (err) {
//         console.log(err.response?.data || err.message);
//         return false;
//     }
// }

// module.exports = { updateMarketData };































const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env"),
});

const mysql = require("mysql2/promise");
const axios = require("axios");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

console.log(
    "Upstox token loaded:",
    ACCESS_TOKEN
        ? `${ACCESS_TOKEN.slice(0, 12)}...`
        : "MISSING"
);

async function updateMarketData() {
    console.log("Updating Market Data...");

    if (!ACCESS_TOKEN) {
        console.error("UPSTOX_ANALYTIC_TOKEN is missing.");
        return false;
    }

    try {
        const [stocks] = await db.execute(`
            SELECT instrument_key
            FROM market_stocks_data
            WHERE instrument_key IS NOT NULL
              AND TRIM(instrument_key) <> ''
            ORDER BY instrument_key
        `);

        console.log(`Found ${stocks.length} Stocks`);

        const instrumentKeys = [
            ...new Set(
                stocks
                    .map(row => String(row.instrument_key).trim())
                    .filter(Boolean)
            ),
        ];

        const chunkSize = 500;

        let quotesProcessed = 0;
        let quotesUpdated = 0;
        let quotesSkipped = 0;

        for (let i = 0; i < instrumentKeys.length; i += chunkSize) {
            const chunk = instrumentKeys.slice(i, i + chunkSize);

            console.log(
                `Processing ${i + 1}-${Math.min(
                    i + chunk.length,
                    instrumentKeys.length
                )} of ${instrumentKeys.length}`
            );

            const response = await axios.get(
                "https://api.upstox.com/v2/market-quote/quotes",
                {
                    headers: {
                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                    },
                    params: {
                        instrument_key: chunk.join(","),
                    },
                    timeout: 30000,
                }
            );

            const quotes = response.data?.data || {};

            console.log(
                `Received ${Object.keys(quotes).length} quotes`
            );

            for (const responseKey in quotes) {
                const q = quotes[responseKey];

                quotesProcessed++;

                // Some Upstox responses can have null OHLC
                if (
                    !q ||
                    !q.ohlc ||
                    q.last_price == null ||
                    q.ohlc.close == null
                ) {
                    quotesSkipped++;

                    console.log(
                        "Skipping incomplete quote:",
                        responseKey,
                        {
                            last_price: q?.last_price ?? null,
                            volume: q?.volume ?? null,
                            ohlc: q?.ohlc ?? null,
                        }
                    );

                    continue;
                }

                // IMPORTANT:
                // Upstox responseKey is like:
                // BSE_EQ:JAYATMA
                //
                // Database instrument_key is like:
                // BSE_EQ|INE....
                //
                // q.instrument_token contains the correct DB key.
                const instrumentKey = q.instrument_token;

                if (!instrumentKey) {
                    quotesSkipped++;

                    console.log(
                        "Skipping quote without instrument_token:",
                        responseKey
                    );

                    continue;
                }


                // if (!Number.isFinite(lastPrice) || !Number.isFinite(previousClose)) {
                //     quotesSkipped++;

                //     console.log(
                //         "Skipping invalid numeric quote:",
                //         responseKey
                //     );

                //     continue;
                // }

                const lastPrice = Number(q.last_price);
                const changeValue = Number(q.net_change ?? 0);

                const previousClose =
                    lastPrice - changeValue;

                const changePercent =
                    previousClose !== 0
                        ? (changeValue / previousClose) * 100
                        : 0;

                const [result] = await db.execute(
                    `
    UPDATE market_stocks_data
    SET
        price = ?,
        change_value = ?,
        change_percent = ?,
        open_price = ?,
        previous_close = ?,
        day_high = ?,
        day_low = ?,
        day_close = ?,
        volume = ?,
        updated_at = NOW()
    WHERE instrument_key = ?
    `,
                    [
                        lastPrice,
                        changeValue,
                        changePercent,
                        q.ohlc.open ?? null,
                        previousClose,
                        q.ohlc.high ?? null,
                        q.ohlc.low ?? null,
                        lastPrice,
                        q.volume ?? 0,
                        instrumentKey,
                    ]
                );

                if (result.affectedRows === 1) {
                    quotesUpdated++;
                } else {
                    console.log(
                        "No DB row matched:",
                        {
                            instrumentKey,
                            responseKey,
                        }
                    );
                }
            }

            console.log(
                `Completed ${Math.min(
                    i + chunk.length,
                    instrumentKeys.length
                )}/${instrumentKeys.length}`
            );
        }

        console.log("\n========== MARKET UPDATE SUMMARY ==========");
        console.log(`Stocks in DB:     ${instrumentKeys.length}`);
        console.log(`Quotes processed: ${quotesProcessed}`);
        console.log(`Quotes updated:   ${quotesUpdated}`);
        console.log(`Quotes skipped:   ${quotesSkipped}`);
        console.log("Market Data Updated Successfully");
        console.log("===========================================\n");

        return true;
    } catch (err) {
        console.error("Market update failed.");

        if (err.response?.data) {
            console.error(
                JSON.stringify(err.response.data, null, 2)
            );
        } else {
            console.error(err.message);
        }

        return false;
    }
}

module.exports = {
    updateMarketData,
};