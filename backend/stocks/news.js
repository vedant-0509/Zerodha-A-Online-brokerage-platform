require("dotenv").config({
    path: "../.env"
});

const mysql = require("mysql2/promise");
const axios = require("axios");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

async function fetchNews() {

    console.log("\n📢 Fetching Nifty 50 Market News...\n");

    //--------------------------------------------------------
    // Fetch Nifty 50 Stocks
    //--------------------------------------------------------

    const [stocks] = await db.execute(`
        SELECT instrument_key, symbol
        FROM market_gainerloser
        WHERE symbol IN (
            'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT',
            'AXISBANK','BAJAJ-AUTO','BAJFINANCE','BAJAJFINSV',
            'BEL','BHARTIARTL','BPCL','BRITANNIA','CIPLA',
            'COALINDIA','DRREDDY','EICHERMOT','ETERNAL',
            'GRASIM','HCLTECH','HDFCBANK','HDFCLIFE',
            'HERO-MOTOCO','HINDALCO','HINDUNILVR',
            'ICICIBANK','INDUSINDBK','INFY','ITC','JIOFIN',
            'JSWSTEEL','KOTAKBANK','LT','M&M','MARUTI',
            'NESTLEIND','NTPC','ONGC','POWERGRID',
            'RELIANCE','SBILIFE','SBIN','SHRIRAMFIN',
            'SUNPHARMA','TATACONSUM','TATAMOTORS',
            'TATASTEEL','TCS','TECHM','TITAN','TRENT'
        )
        ORDER BY symbol
    `);

    console.log(`Found ${stocks.length} Nifty 50 Stocks\n`);

    //--------------------------------------------------------
    // Delete previous news
    //--------------------------------------------------------

    await db.execute(`DELETE FROM market_news`);

    //--------------------------------------------------------
    // Upstox supports max 30 instrument keys/request
    //--------------------------------------------------------

    const batchSize = 30;

    let totalInserted = 0;

    for (let i = 0; i < stocks.length; i += batchSize) {

        const batch = stocks.slice(i, i + batchSize);

        const instrumentKeys = batch
            .map(stock => stock.instrument_key)
            .join(",");

        try {

            const { data } = await axios.get(
                "https://api.upstox.com/v2/news",
                {
                    params: {
                        category: "instrument_keys",
                        instrument_keys: instrumentKeys,
                        page_size: 100
                    },
                    headers: {
                        Authorization: `Bearer ${ACCESS_TOKEN}`,
                        Accept: "application/json"
                    }
                }
            );

            const news = data.data;



            for (const stock of batch) {

                const articles = news[stock.instrument_key];

                if (!articles || articles.length === 0)
                    continue;

                for (const article of articles) {

                    if (!article.heading)
                        continue;

                    await db.execute(
                        `
                        INSERT IGNORE INTO market_news
                        (
                            symbol,
                            instrument_key,
                            heading,
                            summary,
                            thumbnail,
                            article_link,
                            published_time
                        )
                        VALUES
                        (?,?,?,?,?,?,?)
                        `,
                        [
                            stock.symbol,
                            stock.instrument_key,
                            article.heading,
                            article.summary,
                            article.thumbnail,
                            article.article_link,
                            article.published_time
                        ]
                    );

                    totalInserted++;

                    console.log(
                        `✔ ${stock.symbol} -> ${article.heading}`
                    );
                }
            }

        } catch (err) {

            console.log("\n❌ Batch Failed\n");

            if (err.response)
                console.log(err.response.data);
            else
                console.log(err.message);
        }
    }

    console.log(`\n✅ ${totalInserted} news articles stored successfully.`);
    console.log("🎉 News update completed.\n");

    await db.end();
}

module.exports = { fetchNews };