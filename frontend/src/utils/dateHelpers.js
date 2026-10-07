export function getIndiaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDateDaysAgo(days) {
  const indiaToday = getIndiaDate();
  const date = new Date(`${indiaToday}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function getDateMonthsAgo(months) {
  const indiaToday = getIndiaDate();
  const date = new Date(`${indiaToday}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - Number(months || 0));
  return date.toISOString().slice(0, 10);
}

export function getDateYearsAgo(years) {
  return getDateMonthsAgo(Number(years || 0) * 12);
}

export function getHistoryParams(range) {
  switch (range) {
    // IMPORTANT:
    // 1D must use Upstox intraday endpoint.
    // Do NOT send a "from" date.
    case "1D":
      return {
        unit: "minutes",
        interval: "1",
      };

    case "1W":
      return {
        unit: "days",
        interval: "1",
        from: getDateDaysAgo(7),
      };

    case "1M":
      return {
        unit: "days",
        interval: "1",
        from: getDateMonthsAgo(1),
      };

    case "3M":
      return {
        unit: "days",
        interval: "1",
        from: getDateMonthsAgo(3),
      };

    case "6M":
      return {
        unit: "days",
        interval: "1",
        from: getDateMonthsAgo(6),
      };

    case "1Y":
      return {
        unit: "days",
        interval: "1",
        from: getDateYearsAgo(1),
      };

    case "3Y":
      return {
        unit: "days",
        interval: "1",
        from: getDateYearsAgo(3),
      };

    case "5Y":
      return {
        unit: "days",
        interval: "1",
        from: getDateYearsAgo(5),
      };

    case "All":
      return {
        unit: "months",
        interval: "1",
        from: "2000-01-01",
      };

    default:
      return {
        unit: "minutes",
        interval: "1",
      };
  }
}

export function parseHistoryTimestamp(value) {
  if (value === null || value === undefined || value === "") return NaN;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric < 1e11) return numeric * 1000;
    if (numeric < 1e14) return numeric;
    if (numeric < 1e17) return numeric / 1000;
    return numeric / 1000000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function indiaDateFromTimestamp(value) {
  const timestamp = parseHistoryTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function getIndiaTimeParts(value = Date.now()) {
  const timestamp = parseHistoryTimestamp(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes:
      Number(values.hour) * 60 +
      Number(values.minute) +
      Number(values.second) / 60,
  };
}

export function isISTTradingTimestamp(value) {
  const parts = getIndiaTimeParts(value);
  if (!parts) return false;
  return parts.minutes >= 9 * 60 + 15 && parts.minutes <= 15 * 60 + 30;
}

export function getMarketTimestamp(data) {
  if (!data) return NaN;
  return parseHistoryTimestamp(
    data.timestamp ??
    data.time ??
    data.lastTradeTime ??
    data.last_trade_time ??
    data.tradeTime ??
    data.trade_time ??
    data.t ??
    data.ltt,
  );
}

export function getISTMarketProgress(rawTime) {
  const ts = parseHistoryTimestamp(rawTime);
  if (!Number.isFinite(ts)) return 0;
  const parts = getIndiaTimeParts(ts);
  if (!parts) return 0;
  const marketOpenMinutes = 9 * 60 + 15;
  const marketCloseMinutes = 15 * 60 + 30;
  return Math.max(
    0,
    Math.min(
      1,
      (parts.minutes - marketOpenMinutes) /
      (marketCloseMinutes - marketOpenMinutes),
    ),
  );
}
