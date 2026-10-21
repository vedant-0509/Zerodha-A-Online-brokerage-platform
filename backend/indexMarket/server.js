require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { createServer } = require("http");
const { Server } = require("socket.io");

const { connectRedis, redis } = require("./redisClient");
const {
    initializeUpstoxFeed,
    getLatestCache,
    loadCache,
} = require("./indexMarketService");
const { isMarketOpen, getIndiaDateKey } = require("./isMarketOpen");
const { startClosingPriceScheduler } = require("./scheduler");
const { updateClosingPricesFromUpstox } = require("./closingPriceService");

const requestContext = require("../middleware/requestContext");
const createCorsOptions = require("../middleware/corsOptions");
const errorHandler = require("../middleware/errorHandler");

const app = express();

app.use(requestContext);
app.use(helmet());
app.use(cors(createCorsOptions({ credentials: true })));
app.use(errorHandler);

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: createCorsOptions({ credentials: true }),
    transports: ["websocket", "polling"],
});

startClosingPriceScheduler(io);

async function readLastUpstoxUpdate() {
    return new Promise((resolve, reject) => {
        redis.hget("market_meta", "lastUpstoxUpdate", (err, value) => {
            if (err) return reject(err);
            resolve(value);
        });
    });
}

async function bootstrap() {
    try {
        console.log("🚀 Bootstrapping Server...");

        await connectRedis();
        await loadCache();

        const marketOpen = isMarketOpen();

        if (marketOpen) {
            console.log("🟢 Market Open");
        } else {
            console.log("🔴 Market Closed");
        }

        // IMPORTANT: Start the Upstox connection regardless of whether this
        // process started before or during market hours. The service itself
        // watches market-open state and reconnects when required.
        console.log("📡 Starting / maintaining Upstox Live Feed...");
        initializeUpstoxFeed(io);

        // Catch up only after today's normal session has ended. Do not run a
        // supposed "today close" refresh before the close, on weekends, or on
        // configured exchange holidays. The stored marker is the candle's actual
        // trading date, not the server's calendar date.
        const now = new Date();
        const dateKey = getIndiaDateKey(now);
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit",
            minute: "2-digit", hourCycle: "h23",
        }).formatToParts(now);
        const local = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        const minutes = Number(local.hour) * 60 + Number(local.minute);
        const holidaySet = new Set(String(process.env.NSE_MARKET_HOLIDAYS || "")
            .split(",").map((value) => value.trim()).filter(Boolean));
        const normalTradingWeekday = local.weekday !== "Sat" && local.weekday !== "Sun";
        const afterRegularClose = minutes >= 15 * 60 + 30;

        if (!marketOpen && normalTradingWeekday && !holidaySet.has(dateKey) && afterRegularClose) {
            const lastUpstoxUpdate = await readLastUpstoxUpdate();

            if (lastUpstoxUpdate === dateKey) {
                console.log(`[Index Market] Closing data already recorded for trading date ${dateKey}; serving cache.`);
            } else {
                console.log(`[Index Market] Post-close catch-up required for ${dateKey}; fetching latest daily candles.`);
                updateClosingPricesFromUpstox().catch((error) => {
                    console.error("[Index Market] Closing-price catch-up failed:", error?.message || error);
                });
            }
        } else if (!marketOpen) {
            console.log("[Index Market] No post-close catch-up needed at startup (pre-market, weekend, holiday, or before close). Serving cached snapshot.");
        }
    } catch (err) {
        console.error("❌ Bootstrap Error");
        console.error(err);
    }
}

bootstrap();

io.on("connection", (socket) => {
    console.log(`👤 Client Connected : ${socket.id}`);

    // Snapshot immediately on every upstream connection.
    socket.emit("market_snapshot", getLatestCache());

    socket.on("get_snapshot", () => {
        socket.emit("market_snapshot", getLatestCache());
    });

    socket.on("disconnect", () => {
        console.log(`👋 Client Disconnected : ${socket.id}`);
    });
});

const PORT = Number(process.env.PORT || 3020);

httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
