/**
 * compare-all-stocks-groww.js
 *
 * Compare every stock in your MongoDB marketStocks universe against
 * Groww's live Quote API.
 *
 * What it compares:
 *   - official/current price (your dayClose/price vs Groww last_price + OHLC close)
 *   - 1D change
 *   - 1D change %
 *   - open / high / low
 *
 * Run this AFTER your EOD settlement (recommended: after 15:45 IST)
 * when your application has saved official closing values.
 *
 * Required environment:
 *   MONGODB_URI=...
 *   MONGODB_DB=zerodha              (optional)
 *   GROWW_ACCESS_TOKEN=...
 *
 * Optional:
 *   GROWW_CONCURRENCY=8             default 8
 *   GROWW_MAX_RETRIES=4             default 4
 *   GROWW_TIMEOUT_MS=15000          default 15000
 *   DIFF_PRICE_TOLERANCE=0.05       default 0.05
 *   DIFF_CHANGE_TOLERANCE=0.05      default 0.05
 *   DIFF_PERCENT_TOLERANCE=0.05     default 0.05
 *
 * Example:
 *   node backend/scripts/compare-all-stocks-groww.js
 *
 * Output:
 *   backend/reports/groww-diff-YYYY-MM-DD_HH-mm-ss.csv
 *   backend/reports/groww-diff-YYYY-MM-DD_HH-mm-ss.json
 */

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "zerodha";
const GROWW_ACCESS_TOKEN = process.env.GROWW_ACCESS_TOKEN;

const GROWW_CONCURRENCY = Math.max(
  1,
  Number(process.env.GROWW_CONCURRENCY || 8),
);

const GROWW_MAX_RETRIES = Math.max(
  0,
  Number(process.env.GROWW_MAX_RETRIES || 4),
);

const GROWW_TIMEOUT_MS = Math.max(
  3000,
  Number(process.env.GROWW_TIMEOUT_MS || 15000),
);

const PRICE_TOLERANCE = Math.max(
  0,
  Number(process.env.DIFF_PRICE_TOLERANCE || 0.05),
);

const CHANGE_TOLERANCE = Math.max(
  0,
  Number(process.env.DIFF_CHANGE_TOLERANCE || 0.05),
);

const CHANGE_PERCENT_TOLERANCE = Math.max(
  0,
  Number(process.env.DIFF_PERCENT_TOLERANCE || 0.05),
);

const REPORT_DIR = path.resolve(__dirname, "../reports");

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 4) {
  const n = asNumber(value);
  if (n === null) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function absoluteDiff(a, b) {
  const x = asNumber(a);
  const y = asNumber(b);
  if (x === null || y === null) return null;
  return x - y;
}

function percentDifference(base, other) {
  const a = asNumber(base);
  const b = asNumber(other);

  if (a === null || b === null || b === 0) {
    return null;
  }

  return ((a - b) / Math.abs(b)) * 100;
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowStamp() {
  const d = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const timeValues = Object.fromEntries(
    timeParts.map((part) => [part.type, part.value]),
  );

  return (
    `${values.year}-${values.month}-${values.day}_` +
    `${timeValues.hour}-${timeValues.minute}-${timeValues.second}`
  );
}

function getISTDateTime() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date());
}

