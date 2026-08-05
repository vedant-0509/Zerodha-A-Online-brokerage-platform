require("dotenv").config();

const mysql = require("mysql2/promise");
const axios = require("axios");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

 const express = require("express");
const cors = require("cors");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

async function updateMarketData() {
    console.log("Updating Market Data...");

    try {
        const [stocks] = await db.execute(`
            SELECT instrument_key
            FROM market_stocks_data
            ORDER BY instrument_key
        `);

        console.log(`Found ${stocks.length} Stocks`);

        const instrumentKeys = stocks.map(x => x.instrument_key);
        const chunkSize = 500;

        for (let i = 0; i < instrumentKeys.length; i += chunkSize) {
            const chunk = instrumentKeys.slice(i, i + chunkSize);

            const response = await axios.get(
                "https://api.upstox.com/v2/market-quote/quotes",{
                    headers: {Authorization: `Bearer ${ACCESS_TOKEN}`},
                    params: {instrument_key: chunk.join(",")}
                }
            );

            const quotes = response.data.data;

            for (const key in quotes) {
                const q = quotes[key];

                await db.execute(`
                    UPDATE market_stocks_data
                    SET
                        price=?,
                        change_value=?,
                        change_percent=?,
                        open_price=?,
                        previous_close=?,
                        day_high=?,
                        day_low=?,
                        volume=?,
                        updated_at=NOW()
                    WHERE instrument_key=?
                `,
                    [
                        q.last_price,
                        q.last_price - q.ohlc.close,
                        ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100,
                        q.ohlc.open,
                        q.ohlc.close,
                        q.ohlc.high,
                        q.ohlc.low,
                        q.volume,
                        key
                    ]);
            }
            console.log(`Updated ${Math.min(i + chunkSize, instrumentKeys.length)} Stocks`);
        }
        console.log("Market Data Updated Successfully");
        return true;
    }
    catch (err) {
        console.log(err.response?.data || err.message);
        return false;
    }
}

module.exports = { updateMarketData };