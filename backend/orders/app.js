require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();

const PORT = 3007;

const JWT_SECRET = process.env.JWT_SECRET || "zerodha_secret_key";


/* MIDDLEWARE */
app.use(
    cors({
        origin: "http://localhost:3002",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* DATABASE */
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});


/* DATABASE CONNECTION CHECK */
async function testDatabase() {
    try {
        const connection = await db.getConnection();
        connection.release();
    } catch (error) {
        console.error(error.message);
    }
}


/* JWT AUTH MIDDLEWARE */
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token required",
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing",
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded.userId) {
            return res.status(401).json({
                success: false,
                message: "Invalid token payload",
            });
        }

        /*
         * IMPORTANT
         *
         * We do NOT accept userId from the frontend.
         *
         * userId comes from the verified JWT.
         */

        req.userId = decoded.userId;

        next();

    } catch (error) {
        console.error("JWT Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
}


/*HEALTH CHECK */
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Orders API Running 🚀",
        port: PORT,
    });
});


/*GET LOGGED-IN USER ORDERS */
app.get("/orders", authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;
        const [rows] = await db.execute(
            `
                SELECT
                    order_id,
                    user_id,
                    instrument_key,
                    symbol,
                    instrument_name,
                    exchange,
                    order_type,
                    product,
                    quantity,
                    price,
                    invested_amount,
                    order_status,
                    failure_reason,
                    placed_at,
                    executed_at

                FROM orders

                WHERE user_id = ?

                ORDER BY placed_at DESC
                `,
            [userId],
        );


        /* GROUP ORDERS BY DATE*/
        const grouped = {};

        rows.forEach((order) => {
            if (!order.placed_at) return;

            const date = new Date(order.placed_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kolkata",
            });

            if (!grouped[date]) grouped[date] = []

            grouped[date].push({
                order_id: order.order_id,
                name: order.instrument_name,
                symbol: order.symbol,
                instrument_key: order.instrument_key,
                exchange: order.exchange,
                type: order.order_type,
                product: order.product,
                quantity: Number(order.quantity || 0),
                price: Number(order.price || 0),
                amount: Number(order.invested_amount || 0),
                status: order.order_status,
                failure_reason: order.failure_reason,

                time: new Date(order.placed_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Kolkata",
                }),
                placed_at: order.placed_at,
                executed_at: order.executed_at,
            });
        });

        /* CONVERT OBJECT TO ARRAY */

        const result = Object.keys(grouped).map((date) => ({
            date,
            items: grouped[date],
        }));

        return res.json(result);

    } catch (error) {
        console.error("Orders API Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to fetch orders",
        });
    }
});


/* ORDER COUNTS */
app.get("/orders/counts", authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        const [rows] = await db.execute(
            `
                SELECT
                    COUNT(*) AS total,

                    SUM(
                        order_status = 'COMPLETED'
                    ) AS completed,

                    SUM(
                        order_status = 'PENDING'
                    ) AS pending,

                    SUM(
                        order_status = 'FAILED'
                    ) AS failed,

                    SUM(
                        order_status = 'CANCELLED'
                    ) AS cancelled,

                    SUM(
                        order_type = 'BUY'
                    ) AS buys,

                    SUM(
                        order_type = 'SELL'
                    ) AS sells

                FROM orders

                WHERE user_id = ?
                `,
            [userId],
        );

        const data = rows[0];

        res.json({
            success: true,

            counts: {
                total: Number(data.total || 0),
                completed: Number(data.completed || 0),
                pending: Number(data.pending || 0),
                failed: Number(data.failed || 0),
                cancelled: Number(data.cancelled || 0),
                buys: Number(data.buys || 0),
                sells: Number(data.sells || 0),
            },
        });
    } catch (error) {
        console.error("Order Count Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch order counts",
        });
    }
});


/* GET SINGLE ORDER */
app.get("/order/:orderId", authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.userId;

        const [rows] = await db.execute(
            `
                SELECT
                    order_id,
                    user_id,
                    instrument_key,
                    symbol,
                    instrument_name,
                    exchange,
                    order_type,
                    product,
                    quantity,
                    price,
                    invested_amount,
                    order_status,
                    failure_reason,
                    placed_at,
                    executed_at

                FROM orders

                WHERE
                    order_id = ?
                    AND user_id = ?

                LIMIT 1
                `,
            [orderId, userId],
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,

                message: "Order not found",
            });
        }

        const order = rows[0];

        res.json({
            success: true,

            order: {
                order_id: order.order_id,
                symbol: order.symbol,
                name: order.instrument_name,
                exchange: order.exchange,
                type: order.order_type,
                product: order.product,
                quantity: Number(order.quantity || 0),
                price: Number(order.price || 0),
                amount: Number(order.invested_amount || 0),
                status: order.order_status,
                failure_reason: order.failure_reason,
                placed_at: order.placed_at,
                executed_at: order.executed_at,
            },
        });
    } catch (error) {
        console.error("Single Order Error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch order",
        });
    }
});


/* 404 */
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
        path: req.originalUrl,
    });
});


/* GLOBAL ERROR HANDLER */
app.use((error, req, res, next) => {
    console.error("Global Error:", error);

    res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
});


/* START SERVER */
async function startServer() {
    await testDatabase();

    app.listen(PORT, () => {
        console.log("🚀 Orders Server Running");
        console.log(`http://localhost:${PORT}`);
        console.log("Available routes:");
        console.log(`GET http://localhost:${PORT}/`);
        console.log(`GET http://localhost:${PORT}/orders`);
        console.log(`GET http://localhost:${PORT}/orders/counts`);
        console.log(`GET http://localhost:${PORT}/order/:orderId`);
        console.log("");
    });
}

startServer();