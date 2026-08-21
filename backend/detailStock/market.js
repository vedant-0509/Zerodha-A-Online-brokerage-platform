const env = require("./env");

const IST_OFFSET_MINUTES = 330;

function indiaDate(date = new Date()) {
  const utcMillis = date.getTime() + date.getTimezoneOffset() * 60 * 1000;

  const ist = new Date(utcMillis + IST_OFFSET_MINUTES * 60 * 1000);

  return ist.toISOString().slice(0, 10);
}

function indiaMinutes(date = new Date()) {
  const utcMillis = date.getTime() + date.getTimezoneOffset() * 60 * 1000;

  const ist = new Date(utcMillis + IST_OFFSET_MINUTES * 60 * 1000);

  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

function hhmmToMinutes(value) {
  const [hours, minutes] = String(value || "09:15")
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function isTradingDay(date = new Date()) {
  const dateString = indiaDate(date);

  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();

  // Sunday
  if (day === 0) return false;

  // Saturday
  if (day === 6) return false;

  const holidays = Array.isArray(env.marketHolidays) ? env.marketHolidays : [];

  return !holidays.includes(dateString);
}

function isMarketOpen(date = new Date()) {
  if (!isTradingDay(date)) {
    return false;
  }

  const now = indiaMinutes(date);

  const openMinutes = hhmmToMinutes(env.marketOpen || "09:15");

  const closeMinutes = hhmmToMinutes(env.marketClose || "15:30");

  return now >= openMinutes && now < closeMinutes;
}

function isBeforeMarketOpen(date = new Date()) {
  if (!isTradingDay(date)) {
    return false;
  }

  return indiaMinutes(date) < hhmmToMinutes(env.marketOpen || "09:15");
}

function isAfterMarketClose(date = new Date()) {
  if (!isTradingDay(date)) {
    return true;
  }

  return indiaMinutes(date) >= hhmmToMinutes(env.marketClose || "15:30");
}

function marketStatus(date = new Date()) {
  const open = isMarketOpen(date);

  return {
    open,
    date: indiaDate(date),
    openTime: env.marketOpen || "09:15",
    closeTime: env.marketClose || "15:30",
    timezone: env.timezone || "Asia/Kolkata",
    tradingDay: isTradingDay(date),
    beforeOpen: isBeforeMarketOpen(date),
    afterClose: isAfterMarketClose(date),
  };
}

module.exports = {
  indiaDate,
  indiaMinutes, 
  isTradingDay,
  isMarketOpen,
  isBeforeMarketOpen,
  isAfterMarketClose,
  marketStatus,
  hhmmToMinutes,
};
