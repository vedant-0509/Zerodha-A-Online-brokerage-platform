
const UpstoxClient = require("upstox-js-sdk");
const path = require("path");

const { redis } = require("./redisClient");
const marketCache = require("./marketCache");
const { isMarketOpen } = require("./isMarketOpen");

require("dotenv").config({
    path: path.join(__dirname, "../.env"),
});

const token =
    process.env.UPSTOX_ANALYTIC_TOKEN ||
    process.env.UPSTOX_ACCESS_TOKEN;

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

const defaultClient = UpstoxClient.ApiClient.instance;

let streamer = null;
let reconnectTimer = null;
let marketWatchTimer = null;
let reconnectDelay = 2000;
let generation = 0;
let starting = false;
let lastMessageAt = null;

const MAX_RECONNECT_DELAY = 30000;
const STALE_AFTER_MS = 60000;

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizeTimestamp(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number <= 0) {
        return null;
    }

    return number < 1e12 ? number * 1000 : number;
}

function getIndexFeed(value) {
    return (
        value?.ff?.indexFF ||
        value?.fullFeed?.indexFF ||
        value?.indexFF ||
        value
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

function getLatestCache() {
    const now = Date.now();
    const snapshot = {};

    for (const [symbol, value] of Object.entries(marketCache)) {
        const updatedAt = Number(value?.updatedAt);
        const ageMs = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : null;
        const isLiveSource =
            value?.source === "upstox-websocket" && value?.freshness !== "cached";
        const isFresh = ageMs !== null && ageMs <= STALE_AFTER_MS;

        snapshot[symbol] = {
            ...value,
            ageMs,
            freshness: isLiveSource && isFresh ? "live" : "stale",
        };
    }

    return snapshot;
}

function redisHSet(key, field, value) {
    return new Promise((resolve, reject) => {
        redis.hset(key, field, value, (error) => {
            if (error) return reject(error);
            resolve();
        });
    });
}

async function loadCache() {
    const data = await new Promise((resolve, reject) => {
        redis.hgetall("market_snapshot", (error, result) => {
            if (error) return reject(error);
            resolve(result || {});
        });
    });

    for (const [key, value] of Object.entries(data)) {
        try {
            const parsed = JSON.parse(value);

            if (
                parsed &&
                Number.isFinite(Number(parsed.ltp))
            ) {
                marketCache[key] = {
                    ...parsed,
                    freshness: "cached",
                };
            }
        } catch (error) {
            console.error(
                `[Index Market] Invalid cached snapshot ${key}:`,
                error.message
            );
        }
    }

    console.log(
        `✅ Restored ${Object.keys(marketCache).length} cached index values`
    );
}

function clearReconnectTimer() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
}

function scheduleReconnect(io, expectedGeneration) {
    if (reconnectTimer || !isMarketOpen()) return;

    const delay = reconnectDelay;

    reconnectDelay = Math.min(
        reconnectDelay * 2,
        MAX_RECONNECT_DELAY
    );

    console.log(
        `[Index Market] Reconnecting in ${delay}ms`
    );

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;

        if (
            expectedGeneration === generation &&
            !streamer &&
            !starting &&
            isMarketOpen()
        ) {
            initializeUpstoxFeed(io);
        }
    }, delay);
}

function startMarketWatch(io) {
    if (marketWatchTimer) return;

    marketWatchTimer = setInterval(() => {
        if (isMarketOpen() && !streamer && !starting) {
            initializeUpstoxFeed(io);
        }
    }, 5000);
}