function buildGrowwHeaders() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${GROWW_ACCESS_TOKEN}`,
    "X-API-VERSION": "1.0",
  };
}

function parseGrowwOHLC(ohlc) {
  if (!ohlc) {
    return {};
  }

  if (typeof ohlc === "object") {
    return {
      open: asNumber(ohlc.open),
      high: asNumber(ohlc.high),
      low: asNumber(ohlc.low),
      close: asNumber(ohlc.close),
    };
  }

  if (typeof ohlc === "string") {
    const cleaned = ohlc
      .replace(/[{}]/g, "")
      .replace(/["']/g, "")
      .trim();

    const result = {};

    for (const piece of cleaned.split(",")) {
      const [rawKey, rawValue] = piece.split(":");

      if (!rawKey || rawValue === undefined) {
        continue;
      }

      const key = rawKey.trim();
      const value = rawValue.trim();

      result[key] = asNumber(value);
    }

    return {
      open: result.open ?? null,
      high: result.high ?? null,
      low: result.low ?? null,
      close: result.close ?? null,
    };
  }

  return {};
}

async function growwQuote(symbol) {
  const url =
    "https://api.groww.in/v1/live-data/quote" +
    `?exchange=NSE` +
    `&segment=CASH` +
    `&trading_symbol=${encodeURIComponent(symbol)}`;

  let lastError = null;

  for (let attempt = 0; attempt <= GROWW_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      GROWW_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: buildGrowwHeaders(),
        signal: controller.signal,
      });

      const text = await response.text();

      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (response.ok) {
        if (body?.status && body.status !== "SUCCESS") {
          throw new Error(
            body?.message ||
              body?.error ||
              `Groww returned status ${body.status}`,
          );
        }

        return body?.payload || {};
      }

      const requestError = new Error(
        `Groww HTTP ${response.status}: ${
          body?.message ||
          body?.error ||
          text?.slice(0, 300) ||
          "Unknown error"
        }`,
      );

      requestError.statusCode = response.status;
      throw requestError;
    } catch (error) {
      lastError = error;

      const status = Number(error?.statusCode || 0);

      const retryable =
        status === 429 ||
        status === 408 ||
        status >= 500 ||
        error?.name === "AbortError" ||
        !status;

      if (!retryable || attempt >= GROWW_MAX_RETRIES) {
        break;
      }

      const backoff = Math.min(
        1000 * 2 ** attempt,
        15000,
      );

      await sleep(backoff);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("Groww request failed");
}

function normalizeOurStock(stock, instrument) {
  return {
    instrumentKey: stock.instrumentKey,
    symbol: instrument?.tradingSymbol || stock.symbol || null,
    isin: instrument?.isin || null,
    name: instrument?.name || stock.name || null,

    price: asNumber(
      stock.dayClose ??
        stock.price ??
        stock.closePrice ??
        null,
    ),

    dayClose: asNumber(stock.dayClose),
    change: asNumber(stock.changeValue),
    changePercent: asNumber(stock.changePercent),

    open: asNumber(stock.openPrice),
    high: asNumber(stock.dayHigh),
    low: asNumber(stock.dayLow),

    volume: asNumber(stock.volume),
    previousClose: asNumber(stock.previousClose),

    marketStatus: stock.marketStatus || null,
    updatedAt: stock.updatedAt || null,
  };
}

function classify(row) {
  if (row.error) {
    return "GROWW_ERROR";
  }

  if (!row.groww) {
    return "MISSING_GROWW";
  }

  if (row.priceDiff === null) {
    return "MISSING_PRICE";
  }

  const priceOk =
    Math.abs(row.priceDiff) <= PRICE_TOLERANCE;

  const changeOk =
    row.changeDiff === null ||
    Math.abs(row.changeDiff) <= CHANGE_TOLERANCE;

  const percentOk =
    row.changePercentDiff === null ||
    Math.abs(row.changePercentDiff) <=
      CHANGE_PERCENT_TOLERANCE;

  if (priceOk && changeOk && percentOk) {
    return "MATCH";
  }

  return "DIFF";
}

async function worker(items, state) {
  while (true) {
    const index = state.nextIndex;

    if (index >= items.length) {
      return;
    }

    state.nextIndex += 1;

    const stock = items[index];

    try {
      const payload = await growwQuote(stock.symbol);

      const growwOHLC = parseGrowwOHLC(payload.ohlc);

      const growwLastPrice = asNumber(payload.last_price);
      const growwClose =
        growwOHLC.close ??
        growwLastPrice ??
        null;

      const row = {
        index: index + 1,
        instrumentKey: stock.instrumentKey,
        symbol: stock.symbol,
        isin: stock.isin,
        name: stock.name,

        ourPrice: stock.price,
        growwPrice: growwLastPrice,
        growwClose,

        ourOpen: stock.open,
        growwOpen: growwOHLC.open,

        ourHigh: stock.high,
        growwHigh: growwOHLC.high,

        ourLow: stock.low,
        growwLow: growwOHLC.low,

        ourChange: stock.change,
        growwChange: asNumber(payload.day_change),

        ourChangePercent: stock.changePercent,
        growwChangePercent: asNumber(
          payload.day_change_perc,
        ),

        ourPreviousClose: stock.previousClose,

        priceDiff:
          stock.price !== null && growwClose !== null
            ? round(stock.price - growwClose, 4)
            : null,

        priceDiffPercent:
          stock.price !== null && growwClose !== null
            ? round(
                percentDifference(stock.price, growwClose),
                4,
              )
            : null,

        openDiff: absoluteDiff(
          stock.open,
          growwOHLC.open,
        ),

        highDiff: absoluteDiff(
          stock.high,
          growwOHLC.high,
        ),

        lowDiff: absoluteDiff(
          stock.low,
          growwOHLC.low,
        ),

        changeDiff: absoluteDiff(
          stock.change,
          asNumber(payload.day_change),
        ),

        changePercentDiff: absoluteDiff(
          stock.changePercent,
          asNumber(payload.day_change_perc),
        ),

        growwLastTradeTime: asNumber(
          payload.last_trade_time,
        ),

        growwVolume: asNumber(payload.volume),

        growwStatus: payload ? "SUCCESS" : null,
      };

      row.status = classify(row);

      state.results[index] = row;

      const completed = state.completed + 1;
      state.completed = completed;

      if (
        completed % 25 === 0 ||
        completed === items.length
      ) {
        process.stdout.write(
          `\rChecked ${completed}/${items.length}`,
        );
      }
    } catch (error) {
      state.results[index] = {
        index: index + 1,
        instrumentKey: stock.instrumentKey,
        symbol: stock.symbol,
        isin: stock.isin,
        name: stock.name,
        status: "GROWW_ERROR",
        error:
          error?.message ||
          String(error),
      };

      state.completed += 1;

      process.stdout.write(
        `\rChecked ${state.completed}/${items.length}`,
      );
    }
  }
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is missing. Put it in backend/.env",
    );
  }

  if (!GROWW_ACCESS_TOKEN) {
    throw new Error(
      "GROWW_ACCESS_TOKEN is missing. Generate a Groww Trading API access token and put it in backend/.env",
    );
  }

  fs.mkdirSync(REPORT_DIR, {
    recursive: true,
  });

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();

    const db = client.db(MONGODB_DB);

    const [stocks, instruments] = await Promise.all([
      db
        .collection("marketStocks")
        .find({
          instrumentKey: {
            $exists: true,
            $nin: [null, ""],
          },
        })
        .sort({
          mysqlId: 1,
          _id: 1,
        })
        .toArray(),

      db
        .collection("instruments")
        .find({
          segment: {
            $in: ["NSE_EQ", "NSE_CASH"],
          },
          tradingSymbol: {
            $exists: true,
            $nin: [null, ""],
          },
        })
        .toArray(),
    ]);

    const instrumentMap = new Map(
      instruments.map((item) => [
        item.instrumentKey,
        item,
      ]),
    );

    const universe = stocks
      .map((stock) =>
        normalizeOurStock(
          stock,
          instrumentMap.get(stock.instrumentKey),
        ),
      )
      .filter(
        (stock) =>
          stock.symbol &&
          stock.instrumentKey &&
          !String(stock.symbol).includes("|"),
      );

    /*
     * Deduplicate by NSE trading symbol.
     * The Groww comparison is deliberately NSE CASH only.
     */
    const deduped = [];
    const seen = new Set();

    for (const stock of universe) {
      const symbol = String(stock.symbol)
        .trim()
        .toUpperCase();

      if (!symbol || seen.has(symbol)) {
        continue;
      }

      seen.add(symbol);

      deduped.push({
        ...stock,
        symbol,
      });
    }

    console.log("");
    console.log("==============================================");
    console.log("     ZERODHA PROJECT vs GROWW COMPARISON");
    console.log("==============================================");
    console.log(`Time (IST): ${getISTDateTime()}`);
    console.log(`MongoDB:    ${MONGODB_DB}`);
    console.log(`Stocks:     ${deduped.length}`);
    console.log(
      `Concurrency: ${GROWW_CONCURRENCY}`,
    );
    console.log(
      `Price tolerance: ₹${PRICE_TOLERANCE}`,
    );
    console.log(
      `Change tolerance: ₹${CHANGE_TOLERANCE}`,
    );
    console.log(
      `Percent tolerance: ${CHANGE_PERCENT_TOLERANCE}%`,
    );
    console.log("==============================================");
    console.log("");

    const state = {
      nextIndex: 0,
      completed: 0,
      results: new Array(deduped.length),
    };

    const workers = Array.from(
      {
        length: Math.min(
          GROWW_CONCURRENCY,
          deduped.length,
        ),
      },
      () => worker(deduped, state),
    );

    await Promise.all(workers);

    process.stdout.write("\n\n");

    const results = state.results.filter(Boolean);

    results.sort((a, b) => {
      if (a.status === "GROWW_ERROR") return -1;
      if (b.status === "GROWW_ERROR") return 1;

      return (
        Math.abs(Number(b.priceDiff || 0)) -
        Math.abs(Number(a.priceDiff || 0))
      );
    });

    const summary = {
      timeIST: getISTDateTime(),
      totalStocks: deduped.length,
      checked: results.length,
      match: results.filter(
        (row) => row.status === "MATCH",
      ).length,
      diff: results.filter(
        (row) => row.status === "DIFF",
      ).length,
      growwErrors: results.filter(
        (row) => row.status === "GROWW_ERROR",
      ).length,
      missingGroww: results.filter(
        (row) => row.status === "MISSING_GROWW",
      ).length,
      missingPrice: results.filter(
        (row) => row.status === "MISSING_PRICE",
      ).length,
      tolerance: {
        price: PRICE_TOLERANCE,
        change: CHANGE_TOLERANCE,
        changePercent: CHANGE_PERCENT_TOLERANCE,
      },
    };

    const stamp = nowStamp();

    const csvColumns = [
      "index",
      "status",
      "symbol",
      "isin",
      "name",
      "instrumentKey",

      "ourPrice",
      "growwPrice",
      "growwClose",
      "priceDiff",
      "priceDiffPercent",

      "ourChange",
      "growwChange",
      "changeDiff",

      "ourChangePercent",
      "growwChangePercent",
      "changePercentDiff",

      "ourPreviousClose",

      "ourOpen",
      "growwOpen",
      "openDiff",

      "ourHigh",
      "growwHigh",
      "highDiff",

      "ourLow",
      "growwLow",
      "lowDiff",

      "growwLastTradeTime",
      "growwVolume",
      "growwStatus",
      "error",
    ];

    const csv = [
      csvColumns.join(","),
      ...results.map((row) =>
        csvColumns
          .map((column) =>
            csvEscape(row[column]),
          )
          .join(","),
      ),
    ].join("\n");

    const csvPath = path.join(
      REPORT_DIR,
      `groww-diff-${stamp}.csv`,
    );

    const jsonPath = path.join(
      REPORT_DIR,
      `groww-diff-${stamp}.json`,
    );

    fs.writeFileSync(
      csvPath,
      csv,
      "utf8",
    );

    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary,
          rows: results,
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log("SUMMARY");
    console.log("----------------------------------------------");
    console.log(`Total stocks : ${summary.totalStocks}`);
    console.log(`Checked      : ${summary.checked}`);
    console.log(`MATCH        : ${summary.match}`);
    console.log(`DIFF         : ${summary.diff}`);
    console.log(
      `Groww errors : ${summary.growwErrors}`,
    );
    console.log(
      `Missing Groww: ${summary.missingGroww}`,
    );
    console.log(
      `Missing price: ${summary.missingPrice}`,
    );
    console.log("----------------------------------------------");
    console.log(`CSV : ${csvPath}`);
    console.log(`JSON: ${jsonPath}`);
    console.log("");

    /*
     * Print the 50 largest price mismatches directly in terminal.
     */
    console.log(
      "TOP 50 PRICE DIFFERENCES",
    );
    console.log("----------------------------------------------");

    const largestDiffs = results
      .filter(
        (row) =>
          row.priceDiff !== null &&
          row.status !== "GROWW_ERROR",
      )
      .sort(
        (a, b) =>
          Math.abs(b.priceDiff) -
          Math.abs(a.priceDiff),
      )
      .slice(0, 50);

    for (const row of largestDiffs) {
      console.log(
        [
          String(row.symbol).padEnd(18),
          `our=${String(row.ourPrice ?? "-").padStart(10)}`,
          `groww=${String(row.growwClose ?? "-").padStart(10)}`,
          `diff=${String(row.priceDiff ?? "-").padStart(10)}`,
          `chg=${String(row.changePercentDiff ?? "-").padStart(10)}%`,
          row.status,
        ].join(" | "),
      );
    }

    console.log("----------------------------------------------");

    console.log(
      "\nDone. Use the CSV for the complete stock-by-stock mismatch list.",
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error("\nComparison failed:");
  console.error(
    error?.stack ||
      error?.message ||
      String(error),
  );
  process.exit(1);
});
