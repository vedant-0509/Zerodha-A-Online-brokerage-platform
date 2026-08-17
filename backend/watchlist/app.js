require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const crypto = require("crypto");

const app = express();

const PORT = 3008;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: true,
        credentials: true,
    }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// MYSQL CONNECTION
// =====================================================

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// =====================================================
// DATABASE TEST
// =====================================================

async function testDatabase() {
    try {
        const connection = await db.getConnection();

        console.log("✅ MySQL Connected Successfully");

        connection.release();
    } catch (error) {
        console.error("❌ MySQL Connection Failed");
        console.error(error);
    }
}

testDatabase();

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Watchlist API Running 🚀",
        port: PORT,
    });
});

// =====================================================
// GET USER WATCHLIST
//
// GET
// /watchlist/:userId
//
// Example:
// /watchlist/b9246e0a-96aa-49ea-8593-9b0912d7ced8
// =====================================================

app.get("/watchlist/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }

        // -------------------------------------------------
        // Check user
        // -------------------------------------------------

        const [users] = await db.execute(
            `
            SELECT
                user_id,
                full_name,
                email
            FROM users
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId],
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // -------------------------------------------------
        // Get user's watchlist
        //
        // IMPORTANT:
        // Data comes directly from market_stocks_data
        // -------------------------------------------------

        const [rows] = await db.execute(
            `
            SELECT
                w.watchlist_id,
                w.user_id,
                w.instrument_key,
                w.added_at,

                m.id,
                m.symbol,
                m.name,
                m.price,
                m.change_value,
                m.change_percent,
                m.open_price,
                m.previous_close,
                m.day_high,
                m.day_low,
                m.volume,
                m.updated_at,
                m.sector

            FROM watchlist w

            INNER JOIN market_stocks_data m
                ON w.instrument_key = m.instrument_key

            WHERE w.user_id = ?

            ORDER BY w.added_at DESC
            `,
            [userId],
        );

        const stocks = rows.map((stock) => ({
            watchlist_id: stock.watchlist_id,

            user_id: stock.user_id,

            instrument_key: stock.instrument_key,

            symbol: stock.symbol,

            name: stock.name,

            price: Number(stock.price || 0),

            current_price: Number(stock.price || 0),

            change_value: Number(stock.change_value || 0),

            change_percent: Number(stock.change_percent || 0),

            open_price: Number(stock.open_price || 0),

            previous_close: Number(stock.previous_close || 0),

            day_high: Number(stock.day_high || 0),

            day_low: Number(stock.day_low || 0),

            volume: Number(stock.volume || 0),

            sector: stock.sector,

            updated_at: stock.updated_at,

            added_at: stock.added_at,
        }));

        res.json({
            success: true,

            user: {
                user_id: users[0].user_id,
                full_name: users[0].full_name,
                email: users[0].email,
            },

            count: stocks.length,

            stocks,
        });
    } catch (error) {
        console.error("❌ Get Watchlist Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch watchlist",
        });
    }
});

// =====================================================
// SEARCH STOCKS
//
// GET
// /search?q=reliance
//
// IMPORTANT:
// Search happens ONLY inside market_stocks_data.
// =====================================================

app.get("/search", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        // Don't search for empty/very short queries
        if (q.length < 2) {
            return res.json({
                success: true,
                results: [],
            });
        }

        const searchTerm = `%${q}%`;

        const [rows] = await db.execute(
            `
            SELECT
                id,
                instrument_key,
                symbol,
                name,
                price,
                change_value,
                change_percent,
                open_price,
                previous_close,
                day_high,
                day_low,
                volume,
                sector,
                updated_at

            FROM market_stocks_data

            WHERE
                name LIKE ?
                OR symbol LIKE ?
                OR instrument_key LIKE ?

            ORDER BY

                CASE
                    WHEN symbol LIKE ? THEN 1
                    WHEN name LIKE ? THEN 2
                    ELSE 3
                END,

                name ASC

            LIMIT 10
            `,
            [searchTerm, searchTerm, searchTerm, `${q}%`, `${q}%`],
        );

        const results = rows.map((stock) => ({
            id: stock.id,

            instrument_key: stock.instrument_key,

            symbol: stock.symbol,

            name: stock.name,

            price: Number(stock.price || 0),

            change_value: Number(stock.change_value || 0),

            change_percent: Number(stock.change_percent || 0),

            open_price: Number(stock.open_price || 0),

            previous_close: Number(stock.previous_close || 0),

            day_high: Number(stock.day_high || 0),

            day_low: Number(stock.day_low || 0),

            volume: Number(stock.volume || 0),

            sector: stock.sector,
        }));

        res.json({
            success: true,
            query: q,
            count: results.length,
            results,
        });
    } catch (error) {
        console.error("❌ Search Error:", error);

        res.status(500).json({
            success: false,
            message: "Search failed",
        });
    }
});

// =====================================================
// ADD STOCK TO USER WATCHLIST
//
// POST
// /watchlist
//
// Body:
//
// {
//     "userId": "...",
//     "instrumentKey": "NSE_EQ|INE002A01018"
// }
// =====================================================

app.post("/watchlist", async (req, res) => {
    try {
        const { userId, instrumentKey } = req.body;

        if (!userId || !instrumentKey) {
            return res.status(400).json({
                success: false,
                message: "userId and instrumentKey are required",
            });
        }

        // -------------------------------------------------
        // Check user
        // -------------------------------------------------

        const [users] = await db.execute(
            `
            SELECT user_id
            FROM users
            WHERE user_id = ?
            LIMIT 1
            `,
            [userId],
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // -------------------------------------------------
        // Check stock exists
        // -------------------------------------------------

        const [stocks] = await db.execute(
            `
            SELECT
                instrument_key,
                symbol,
                name,
                price,
                change_percent,
                volume,
                day_high,
                day_low
            FROM market_stocks_data
            WHERE instrument_key = ?
            LIMIT 1
            `,
            [instrumentKey],
        );

        if (stocks.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock not found in market_stocks_data",
            });
        }

        // -------------------------------------------------
        // Check duplicate
        // -------------------------------------------------

        const [existing] = await db.execute(
            `
            SELECT watchlist_id
            FROM watchlist
            WHERE
                user_id = ?
                AND instrument_key = ?
            LIMIT 1
            `,
            [userId, instrumentKey],
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Stock already exists in watchlist",
                watchlist_id: existing[0].watchlist_id,
            });
        }

        // -------------------------------------------------
        // Create watchlist ID
        // -------------------------------------------------

        const watchlistId = crypto.randomUUID();

        // -------------------------------------------------
        // Insert
        // -------------------------------------------------

        await db.execute(
            `
            INSERT INTO watchlist
            (
                watchlist_id,
                user_id,
                instrument_key
            )
            VALUES
            (?, ?, ?)
            `,
            [watchlistId, userId, instrumentKey],
        );

        res.status(201).json({
            success: true,

            message: "Stock added to watchlist",

            watchlist_id: watchlistId,

            stock: {
                instrument_key: stocks[0].instrument_key,

                symbol: stocks[0].symbol,

                name: stocks[0].name,
            },
        });
    } catch (error) {
        console.error("❌ Add Watchlist Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to add stock to watchlist",
        });
    }
});

// =====================================================
// DELETE STOCK FROM WATCHLIST
//
// DELETE
// /watchlist/:userId/:instrumentKey
//
// =====================================================

app.delete("/watchlist/:userId/:instrumentKey", async (req, res) => {
    try {
        const { userId, instrumentKey } = req.params;

        const [result] = await db.execute(
            `
                DELETE FROM watchlist

                WHERE
                    user_id = ?
                    AND instrument_key = ?
                `,
            [userId, instrumentKey],
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Stock not found in watchlist",
            });
        }

        res.json({
            success: true,
            message: "Stock removed from watchlist",
        });
    } catch (error) {
        console.error("❌ Delete Watchlist Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to remove stock",
        });
    }
});

// =====================================================
// 404
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});

// =====================================================
// SERVER
// =====================================================

const server = app.listen(PORT, () => {
    console.log("");
    console.log("========================================");
    console.log(`🚀 Watchlist Server Running`);
    console.log(`http://localhost:${PORT}`);
    console.log("========================================");

    console.log("Available routes:");

    console.log(`GET  http://localhost:${PORT}/`);

    console.log(`GET  http://localhost:${PORT}/watchlist/:userId`);

    console.log(`GET  http://localhost:${PORT}/search?q=reliance`);

    console.log(`POST http://localhost:${PORT}/watchlist`);

    console.log(
        `DELETE http://localhost:${PORT}/watchlist/:userId/:instrumentKey`,
    );

    console.log("========================================");
});

server.on("error", (error) => {
    console.error("❌ Server Error:", error);
});
