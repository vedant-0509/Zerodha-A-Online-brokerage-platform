const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();

app.use(cors());
app.use(express.json());

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

app.get("/watchlist/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const [rows] = await db.execute(
            `
            SELECT
                w.watchlist_id,

                i.instrument_key,
                i.trading_symbol,
                i.name AS instrument_name,
                i.exchange,

                m.price AS current_price,
                m.change_percent,
                m.volume,
                m.day_low,
                m.day_high

            FROM watchlist w

            INNER JOIN instruments_master i
                ON w.instrument_key = i.instrument_key

            LEFT JOIN market_stocks_data m
                ON i.instrument_key = m.instrument_key

            WHERE w.user_id = ?

            ORDER BY w.added_at DESC
            `,
            [userId]
        );

        const response = rows.map((stock) => ({
            watchlist_id: stock.watchlist_id,

            instrument_key: stock.instrument_key,
            trading_symbol: stock.trading_symbol,
            instrument_name: stock.instrument_name,
            exchange: stock.exchange,

            current_price: stock.current_price ?? 0,

            change_percent: stock.change_percent ?? 0,

            volume: stock.volume ?? 0,

            day_low: stock.day_low ?? 0,
            day_high: stock.day_high ?? 0,
        }));

        res.json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

app.listen(3008, () => {
    console.log("✅ Watchlist API running on http://localhost:3008");
});