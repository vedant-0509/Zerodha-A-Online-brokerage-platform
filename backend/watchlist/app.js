require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");

const authenticateToken = require("../middleware/authenticateToken");
const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");
const { validateBodyObject } = require("../middleware/validateRequest");

const {
    connectMongoDB,
    getMongoDB,
    closeMongoDB,
} = require("../config/mongodb");

const app = express();

const PORT = 3008;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

// =====================================================
// MONGODB
// =====================================================

function getCollection(name) {
    return getMongoDB().collection(name);
}

const usersCollection = () => getCollection("users");
const watchlistCollection = () => getCollection("watchlist");
const marketStocksCollection = () => getCollection("marketStocks");

// =====================================================
// HOME
// =====================================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Watchlist API Running 🚀",
        port: PORT,
        database: "MongoDB",
    });
});

// =====================================================
// GET USER WATCHLIST
// GET /watchlist
// =====================================================

app.get("/watchlist", authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;

        // -------------------------------------------------
        // Check user
        // -------------------------------------------------

        const user = await usersCollection().findOne(
            {
                userId,
            },
            {
                projection: {
                    _id: 0,
                    userId: 1,
                    fullName: 1,
                    email: 1,
                },
            },
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // -------------------------------------------------
        // Get user's watchlist
        // -------------------------------------------------

        const watchlist = await watchlistCollection()
            .find({
                userId,
            })
            .sort({
                addedAt: -1,
            })
            .toArray();

        const instrumentKeys = watchlist
            .map((item) => item.instrumentKey)
            .filter(Boolean);

        let marketStocks = [];

        if (instrumentKeys.length > 0) {
            marketStocks = await marketStocksCollection()
                .find({
                    instrumentKey: {
                        $in: instrumentKeys,
                    },
                })
                .toArray();
        }

        const stockMap = new Map(
            marketStocks.map((stock) => [
                stock.instrumentKey,
                stock,
            ]),
        );

        const stocks = watchlist
            .map((item) => {
                const stock = stockMap.get(
                    item.instrumentKey,
                );

                // Preserve SQL INNER JOIN behavior:
                // if market stock doesn't exist, don't return it.
                if (!stock) {
                    return null;
                }

                return {
                    watchlist_id:
                        item.watchlistId,

                    user_id:
                        item.userId,

                    instrument_key:
                        item.instrumentKey,

                    symbol:
                        stock.symbol,

                    name:
                        stock.name,

                    price:
                        Number(stock.price || 0),

                    current_price:
                        Number(stock.price || 0),

                    change_value:
                        Number(stock.changeValue || 0),

                    change_percent:
                        Number(stock.changePercent || 0),

                    open_price:
                        Number(stock.openPrice || 0),

                    previous_close:
                        Number(stock.previousClose || 0),

                    day_high:
                        Number(stock.dayHigh || 0),

                    day_low:
                        Number(stock.dayLow || 0),

                    volume:
                        Number(stock.volume || 0),

                    sector:
                        stock.sector,

                    updated_at:
                        stock.updatedAt ?? null,

                    added_at:
                        item.addedAt ?? null,
                };
            })
            .filter(Boolean);

        res.json({
            success: true,

            user: {
                user_id: user.userId,
                full_name: user.fullName,
                email: user.email,
            },

            count: stocks.length,

            stocks,
        });
    } catch (error) {
        console.error(
            "❌ Get Watchlist Error:",
            error,
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch watchlist",
        });
    }
});

// =====================================================
// SEARCH STOCKS
// GET /search?q=reliance
// =====================================================

