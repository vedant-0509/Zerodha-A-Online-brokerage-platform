require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const { connectRedis, redis } = require("./redisClient");

const { initializeUpstoxFeed, getLatestCache, loadCache } = require("./indexMarketService");

const { isMarketOpen } = require("./isMarketOpen");
const { startClosingPriceScheduler } = require("./scheduler");
const { updateClosingPricesFromUpstox } = require("./closingPriceService");

const cron = require('node-cron');

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
    },
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

        if (lastUpstoxUpdate === today) {
            console.log("✅ Upstox closing prices already fetched today.");
            console.log("📦 Serving cached Redis snapshot.");
            return;
        }

        console.log("📥 Fetching today's official closing prices...");

        // cron.schedule("35 15 * * 1-5", () => {
        //     updateClosingPricesFromUpstox();
        // }, {
        //     timezone: "Asia/Kolkata",
        // });                                   this is for produnction level
        updateClosingPricesFromUpstox();       //this is for devlopment level

        console.log("✅ Redis updated with today's official closing prices.");
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

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
