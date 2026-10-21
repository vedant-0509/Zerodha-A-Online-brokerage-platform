const cron = require("node-cron");
const {
    updateClosingPricesFromUpstox,
    getIndiaDateKey,
} = require("./closingPriceService");
const {
    isTradingDay,
    hasVerifiedHolidayCalendar,
    getIndiaMarketTime,
} = require("./isMarketOpen");
const { redis } = require("./redisClient");
const { isClosingSnapshotComplete } = require("./closingSnapshotValidator");

function redisHGet(key, field) {
    return new Promise((resolve, reject) => {
        redis.hget(key, field, (err, value) => {
            if (err) return reject(err);
            resolve(value);
        });
    });
}

function startClosingPriceScheduler(io) {
    console.log("Closing Price Scheduler Started");
    console.log(
        "Checks every 5 minutes from 3:35 PM to 5:55 PM IST on verified NSE trading days"
    );

    cron.schedule(
        "*/5 15-17 * * 1-5",
        async () => {
            const now = new Date();
            const local = getIndiaMarketTime(now);
            const minutes =
                Number(local.hour) * 60 + Number(local.minute);

            if (minutes < 15 * 60 + 35 || minutes >= 18 * 60) {
                return;
            }

            const dateKey = getIndiaDateKey(now);

            if (
                !hasVerifiedHolidayCalendar(now) ||
                !isTradingDay(now)
            ) {
                console.log(
                    `[Index Market] EOD sync skipped for ${dateKey}: holiday, non-trading date, or unverified exchange calendar.`
                );
                return;
            }

            try {
                const completedDate = await redisHGet(
                    "market_meta",
                    "lastUpstoxUpdate"
                );

                const snapshotComplete =
                    await isClosingSnapshotComplete(dateKey);

                if (completedDate === dateKey && snapshotComplete) {
                    console.log(
                        `[Index Market] Valid EOD snapshot confirmed for ${dateKey}; no retry needed.`
                    );
                    return;
                }

                console.warn(
                    `[Index Market] EOD marker/snapshot mismatch for ${dateKey}; attempting validated refresh.`
                );

                const result = await updateClosingPricesFromUpstox(io, {
                    expectedTradingDate: dateKey,
                });

                console.log(
                    `[Index Market] Closing-price sync completed: ${result.succeeded}/${result.total}, trading date ${result.tradingDate}.`
                );
            } catch (err) {
                console.error(
                    `[Index Market] EOD sync failed; a later scheduler run may retry: ${err?.message || err}`
                );
            }
        },
        { timezone: "Asia/Kolkata" }
    );
}

module.exports = { startClosingPriceScheduler };
