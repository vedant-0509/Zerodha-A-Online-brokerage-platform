const { redis } = require("./redisClient");
const marketCache = require("./marketCache");

const { getDailyClose } = require("./historicalCloseService");
const { instruments } = require("./indexMarketService");
const { initDb, requireDb } = require("./db");

function getIndiaDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
}

function redisHSet(key, field, value) {
    return new Promise((resolve, reject) => {
        redis.hset(key, field, value, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
}

function getPreviousDateKey(timestamp) {
    if (!timestamp || !Number.isFinite(new Date(timestamp).getTime())) {
        throw new Error(`Invalid candle timestamp: ${timestamp}`);
    }

    return getIndiaDateKey(new Date(timestamp));
}

async function publishClosingSnapshot({
    staged,
    expectedTradingDate,
    marketCache,
    redis,
    io,
}) {
    const nextSnapshot = { ...marketCache };
    const transaction = redis.multi();

    for (const item of staged) {
        nextSnapshot[item.instrumentKey] = item.latest;

        transaction.hSet(
            "market_snapshot",
            item.instrumentKey,
            JSON.stringify(item.latest),
        );
    }

    transaction.hSet(
        "market_meta",
        "lastUpstoxUpdate",
        expectedTradingDate,
    );

    transaction.hSet(
        "market_meta",
        "lastUpstoxUpdateAt",
        new Date().toISOString(),
    );

    await transaction.exec();

    for (const item of staged) {
        marketCache[item.instrumentKey] = item.latest;
    }

    if (io) {
        io.emit("market_snapshot", nextSnapshot);
    }

    return nextSnapshot;
}


async function updateClosingPricesFromUpstox(
    io = null,
    { expectedTradingDate = null } = {},
) {
    if (!expectedTradingDate) {
        throw new Error(
            "expectedTradingDate is required; refusing an unverified close sync",
        );
    }

    console.log(`Fetching daily closing candles for ${expectedTradingDate}...`);

    await initDb();

    const db = requireDb();
    const collection = db.collection("indexClosingPrices");

    // Stage 1: Fetch and validate EVERY instrument before changing
    // the displayed cache or Redis snapshot.
    const staged = [];
    const failures = [];

    for (const instrumentKey of instruments) {
        try {
            const candle = await getDailyClose(instrumentKey, expectedTradingDate);

            if (!candle) {
                throw new Error("No historical candle returned");
            }

            const tradingDate = getPreviousDateKey(candle.timestamp);

            if (tradingDate !== expectedTradingDate) {
                throw new Error(
                    `Wrong candle date: expected ${expectedTradingDate}, got ${tradingDate}`,
                );
            }

            const open = Number(candle.open);
            const high = Number(candle.high);
            const low = Number(candle.low);
            const closePrice = Number(candle.close);

            if (
                ![open, high, low, closePrice].every(Number.isFinite) ||
                open <= 0 ||
                high <= 0 ||
                low <= 0 ||
                closePrice <= 0 ||
                high < Math.max(open, closePrice, low) ||
                low > Math.min(open, closePrice, high)
            ) {
                throw new Error("Invalid OHLC data");
            }

            const previousRecord = await collection.findOne(
                {
                    instrumentKey,
                    tradingDate: { $lt: tradingDate },
                },
                { sort: { tradingDate: -1 } },
            );

            const candidatePreviousClose = previousRecord
                ? Number(previousRecord.closePrice)
                : Number(candle.previousClose);

            const hasPreviousClose =
                Number.isFinite(candidatePreviousClose) && candidatePreviousClose > 0;

            const effectivePreviousClose = hasPreviousClose
                ? candidatePreviousClose
                : closePrice;

            const latest = {
                ltp: closePrice,
                // Keep this field's existing meaning for frontend compatibility.
                close: effectivePreviousClose,
                previousClose: effectivePreviousClose,
                change: hasPreviousClose ? closePrice - effectivePreviousClose : 0,
                changePercent: hasPreviousClose
                    ? ((closePrice - effectivePreviousClose) / effectivePreviousClose) *
                    100
                    : 0,
                ohlc: [
                    {
                        interval: "1d",
                        open,
                        high,
                        low,
                        close: closePrice,
                    },
                ],
                updatedAt: Date.now(),
                tradingDate,
                source: "Upstox Historical",
            };

            staged.push({
                instrumentKey,
                tradingDate,
                closePrice,
                latest,
            });
        } catch (err) {
            failures.push({
                instrumentKey,
                reason: err?.message || String(err),
            });
        }
    }

    // Do not update any displayed values if even one required candle fails.
    if (failures.length > 0 || staged.length !== instruments.length) {
        const message =
            `Closing-price sync rejected: ${staged.length}/` +
            `${instruments.length} candles validated for ${expectedTradingDate}. ` +
            failures
                .map(({ instrumentKey, reason }) => `${instrumentKey}: ${reason}`)
                .join("; ");

        try {
            await redisHSet(
                "market_meta",
                "lastUpstoxPartialUpdate",
                JSON.stringify({
                    attemptedAt: new Date().toISOString(),
                    expectedTradingDate,
                    succeeded: staged.length,
                    total: instruments.length,
                    failures,
                }),
            );
        } catch (err) {
            console.error("Could not save sync diagnostics:", err.message);
        }

        throw new Error(message);
    }

    // Stage 2: Persist the complete validated batch to MongoDB.
    // If a write fails, do not update the in-memory or Redis snapshot.
    for (const item of staged) {
        await collection.updateOne(
            {
                instrumentKey: item.instrumentKey,
                tradingDate: item.tradingDate,
            },
            {
                $set: {
                    closePrice: item.closePrice,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    instrumentKey: item.instrumentKey,
                    tradingDate: item.tradingDate,
                    createdAt: new Date(),
                },
            },
            { upsert: true },
        );
    }

    // Stage 3: Prepare the complete snapshot and publish all Redis
    // fields in one Redis transaction.
    const nextSnapshot = { ...marketCache };
    const transaction = redis.multi();

    for (const item of staged) {
        nextSnapshot[item.instrumentKey] = item.latest;

        transaction.hSet(
            "market_snapshot",
            item.instrumentKey,
            JSON.stringify(item.latest),
        );
    }

    transaction.hSet("market_meta", "lastUpstoxUpdate", expectedTradingDate);

    transaction.hSet(
        "market_meta",
        "lastUpstoxUpdateAt",
        new Date().toISOString(),
    );

    // Do not update memory or emit until Redis confirms the transaction.
    await transaction.exec();

    for (const item of staged) {
        marketCache[item.instrumentKey] = item.latest;
    }

    if (io) {
        io.emit("market_snapshot", nextSnapshot);
    }

    console.log(
        `Closing-price sync complete: ${staged.length}/${instruments.length}; ` +
        `trading date: ${expectedTradingDate}`,
    );

    return {
        success: true,
        succeeded: staged.length,
        total: instruments.length,
        tradingDate: expectedTradingDate,
    };
}

module.exports = {
    updateClosingPricesFromUpstox,
    getIndiaDateKey,
    publishClosingSnapshot,
};
