const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env"),
});

const axios = require("axios");

const {
    getMongoDB,
} = require("../config/mongodb");

const ACCESS_TOKEN =
    process.env.UPSTOX_ANALYTIC_TOKEN;

console.log(
    "Upstox token loaded:",
    ACCESS_TOKEN
        ? `${ACCESS_TOKEN.slice(0, 12)}...`
        : "MISSING"
);


async function updateMarketData() {

    console.log("Updating Market Data...");

    if (!ACCESS_TOKEN) {

        console.error(
            "UPSTOX_ANALYTIC_TOKEN is missing."
        );

        return false;
    }

    try {

        const db = getMongoDB();

        const collection =
            db.collection("marketStocks");


        /* =================================================
           GET INSTRUMENT KEYS
        ================================================= */

        const stocks = await collection
            .find(
                {
                    instrumentKey: {
                        $exists: true,
                        $nin: [null, ""],
                    },
                },
                {
                    projection: {
                        _id: 0,
                        instrumentKey: 1,
                    },
                }
            )
            .sort({
                instrumentKey: 1,
            })
            .toArray();


        console.log(
            `Found ${stocks.length} Stocks`
        );


        const instrumentKeys = [
            ...new Set(
                stocks
                    .map(
                        row =>
                            String(
                                row.instrumentKey
                            ).trim()
                    )
                    .filter(Boolean)
            ),
        ];


        const chunkSize = 500;

        let quotesProcessed = 0;
        let quotesUpdated = 0;
        let quotesSkipped = 0;


        /* =================================================
           PROCESS UPSTOX QUOTES
        ================================================= */

        for (
            let i = 0;
            i < instrumentKeys.length;
            i += chunkSize
        ) {

            const chunk =
                instrumentKeys.slice(
                    i,
                    i + chunkSize
                );


            console.log(
                `Processing ${i + 1}-${Math.min(
                    i + chunk.length,
                    instrumentKeys.length
                )} of ${instrumentKeys.length}`
            );


            const response =
                await axios.get(
                    "https://api.upstox.com/v2/market-quote/quotes",
                    {
                        headers: {
                            Authorization:
                                `Bearer ${ACCESS_TOKEN}`,
                        },

                        params: {
                            instrument_key:
                                chunk.join(","),
                        },

                        timeout: 30000,
                    }
                );


            const quotes =
                response.data?.data || {};


            console.log(
                `Received ${Object.keys(quotes).length} quotes`
            );


            /* =================================================
               UPDATE EACH QUOTE
            ================================================= */

            for (
                const responseKey in quotes
            ) {

                const q =
                    quotes[responseKey];

                quotesProcessed++;


                if (
                    !q ||
                    !q.ohlc ||
                    q.last_price == null ||
                    q.ohlc.close == null
                ) {

                    quotesSkipped++;

                    console.log(
                        "Skipping incomplete quote:",
                        responseKey
                    );

                    continue;
                }


                /*
                 * IMPORTANT:
                 * Upstox responseKey can be:
                 *
                 * BSE_EQ:JAYATMA
                 *
                 * MongoDB instrumentKey is:
                 *
                 * BSE_EQ|INE....
                 *
                 * Therefore use instrument_token.
                 */

                const instrumentKey =
                    q.instrument_token;


                if (!instrumentKey) {

                    quotesSkipped++;

                    console.log(
                        "Skipping quote without instrument_token:",
                        responseKey
                    );

                    continue;
                }


                const lastPrice =
                    Number(q.last_price);

                const changeValue =
                    Number(q.net_change ?? 0);

                const previousClose =
                    lastPrice - changeValue;

                const changePercent =
                    previousClose !== 0
                        ? (
                            changeValue /
                            previousClose
                        ) * 100
                        : 0;


                if (
                    !Number.isFinite(lastPrice) ||
                    !Number.isFinite(changeValue) ||
                    !Number.isFinite(previousClose)
                ) {

                    quotesSkipped++;

                    console.log(
                        "Skipping invalid numeric quote:",
                        responseKey
                    );

                    continue;
                }


                const result =
                    await collection.updateOne(
                        {
                            instrumentKey,
                        },
                        {
                            $set: {
                                price: lastPrice,

                                changeValue:
                                    changeValue,

                                changePercent:
                                    changePercent,

                                openPrice:
                                    q.ohlc.open ??
                                    null,

                                previousClose:
                                    previousClose,

                                dayHigh:
                                    q.ohlc.high ??
                                    null,

                                dayLow:
                                    q.ohlc.low ??
                                    null,

                                dayClose:
                                    lastPrice,

                                volume:
                                    Number(
                                        q.volume ?? 0
                                    ),

                                updatedAt:
                                    new Date(),
                            },
                        }
                    );


                if (
                    result.matchedCount === 1
                ) {

                    quotesUpdated++;

                } else {

                    console.log(
                        "No MongoDB row matched:",
                        {
                            instrumentKey,
                            responseKey,
                        }
                    );
                }
            }


            console.log(
                `Completed ${Math.min(
                    i + chunk.length,
                    instrumentKeys.length
                )}/${instrumentKeys.length}`
            );
        }


        console.log(
            "\n========== MARKET UPDATE SUMMARY =========="
        );

        console.log(
            `Stocks in DB:     ${instrumentKeys.length}`
        );

        console.log(
            `Quotes processed: ${quotesProcessed}`
        );

        console.log(
            `Quotes updated:   ${quotesUpdated}`
        );

        console.log(
            `Quotes skipped:   ${quotesSkipped}`
        );

        console.log(
            "Market Data Updated Successfully"
        );

        console.log(
            "===========================================\n"
        );


        return true;

    } catch (err) {

        console.error(
            "Market update failed."
        );

        if (err.response?.data) {

            console.error(
                JSON.stringify(
                    err.response.data,
                    null,
                    2
                )
            );

        } else {

            console.error(
                err.message
            );
        }

        return false;
    }
}


module.exports = {
    updateMarketData,
};