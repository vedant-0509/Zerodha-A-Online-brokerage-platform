const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env")
});

console.log(
    "Upstox token loaded:",
    process.env.UPSTOX_ANALYTIC_TOKEN
        ? `${process.env.UPSTOX_ANALYTIC_TOKEN.slice(0, 12)}...`
        : "MISSING"
);

const {
    connectMongoDB,
    closeMongoDB
} = require("../config/mongodb");

const {
    startScheduler
} = require("./marketScheduler");

const {
    alreadyUpdatedToday,
    saveUpdateLog
} = require("./marketUpdateLog");

const {
    updateMarketData
} = require("./marketUpdateService");

const {
    isMarketOpen
} = require("../indexMarket/isMarketOpen");


require("./app");


async function bootstrap() {

    console.log("Starting Holdings Server...");

    try {

        // IMPORTANT:
        // MongoDB must be connected before
        // marketUpdateLog / marketUpdateService
        // access getMongoDB().
        await connectMongoDB();


        if (isMarketOpen()) {

            console.log("Market Open");
            console.log("Serving DB Data");

        } else {

            console.log("Market Closed");

            const updated =
                await alreadyUpdatedToday();

            if (updated) {

                console.log(
                    "Today's data already updated."
                );

            } else {

                console.log(
                    "Updating Today's Closing Prices..."
                );

                const success =
                    await updateMarketData();

                if (success) {

                    await saveUpdateLog();

                    console.log(
                        "Today's Closing Prices Saved."
                    );

                } else {

                    console.log(
                        "Market update failed."
                    );

                    console.log(
                        "Log not saved."
                    );
                }
            }
        }


        // Start scheduler only after MongoDB
        // connection is ready.
        startScheduler();

    } catch (error) {

        console.error(
            "Holdings bootstrap failed:",
            error
        );

        try {
            await closeMongoDB();
        } catch (_) {}

        process.exit(1);
    }
}


bootstrap();