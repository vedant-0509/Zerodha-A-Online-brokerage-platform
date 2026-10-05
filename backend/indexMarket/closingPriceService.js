const { redis } = require("./redisClient");
const marketCache = require("./marketCache");

const { getDailyClose } = require("./historicalCloseService");
const { instruments } = require("./indexMarketService");
const { initDb, requireDb } = require("./db");

async function updateClosingPricesFromUpstox(io = null) {
    console.log("📥 Fetching official closing prices from Upstox...");

    // Make sure MongoDB is connected
    await initDb();

    const db = requireDb();
    const collection = db.collection("indexClosingPrices");

    try {
        for (const instrumentKey of instruments) {
            try {
                // ------------------------------------------
                // Fetch today's official close from Upstox
                // ------------------------------------------
                const candle = await getDailyClose(instrumentKey);

                if (!candle) {
                    console.log(`⚠ Skipping ${instrumentKey}: No candle found.`);
                    continue;
                }

                console.log(candle);

                // ------------------------------------------
                // Read previous trading day's close
                // ------------------------------------------
                const previousRecord = await collection.findOne(
                    {
                        instrumentKey,
                        tradingDate: {
                            $lt: candle.timestamp.split("T")[0],
                        },
                    },
                    {
                        sort: {
                            tradingDate: -1,
                        },
                    },
                );

                const previousClose = previousRecord ? Number(previousRecord.closePrice) : Number(candle.previousClose ?? candle.close);

                // ------------------------------------------
                // Prepare latest object for Redis
                // ------------------------------------------
                const latest = {
                    ltp: candle.close,
                    close: previousClose,
                    ohlc: [
                        {
                            interval: "1d",
                            open: candle.open,
                            high: candle.high,
                            low: candle.low,
                            close: candle.close,
                        },
                    ],
                    updatedAt: Date.now(),
                    source: "Upstox Historical",
                };

                const tradingDate = candle.timestamp.split("T")[0];

                // ------------------------------------------
                // Store today's official close
                // ------------------------------------------
                await collection.updateOne(
                    {
                        instrumentKey,
                        tradingDate,
                    },
                    {
                        $set: {
                            closePrice: Number(candle.close),
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            instrumentKey,
                            tradingDate,
                            createdAt: new Date(),
                        },
                    },
                    {
                        upsert: true,
                    },
                );

                // ------------------------------------------
                // Keep only latest 2 trading days
                // ------------------------------------------
                const oldRecords = await collection
                    .find({
                        instrumentKey,
                    })
                    .sort({
                        tradingDate: -1,
                    })
                    .skip(2)
                    .project({
                        _id: 1,
                    })
                    .toArray();

                if (oldRecords.length > 0) {
                    await collection.deleteMany({
                        _id: {
                            $in: oldRecords.map((record) => record._id),
                        },
                    });
                }

                // ------------------------------------------
                // Update RAM Cache
                // ------------------------------------------
                marketCache[instrumentKey] = latest;

                // ------------------------------------------
                // Update Redis
                // ------------------------------------------
                await new Promise((resolve, reject) => {
                    redis.hset(
                        "market_snapshot",
                        instrumentKey,
                        JSON.stringify(latest),
                        (err) => (err ? reject(err) : resolve()),
                    );
                });

                console.log(
                    `✅ ${instrumentKey} | Today: ${candle.close} | Previous: ${previousClose}`,
                );
            } catch (err) {
                console.error(`❌ ${instrumentKey}:`, err.message);
            }
        }

        // ------------------------------------------
        // Save today's update flag
        // ------------------------------------------
        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
        });

        await new Promise((resolve, reject) => {
            redis.hset("market_meta", "lastUpstoxUpdate", today, (err) =>
                err ? reject(err) : resolve(),
            );
        });

        console.log(`✅ Saved closing update flag: ${today}`);

        // ------------------------------------------
        // Broadcast latest snapshot
        // ------------------------------------------
        if (io) {
            io.emit("market_snapshot", marketCache);
            console.log("📡 Snapshot broadcasted.");
        }

        console.log("🎉 Official closing prices updated successfully.");
    } catch (err) {
        console.error("❌ Closing price update failed.");
        console.error(err);
        throw err;
    }
}

module.exports = {
    updateClosingPricesFromUpstox,
};
