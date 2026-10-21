const cron = require("node-cron");
const { updateClosingPricesFromUpstox, getIndiaDateKey } = require("./closingPriceService");
const { isTradingDay, hasVerifiedHolidayCalendar, getIndiaMarketTime } = require("./isMarketOpen");
const { redis } = require("./redisClient");

function redisHGet(key, field) {
    return new Promise((resolve, reject) => {
        redis.hget(key, field, (err, value) => err ? reject(err) : resolve(value));
    });
}

function startClosingPriceScheduler(io) {
    console.log("⏰ Closing Price Scheduler Started");
    console.log("📅 Checks every 5 minutes from 3:35 PM to 5:55 PM IST on verified NSE trading days");

    // Retry during the post-market window. The service itself validates the
    // candle date and does not overwrite cached values with stale candles.
    cron.schedule("*/5 15-17 * * 1-5", async () => {
        const now = new Date();
        const local = getIndiaMarketTime(now);
        const minutes = Number(local.hour) * 60 + Number(local.minute);
        if (minutes < 15 * 60 + 35 || minutes >= 18 * 60) return;

        const dateKey = getIndiaDateKey(now);
        if (!hasVerifiedHolidayCalendar(now) || !isTradingDay(now)) {
            console.log(`[Index Market] EOD sync skipped: ${dateKey} is a holiday/non-trading date or this year's official NSE calendar is not installed.`);
            return;
        }

        try {
            const completedDate = await redisHGet("market_meta", "lastUpstoxUpdate");
            if (completedDate === dateKey) {
                console.log(`[Index Market] EOD close already complete for ${dateKey}; no retry needed.`);
                return;
            }

            console.log(`[Index Market] EOD close attempt for ${dateKey} at ${local.hour}:${local.minute}`);
            const result = await updateClosingPricesFromUpstox(io, { expectedTradingDate: dateKey });
            console.log(`✅ Closing-price sync completed: ${result.succeeded}/${result.total}, trading date ${result.tradingDate}`);
        } catch (err) {
            // No success marker is written on an incomplete run, so the next
            // 5-minute pass retries without clearing the existing snapshot.
            console.error(`[Index Market] EOD attempt failed; will retry within window: ${err?.message || err}`);
        }
    }, { timezone: "Asia/Kolkata" });
}

module.exports = { startClosingPriceScheduler };
