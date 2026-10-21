
const MARKET_TIMEZONE = "Asia/Kolkata";

function getIndiaDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: MARKET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

function getIndiaMarketTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: MARKET_TIMEZONE,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);

    return Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );
}

function getConfiguredHolidays() {
    return new Set(
        String(process.env.NSE_MARKET_HOLIDAYS || "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) =>
                /^\d{4}-\d{2}-\d{2}$/.test(value)
            )
    );
}

function isMarketOpen(date = new Date()) {
    const marketTime = getIndiaMarketTime(date);
    const indiaDate = getIndiaDateKey(date);

    // Normal NSE equity market is closed on weekends.
    if (
        marketTime.weekday === "Sat" ||
        marketTime.weekday === "Sun"
    ) {
        return false;
    }

    // Configure official exchange holidays through environment variables.
    if (getConfiguredHolidays().has(indiaDate)) {
        return false;
    }

    const hour = Number(marketTime.hour);
    const minute = Number(marketTime.minute);
    const currentMinutes = hour * 60 + minute;

    const marketOpenMinutes = 9 * 60 + 15;
    const marketCloseMinutes = 15 * 60 + 30;

    return (
        currentMinutes >= marketOpenMinutes &&
        currentMinutes < marketCloseMinutes
    );
}

module.exports = {
    isMarketOpen,
    getIndiaDateKey,
};
