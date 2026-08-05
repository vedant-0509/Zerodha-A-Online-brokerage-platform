const cron = require("node-cron");

const updateMarketData = require("./updateMarketData");

cron.schedule(
    "35 15 * * 1-5",
    async () => {
        const updated = await alreadyUpdatedToday();

        if(updated){
            console.log("Already Updated.");
            return;
        }

        await updateMarketData();
        await saveUpdateLog();
    },
    {
        timezone:"Asia/Kolkata"
    }
);