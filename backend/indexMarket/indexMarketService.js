const UpstoxClient = require("upstox-js-sdk");
const path = require("path");

const { redis } = require("./redisClient");
const marketCache = require("./marketCache");
const { isMarketOpen } = require("./isMarketOpen");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const defaultClient = UpstoxClient.ApiClient.instance;

defaultClient.authentications["OAUTH2"].accessToken = process.env.UPSTOX_ANALYTIC_TOKEN;

const instruments = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
    "NSE_INDEX|India VIX",
    "NSE_INDEX|Nifty Next 50",
    "NSE_INDEX|Nifty 100",
    "NSE_INDEX|Nifty 500",
    "NSE_INDEX|Nifty Auto",
    "NSE_INDEX|Nifty FMCG",
    "NSE_INDEX|Nifty Metal",
    "NSE_INDEX|Nifty Pharma",
    "NSE_INDEX|Nifty PSU Bank",
    "NSE_INDEX|Nifty IT",
    "NSE_INDEX|NIFTY MID SELECT",
    "NSE_INDEX|NIFTY SMLCAP 100",
    "NSE_INDEX|Nifty Commodities",
    "BSE_INDEX|BANKEX",
    "BSE_INDEX|BSE100",
    "BSE_INDEX|SML250",
    "BSE_INDEX|FOCIT",
    "BSE_INDEX|BSEIPO",
];

let streamer = null;

/*** Restore cache from Redis***/
async function loadCache() {
    return new Promise((resolve, reject) => {
        redis.hgetall("market_snapshot", (err, data) => {
            if (err) return reject(err);

            if (!data || Object.keys(data).length === 0) {
                console.log("⚠ No Redis snapshot found.");
                return resolve();
            }

            for (const [key, value] of Object.entries(data)) {
                marketCache[key] = JSON.parse(value);
            }

            console.log("✅ Market cache restored from Redis.");

            resolve();
        });
    });
}

/***Save latest tick***/
function saveTick(symbol, latest) {
    return new Promise((resolve, reject) => {
        redis.hset("market_snapshot", symbol, JSON.stringify(latest), (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function getLatestCache() {
    return marketCache;
}

/***Start Upstox Live Feed***/
function initializeUpstoxFeed(io) {
    if (streamer) {
        console.log("⚠ Upstox already connected.");
        return;
    }

    console.log("⏳ Connecting Upstox WebSocket...");

    streamer = new UpstoxClient.MarketDataStreamerV3(instruments, "ltpc");

    streamer.on("open", () => {
        console.log("🟢 UPSTOX CONNECTED");
    });

    streamer.on("message", async (message) => {
        try {
            const feed = JSON.parse(message.toString());

            if (!feed?.feeds) return;

            for (const [symbol, value] of Object.entries(feed.feeds)) {
                const indexData = value?.ff?.indexFF ?? value?.fullFeed?.indexFF;
                const ltpc = indexData?.ltpc ?? value?.ltpc;

                if (!ltpc) continue;

                if (ltpc.ltp == null || ltpc.cp == null) continue;

                const latest = {
                    ltp: ltpc.ltp,
                    close: ltpc.cp,
                    ohlc: indexData?.marketOHLC?.ohlc || [],
                    updatedAt: Date.now(),
                };

                // Update RAM cache
                marketCache[symbol] = latest;

                // Update Redis
                try {
                    await saveTick(symbol, latest);
                } catch (err) {
                    console.error("Redis Write Error:", err);
                }

                // Broadcast only changed symbol
                io.emit("market_update", {
                    symbol,
                    data: latest,
                });
            }
        } catch (err) {
            console.error("❌ Feed Parse Error:", err);
        }
    });

    streamer.on("error", (err) => {
        console.error("🔴 UPSTOX ERROR:", err);
    });

    streamer.on("close", () => {
        console.log("🟡 UPSTOX CLOSED");
        streamer = null;

        // Don't reconnect after market closes
        if (!isMarketOpen()) {
            console.log("🔴 Market Closed. Reconnect cancelled.");
            return;
        }

        console.log("♻ Reconnecting in 2 seconds...");

        setTimeout(() => {
            initializeUpstoxFeed(io);
        }, 2000);
    });

    streamer.connect();
}

module.exports = {
    initializeUpstoxFeed,
    getLatestCache,
    loadCache,
    instruments};