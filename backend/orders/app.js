const cors = require("cors");
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3007;

// Database Connection Pool
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Health Check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Orders API Running 🚀"
    });
});

// Get Orders of Particular User
app.get("/orders/:userId", async (req, res) => {
    try {

        const { userId } = req.params;

        const [rows] = await db.execute(
            `
    SELECT
        order_id,
        instrument_name,
        symbol,
        order_type,
        quantity,
        price,
        invested_amount,
        order_status,
        placed_at
    FROM orders
    WHERE user_id = ?
    ORDER BY placed_at DESC
    `,
            [userId]
        );

        const grouped = {};

        rows.forEach((order) => {

            const date = new Date(order.placed_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "2-digit",
            });

            if (!grouped[date]) {
                grouped[date] = [];
            }

            grouped[date].push({
                order_id: order.order_id,
                name: order.instrument_name,
                symbol: order.symbol,
                type: order.order_type,
                quantity: order.quantity,
                price: Number(order.price),
                amount: Number(order.invested_amount),
                status: order.order_status,
                time: new Date(order.placed_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                }),
            });

        });

        const result = Object.keys(grouped).map(date => ({
            date,
            items: grouped[date]
        }));

        console.log(result);

        res.json(result);

    } catch (err) {
        console.error("Orders API Error:", err);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

// 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Orders Server Running on http://localhost:${PORT}`);
});