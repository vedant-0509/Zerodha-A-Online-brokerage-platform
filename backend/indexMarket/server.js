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

const { isMarketOpen } = require("./isMarketOpen");
const { startClosingPriceScheduler } = require("./scheduler");
const { updateClosingPricesFromUpstox } = require("./closingPriceService");

const cron = require("node-cron");

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
    transports: ["websocket"],
});

// Start scheduler
startClosingPriceScheduler(io);

async function bootstrap() {
    try {
        console.log("🚀 Bootstrapping Server...");

        await connectRedis();

        await loadCache();

        // Market Open → Live Upstox
        if (isMarketOpen()) {
            console.log("🟢 Market Open");
            console.log("📡 Starting Upstox Live Feed...");

            initializeUpstoxFeed(io);
            return;
        }

        // Market Closed
        console.log("🔴 Market Closed");

        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
        });

        console.log(today);

        const lastUpstoxUpdate = await new Promise((resolve, reject) => {
            redis.hget("market_meta", "lastUpstoxUpdate", (err, value) => {
                if (err) return reject(err);
                resolve(value);
            });
        });


        const currentCache = getLatestCache();

        const hasSnapshot =
            currentCache &&
            typeof currentCache === "object" &&
            Object.keys(currentCache).length > 0;

        if (hasSnapshot) {
            console.log(
                "📦 Market closed. Existing last-trading-day snapshot available."
            );

            console.log(
                "🛑 No market data fetch required."
            );

            return;
        }

        console.log(
            "⚠️ Market snapshot missing. Fetching latest trading-day values..."
        );

        if (lastUpstoxUpdate === today && hasSnapshot) {
            console.log("✅ Upstox closing prices already fetched today.");
            console.log("📦 Serving cached Redis snapshot.");
            return;
        }

        if (lastUpstoxUpdate === today && !hasSnapshot) {
            console.log(
                "⚠️ Today's update flag exists, but market snapshot is missing.",
            );
            console.log("🔄 Refetching official Upstox closing prices...");
        }

        console.log("📥 Fetching today's official closing prices...");

        // cron.schedule("35 15 * * 1-5", () => {
        //     updateClosingPricesFromUpstox();
        // }, {
        //     timezone: "Asia/Kolkata",
        // });                                   this is for produnction level
        await updateClosingPricesFromUpstox();

        console.log("✅ Redis updated with today's official closing prices.");

        // Reload the freshly updated Redis snapshot into RAM
        await loadCache();

        console.log("✅ Market cache refreshed with latest closing prices.");
    } catch (err) {
        console.error("❌ Bootstrap Error");
        console.error(err);
    }
}

bootstrap();

io.on("connection", (socket) => {
    console.log(`👤 Client Connected : ${socket.id}`);

    // Send latest snapshot immediately
    socket.emit("market_snapshot", getLatestCache());

    socket.on("get_snapshot", () => {
        socket.emit("market_snapshot", getLatestCache());
    });

    socket.on("disconnect", () => {
        console.log(`👋 Client Disconnected : ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3020;

httpServer.listen(PORT, "127.0.0.1", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
