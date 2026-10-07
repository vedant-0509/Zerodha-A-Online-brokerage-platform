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

        // Keep the existing post-market closing-price behavior.
        if (!marketOpen) {
            const today = new Date().toLocaleDateString("en-CA", {
                timeZone: "Asia/Kolkata",
            });

            console.log(today);

            const lastUpstoxUpdate = await readLastUpstoxUpdate();

            if (lastUpstoxUpdate === today) {
                console.log("✅ Upstox closing prices already fetched today.");
                console.log("📦 Serving cached Redis snapshot.");
                return;
            }

            console.log("📥 Fetching today's official closing prices...");

            // Keep the existing development behavior.
            updateClosingPricesFromUpstox().catch((error) => {
                console.error("❌ Closing price update failed:", error?.message || error);
            });
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
