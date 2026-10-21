function getIndiaDateKey(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getConfiguredHolidays() {
  return new Set(
    String(process.env.NSE_MARKET_HOLIDAYS || "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
  );
}

function isMarketOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  // Weekends and explicitly configured NSE holidays are closed.
  if (values.weekday === "Sat" || values.weekday === "Sun") {
    return false;
  }

  if (getConfiguredHolidays().has(getIndiaDateKey(date))) {
    return false;
  }

  const minutes = Number(values.hour) * 60 + Number(values.minute);

  // NSE regular session: 09:15–15:30 IST.
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

module.exports = { isMarketOpen };
