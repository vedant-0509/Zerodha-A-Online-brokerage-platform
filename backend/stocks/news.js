require("dotenv").config({
    path: "../.env",
});

const axios = require("axios");

const { getMongoDB } = require("../config/mongodb");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

async function fetchNews() {
    console.log("\n📢 Fetching Nifty 50 Market News...\n");

    const db = getMongoDB();

    const stocksCollection = db.collection("marketGainerloser");
    const newsCollection = db.collection("marketNews");

    // ========================================================
    // NIFTY 50 STOCKS
    // ========================================================

    const niftySymbols = [
        "ADANIENT",
        "ADANIPORTS",
        "APOLLOHOSP",
        "ASIANPAINT",
        "AXISBANK",
        "BAJAJ-AUTO",
        "BAJFINANCE",
        "BAJAJFINSV",
        "BEL",
        "BHARTIARTL",
        "BPCL",
        "BRITANNIA",
        "CIPLA",
        "COALINDIA",
        "DRREDDY",
        "EICHERMOT",
        "ETERNAL",
        "GRASIM",
        "HCLTECH",
        "HDFCBANK",
        "HDFCLIFE",
        "HERO-MOTOCO",
        "HINDALCO",
        "HINDUNILVR",
        "ICICIBANK",
        "INDUSINDBK",
        "INFY",
        "ITC",
        "JIOFIN",
        "JSWSTEEL",
        "KOTAKBANK",
        "LT",
        "M&M",
        "MARUTI",
        "NESTLEIND",
        "NTPC",
        "ONGC",
        "POWERGRID",
        "RELIANCE",
        "SBILIFE",
        "SBIN",
        "SHRIRAMFIN",
        "SUNPHARMA",
        "TATACONSUM",
        "TATAMOTORS",
        "TATASTEEL",
        "TCS",
        "TECHM",
        "TITAN",
        "TRENT",
    ];

    const stocks = await stocksCollection
        .find(
            {
                symbol: {
                    $in: niftySymbols,
                },
                instrumentKey: {
                    $exists: true,
                    $ne: null,
                },
            },
            {
                projection: {
                    _id: 0,
                    instrumentKey: 1,
                    symbol: 1,
                },
            }
        )
        .sort({ symbol: 1 })
        .toArray();

    console.log(`Found ${stocks.length} Nifty 50 Stocks\n`);

    // ========================================================
    // CLEAR OLD NEWS
    // ========================================================

    await newsCollection.deleteMany({});

    // ========================================================
    // FETCH FROM UPSTOX
    // ========================================================

    const batchSize = 30;

    let totalInserted = 0;

    for (let i = 0; i < stocks.length; i += batchSize) {

        const batch = stocks.slice(i, i + batchSize);

        const instrumentKeys = batch
            .map((stock) => stock.instrumentKey)
            .join(",");

        try {

            const { data } = await axios.get(
                "https://api.upstox.com/v2/news",
                {
                    params: {
                        category: "instrument_keys",
                        instrument_keys: instrumentKeys,
                        page_size: 100,
                    },
                    headers: {
                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                        Accept: "application/json",
                    },
                }
            );

            const news = data?.data || {};

            const documents = [];

            for (const stock of batch) {

                const articles = news[stock.instrumentKey];

                if (!Array.isArray(articles) || articles.length === 0) {
                    continue;
                }

                for (const article of articles) {

                    if (!article?.heading) {
                        continue;
                    }

                    documents.push({
                        symbol: stock.symbol,
                        instrumentKey: stock.instrumentKey,
                        heading: article.heading,
                        summary: article.summary || null,
                        thumbnail: article.thumbnail || null,
                        articleLink: article.article_link || null,
                        publishedTime: article.published_time
                            ? new Date(article.published_time)
                            : null,
                        createdAt: new Date(),
                    });

                    console.log(
                        `✔ ${stock.symbol} -> ${article.heading}`
                    );
                }
            }

            if (documents.length > 0) {
                await newsCollection.insertMany(
                    documents,
                    {
                        ordered: false,
                    }
                );

                totalInserted += documents.length;
            }

        } catch (err) {

            console.log("\n❌ Batch Failed\n");

            if (err.response) {
                console.log(err.response.data);
            } else {
                console.log(err.message);
            }
        }
    }

    console.log(
        `\n✅ ${totalInserted} news articles stored successfully.`
    );

    console.log("🎉 News update completed.\n");

    return totalInserted;
}

module.exports = {
    fetchNews,
};