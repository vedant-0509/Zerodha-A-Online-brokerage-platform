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