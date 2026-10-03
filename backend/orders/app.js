require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authenticateToken = require("../middleware/authenticateToken");
const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");

const {
    connectMongoDB,
    getMongoDB,
    closeMongoDB,
} = require("../config/mongodb");

const app = express();

const PORT = 3007;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({
    extended: false,
    limit: "16kb",
}));


/* =========================================================
   DATABASE
========================================================= */

function getOrdersCollection() {
    return getMongoDB().collection("orders");
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Orders API Running 🚀",
        port: PORT,
        database: "MongoDB",
    });
});


/* =========================================================
   GET LOGGED-IN USER ORDERS
========================================================= */

app.get("/orders", authenticateToken, async (req, res) => {

    try {

        const userId = req.userId;

        const orders = await getOrdersCollection()
            .find(
                { userId },
                {
                    projection: {
                        _id: 0,
                        orderId: 1,
                        userId: 1,
                        instrumentKey: 1,
                        symbol: 1,
                        instrumentName: 1,
                        exchange: 1,
                        orderType: 1,
                        product: 1,
                        quantity: 1,
                        price: 1,
                        investedAmount: 1,
                        orderStatus: 1,
                        failureReason: 1,
                        placedAt: 1,
                        executedAt: 1,
                    },
                }
            )
            .sort({ placedAt: -1 })
            .toArray();


        /* =================================================
           GROUP ORDERS BY DATE
        ================================================= */

        const grouped = {};

        orders.forEach((order) => {

            if (!order.placedAt) {
                return;
            }

            const date =
                new Date(order.placedAt)
                    .toLocaleDateString(
                        "en-IN",
                        {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                        }
                    );


            if (!grouped[date]) {
                grouped[date] = [];
            }


            grouped[date].push({

                order_id: order.orderId,

                name:
                    order.instrumentName,

                symbol:
                    order.symbol,

                instrument_key:
                    order.instrumentKey,

                exchange:
                    order.exchange,

                type:
                    order.orderType,

                product:
                    order.product,

                quantity:
                    Number(order.quantity || 0),

                price:
                    Number(order.price || 0),

                amount:
                    Number(order.investedAmount || 0),

                status:
                    order.orderStatus,

                failure_reason:
                    order.failureReason,

                time:
                    new Date(order.placedAt)
                        .toLocaleTimeString(
                            "en-IN",
                            {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                                timeZone: "Asia/Kolkata",
                            }
                        ),

                placed_at:
                    order.placedAt,

                executed_at:
                    order.executedAt,
            });
        });


        /* =================================================
           CONVERT OBJECT TO ARRAY
        ================================================= */

        const result =
            Object.keys(grouped).map(
                (date) => ({
                    date,
                    items: grouped[date],
                })
            );


        return res.json(result);

    } catch (error) {

        console.error(
            "Orders API Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to fetch orders",
        });
    }
});


/* =========================================================
   ORDER COUNTS
========================================================= */

app.get(
    "/orders/counts",
    authenticateToken,
    async (req, res) => {

        try {

            const userId = req.userId;

            const collection =
                getOrdersCollection();


            const counts = await collection
                .aggregate([
                    {
                        $match: {
                            userId,
                        },
                    },
                    {
                        $group: {
                            _id: null,

                            total: {
                                $sum: 1,
                            },

                            completed: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderStatus",
                                                "COMPLETED",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            pending: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderStatus",
                                                "PENDING",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            failed: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderStatus",
                                                "FAILED",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            cancelled: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderStatus",
                                                "CANCELLED",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            buys: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderType",
                                                "BUY",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },

                            sells: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$orderType",
                                                "SELL",
                                            ],
                                        },
                                        1,
                                        0,
                                    ],
                                },
                            },
                        },
                    },
                ])
                .toArray();


            const data =
                counts[0] || {};


            return res.json({
                success: true,

                counts: {
                    total:
                        Number(data.total || 0),

                    completed:
                        Number(data.completed || 0),

                    pending:
                        Number(data.pending || 0),

                    failed:
                        Number(data.failed || 0),

                    cancelled:
                        Number(data.cancelled || 0),

                    buys:
                        Number(data.buys || 0),

                    sells:
                        Number(data.sells || 0),
                },
            });

        } catch (error) {

            console.error(
                "Order Count Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to fetch order counts",
            });
        }
    }
);


/* =========================================================
   GET SINGLE ORDER
========================================================= */

app.get(
    "/order/:orderId",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                orderId,
            } = req.params;

            const userId =
                req.userId;


            const order =
                await getOrdersCollection()
                    .findOne(
                        {
                            orderId,
                            userId,
                        },
                        {
                            projection: {
                                _id: 0,
                                orderId: 1,
                                userId: 1,
                                instrumentKey: 1,
                                symbol: 1,
                                instrumentName: 1,
                                exchange: 1,
                                orderType: 1,
                                product: 1,
                                quantity: 1,
                                price: 1,
                                investedAmount: 1,
                                orderStatus: 1,
                                failureReason: 1,
                                placedAt: 1,
                                executedAt: 1,
                            },
                        }
                    );


            if (!order) {

                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }


            return res.json({
                success: true,

                order: {

                    order_id:
                        order.orderId,

                    symbol:
                        order.symbol,

                    name:
                        order.instrumentName,

                    exchange:
                        order.exchange,

                    type:
                        order.orderType,

                    product:
                        order.product,

                    quantity:
                        Number(
                            order.quantity || 0
                        ),

                    price:
                        Number(
                            order.price || 0
                        ),

                    amount:
                        Number(
                            order.investedAmount || 0
                        ),

                    status:
                        order.orderStatus,

                    failure_reason:
                        order.failureReason,

                    placed_at:
                        order.placedAt,

                    executed_at:
                        order.executedAt,
                },
            });

        } catch (error) {

            console.error(
                "Single Order Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Unable to fetch order",
            });
        }
    }
);


/* =========================================================
   404
========================================================= */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route Not Found",
        path: req.originalUrl,
    });
});


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(errorHandler);


/* =========================================================
   START SERVER
========================================================= */

let server;

async function startServer() {

    try {

        await connectMongoDB();

        server = app.listen(
            PORT,
            "127.0.0.1",
            () => {

                console.log(
                    "🚀 Orders Server Running"
                );

                console.log(
                    `http://localhost:${PORT}`
                );

                console.log(
                    "Database: MongoDB"
                );

                console.log(
                    "Available routes:"
                );

                console.log(
                    `GET http://localhost:${PORT}/`
                );

                console.log(
                    `GET http://localhost:${PORT}/orders`
                );

                console.log(
                    `GET http://localhost:${PORT}/orders/counts`
                );

                console.log(
                    `GET http://localhost:${PORT}/order/:orderId`
                );

                console.log("");
            }
        );


        server.on("error", (error) => {

            console.error(
                "❌ Orders Server Error:",
                error
            );

            if (
                error.code === "EADDRINUSE"
            ) {

                console.error(
                    `Port ${PORT} is already in use.`
                );
            }
        });

    } catch (error) {

        console.error(
            "❌ Failed to start Orders server:",
            error.message
        );

        process.exit(1);
    }
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {

    console.log(
        `\n${signal} received.`
    );

    try {

        if (server) {

            await new Promise(
                (resolve) => {
                    server.close(resolve);
                }
            );
        }

        await closeMongoDB();

        console.log(
            "Orders server stopped."
        );

        process.exit(0);

    } catch (error) {

        console.error(
            "Shutdown error:",
            error.message
        );

        process.exit(1);
    }
}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


startServer();