app.get("/search", async (req, res) => {
    try {
        const q = String(
            req.query.q || "",
        ).trim();

        if (q.length < 2) {
            return res.json({
                success: true,
                results: [],
            });
        }

        const escaped = q.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
        );

        const regex = new RegExp(
            escaped,
            "i",
        );

        const prefixRegex = new RegExp(
            `^${escaped}`,
            "i",
        );

        const stocks =
            await marketStocksCollection()
                .find({
                    $or: [
                        {
                            name: regex,
                        },
                        {
                            symbol: regex,
                        },
                        {
                            instrumentKey: regex,
                        },
                    ],
                })
                .limit(50)
                .toArray();

        const results = stocks
            .map((stock) => {
                let rank = 3;

                if (
                    prefixRegex.test(
                        stock.symbol || "",
                    )
                ) {
                    rank = 1;
                } else if (
                    prefixRegex.test(
                        stock.name || "",
                    )
                ) {
                    rank = 2;
                }

                return {
                    stock,
                    rank,
                };
            })
            .sort((a, b) => {
                if (a.rank !== b.rank) {
                    return a.rank - b.rank;
                }

                return String(
                    a.stock.name || "",
                ).localeCompare(
                    String(
                        b.stock.name || "",
                    ),
                );
            })
            .slice(0, 10)
            .map(({ stock }) => ({
                id:
                    stock.mysqlId ??
                    stock.id ??
                    null,

                instrument_key:
                    stock.instrumentKey,

                symbol:
                    stock.symbol,

                name:
                    stock.name,

                price:
                    Number(stock.price || 0),

                change_value:
                    Number(
                        stock.changeValue || 0,
                    ),

                change_percent:
                    Number(
                        stock.changePercent || 0,
                    ),

                open_price:
                    Number(
                        stock.openPrice || 0,
                    ),

                previous_close:
                    Number(
                        stock.previousClose || 0,
                    ),

                day_high:
                    Number(
                        stock.dayHigh || 0,
                    ),

                day_low:
                    Number(
                        stock.dayLow || 0,
                    ),

                volume:
                    Number(stock.volume || 0),

                sector:
                    stock.sector,
            }));

        res.json({
            success: true,
            query: q,
            count: results.length,
            results,
        });
    } catch (error) {
        console.error(
            "❌ Search Error:",
            error,
        );

        res.status(500).json({
            success: false,
            message: "Search failed",
        });
    }
});

// =====================================================
// ADD STOCK TO WATCHLIST
// POST /watchlist
// =====================================================

app.post(
    "/watchlist",
    authenticateToken,
    validateBodyObject({
        allowEmpty: false,
        allowedFields: ["instrumentKey"],
        requiredFields: ["instrumentKey"],
        fieldRules: {
            instrumentKey: {
                type: "string",
                maxLength: 255,
            },
        },
    }),
    async (req, res) => {
        try {
            const {
                instrumentKey,
            } = req.body || {};

            const body = req.body || {};

            // Never allow client-controlled user ID.
            if (
                Object.prototype.hasOwnProperty.call(
                    body,
                    "userId",
                ) ||
                Object.prototype.hasOwnProperty.call(
                    body,
                    "user_id",
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "userId must not be supplied; use the authenticated session",
                });
            }

            const userId = req.userId;

            if (!instrumentKey) {
                return res.status(400).json({
                    success: false,
                    message:
                        "instrumentKey is required",
                });
            }

            // -------------------------------------------------
            // Check user
            // -------------------------------------------------

            const user =
                await usersCollection().findOne(
                    {
                        userId,
                    },
                    {
                        projection: {
                            _id: 1,
                        },
                    },
                );

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // -------------------------------------------------
            // Check stock
            // -------------------------------------------------

            const stock =
                await marketStocksCollection()
                    .findOne({
                        instrumentKey,
                    });

            if (!stock) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Stock not found in marketStocks",
                });
            }

            // -------------------------------------------------
            // Check duplicate
            // -------------------------------------------------

            const existing =
                await watchlistCollection()
                    .findOne({
                        userId,
                        instrumentKey,
                    });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Stock already exists in watchlist",
                    watchlist_id:
                        existing.watchlistId,
                });
            }

            // -------------------------------------------------
            // Create watchlist ID
            // -------------------------------------------------

            const watchlistId =
                crypto.randomUUID();

            const now = new Date();

            // -------------------------------------------------
            // Insert
            // -------------------------------------------------

            try {
                await watchlistCollection()
                    .insertOne({
                        watchlistId,
                        userId,
                        instrumentKey,
                        addedAt: now,
                        createdAt: now,
                        updatedAt: now,
                    });
            } catch (insertError) {
                // Protect against race-condition duplicate inserts.
                if (
                    insertError?.code === 11000
                ) {
                    const duplicate =
                        await watchlistCollection()
                            .findOne({
                                userId,
                                instrumentKey,
                            });

                    return res.status(409).json({
                        success: false,
                        message:
                            "Stock already exists in watchlist",
                        watchlist_id:
                            duplicate?.watchlistId ||
                            null,
                    });
                }

                throw insertError;
            }

            res.status(201).json({
                success: true,

                message:
                    "Stock added to watchlist",

                watchlist_id:
                    watchlistId,

                stock: {
                    instrument_key:
                        stock.instrumentKey,

                    symbol:
                        stock.symbol,

                    name:
                        stock.name,
                },
            });
        } catch (error) {
            console.error(
                "❌ Add Watchlist Error:",
                error,
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add stock to watchlist",
            });
        }
    },
);

