const cron = require("node-cron");
const { updateClosingPricesFromUpstox } = require("./closingPriceService");

function startClosingPriceScheduler(io) {
    console.log("⏰ Closing Price Scheduler Started");
    console.log("📅 Schedule: Monday-Friday at 3:35 PM (Asia/Kolkata)");

    cron.schedule("35 15 * * 1-5", async () => {
        console.log("\n======================================");
        console.log("🕒 3:35 PM Scheduler Triggered");
        console.log("======================================");

        try {
            console.log("📥 Fetching official closing prices...");

            await updateClosingPricesFromUpstox(io);

            console.log("✅ Closing prices updated successfully.");
        } catch (err) {
            console.error(err);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata",
    });
}

module.exports = {startClosingPriceScheduler};