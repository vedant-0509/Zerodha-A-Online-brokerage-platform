// const env = require("./env");
// const { getStockFinancials } = require("./upstox");
// const logger = require("./logger");

// const FORCE_MARKET_OPEN = process.env.FORCE_MARKET_OPEN === "true";

// function indiaDate(date = new Date()) {
//   return new Intl.DateTimeFormat("en-CA", {
//     timeZone: "Asia/Kolkata",
//     year: "numeric",
//     month: "2-digit",
//     day: "2-digit",
//   }).format(date);
// }

// function indiaMinutes(date = new Date()) {
//   const parts = new Intl.DateTimeFormat("en-GB", {
//     timeZone: "Asia/Kolkata",
//     hour: "2-digit",
//     minute: "2-digit",
//     second: "2-digit",
//     hourCycle: "h23",
//   }).formatToParts(date);

//   const values = Object.fromEntries(
//     parts.map((part) => [
//       part.type,
//       part.value,
//     ])
//   );

//   return (
//     Number(values.hour || 0) * 60 +
//     Number(values.minute || 0) +
//     Number(values.second || 0) / 60
//   );
// }

// function hhmmToMinutes(value) {
//   const [hours, minutes] = String(
//     value || "09:15"
//   )
//     .split(":")
//     .map(Number);

//   return hours * 60 + minutes;
// }

// function isTradingDay(date = new Date()) {
//   const dateString =
//     indiaDate(date);

//   const day =
//     new Date(
//       `${dateString}T00:00:00Z`
//     ).getUTCDay();

//   if (day === 0) return false;
//   if (day === 6) return false;

//   const holidays =
//     Array.isArray(
//       env.marketHolidays
//     )
//       ? env.marketHolidays
//       : [];

//   return !holidays.includes(
//     dateString
//   );
// }

// // function isMarketOpen(date = new Date()) {
// //   if (!isTradingDay(date)) {
// //     return false;
// //   }

// //   const now =
// //     indiaMinutes(date);

// //   const openMinutes =
// //     hhmmToMinutes(
// //       env.marketOpen ||
// //       "09:15"
// //     );

// //   const closeMinutes =
// //     hhmmToMinutes(
// //       env.marketClose ||
// //       "15:30"
// //     );

// //   return (
// //     now >= openMinutes &&
// //     now < closeMinutes
// //   );
// // }
// function isMarketOpen(date = new Date()) {
//   if (FORCE_MARKET_OPEN) {
//     return true;
//   }

//   if (!isTradingDay(date)) {
//     return false;
//   }

//   const now = indiaMinutes(date);

//   const openMinutes = hhmmToMinutes(
//     env.marketOpen || "09:15"
//   );

//   const closeMinutes = hhmmToMinutes(
//     env.marketClose || "15:30"
//   );

//   return (
//     now >= openMinutes &&
//     now < closeMinutes
//   );
// }

// function isBeforeMarketOpen(
//   date = new Date()
// ) {
//   if (!isTradingDay(date)) {
//     return false;
//   }

//   return (
//     indiaMinutes(date) <
//     hhmmToMinutes(
//       env.marketOpen ||
//       "09:15"
//     )
//   );
// }

// function isAfterMarketClose(
//   date = new Date()
// ) {
//   if (!isTradingDay(date)) {
//     return true;
//   }

//   return (
//     indiaMinutes(date) >=
//     hhmmToMinutes(
//       env.marketClose ||
//       "15:30"
//     )
//   );
// }

// function marketStatus(
//   date = new Date()
// ) {
//   const open =
//     isMarketOpen(date);

//   return {
//     open,

//     marketOpen: open,

//     date:
//       indiaDate(date),

//     openTime:
//       env.marketOpen ||
//       "09:15",

//     closeTime:
//       env.marketClose ||
//       "15:30",

//     timezone:
//       env.timezone ||
//       "Asia/Kolkata",

//     tradingDay:
//       isTradingDay(date),

//     beforeOpen:
//       isBeforeMarketOpen(date),

//     afterClose:
//       isAfterMarketClose(date),
//   };
// }

// async function handleStockMarketData(
//   symbol
// ) {
//   try {
//     return await getStockFinancials(
//       symbol
//     );
//   } catch (error) {
//     logger.error(
//       `Market process error for ${symbol}:`,
//       error
//     );

