const UpstoxClient = require("upstox-js-sdk");
const path = require("path");

const { redis } = require("./redisClient");
const marketCache = require("./marketCache");
const { isMarketOpen } = require("./isMarketOpen");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const defaultClient = UpstoxClient.ApiClient.instance;
defaultClient.authentications["OAUTH2"].accessToken =
    process.env.UPSTOX_ANALYTIC_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;

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
let reconnectTimer = null;
let marketWatchTimer = null;
let lastLogAt = 0;

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(value) {
    const n = Number(value);

    if (!Number.isFinite(n) || n <= 0) {
        return Date.now();
    }

    // Upstox timestamps can be expressed in seconds or milliseconds.
    return n < 1e12 ? n * 1000 : n;
}

function getIndexFeed(value) {
    return (
        value?.ff?.indexFF || value?.fullFeed?.indexFF || value?.indexFF || value
    );
}

function getLtpc(value, indexData) {
    return (
        indexData?.ltpc ||
        value?.ltpc ||
        value?.ff?.ltpc ||
        value?.fullFeed?.ltpc ||
        null
    );
}

/** Restore cache from Redis. */
async function loadCache() {
    return new Promise((resolve, reject) => {
        redis.hgetall("market_snapshot", (err, data) => {
            if (err) return reject(err);

            if (!data || Object.keys(data).length === 0) {
                console.log("⚠ No Redis snapshot found.");
                return resolve();
            }

            for (const [key, value] of Object.entries(data)) {
                try {
                    marketCache[key] = JSON.parse(value);
                } catch (parseError) {
                    console.error(
                        `[Index Market] Invalid Redis snapshot for ${key}:`,
                        parseError.message,
                    );
                }
            }

            console.log("✅ Market cache restored from Redis.");
            resolve();
        });
    });
}

/** Save the latest tick without blocking the websocket broadcast. */
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

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function scheduleReconnect(io, delay = 2000) {
    clearReconnectTimer();

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;

        if (!streamer) {
            initializeUpstoxFeed(io);
        }
    }, delay);
}

function startMarketWatch(io) {
    if (marketWatchTimer) return;

    marketWatchTimer = setInterval(() => {
        if (isMarketOpen() && !streamer) {
            console.log(
                "🟢 Market is open and live feed is not connected. Starting Upstox feed...",
            );
            initializeUpstoxFeed(io);
        }
    }, 5000);
}

/** Start / maintain Upstox live feed. */
function initializeUpstoxFeed(io) {
    startMarketWatch(io);

    if (!process.env.UPSTOX_ANALYTIC_TOKEN && !process.env.UPSTOX_ACCESS_TOKEN) {
        console.error("🔴 Upstox access token is missing.");
        return;
    }

    if (streamer) {
        return;
    }

    clearReconnectTimer();

    console.log("⏳ Connecting Upstox WebSocket...");

    streamer = new UpstoxClient.MarketDataStreamerV3(
        instruments,
        process.env.UPSTOX_STREAM_MODE || "ltpc",
    );

    streamer.on("open", () => {
        console.log(
            `🟢 UPSTOX CONNECTED | subscribed=${instruments.length} | marketOpen=${isMarketOpen()}`,
        );

        // Send the freshest cache immediately after the stream is established.
        io.emit("market_snapshot", getLatestCache());
    });

    streamer.on("message", async (message) => {
        try {
            const feed =
                typeof message === "string"
                    ? JSON.parse(message)
                    : JSON.parse(message.toString());

            if (!feed?.feeds) return;

            for (const [symbol, value] of Object.entries(feed.feeds)) {
                const indexData = getIndexFeed(value);
                const ltpc = getLtpc(value, indexData);

                if (!ltpc) continue;

                const ltp = toNumber(ltpc.ltp);
                const previousClose = toNumber(ltpc.cp);

                if (ltp === null || previousClose === null) continue;

                const updatedAt = normalizeTimestamp(ltpc.ltt);

                const latest = {
                    ltp,
                    // Keep `close` for frontend compatibility.
                    close: previousClose,
                    previousClose,
                    change: ltp - previousClose,
                    changePercent:
                        previousClose !== 0
                            ? ((ltp - previousClose) / previousClose) * 100
                            : 0,
                    ohlc: indexData?.marketOHLC?.ohlc || [],
                    updatedAt,
                    source: "upstox-websocket",
                };

                marketCache[symbol] = latest;

                // Broadcast immediately. Redis persistence must never delay live UI updates.
                io.emit("market_update", {
                    symbol,
                    data: latest,
                });

                saveTick(symbol, latest).catch((err) => {
                    console.error(
                        `[Index Market] Redis Write Error for ${symbol}:`,
                        err.message,
                    );
                });
            }
        } catch (err) {
            console.error("❌ Feed Parse Error:", err);
        }
    });

    streamer.on("error", (err) => {
        console.error("🔴 UPSTOX ERROR:", err?.message || err);
    });

    streamer.on("close", () => {
        console.log("🟡 UPSTOX CLOSED");
        streamer = null;

        // Reconnect during market hours. If closed, the market-watch timer will
        // start the feed automatically when the next open session begins.
        if (isMarketOpen()) {
            console.log("♻ Reconnecting live feed in 2 seconds...");
            scheduleReconnect(io, 2000);
        } else {
            console.log("🔴 Market Closed. Waiting for next market-open check.");
        }
    });

    try {
        streamer.connect();
    } catch (err) {
        console.error("🔴 UPSTOX CONNECT FAILED:", err?.message || err);
        streamer = null;
        scheduleReconnect(io, 5000);
    }
}

module.exports = {
    initializeUpstoxFeed,
    getLatestCache,
    loadCache,
    instruments,
};
