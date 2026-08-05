const cron = require("node-cron");

const { alreadyUpdatedToday, saveUpdateLog } = require("./marketUpdateLog");

const { updateMarketData } = require("./marketUpdateService");

function startScheduler() {

    cron.schedule(
        "35 15 * * 1-5",
        async () => {

            try {

                console.log("3:35 PM Triggered");

                const updated = await alreadyUpdatedToday();

                if(updated){

                    console.log("Already Updated Today.");

                    return;
                }

                await updateMarketData();

                await saveUpdateLog();

                console.log("Today's Update Completed.");

            } catch(err){

                console.log(err);

            }

        },
        {
            timezone:"Asia/Kolkata"
        }
    );

}

module.exports = {
    startScheduler
};