//     return null;
//   }
// }

// module.exports = {
//   indiaDate,
//   indiaMinutes,
//   isTradingDay,
//   isMarketOpen,
//   isBeforeMarketOpen,
//   isAfterMarketClose,
//   marketStatus,
//   hhmmToMinutes,
//   handleStockMarketData,
// };


























const env = require("./env");
const { getStockFinancials } = require("./upstox");
const logger = require("./logger");

const FORCE_MARKET_OPEN = process.env.FORCE_MARKET_OPEN === "true";

function indiaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function indiaMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return (
    Number(values.hour || 0) * 60 +
    Number(values.minute || 0) +
    Number(values.second || 0) / 60
  );
}

function hhmmToMinutes(value) {
  const [hours, minutes] = String(
    value || "09:15"
  )
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function isOfficialSettlementReady(date = new Date()) {
  // Weekends/holidays do not have a pending same-day settlement.
  if (!isTradingDay(date)) return true;

  const nowMinutes = indiaMinutes(date);
  const openMinutes = hhmmToMinutes(env.marketOpen || "09:15");
  const settlementMinutes = hhmmToMinutes(env.marketSettlement || "15:45");

  // Before the live session starts, the latest completed session is already
  // finalized and can be served as the official 1D chart.
  if (nowMinutes < openMinutes) return true;

  return nowMinutes >= settlementMinutes;
}

function isTradingDay(date = new Date()) {
  const dateString =
    indiaDate(date);

  const day =
    new Date(
      `${dateString}T00:00:00Z`
    ).getUTCDay();

  if (day === 0) return false;
  if (day === 6) return false;

  const holidays =
    Array.isArray(
      env.marketHolidays
    )
      ? env.marketHolidays
      : [];

  return !holidays.includes(
    dateString
  );
}

// function isMarketOpen(date = new Date()) {
//   if (!isTradingDay(date)) {
//     return false;
//   }

//   const now =
//     indiaMinutes(date);

//   const openMinutes =
//     hhmmToMinutes(
//       env.marketOpen ||
//       "09:15"
//     );

//   const closeMinutes =
//     hhmmToMinutes(
//       env.marketClose ||
//       "15:30"
//     );

//   return (
//     now >= openMinutes &&
//     now < closeMinutes
//   );
// }
function isMarketOpen(date = new Date()) {
  if (FORCE_MARKET_OPEN) {
    return true;
  }

  if (!isTradingDay(date)) {
    return false;
  }

  const now = indiaMinutes(date);

  const openMinutes = hhmmToMinutes(
    env.marketOpen || "09:15"
  );

  const closeMinutes = hhmmToMinutes(
    env.marketClose || "15:30"
  );

  return (
    now >= openMinutes &&
    now < closeMinutes
  );
}

function isBeforeMarketOpen(
  date = new Date()
) {
  if (!isTradingDay(date)) {
    return false;
  }

  return (
    indiaMinutes(date) <
    hhmmToMinutes(
      env.marketOpen ||
      "09:15"
    )
  );
}

function isAfterMarketClose(
  date = new Date()
) {
  if (!isTradingDay(date)) {
    return true;
  }

  return (
    indiaMinutes(date) >=
    hhmmToMinutes(
      env.marketClose ||
      "15:30"
    )
  );
}

function marketStatus(
  date = new Date()
) {
  const open =
    isMarketOpen(date);

  return {
    open,

    marketOpen: open,

    date:
      indiaDate(date),

    openTime:
      env.marketOpen ||
      "09:15",

    closeTime:
      env.marketClose ||
      "15:30",

    timezone:
      env.timezone ||
      "Asia/Kolkata",

    tradingDay:
      isTradingDay(date),

    beforeOpen:
      isBeforeMarketOpen(date),

    afterClose:
      isAfterMarketClose(date),

    officialSettlementReady:
      isOfficialSettlementReady(date),

    settlementTime:
      env.marketSettlement ||
      "15:45",
  };
}

async function handleStockMarketData(
  symbol
) {
  try {
    return await getStockFinancials(
      symbol
    );
  } catch (error) {
    logger.error(
      `Market process error for ${symbol}:`,
      error
    );

    return null;
  }
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
  isOfficialSettlementReady,
  handleStockMarketData,
};