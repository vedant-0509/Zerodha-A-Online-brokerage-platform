const path = require("path");
require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

const axios = require("axios");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");

const {
    connectMongoDB,
    getMongoDB,
    closeMongoDB,
} = require("../config/mongodb");

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

// ============================================================
// ROUTES / HELPERS
// ============================================================

const searchRoutes = require("./search");
const { fetchNews } = require("./news");
const updatePreviousClose = require("./reInit");

// ============================================================
// MONGODB
// ============================================================

function getCollection(name) {
    return getMongoDB().collection(name);
}

function getMarketGainerLoserCollection() {
    return getCollection("marketGainerloser");
}

function getMarketNewsCollection() {
    return getCollection("marketNews");
}

function getMarketUpdateLogCollection() {
    return getCollection("marketUpdateLog");
}

// ============================================================
// UPSTOX
// ============================================================

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

const CUTOFF_HOUR = 15;
const CUTOFF_MIN = 45;

app.use("/search", searchRoutes);

// ============================================================
// RESPONSE NORMALIZER
// ============================================================

function normalizeMarketStock(stock) {
    if (!stock) return null;

    return {
        instrument_key: stock.instrumentKey,
        symbol: stock.symbol,
        name: stock.companyName,
        price: Number(stock.closePrice ?? 0),
        open_price: Number(stock.openPrice ?? 0),
        high_price: Number(stock.highPrice ?? 0),
        low_price: Number(stock.lowPrice ?? 0),
        previous_close: Number(stock.previousClose ?? 0),
        volume: Number(stock.volume ?? 0),
        change_percent: Number(stock.changePercent ?? 0),
        change_points: Number(stock.changePoints ?? 0),
        exchange: stock.exchange,
    };
}

// ============================================================
// TOP GAINERS
// ============================================================

app.get("/top-gainers", async (req, res) => {
    try {
        const collection = getMarketGainerLoserCollection();

        const stocks = await collection
            .find({})
            .sort({ changePercent: -1 })
            .limit(10)
            .toArray();

        const rows = stocks.map(normalizeMarketStock);

        res.json(rows);
    } catch (err) {
        console.error("top-gainers error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch top gainers",
        });
    }
});

// ============================================================
// TOP LOSERS
// ============================================================

app.get("/top-losers", async (req, res) => {
    try {
        const collection = getMarketGainerLoserCollection();

        const stocks = await collection
            .find({})
            .sort({ changePercent: 1 })
            .limit(10)
            .toArray();

        const rows = stocks.map(normalizeMarketStock);

        res.json(rows);
    } catch (err) {
        console.error("top-losers error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch top losers",
        });
    }
});

// ============================================================
// VOLUME SHOCKERS
// ============================================================

app.get("/volume-shockers", async (req, res) => {
    try {
        const collection = getMarketGainerLoserCollection();

        const stocks = await collection
            .find({})
            .sort({ volume: -1 })
            .limit(10)
            .toArray();

        const rows = stocks.map(normalizeMarketStock);

        res.json(rows);
    } catch (err) {
        console.error("volume-shockers error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch volume shockers",
        });
    }
});

// ============================================================
// GET SINGLE STOCK
//
// Used by ShareholdingPattern when:
// 1. User clicks a stock
// 2. User refreshes the detail page
// 3. User directly opens /dashboard/stocks/explore/:symbol
// ============================================================

app.get("/stock/:symbol", async (req, res) => {
    try {
        const symbol = decodeURIComponent(req.params.symbol).trim();

        if (!symbol) {
            return res.status(400).json({
                success: false,
                message: "Symbol is required",
            });
        }

        const collection = getMarketGainerLoserCollection();

        const stock = await collection.findOne({
            symbol: symbol,
        });

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: `Stock ${symbol} not found`,
            });
        }

        const price = Number(stock.closePrice ?? 0);
        const previousClose = Number(stock.previousClose ?? 0);

        const changePoints =
            previousClose > 0
                ? Number((price - previousClose).toFixed(2))
                : Number(stock.changePoints ?? 0);

        const changePercent =
            previousClose > 0
                ? Number(((changePoints / previousClose) * 100).toFixed(2))
                : Number(stock.changePercent ?? 0);

        res.json({
            success: true,
            data: {
                instrument_key: stock.instrumentKey,
                symbol: stock.symbol,
                name: stock.companyName,
                price,
                open_price: Number(stock.openPrice ?? 0),
                high_price: Number(stock.highPrice ?? 0),
                low_price: Number(stock.lowPrice ?? 0),
                previous_close: previousClose,
                volume: Number(stock.volume ?? 0),
                change_points: changePoints,
                change_percent: changePercent,
                exchange: stock.exchange,
                trading_date: stock.tradingDate ?? null,
                updated_at: stock.updatedAt ?? null,
            },
        });
    } catch (err) {
        console.error("stock lookup error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch stock",
        });
    }
});

// ============================================================
// SECTOR TRENDS
// ============================================================