function initializeUpstoxFeed(io) {
    startMarketWatch(io);

    if (!isMarketOpen()) {
        console.log(
            "[Index Market] Outside normal market hours; retaining cached snapshot."
        );
        return;
    }

    if (!token) {
        console.error(
            "[Index Market] Missing UPSTOX_ANALYTIC_TOKEN / UPSTOX_ACCESS_TOKEN"
        );
        return;
    }

    if (streamer || starting) return;

    clearReconnectTimer();
    starting = true;

    const currentGeneration = ++generation;
    defaultClient.authentications["OAUTH2"].accessToken = token;

    const streamMode = process.env.UPSTOX_STREAM_MODE || "ltpc";

    let activeStreamer;

    try {
        activeStreamer = new UpstoxClient.MarketDataStreamerV3(
            [],
            streamMode
        );

        streamer = activeStreamer;
    } catch (error) {
        starting = false;
        streamer = null;

        console.error(
            "[Index Market] Could not create streamer:",
            error.message
        );

        scheduleReconnect(io, currentGeneration);
        return;
    }

    function isCurrentConnection() {
        return (
            streamer === activeStreamer &&
            generation === currentGeneration
        );
    }

    function retireConnection(errorMessage) {
        if (!isCurrentConnection()) return;

        console.error(
            "[Index Market] Retiring connection:",
            errorMessage
        );

        streamer = null;
        starting = false;

        try {
            activeStreamer.disconnect();
        } catch (_) {
            // The SDK may already have closed the socket.
        }

        scheduleReconnect(io, currentGeneration);
    }

    activeStreamer.on("open", () => {
        if (!isCurrentConnection()) return;

        starting = false;
        reconnectDelay = 2000;

        if (!isMarketOpen()) {
            try {
                activeStreamer.disconnect();
            } catch (_) {}
            streamer = null;
            return;
        }

        try {
            activeStreamer.subscribe(instruments, streamMode);

            console.log(
                `[Index Market] Connected; subscribed to ${instruments.length} instruments`
            );

            io.emit("market_snapshot", getLatestCache());
        } catch (error) {
            retireConnection(
                `Subscription failed: ${error.message}`
            );
        }
    });

    activeStreamer.on("message", (message) => {
        if (!isCurrentConnection()) return;

        try {
            const feed =
                typeof message === "string"
                    ? JSON.parse(message)
                    : JSON.parse(message.toString());

            if (!feed?.feeds) return;

            let changed = false;

            for (const [symbol, value] of Object.entries(feed.feeds)) {
                if (!instruments.includes(symbol)) continue;

                const indexData = getIndexFeed(value);
                const ltpc = getLtpc(value, indexData);

                if (!ltpc) continue;

                const ltp = toNumber(ltpc.ltp);
                const previousClose = toNumber(ltpc.cp);
                const feedTimestamp = normalizeTimestamp(ltpc.ltt);

                if (ltp === null || ltp <= 0) continue;
                if (
                    previousClose === null ||
                    previousClose <= 0
                ) {
                    continue;
                }

                // Reject clearly future-dated feed timestamps.
                const updatedAt = feedTimestamp || Date.now();

                if (updatedAt > Date.now() + 60000) {
                    console.warn(
                        `[Index Market] Ignoring future-dated tick for ${symbol}`
                    );
                    continue;
                }

                const latest = {
                    ltp,
                    close: previousClose,
                    previousClose,
                    change: ltp - previousClose,
                    changePercent:
                        ((ltp - previousClose) / previousClose) * 100,
                    ohlc: indexData?.marketOHLC?.ohlc || [],
                    updatedAt,
                    source: "upstox-websocket",
                    freshness: "live",
                };

                marketCache[symbol] = latest;
                changed = true;

                io.emit("market_update", {
                    symbol,
                    data: latest,
                });

                redisHSet(
                    "market_snapshot",
                    symbol,
                    JSON.stringify(latest)
                ).catch((error) => {
                    console.error(
                        `[Index Market] Redis write failed for ${symbol}:`,
                        error.message
                    );
                });
            }

            if (changed) {
                lastMessageAt = Date.now();
            }
        } catch (error) {
            console.error(
                "[Index Market] Feed parsing error:",
                error.message
            );
        }
    });

    activeStreamer.on("error", (error) => {
        const message = error?.message || String(error);
        console.error("[Index Market] Upstox socket error:", message);

        // Some SDK/transport failures emit error without a subsequent close.
        // Retire this connection once; generation guards prevent duplicate retries.
        if (isCurrentConnection() && isMarketOpen()) {
            retireConnection(message);
        }
    });

    activeStreamer.on("close", () => {
        if (!isCurrentConnection()) return;

        console.warn("[Index Market] Upstox connection closed");

        streamer = null;
        starting = false;

        if (isMarketOpen()) {
            scheduleReconnect(io, currentGeneration);
        }
    });

    try {
        activeStreamer.connect();
    } catch (error) {
        retireConnection(
            `Connect failed: ${error.message}`
        );
    }
}

function getFeedHealth() {
    const ageMs = lastMessageAt
        ? Date.now() - lastMessageAt
        : null;

    return {
        connected: Boolean(streamer),
        marketOpen: isMarketOpen(),
        lastMessageAt,
        ageMs,
        stale:
            ageMs === null ||
            ageMs > STALE_AFTER_MS,
    };
}

module.exports = {
    initializeUpstoxFeed,
    getLatestCache,
    loadCache,
    instruments,
    getFeedHealth,
};
