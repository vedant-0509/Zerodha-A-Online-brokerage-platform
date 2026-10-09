
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

  // Indian equity market is closed on weekends.
  if (values.weekday === "Sat" || values.weekday === "Sun") {
    return false;
  }

  const minutes =
    Number(values.hour) * 60 + Number(values.minute);

  // NSE regular session: 09:15–15:30 IST.
  return minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
}

module.exports = { isMarketOpen };
