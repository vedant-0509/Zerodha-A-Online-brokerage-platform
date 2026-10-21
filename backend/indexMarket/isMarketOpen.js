const MARKET_TIMEZONE = "Asia/Kolkata";

// NSE cash-equity holidays for 2026, sourced from the exchange's published
// holiday calendar. Update this versioned calendar when NSE publishes the
// next year's calendar. NSE_MARKET_HOLIDAYS remains available for ad-hoc
// closures and special holidays announced by the exchange.
const NSE_HOLIDAYS_BY_YEAR = {
    "2026": new Set([
        "2026-01-15", // Municipal Corporation Election - Maharashtra
        "2026-01-26", // Republic Day
        "2026-03-03", // Holi
        "2026-03-26", // Shri Ram Navami
        "2026-03-31", // Shri Mahavir Jayanti
        "2026-04-03", // Good Friday
        "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
        "2026-05-01", // Maharashtra Day
        "2026-05-28", // Bakri Id
        "2026-06-26", // Muharram
        "2026-09-14", // Ganesh Chaturthi
        "2026-10-02", // Mahatma Gandhi Jayanti
        "2026-10-20", // Dussehra
        "2026-11-10", // Diwali-Balipratipada
        "2026-11-24", // Guru Nanak Jayanti
        "2026-12-25", // Christmas
    ]),
};

function getIndiaDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: MARKET_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
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
    return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function getConfiguredHolidays() {
    return new Set(
        String(process.env.NSE_MARKET_HOLIDAYS || "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
    );
}

function isTradingDay(date = new Date()) {
    const dateKey = getIndiaDateKey(date);
    const { weekday } = getIndiaMarketTime(date);
    if (weekday === "Sat" || weekday === "Sun") return false;

    const year = dateKey.slice(0, 4);
    const yearCalendar = NSE_HOLIDAYS_BY_YEAR[year];
    if (yearCalendar && yearCalendar.has(dateKey)) return false;
    return !getConfiguredHolidays().has(dateKey);
}

function hasVerifiedHolidayCalendar(date = new Date()) {
    return Object.prototype.hasOwnProperty.call(NSE_HOLIDAYS_BY_YEAR, getIndiaDateKey(date).slice(0, 4));
}

function isMarketOpen(date = new Date()) {
    if (!isTradingDay(date)) return false;
    const marketTime = getIndiaMarketTime(date);
    const currentMinutes = Number(marketTime.hour) * 60 + Number(marketTime.minute);
    return currentMinutes >= (9 * 60 + 15) && currentMinutes < (15 * 60 + 30);
}

module.exports = { isMarketOpen, isTradingDay, hasVerifiedHolidayCalendar, getIndiaDateKey, getIndiaMarketTime };
