const { redis } = require("./redisClient");
const marketCache = require("./marketCache");

const { getDailyClose } = require("./historicalCloseService");
const { instruments } = require("./indexMarketService");
const db = require("./db");

async function updateClosingPricesFromUpstox(io = null) {
    console.log("📥 Fetching official closing prices from Upstox...");

    try {
        for (const instrumentKey of instruments) {
            try {
                // Fetch today's official close from Upstox
                const candle = await getDailyClose(instrumentKey);

                if (!candle) {
                    console.log(`⚠ Skipping ${instrumentKey}: No candle found.`);
                    continue;
                }

                console.log(candle);

                // ------------------------------------------
                // Read previous trading day's close
                // ------------------------------------------
                const [rows] = await db.execute(
                    `
                    SELECT close_price
                    FROM index_closing_prices
                    WHERE instrument_key = ?
                    ORDER BY trading_date DESC
                    LIMIT 1
                    `,
                    [instrumentKey]
                );

                const previousClose = rows.length > 0 ? rows[0].close_price : candle.close; // first run fallback

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

                // ------------------------------------------
                // Store today's official close
                // ------------------------------------------
                await db.execute(
                    `
                    INSERT INTO index_closing_prices
                    (instrument_key, trading_date, close_price)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        close_price = VALUES(close_price)
                    `,
                    [
                        instrumentKey,
                        candle.timestamp.split("T")[0],
                        candle.close,
                    ]
                );

                // ------------------------------------------
                // Keep only latest 2 trading days
                // (Requires MySQL 8+)
                // ------------------------------------------
                await db.execute(`
                    DELETE FROM index_closing_prices
                    WHERE id IN (
                        SELECT id
                        FROM (
                            SELECT
                                id,
                                ROW_NUMBER() OVER (
                                    PARTITION BY instrument_key
                                    ORDER BY trading_date DESC
                                ) AS rn
                            FROM index_closing_prices
                        ) x
                        WHERE rn > 2
                    )
                `);

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
                        (err) => (err ? reject(err) : resolve())
                    );
                });

                console.log(
                    `✅ ${instrumentKey} | Today: ${candle.close} | Previous: ${previousClose}`
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
            redis.hset(
                "market_meta",
                "lastUpstoxUpdate",
                today,
                (err) => (err ? reject(err) : resolve())
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

module.exports = { updateClosingPricesFromUpstox };