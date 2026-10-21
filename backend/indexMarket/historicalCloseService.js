const axios = require("axios");

const ACCESS_TOKEN =
    process.env.UPSTOX_ANALYTIC_TOKEN || process.env.UPSTOX_ACCESS_TOKEN;

function getIndiaDate(daysOffset = 0) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value]),
    );

    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);

    const date = new Date(Date.UTC(year, month - 1, day + daysOffset));

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
}

function getIndiaDateKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
}

async function getDailyClose(instrumentKey, expectedTradingDate = null) {
    if (!ACCESS_TOKEN) {
        throw new Error("Upstox access token is missing");
    }

    if (
        !expectedTradingDate ||
        !/^\d{4}-\d{2}-\d{2}$/.test(expectedTradingDate)
    ) {
        throw new Error(
            `A valid expectedTradingDate is required for ${instrumentKey}`,
        );
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
            throw new Error(`No historical candles returned for ${instrumentKey}`);
        }

        const sortedCandles = candles
            .filter(
                (candle) =>
                    Array.isArray(candle) &&
                    candle.length >= 5 &&
                    candle[0] &&
                    Number.isFinite(Number(candle[4])) &&
                    Number(candle[4]) > 0,
            )
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

        if (sortedCandles.length === 0) {
            throw new Error(`No valid daily candles returned for ${instrumentKey}`);
        }

        // Select the candle for the expected session, not simply the newest
        // candle returned. If Upstox has not published today's final candle,
        // fail and let the scheduler retry instead of relabelling old data.
        const validTimestampCandles = sortedCandles.filter((candle) =>
            Number.isFinite(new Date(candle[0]).getTime()),
        );
        const latest = validTimestampCandles.find(
            (candle) => getIndiaDateKey(new Date(candle[0])) === expectedTradingDate,
        );

        if (!latest) {
            const newestDate = validTimestampCandles[0]
                ? getIndiaDateKey(new Date(validTimestampCandles[0][0]))
                : "none";
            throw new Error(
                `No candle for expected trading date ${expectedTradingDate || "latest"} ` +
                `for ${instrumentKey}; newest returned date is ${newestDate}`,
            );
        }

        const timestamp = latest[0];
        const previous =
            validTimestampCandles.find(
                (candle) =>
                    new Date(candle[0]).getTime() < new Date(timestamp).getTime(),
            ) || null;
        const open = Number(latest[1]);
        const high = Number(latest[2]);
        const low = Number(latest[3]);
        const close = Number(latest[4]);
        if (
            ![open, high, low, close].every(Number.isFinite) ||
            open <= 0 ||
            high <= 0 ||
            low <= 0 ||
            close <= 0 ||
            high < Math.max(open, close, low) ||
            low > Math.min(open, close, high)
        ) {
            throw new Error(
                `Invalid OHLC values for ${instrumentKey} on ${getIndiaDateKey(new Date(timestamp))}`,
            );
        }

        console.log(
            `📊 ${instrumentKey} | Candle: ${timestamp} | Close: ${latest[4]} | Previous close: ${previous?.[4] ?? "N/A"}`,
        );

        return {
            instrumentKey,
            open,
            high,
            low,
            close,
            volume: Number(latest[5] || 0),
            timestamp,
            previousClose: previous ? Number(previous[4]) : null,
            previousTimestamp: previous?.[0] || null,
        };
    } catch (err) {
        console.error(
            `❌ Historical close error for ${instrumentKey}:`,
            err.response?.data || err.message,
        );

        throw err;
    }
}

module.exports = { getDailyClose };