app.get("/sector-trends", async (req, res) => {
    try {
        const collection = getMarketGainerLoserCollection();

        const pipeline = [
            {
                $match: {
                    sector: {
                        $exists: true,
                        $ne: null,
                        $ne: "",
                    },
                },
            },
            {
                $group: {
                    _id: "$sector",
                    total: {
                        $sum: 1,
                    },
                    gainers: {
                        $sum: {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $convert: {
                                                input: "$changePercent",
                                                to: "double",
                                                onError: 0,
                                                onNull: 0,
                                            },
                                        },
                                        0,
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    losers: {
                        $sum: {
                            $cond: [
                                {
                                    $lt: [
                                        {
                                            $convert: {
                                                input: "$changePercent",
                                                to: "double",
                                                onError: 0,
                                                onNull: 0,
                                            },
                                        },
                                        0,
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    avg_change: {
                        $avg: {
                            $convert: {
                                input: "$changePercent",
                                to: "double",
                                onError: 0,
                                onNull: 0,
                            },
                        },
                    },
                },
            },
        ];

        const sectors = await collection.aggregate(pipeline).toArray();

        const normalized = sectors.map((sector) => ({
            sector: sector._id,
            total: Number(sector.total || 0),
            gainers: Number(sector.gainers || 0),
            losers: Number(sector.losers || 0),
            avg_change: Number(Number(sector.avg_change || 0).toFixed(2)),
        }));

        const gainers = [...normalized]
            .sort((a, b) => b.avg_change - a.avg_change)
            .slice(0, 5);

        const losers = [...normalized]
            .sort((a, b) => a.avg_change - b.avg_change)
            .slice(0, 5);

        res.json([...gainers, ...losers]);
    } catch (err) {
        console.error("sector-trends error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch sector trends",
        });
    }
});

// ============================================================
// NEWS
// ============================================================

app.get("/market-news", async (req, res) => {
    try {
        const collection = getMarketNewsCollection();

        // Deduplicate by articleLink.
        // Prefer the earliest inserted document for duplicate links.
        const pipeline = [
            {
                $match: {
                    articleLink: {
                        $exists: true,
                        $ne: null,
                        $ne: "",
                    },
                },
            },
            {
                $sort: {
                    articleLink: 1,
                    id: 1,
                },
            },
            {
                $group: {
                    _id: "$articleLink",
                    doc: {
                        $first: "$$ROOT",
                    },
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$doc",
                },
            },
            {
                $sort: {
                    publishedTime: -1,
                },
            },
            {
                $limit: 50,
            },
        ];

        const articles = await collection.aggregate(pipeline).toArray();

        const rows = articles.map((article) => ({
            symbol: article.symbol,
            title: article.heading,
            description: article.summary,
            image: article.thumbnail,
            link: article.articleLink,
            published_at: article.publishedTime ?? null,
            source: "Upstox News",
        }));

        res.json(rows);
    } catch (err) {
        console.error("market-news error:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch market news",
        });
    }
});

// ============================================================
// IST HELPERS
// ============================================================

function getISTNow() {
    return new Date(
        new Date().toLocaleString("en-US", {
            timeZone: "Asia/Kolkata",
        }),
    );
}

function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return `${y}-${m}-${day}`;
}

function toMongoDate(dateString) {
    return new Date(`${dateString}T00:00:00+05:30`);
}

// ============================================================
// DAILY UPDATE LOG
// ============================================================

async function ensureLogTable() {
    const collection = getMarketUpdateLogCollection();

    await collection.updateOne(
        {
            id: 1,
        },
        {
            $setOnInsert: {
                id: 1,
                lastRunDate: null,
                createdAt: new Date(),
            },
        },
        {
            upsert: true,
        },
    );
}

async function hasAlreadyRunToday(todayStr) {
    const collection = getMarketUpdateLogCollection();

    const row = await collection.findOne({
        id: 1,
    });

    if (!row || !row.lastRunDate) {
        return false;
    }

    if (row.lastRunDate instanceof Date) {
        return formatDate(
            new Date(
                row.lastRunDate.toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                }),
            ),
        ) === todayStr;
    }

    if (typeof row.lastRunDate === "string") {
        return row.lastRunDate.slice(0, 10) === todayStr;
    }

    return false;
}

async function markRunAsDone(todayStr) {
    const collection = getMarketUpdateLogCollection();

    await collection.updateOne(
        {
            id: 1,
        },
        {
            $set: {
                lastRunDate: toMongoDate(todayStr),
                updatedAt: new Date(),
            },
        },
        {
            upsert: true,
        },
    );
}

// ============================================================
// PREVIOUS TRADING DAY
// ============================================================

async function getPreviousTradingDay() {
    const now = getISTNow();

    const d = new Date(now);

    if (
        now.getHours() < CUTOFF_HOUR ||
        (now.getHours() === CUTOFF_HOUR &&
            now.getMinutes() < CUTOFF_MIN)
    ) {
        d.setDate(d.getDate() - 1);
    }

    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() - 1);
    }

    return formatDate(d);
}

// ============================================================
// UPDATE MARKET DATA AFTER MARKET CLOSE
// ============================================================

