const axios = require("axios");

const ACCESS_TOKEN =
    process.env.UPSTOX_ANALYTIC_TOKEN ||
    process.env.UPSTOX_ACCESS_TOKEN;

function getIndiaDate(daysOffset = 0) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);

    const date = new Date(
        Date.UTC(year, month - 1, day + daysOffset)
    );

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
}

async function getDailyClose(instrumentKey) {
    if (!ACCESS_TOKEN) {
        throw new Error("Upstox access token is missing");
    }

    const today = getIndiaDate(0);
    const fromDate = getIndiaDate(-10);

    const url =
        `https://api.upstox.com/v3/historical-candle/` +
        `${encodeURIComponent(instrumentKey)}/days/1/` +
        `${today}/${fromDate}`;

    try {
        const { data } = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                Accept: "application/json",
            },
            timeout: 15000,
        });

        const candles = data?.data?.candles;

        if (!Array.isArray(candles) || candles.length === 0) {
            throw new Error(
                `No historical candles returned for ${instrumentKey}`
            );
        }

        const sortedCandles = candles
            .filter(
                (candle) =>
                    Array.isArray(candle) &&
                    candle.length >= 5 &&
                    candle[0] &&
                    Number.isFinite(Number(candle[4])) &&
                    Number(candle[4]) > 0
            )
            .sort(
                (a, b) =>
                    new Date(b[0]).getTime() -
                    new Date(a[0]).getTime()
            );

        if (sortedCandles.length === 0) {
            throw new Error(
                `No valid daily candles returned for ${instrumentKey}`
            );
        }

        const latest = sortedCandles[0];
        const previous = sortedCandles[1] || null;

        const timestamp = latest[0];

        if (!Number.isFinite(new Date(timestamp).getTime())) {
            throw new Error(
                `Invalid candle timestamp for ${instrumentKey}: ${timestamp}`
            );
        }

        console.log(
            `📊 ${instrumentKey} | Candle: ${timestamp} | Close: ${latest[4]} | Previous close: ${previous?.[4] ?? "N/A"}`
        );

        return {
            instrumentKey,
            open: Number(latest[1]),
            high: Number(latest[2]),
            low: Number(latest[3]),
            close: Number(latest[4]),
            volume: Number(latest[5] || 0),
            timestamp,
            previousClose: previous ? Number(previous[4]) : null,
            previousTimestamp: previous?.[0] || null,
        };
    } catch (err) {
        console.error(
            `❌ Historical close error for ${instrumentKey}:`,
            err.response?.data || err.message
        );

        throw err;
    }
}

module.exports = { getDailyClose };