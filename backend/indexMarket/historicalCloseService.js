const axios = require("axios");

const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

async function getDailyClose(instrumentKey) {
    try {
        // const today = new Date().toISOString().split("T")[0];
        const today = new Date().toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
        });

        const url = `https://api.upstox.com/v3/historical-candle/intraday/${encodeURIComponent(instrumentKey)}/days/1`;

        const { data } = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                Accept: "application/json",
            },
        });

        const candle = data?.data?.candles?.[0];

        if (!candle) {
            console.log(`⚠ No intraday data found for ${instrumentKey}`);
            return null;
        }

        if (candle[0].split("T")[0] !== today) {
            console.log(`⚠ No candle found for today: ${instrumentKey}`);
            return null;
        }

        return {
            instrumentKey,
            open: candle[1],
            high: candle[2],
            low: candle[3],
            close: candle[4],
            volume: candle[5],
            timestamp: candle[0],
        };
        
    } catch (err) {
        console.log(
            instrumentKey,
            err.response?.data || err.message
        );
        return null;
    }
}

module.exports = { getDailyClose };