async function updateMarketData() {
    console.log("\nFetching today's market data...\n");

    let success = true;

    const collection = getMarketGainerLoserCollection();

    const stocks = await collection
        .find(
            {},
            {
                projection: {
                    _id: 1,
                    instrumentKey: 1,
                    previousClose: 1,
                },
            },
        )
        .sort({
            instrumentKey: 1,
        })
        .toArray();

    console.log(`Found ${stocks.length} stocks\n`);

    for (const stock of stocks) {
        try {
            const previousClose = Number(stock.previousClose ?? 0);

            const url =
                `https://api.upstox.com/v3/historical-candle/intraday/` +
                `${encodeURIComponent(stock.instrumentKey)}/days/1`;

            const { data } = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    Accept: "application/json",
                },
            });

            const candle = data?.data?.candles?.[0];

            if (!candle) {
                console.log(`No candle: ${stock.instrumentKey}`);
                success = false;
                continue;
            }

            const open = Number(candle[1]);
            const high = Number(candle[2]);
            const low = Number(candle[3]);
            const close = Number(candle[4]);
            const volume = Number(candle[5]);

            let changePoints = 0;
            let changePercent = 0;

            if (previousClose > 0) {
                changePoints = Number(
                    (close - previousClose).toFixed(2),
                );

                changePercent = Number(
                    ((changePoints / previousClose) * 100).toFixed(2),
                );
            }

            await collection.updateOne(
                {
                    _id: stock._id,
                },
                {
                    $set: {
                        tradingDate: toMongoDate(formatDate(getISTNow())),
                        openPrice: open,
                        highPrice: high,
                        lowPrice: low,
                        closePrice: close,
                        changePoints,
                        changePercent,
                        volume,
                        updatedAt: new Date(),
                    },
                },
            );

            console.log(
                `✓ ${stock.instrumentKey} ` +
                    `${previousClose} -> ${close} ` +
                    `(${changePercent}%)`,
            );
        } catch (err) {
            success = false;

            console.log(`Error: ${stock.instrumentKey}`);

            if (err.response) {
                console.log(err.response.data);
            } else {
                console.log(err.message);
            }
        }
    }

    if (success) {
        // MongoDB update pipeline:
        // previousClose = current closePrice
        await collection.updateMany(
            {
                closePrice: {
                    $exists: true,
                    $ne: null,
                },
            },
            [
                {
                    $set: {
                        previousClose: "$closePrice",
                    },
                },
            ],
        );

        console.log("✓ previousClose updated successfully.");
    } else {
        console.log(
            "⚠ Some stocks failed. previousClose NOT updated.",
        );
    }
}

// ============================================================
// DAILY POST-MARKET UPDATE
// ============================================================

async function checkAndRunDailyUpdate() {
    try {
        const now = getISTNow();

        const day = now.getDay();

        if (day === 0 || day === 6) {
            return;
        }

        const afterCutoff =
            now.getHours() > CUTOFF_HOUR ||
            (now.getHours() === CUTOFF_HOUR &&
                now.getMinutes() >= CUTOFF_MIN);

        if (!afterCutoff) {
            return;
        }

        const todayStr = formatDate(now);

        if (await hasAlreadyRunToday(todayStr)) {
            return;
        }

        console.log(
            `\n[${todayStr}] Running post-market-close update...`,
        );

        const previousTradingDay = await getPreviousTradingDay();

        console.log(
            "Previous Trading Day:",
            previousTradingDay,
        );

        await updatePreviousClose(
            null,
            previousTradingDay,
        );

        await fetchNews();

        await updateMarketData();

        await markRunAsDone(todayStr);

        console.log(
            `[${todayStr}] Daily update marked as done.\n`,
        );
    } catch (err) {
        console.error(
            "checkAndRunDailyUpdate error:",
            err,
        );
    }
}

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: "ROUTE_NOT_FOUND",
            message: "Route not found.",
        },
        requestId: req.requestId,
    });
});

app.use(errorHandler);

// ============================================================
// START SERVER
// ============================================================

let server;

async function startServer() {
    try {
        await connectMongoDB();

        await ensureLogTable();

        await checkAndRunDailyUpdate();

        setInterval(
            checkAndRunDailyUpdate,
            60 * 1000,
        );

        server = app.listen(
            PORT,
            "127.0.0.1",
            () => {
                console.log(
                    `Server Running on http://localhost:${PORT}`,
                );
                console.log(
                    "Database: MongoDB",
                );
            },
        );

        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(
                    `Port ${PORT} is already in use.`,
                );
            } else {
                console.error(
                    "Stocks server error:",
                    err,
                );
            }

            process.exit(1);
        });
    } catch (err) {
        console.error(
            "Startup failed:",
            err,
        );

        process.exit(1);
    }
}

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

async function shutdown(signal) {
    console.log(
        `\nReceived ${signal}. Shutting down Stocks service...`,
    );

    try {
        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }

        await closeMongoDB();

        console.log(
            "Stocks service shutdown complete.",
        );

        process.exit(0);
    } catch (err) {
        console.error(
            "Shutdown error:",
            err,
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