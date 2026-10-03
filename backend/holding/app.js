const cors = require("cors");
const helmet = require("helmet");
const express = require("express");

const app = express();

require("dotenv").config();

const authenticateToken = require("../middleware/authenticateToken");
const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");

const {
    connectMongoDB,
    getMongoDB,
    closeMongoDB,
} = require("../config/mongodb");

const PORT = 3006;

app.use(express.json());
app.use(requestContext);

app.use(
    cors(
        createCorsOptions
            ? createCorsOptions()
            : undefined
    )
);

app.use(helmet());

function getCollections() {
    const db = getMongoDB();

    return {
        holdings: db.collection("holdings"),
        marketStocks: db.collection("marketStocks"),
    };
}


/* =========================================================
   HOLDINGS
========================================================= */

app.get("/holdings", authenticateToken, async (req, res, next) => {
    try {
        // User identity comes only from verified JWT.
        const userId = req.userId;

        const {
            holdings: holdingsCollection,
            marketStocks,
        } = getCollections();

        const holdingRows = await holdingsCollection
            .find({ userId })
            .sort({ createdAt: 1 })
            .toArray();

        const holdings = [];

        let totalInvestment = 0;
        let currentValue = 0;
        let todaysPnL = 0;
        let totalPreviousValue = 0;

        for (const holding of holdingRows) {

            const instrumentKey = holding.instrumentKey;

            const stock = await marketStocks.findOne(
                { instrumentKey },
                {
                    projection: {
                        _id: 0,
                        instrumentKey: 1,
                        symbol: 1,
                        name: 1,
                        price: 1,
                        changePercent: 1,
                        changeValue: 1,
                    },
                }
            );

            // Preserve SQL INNER JOIN behavior:
            // if stock doesn't exist, skip the holding.
            if (!stock) {
                continue;
            }

            const quantity = Number(holding.quantity || 0);
            const investment = Number(holding.investedValue || 0);
            const currentPrice = Number(stock.price || 0);
            const dayChange = Number(stock.changeValue || 0);

            const currentHoldingValue =
                currentPrice * quantity;

            const previousClose =
                currentPrice - dayChange;

            const previousHoldingValue =
                previousClose * quantity;

            const dayPnL =
                dayChange * quantity;

            const totalReturn =
                currentHoldingValue - investment;

            const totalReturnPercent =
                investment > 0
                    ? (totalReturn / investment) * 100
                    : 0;

            const averagePrice =
                quantity > 0
                    ? investment / quantity
                    : 0;

            totalInvestment += investment;
            currentValue += currentHoldingValue;
            todaysPnL += dayPnL;
            totalPreviousValue += previousHoldingValue;

            holdings.push({
                holding_id: holding.holdingId,
                instrument_key: instrumentKey,

                symbol: stock.symbol,
                name: stock.name,

                quantity,

                invested_value: investment,

                average_price: averagePrice,

                purchase_date: holding.purchaseDate,

                current_price: currentPrice,
                current_value: currentHoldingValue,

                total_return: totalReturn,
                total_return_percent: totalReturnPercent,

                day_change_value: dayChange,
                day_change_percent:
                    Number(stock.changePercent || 0),

                day_pnl: dayPnL,
            });
        }


        /* =================================================
           PORTFOLIO SUMMARY
        ================================================= */

        const totalReturn =
            currentValue - totalInvestment;

        const totalReturnPercent =
            totalInvestment > 0
                ? (totalReturn / totalInvestment) * 100
                : 0;

        const todaysReturnPercent =
            totalPreviousValue > 0
                ? (todaysPnL / totalPreviousValue) * 100
                : 0;


        res.json({
            summary: {
                totalInvestment,
                currentValue,

                totalReturn,
                totalReturnPercent,

                todaysPnL,
                todaysReturnPercent,
            },

            holdings,
        });

    } catch (err) {
        next(err);
    }
});


/* =========================================================
   404
========================================================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});


/* =========================================================
   ERROR HANDLER
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

                console.log("");
                console.log("========================================");
                console.log("🚀 Holdings Server Running");
                console.log(`http://localhost:${PORT}`);
                console.log("Database: MongoDB");
                console.log("========================================");
                console.log("GET http://localhost:3006/holdings");
                console.log("========================================");
            }
        );

        server.on("error", (err) => {

            console.error("❌ Holdings Server Error:", err);

            if (err.code === "EADDRINUSE") {
                console.error(
                    `Port ${PORT} is already in use.`
                );
            }

            process.exit(1);
        });

    } catch (err) {

        console.error(
            "❌ Failed to start Holdings server:",
            err.message
        );

        process.exit(1);
    }
}


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

async function shutdown(signal) {

    console.log(`\n${signal} received.`);

    try {

        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }

        await closeMongoDB();

        console.log("Holdings server stopped.");

        process.exit(0);

    } catch (err) {

        console.error(
            "Shutdown error:",
            err.message
        );

        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));


startServer();