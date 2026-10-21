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
        parts.map(({ type, value }) => [type, value])
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

async function updateClosingPricesFromUpstox(io = null) {
    console.log("📥 Fetching latest daily closing candles from Upstox...");

    await initDb();

    const db = requireDb();
    const collection = db.collection("indexClosingPrices");

    const failures = [];
    let succeeded = 0;
    let latestTradingDate = null;

    for (const instrumentKey of instruments) {
        try {
            const candle = await getDailyClose(instrumentKey);

            if (!candle) {
                throw new Error("No valid historical candle returned");
            }

            const tradingDate = getPreviousDateKey(candle.timestamp);
            const closePrice = Number(candle.close);

            if (!Number.isFinite(closePrice) || closePrice <= 0) {
                throw new Error(`Invalid closing price: ${candle.close}`);
            }

            if (
                candle.open == null ||
                candle.high == null ||
                candle.low == null ||
                !Number.isFinite(Number(candle.open)) ||
                !Number.isFinite(Number(candle.high)) ||
                !Number.isFinite(Number(candle.low))
            ) {
                throw new Error("Invalid OHLC data returned");
            }

            const previousRecord = await collection.findOne(
                {
                    instrumentKey,
                    tradingDate: { $lt: tradingDate },
                },
                {
                    sort: { tradingDate: -1 },
                }
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
                // `close` is retained as the previous-close field for existing UI compatibility.
                close: effectivePreviousClose,
                previousClose: effectivePreviousClose,
                change: hasPreviousClose ? closePrice - effectivePreviousClose : 0,
                changePercent:
                    hasPreviousClose
                        ? ((closePrice - effectivePreviousClose) / effectivePreviousClose) * 100
                        : 0,
                ohlc: [
                    {
                        interval: "1d",
                        open: Number(candle.open),
                        high: Number(candle.high),
                        low: Number(candle.low),
                        close: closePrice,
                    },
                ],
                updatedAt: Date.now(),
                tradingDate,
                source: "Upstox Historical",
            };

            await collection.updateOne(
                { instrumentKey, tradingDate },
                {
                    $set: {
                        closePrice,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        instrumentKey,
                        tradingDate,
                        createdAt: new Date(),
                    },
                },
                { upsert: true }
            );

            // Update cache only after the database write succeeds.
            marketCache[instrumentKey] = latest;

            await redisHSet(
                "market_snapshot",
                instrumentKey,
                JSON.stringify(latest)
            );

            succeeded += 1;

            if (!latestTradingDate || tradingDate > latestTradingDate) {
                latestTradingDate = tradingDate;
            }

            console.log(
                `✅ ${instrumentKey} | Trading date: ${tradingDate} | Close: ${closePrice} | Previous close: ${hasPreviousClose ? effectivePreviousClose : "unavailable"}`
            );
        } catch (err) {
            failures.push({
                instrumentKey,
                reason: err?.message || String(err),
            });

            console.error(
                `❌ Closing-price update failed for ${instrumentKey}:`,
                err?.message || err
            );
        }
    }

    // Broadcast successfully refreshed values, even if some instruments failed.
    if (io && succeeded > 0) {
        io.emit("market_snapshot", marketCache);
        console.log("📡 Updated snapshot broadcasted.");
    }

    const attemptedAt = new Date().toISOString();

    if (failures.length > 0 || succeeded !== instruments.length) {
        try {
            await redisHSet(
                "market_meta",
                "lastUpstoxPartialUpdate",
                JSON.stringify({
                    attemptedAt,
                    succeeded,
                    total: instruments.length,
                    failures,
                })
            );
        } catch (err) {
            console.error(
                "❌ Could not save partial-sync diagnostics:",
                err?.message || err
            );
        }

        throw new Error(
            `Closing-price sync incomplete: ${succeeded}/${instruments.length} succeeded. ` +
                failures
                    .map(({ instrumentKey, reason }) => `${instrumentKey}: ${reason}`)
                    .join("; ")
        );
    }

    // Record the actual candle trading date, not the server's current date.
    await redisHSet(
        "market_meta",
        "lastUpstoxUpdate",
        latestTradingDate
    );

    await redisHSet(
        "market_meta",
        "lastUpstoxUpdateAt",
        attemptedAt
    );

    console.log(
        `🎉 Closing-price sync complete: ${succeeded}/${instruments.length}; latest trading date: ${latestTradingDate}`
    );

    return {
        success: true,
        succeeded,
        total: instruments.length,
        tradingDate: latestTradingDate,
        updatedAt: attemptedAt,
    };
}

module.exports = {
    updateClosingPricesFromUpstox,
    getIndiaDateKey,
};