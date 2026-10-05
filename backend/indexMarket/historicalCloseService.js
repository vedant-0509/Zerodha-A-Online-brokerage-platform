// const axios = require("axios");

// const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

// async function getDailyClose(instrumentKey) {
//     try {
//         // const today = new Date().toISOString().split("T")[0];
//         const today = new Date().toLocaleDateString("en-CA", {
//             timeZone: "Asia/Kolkata",
//         });

//         const url = `https://api.upstox.com/v3/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/days/1`;

//         const { data } = await axios.get(url, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//                 Accept: "application/json",
//             },
//         });

//         const candle = data?.data?.candles?.[0];

//         if (!candle) {
//             console.log(`⚠ No intraday data found for ${instrumentKey}`);
//             return null;
//         }

//         if (candle[0].split("T")[0] !== today) {
//             console.log(`⚠ No candle found for today: ${instrumentKey}`);
//             return null;
//         }

//         return {
//             instrumentKey,
//             open: candle[1],
//             high: candle[2],
//             low: candle[3],
//             close: candle[4],
//             volume: candle[5],
//             timestamp: candle[0],
//         };
        
//     } catch (err) {
//         console.log(
//             instrumentKey,
//             err.response?.data || err.message
//         );
//         return null;
//     }
// }

// module.exports = { getDailyClose };






const axios = require("axios");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

function getIndiaDate(daysOffset = 0) {
    const date = new Date();

    date.setDate(date.getDate() + daysOffset);

    return date.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });
}

async function getDailyClose(instrumentKey) {
    try {
        const today = getIndiaDate(0);

        // Request enough calendar days to cover
        // weekends and market holidays.
        const fromDate = getIndiaDate(-10);

        const url =
            `https://api.upstox.com/v3/historical-candle/` +
            `${encodeURIComponent(instrumentKey)}/days/1/` +
            `${today}/${fromDate}`;

        const { data } = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                Accept: "application/json",
            },
        });

        const candles = data?.data?.candles;

        if (!Array.isArray(candles) || candles.length === 0) {
            console.log(
                `⚠ No historical candles found for ${instrumentKey}`
            );

            return null;
        }

        // Convert and sort newest → oldest.
        const sortedCandles = candles
            .filter(
                (candle) =>
                    Array.isArray(candle) &&
                    candle.length >= 5
            )
            .sort(
                (a, b) =>
                    new Date(b[0]) - new Date(a[0])
            );

        if (sortedCandles.length === 0) {
            return null;
        }

        // Latest trading session.
        const latest = sortedCandles[0];

        // Previous trading session.
        const previous = sortedCandles[1] || null;

        const tradingDate =
            latest[0].split("T")[0];

        const previousClose = previous
            ? Number(previous[4])
            : null;

        console.log(
            `📊 ${instrumentKey} | ` +
            `Latest: ${tradingDate} | ` +
            `Close: ${latest[4]} | ` +
            `Previous Close: ${previousClose ?? "N/A"}`
        );

        return {
            instrumentKey,

            open: Number(latest[1]),
            high: Number(latest[2]),
            low: Number(latest[3]),
            close: Number(latest[4]),
            volume: Number(latest[5] || 0),

            timestamp: latest[0],

            previousClose,
            previousTimestamp:
                previous?.[0] || null,
        };
    } catch (err) {
        console.error(
            `❌ Historical close error for ${instrumentKey}:`,
            err.response?.data || err.message
        );

        return null;
    }
}

module.exports = {
    getDailyClose,
};