// =====================================================
// DELETE STOCK FROM WATCHLIST
// DELETE /watchlist/:instrumentKey
// =====================================================

app.delete(
    "/watchlist/:instrumentKey",
    authenticateToken,
    async (req, res) => {
        try {
            const userId = req.userId;

            const instrumentKey =
                decodeURIComponent(
                    req.params.instrumentKey,
                );

            const result =
                await watchlistCollection()
                    .deleteOne({
                        userId,
                        instrumentKey,
                    });

            if (result.deletedCount === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Stock not found in watchlist",
                });
            }

            res.json({
                success: true,
                message:
                    "Stock removed from watchlist",
            });
        } catch (error) {
            console.error(
                "❌ Delete Watchlist Error:",
                error,
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to remove stock",
            });
        }
    },
);

// =====================================================
// 404
// =====================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route Not Found",
    });
});

app.use(errorHandler);

// =====================================================
// SERVER
// =====================================================

let server;

async function startServer() {
    try {
        await connectMongoDB();

        server = app.listen(
            PORT,
            "127.0.0.1",
            () => {
                console.log("");
                console.log(
                    "========================================",
                );
                console.log(
                    "🚀 Watchlist Server Running",
                );
                console.log(
                    `http://localhost:${PORT}`,
                );
                console.log(
                    "Database: MongoDB",
                );
                console.log(
                    "========================================",
                );

                console.log(
                    "Available routes:",
                );

                console.log(
                    `GET  http://localhost:${PORT}/`,
                );

                console.log(
                    `GET  http://localhost:${PORT}/watchlist`,
                );

                console.log(
                    `GET  http://localhost:${PORT}/search?q=reliance`,
                );

                console.log(
                    `POST http://localhost:${PORT}/watchlist`,
                );

                console.log(
                    `DELETE http://localhost:${PORT}/watchlist/:instrumentKey`,
                );

                console.log(
                    "========================================",
                );
            },
        );

        server.on("error", (error) => {
            console.error(
                "❌ Server Error:",
                error,
            );

            process.exit(1);
        });
    } catch (error) {
        console.error(
            "❌ Watchlist startup failed:",
            error,
        );

        process.exit(1);
    }
}

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

async function shutdown(signal) {
    console.log(
        `\nReceived ${signal}. Shutting down Watchlist service...`,
    );

    try {
        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }

        await closeMongoDB();

        console.log(
            "Watchlist service shutdown complete.",
        );

        process.exit(0);
    } catch (error) {
        console.error(
            "Shutdown error:",
            error,
        );

        process.exit(1);
    }
}

process.on(
    "SIGINT",
    () => shutdown("SIGINT"),
);

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM"),
);

startServer();