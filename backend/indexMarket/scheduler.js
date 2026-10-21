const cron = require("node-cron");
const { updateClosingPricesFromUpstox } = require("./closingPriceService");

function startClosingPriceScheduler(io) {
    console.log("⏰ Closing Price Scheduler Started");
    console.log("📅 Schedule: Monday-Friday at 3:35 PM (Asia/Kolkata)");

    cron.schedule(
        "35 15 * * 1-5",
        async () => {
            console.log("\n======================================");
            console.log("🕒 Closing Price Scheduler Triggered");
            console.log("======================================");

            try {
                const now = new Date();
                const parts = new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Asia/Kolkata",
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                }).formatToParts(now);
                const local = Object.fromEntries(
                    parts.map(({ type, value }) => [type, value])
                );
                const dateParts = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Kolkata",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }).formatToParts(now);
                const dateValues = Object.fromEntries(
                    dateParts.map(({ type, value }) => [type, value])
                );
                const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
                const holidays = new Set(
                    String(process.env.NSE_MARKET_HOLIDAYS || "")
                        .split(",")
                        .map((value) => value.trim())
                        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
                );

                if (local.weekday === "Sat" || local.weekday === "Sun" || holidays.has(today)) {
                    console.log(`[Index Market] Skipping closing-price sync on non-trading date ${today}.`);
                    return;
                }

                const result = await updateClosingPricesFromUpstox(io);

                console.log(
                    `✅ Closing-price sync completed: ${result.succeeded}/${result.total}`
                );
            } catch (err) {
                console.error(
                    "❌ Closing-price scheduler failed:",
                    err?.message || err
                );
            }
        },
        {
            timezone: "Asia/Kolkata",
        }
    );
}

module.exports = { startClosingPriceScheduler };