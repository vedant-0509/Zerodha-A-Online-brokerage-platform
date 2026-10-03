require("dotenv").config();

const axios = require("axios");

const { getMongoDB, connectMongoDB, closeMongoDB } = require("../config/mongodb");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

async function updatePreviousClose(_db, previousDate) {
    console.log(`\nFetching Previous Close (${previousDate})...\n`);

    const collection = getMongoDB().collection("marketGainerloser");

    const stocks = await collection
        .find(
            {
                instrumentKey: {
                    $exists: true,
                    $ne: null,
                },
            },
            {
                projection: {
                    _id: 0,
                    instrumentKey: 1,
                },
            }
        )
        .sort({ instrumentKey: 1 })
        .toArray();

    console.log(`Found ${stocks.length} stocks\n`);

    for (const stock of stocks) {
        try {
            const url =
                `https://api.upstox.com/v3/historical-candle/` +
                `${encodeURIComponent(stock.instrumentKey)}` +
                `/days/1/${previousDate}/${previousDate}`;

            const { data } = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    Accept: "application/json",
                },
            });

            const candle = data?.data?.candles?.[0];

            if (!candle) {
                console.log(`No candle : ${stock.instrumentKey}`);
                continue;
            }

            const previousClose = Number(candle[4]);

            if (!Number.isFinite(previousClose)) {
                console.log(
                    `Invalid previous close : ${stock.instrumentKey}`
                );
                continue;
            }

            await collection.updateOne(
                {
                    instrumentKey: stock.instrumentKey,
                },
                {
                    $set: {
                        previousClose,
                        tradingDate: previousDate,
                        updatedAt: new Date(),
                    },
                }
            );

            console.log(
                `✅ ${stock.instrumentKey} -> Previous Close = ${previousClose}`
            );

        } catch (err) {
            console.log(`❌ ${stock.instrumentKey}`);

            if (err.response) {
                console.log(err.response.data);
            } else {
                console.log(err.message);
            }
        }
    }

    console.log("\n🎉 Previous Close Updated Successfully.");
}

module.exports = updatePreviousClose;


// ============================================================
// STANDALONE MANUAL RUN
// ============================================================

if (require.main === module) {
    const dateArg =
        process.argv[2] ||
        new Date().toISOString().slice(0, 10);

    (async () => {
        try {
            await connectMongoDB();

            await updatePreviousClose(null, dateArg);

        } catch (err) {
            console.error(err);
            process.exitCode = 1;

        } finally {
            await closeMongoDB();
        }
    })();
}