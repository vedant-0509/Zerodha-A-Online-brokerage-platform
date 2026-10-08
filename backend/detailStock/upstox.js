const axios = require("axios");
const Upstox = require("upstox-js-sdk");

const env = require("./env");
const logger = require("./logger");

const V2 = "https://api.upstox.com/v2";
const V3 = "https://api.upstox.com/v3";
const HFT_V3 = "https://api-hft.upstox.com/v3";

/* =========================================================
   CONFIG
========================================================= */

if (!env.upstoxAccessToken) {
  logger.warn("UPSTOX_ACCESS_TOKEN is empty");
}

const defaultClient = Upstox.ApiClient.instance;
defaultClient.authentications["OAUTH2"].accessToken = env.upstoxAccessToken;

/* =========================================================
   WEBSOCKET STATE
========================================================= */

let streamer = null;
let connected = false;
let connecting = false;

let onTick = null;

const subscribed = new Set();
const pendingUnsubscribe = new Map();

/* =========================================================
   FUNDAMENTALS CACHE
========================================================= */

const fundamentalsCache = new Map();
const FUNDAMENTALS_TTL = 15 * 60 * 1000;

/* =========================================================
   HELPERS
========================================================= */

function safeJson(data) {
  if (data == null) {
    return null;
  }

  if (typeof data === "object" && !Buffer.isBuffer(data)) {
    return data;
  }

  try {
    return JSON.parse(
      Buffer.isBuffer(data) ? data.toString("utf8") : String(data),
    );
  } catch {
    return null;
  }
}

function n(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function headers() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.upstoxAccessToken}`,
  };
}

function uniqueKeys(keys) {
  return [...new Set((keys || []).filter(Boolean))];
}

/* =========================================================
   FEED HELPERS
========================================================= */

function findFeed(payload, key) {
  const feeds = payload?.feeds || payload?.data?.feeds || {};

  return (
    feeds[key] ||
    feeds[key?.replace("|", ":")] ||
    feeds[key?.replace(":", "|")] ||
    null
  );
}

/* =========================================================
   WEBSOCKET FEED NORMALIZATION
========================================================= */

function normalizeFeed(instrumentKey, feed) {
  if (!feed) {
    return null;
  }

  const root = feed?.fullFeed?.marketFF || feed?.fullFeed?.indexFF || feed?.marketFF || feed?.indexFF || feed?.ff || feed;

  const ltpc = root?.ltpc || feed?.ltpc || {};
  const extended = root?.eFeedDetails || root?.extendedFeedDetails || {};

  const daily = (root?.marketOHLC?.ohlc || feed?.marketOHLC?.ohlc || []).find((item) => item?.interval === "1d",) || {};

  const ltp = n(ltpc.ltp ?? root?.ltp ?? feed?.ltp);
  const previousClose = n(ltpc.cp ?? extended.cp ?? extended.lastClose ?? root?.lastClose,);

  const open = n(daily.open ?? root?.open);
  const high = n(daily.high ?? root?.high);
  const low = n(daily.low ?? root?.low);

  const volume = n(daily.vol ?? daily.volume ?? extended.vtt ?? extended.tv ?? root?.volume,);

  const upperCircuit = n(extended.uc ?? extended.upperCircuit ?? root?.upperCircuit,);

  const lowerCircuit = n(extended.lc ?? extended.lowerCircuit ?? root?.lowerCircuit,);

  const yearHigh = n(extended.yh ?? extended.yearHigh ?? root?.yearHigh);
  const yearLow = n(extended.yl ?? extended.yearLow ?? root?.yearLow);

  const lastTradedQuantity = n(ltpc.ltq ?? root?.ltq);
  const lastTradeTime = n(ltpc.ltt ?? root?.ltt) || null;

  if (ltp === null && previousClose === null) {
    return null;
  }

  const change = ltp !== null && previousClose !== null ? ltp - previousClose : null;

  const changePercent = previousClose !== null && previousClose !== 0 && change !== null ? (change / previousClose) * 100 : null;

  return {
    instrumentKey,
    ltp,
    price: ltp,
    previousClose,
    change,
    changePercent,
    open,
    high,
    low,
    volume,
    totalVolume: volume,
    upperCircuit,
    lowerCircuit,
    upperCircuitLimit: upperCircuit,
    lowerCircuitLimit: lowerCircuit,
    yearHigh,
    yearLow,
    week52High: yearHigh,
    week52Low: yearLow,
    lastTradedQuantity,
    lastTradeTime,
    timestamp: lastTradeTime ?? Date.now(),
    source: "upstox-websocket",
  };
}

/* =========================================================
   WEBSOCKET STREAMER
========================================================= */

function ensureStreamer() {
  if (streamer) {
    return streamer;
  }

  streamer = new Upstox.MarketDataStreamerV3();
  streamer.autoReconnect(true, 10, 1000000);

  streamer.on("open", () => {
    connected = true;
    connecting = false;

    logger.info("Upstox MarketDataStreamerV3 connected", {
      subscriptions: subscribed.size,
    });

    if (subscribed.size) {
      try {
        streamer.subscribe([...subscribed], env.upstoxStreamMode || "full");
      } catch (error) {
        logger.error("Upstox resubscribe failed", {
          error: error?.message || String(error),
        });
      }
    }
  });

  streamer.on("close", () => {
    connected = false;
    connecting = false;

    logger.warn("Upstox market websocket closed");
  });

  streamer.on("reconnecting", () => {
    connected = false;
    connecting = true;

    logger.info("Upstox market websocket reconnecting");
  });

  streamer.on("autoReconnectStopped", () => {
    connected = false;
    connecting = false;

    logger.warn("Upstox automatic reconnect stopped");
  });

  streamer.on("error", (error) => {
    connected = false;

    logger.error("Upstox market websocket error", {
      error: error?.message || String(error),
    });
  });

  streamer.on("message", (raw) => {
    const payload = safeJson(raw);

    if (!payload) {
      return;
    }

    const feeds = payload?.feeds || payload?.data?.feeds || {};

    for (const [providerKey, feed] of Object.entries(feeds)) {
      let instrumentKey = null;

      if (subscribed.has(providerKey)) {
        instrumentKey = providerKey;
      } else {
        instrumentKey = [...subscribed].find(
          (key) =>
            key === providerKey ||
            key.replace("|", ":") === providerKey ||
            key.replace(":", "|") === providerKey,
        );
      }

      if (!instrumentKey) {
        continue;
      }

      const tick = normalizeFeed(instrumentKey, feed);

      if (tick && typeof onTick === "function") {
        try {
          onTick(tick);
        } catch (error) {
          logger.error("Tick handler failed", {
            instrumentKey,
            error: error?.message || String(error),
          });
        }
      }
    }
  });

  try {
    connecting = true;
    streamer.connect();
  } catch (error) {
    connected = false;
    connecting = false;

    logger.error("Upstox websocket connect failed", {
      error: error?.message || String(error),
    });
  }

  return streamer;
}

/* =========================================================
   SUBSCRIBE
========================================================= */

async function subscribe(instrumentKey) {
  if (!instrumentKey) {
    throw new Error("instrumentKey is required");
  }

  const pending = pendingUnsubscribe.get(instrumentKey);
  if (pending) {
    clearTimeout(pending);
    pendingUnsubscribe.delete(instrumentKey);
  }

  if (subscribed.has(instrumentKey)) {
    return {
      subscribed: true,
      alreadySubscribed: true,
      connected,
    };
  }

  const maxSubscriptions = Number(env.upstoxMaxUniqueSubscriptions) || 100;

  if (subscribed.size >= maxSubscriptions) {
    throw new Error(
      `Live subscription capacity reached (${maxSubscriptions}).`,
    );
  }

  subscribed.add(instrumentKey);

  const s = ensureStreamer();

  if (connected) {
    try {
      s.subscribe([instrumentKey], env.upstoxStreamMode || "full");
    } catch (error) {
      subscribed.delete(instrumentKey);

      logger.error("Upstox subscribe failed", {
        instrumentKey,
        error: error?.message || String(error),
      });

      throw error;
    }
  }

  return {
    subscribed: true,
    alreadySubscribed: false,
    connected,
  };
}

/* =========================================================
   UNSUBSCRIBE
========================================================= */

async function unsubscribe(instrumentKey, immediate = false) {
  if (!subscribed.has(instrumentKey)) {
    return { unsubscribed: false };
  }

  const previous = pendingUnsubscribe.get(instrumentKey);

  if (previous) {
    clearTimeout(previous);
    pendingUnsubscribe.delete(instrumentKey);
  }

  const run = () => {
    pendingUnsubscribe.delete(instrumentKey);

    if (!subscribed.has(instrumentKey)) {
      return;
    }

    subscribed.delete(instrumentKey);

    if (streamer && connected) {
      try {
        streamer.unsubscribe([instrumentKey]);
      } catch (error) {
        logger.warn("Upstox unsubscribe failed", {
          instrumentKey,
          error: error?.message || String(error),
        });
      }
    }
  };

  const graceMs = Number(env.unsubscribeGraceMs) || 0;

  if (immediate || graceMs <= 0) {
    run();
  } else {
    const timer = setTimeout(run, graceMs);
    pendingUnsubscribe.set(instrumentKey, timer);
  }

  return { unsubscribed: true };
}

/* =========================================================
   QUOTE HELPERS
========================================================= */

function extractQuoteObject(data, instrumentKey) {
  if (!data) {
    return null;
  }

  return (
    data[instrumentKey] ||
    data[instrumentKey.replace("|", ":")] ||
    data[instrumentKey.replace(":", "|")] ||
    Object.values(data).find(
      (item) =>
        item?.instrument_token === instrumentKey ||
        item?.instrument_key === instrumentKey,
    ) ||
    null
  );
}

function normalizeQuote(instrumentKey, quote) {
  if (!quote) {
    return null;
  }

  const ohlc = quote?.ohlc || {};
  const price = n(quote?.last_price);
  const netChange = n(quote?.net_change);

  let previousClose = null;

  if (price !== null && netChange !== null) {
    previousClose = price - netChange;
  } else {
    previousClose = n(quote?.cp ?? quote?.prev_close ?? quote?.previous_close);
  }

  const change =
    price !== null && previousClose !== null ? price - previousClose : null;

  const changePercent =
    previousClose !== null && previousClose !== 0 && change !== null
      ? (change / previousClose) * 100
      : null;

  const upperCircuit = n(quote?.upper_circuit_limit);
  const lowerCircuit = n(quote?.lower_circuit_limit);

  return {
    instrumentKey,
    ltp: price,
    price,
    previousClose,
    change,
    changePercent,
    open: n(ohlc.open),
    high: n(ohlc.high),
    low: n(ohlc.low),
    volume: n(quote?.volume),
    totalVolume: n(quote?.volume),
    upperCircuit,
    lowerCircuit,
    upperCircuitLimit: upperCircuit,
    lowerCircuitLimit: lowerCircuit,
    lastTradeTime: n(quote?.last_trade_time),
    timestamp: n(quote?.timestamp, Date.now()),
    source: "upstox-rest",
  };
}

/* =========================================================
   REST - OHLC / QUOTE
========================================================= */

async function fetchOhlc(instrumentKey) {
  if (!instrumentKey) {
    throw new Error("instrumentKey is required");
  }

  const response = await axios.get(`${V2}/market-quote/quotes`, {
    params: {
      instrument_key: instrumentKey,
    },
    headers: headers(),
    timeout: 10000,
  });

  const quote = extractQuoteObject(response.data?.data, instrumentKey);

  if (!quote) {
    throw new Error("No market quote returned by Upstox");
  }

  return normalizeQuote(instrumentKey, quote);
}

/* =========================================================
   REST - BATCH QUOTES
========================================================= */

async function fetchQuotes(instrumentKeys) {
  const keys = uniqueKeys(instrumentKeys);

  if (!keys.length) {
    return {};
  }

  const result = {};
  const batchSize = 500;

  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);

    const response = await axios.get(`${V2}/market-quote/quotes`, {
      params: {
        instrument_key: batch.join(","),
      },
      headers: headers(),
      timeout: 20000,
    });

    Object.assign(result, response.data?.data || {});
  }

  return result;
}

/* =========================================================
   HISTORY
========================================================= */

async function fetchHistory(instrumentKey, unit, interval, to, from) {
  if (!instrumentKey) {
    throw new Error("instrumentKey is required");
  }

  let response;

  if (!from && unit === "minutes") {
    const path =
      `${V3}/historical-candle/intraday/` +
      `${encodeURIComponent(instrumentKey)}/` +
      `${unit}/` +
      `${interval}`;

    response = await axios.get(path, {
      headers: headers(),
      timeout: 15000,
    });
  } else {
    const path =
      `${V3}/historical-candle/` +
      `${encodeURIComponent(instrumentKey)}/` +
      `${unit}/` +
      `${interval}/` +
      `${to}` +
      `${from ? `/${from}` : ""}`;

    response = await axios.get(path, {
      headers: headers(),
      timeout: 15000,
    });
  }

  return (response.data?.data?.candles || [])
    .map((candle) => ({
      timestamp: candle[0],
      open: n(candle[1], 0),
      high: n(candle[2], 0),
      low: n(candle[3], 0),
      close: n(candle[4], 0),
      volume: n(candle[5], 0),
      openInterest: n(candle[6], 0),
    }))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/* =========================================================
   FUNDAMENTALS REQUEST
========================================================= */

async function fundamentalsRequest(isin, endpoint, params = {}) {
  if (!isin) {
    throw new Error("ISIN is required");
  }

  const response = await axios.get(
    `${V2}/fundamentals/` + `${encodeURIComponent(isin)}/` + `${endpoint}`,
    {
      params,
      headers: headers(),
      timeout: 15000,
    },
  );

  if (response.data?.status && response.data.status !== "success") {
    throw new Error(
      response.data?.errors?.[0]?.message ||
      `Upstox fundamentals ${endpoint} failed`,
    );
  }

  return response.data?.data ?? null;
}

/* =========================================================
   RATIO & STATEMENT HELPERS
========================================================= */

function ratioMap(rows) {
  const result = {};

  for (const row of rows || []) {
    const key = String(row?.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (!key) {
      continue;
    }

    result[key] = row?.company_value ?? null;
    result[`${key}Sector`] = row?.sector_value ?? null;
  }

  return result;
}

function latestCategory(data, category) {
  return (
    data?.income_statement?.find((item) => item?.category === category)
      ?.history?.[0] || null
  );
}

function latestParticular(data, regex) {
  return (
    data?.full_statement?.find((item) =>
      regex.test(String(item?.particular || "")),
    )?.history?.[0] || null
  );
}

/* =========================================================
   SHAREHOLDING
========================================================= */

function normalizeShareholding(rows) {
  const labels = {
    promoters: "Promoters",
    fii: "FII",
    other_dii: "DII",
    public: "Public",
    mutual_funds: "Mutual Funds",
    retail_and_other: "Retail & Other",
  };

  return (rows || []).map((row) => ({
    category: row?.category,
    label: labels[row?.category] || row?.category,
    history: (row?.history || []).map((history) => ({
      period: history?.period,
      percentage: n(history?.value, 0),
    })),
  }));
}

function mutualFundAggregate(shareholding) {
  const row = (shareholding || []).find(
    (item) => item.category === "mutual_funds",
  );

  if (!row) {
    return [];
  }

  return [
    {
      name: "Mutual Funds",
      type: "aggregate",
      percentage: row.history?.[0]?.percentage ?? 0,
      period: row.history?.[0]?.period ?? null,
      history: row.history || [],
    },
  ];
}

/* =========================================================
   GET FUNDAMENTALS
========================================================= */

async function getFundamentals(isin, force = false) {
  if (!isin) {
    throw new Error("ISIN is required");
  }

  const cached = fundamentalsCache.get(isin);

  if (!force && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const results = await Promise.allSettled([
    fundamentalsRequest(isin, "profile"),
    fundamentalsRequest(isin, "key-ratios"),
    fundamentalsRequest(isin, "income-statement", {
      type: "consolidated",
      time_period: "quarterly",
      fs: true,
    }),
    fundamentalsRequest(isin, "balance-sheet", {
      type: "consolidated",
      fs: true,
    }),
    fundamentalsRequest(isin, "cash-flow", {
      type: "consolidated",
      fs: true,
    }),
    fundamentalsRequest(isin, "share-holdings"),
    fundamentalsRequest(isin, "corporate-actions"),
    fundamentalsRequest(isin, "competitors"),
  ]);

  const get = (index) =>
    results[index]?.status === "fulfilled" ? results[index].value : null;

  const profile = get(0);
  const ratioRows = get(1) || [];
  const income = get(2);
  const balanceSheet = get(3);
  const cashFlow = get(4);
  const shareholding = normalizeShareholding(get(5));
  const corporateActions = get(6) || [];
  const competitors = get(7) || [];

  const ratios = ratioMap(ratioRows);
  const revenue = latestCategory(income, "revenue");
  const operatingProfit = latestCategory(income, "operating_profit");
  const netProfit = latestCategory(income, "net_profit");
  const eps = latestParticular(income, /^EPS\s*-\s*Basic$/i);

  const fundamentals = {
    marketCap: null,
    sector: profile?.sector || null,
    sectorMarketCapInr: profile?.sector_market_cap_inr?.formatted || null,
    sectorMarketCapUsd: profile?.sector_market_cap_usd?.formatted || null,
    sectorMarketCap: profile?.sector_market_cap_inr?.formatted || null,
    peRatio: ratios.pe ?? null,
    pbRatio: ratios.pb ?? null,
    roe: ratios.roe ?? null,
    roa: ratios.roa ?? null,
    roce: ratios.roce ?? null,
    evEbitda: ratios.evebitda ?? null,
    eps: eps?.value ?? null,
    revenue: revenue?.value ?? null,
    revenuePeriod: revenue?.period ?? null,
    operatingProfit: operatingProfit?.value ?? null,
    operatingProfitPeriod: operatingProfit?.period ?? null,
    netProfit: netProfit?.value ?? null,
    netProfitPeriod: netProfit?.period ?? null,
  };

  const value = {
    fundamentals,
    profile,
    ratios: ratioRows,
    incomeStatement: income,
    balanceSheet,
    cashFlow,
    shareholding,
    mutualFunds: mutualFundAggregate(shareholding),
    corporateActions,
    competitors,
    updatedAt: Date.now(),
  };

  fundamentalsCache.set(isin, {
    value,
    expiresAt: Date.now() + FUNDAMENTALS_TTL,
  });

  return value;
}

/* =========================================================
   STOCK FINANCIALS (RESOLVER & EXPORT)
========================================================= */

async function getStockFinancials(identifier, force = false) {
  if (!identifier) {
    throw new Error("Identifier (ISIN or Symbol) is required");
  }

  try {
    const data = await getFundamentals(identifier, force);

    return {
      symbol: identifier,
      isin: identifier,
      ...data?.fundamentals,
      profile: data?.profile,
      ratios: data?.ratios,
      incomeStatement: data?.incomeStatement,
      balanceSheet: data?.balanceSheet,
      cashFlow: data?.cashFlow,
      shareholding: data?.shareholding || [],
      mutualFunds: data?.mutualFunds || [],
      corporateActions: data?.corporateActions || [],
      competitors: data?.competitors || [],
      updatedAt: data?.updatedAt,
    };
  } catch (error) {
    logger.error(`Failed to fetch financials for ${identifier}`, {
      error: error?.message || String(error),
    });
    throw error;
  }
}

/* =========================================================
   COMPANY PROFILE & ADDITIONAL APIs
========================================================= */

async function getProfile(isin) {
  if (!isin) {
    throw new Error("ISIN is required");
  }
  return (await fundamentalsRequest(isin, "profile")) || {};
}

async function getCorporateActions(isin) {
  return (await fundamentalsRequest(isin, "corporate-actions")) || [];
}

async function getCompetitors(isin) {
  return (await fundamentalsRequest(isin, "competitors")) || [];
}

async function getBalanceSheet(isin, type = "consolidated") {
  return fundamentalsRequest(isin, "balance-sheet", {
    type,
    fs: true,
  });
}

async function getFunds() {
  const response = await axios.get(`${V3}/user/get-funds-and-margin`, {
    headers: {
      ...headers(),
      "Api-Version": "3.0",
    },
    timeout: 10000,
  });

  return response.data?.data || response.data;
}

function parseMarketTick(instrumentKey, feed) {
  const ltp = feed.ltp || feed.ff?.marketFF?.ltpc?.ltp || 0;
  const ohlc = feed.ff?.marketFF?.marketOHLC?.ohlc?.[0] || {};
  const volume = ohlc.vol || feed.v || 0;
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    symbol: instrumentKey,
    ltp: Number(ltp),
    time: timestamp,
    open: Number(ohlc.open || ltp),
    high: Number(ohlc.high || ltp),
    low: Number(ohlc.low || ltp),
    close: Number(ohlc.close || ltp),
    volume: Number(volume),
    change: feed.ff?.marketFF?.ltpc?.cp ? ltp - feed.ff?.marketFF?.ltpc?.cp : 0,
  };
}

/* =========================================================
   PLACE ORDER
========================================================= */

async function placeOrder(order) {
  const error = new Error("Real broker order placement is disabled. This application is simulation-only.");
  error.code = "REAL_ORDER_DISABLED";
  error.httpStatus = 503;
  throw error;

  /*
   * Intentionally unreachable legacy broker-order code is retained below
   * for reference, but this guard makes accidental real order placement
   * impossible from the running application.
   */
  if (!order) {
    throw new Error("Order payload is required");
  }

  if (!order.instrumentKey) {
    throw new Error("instrumentKey is required");
  }

  if (!order.transactionType) {
    throw new Error("transactionType is required");
  }

  const quantity = Number(order.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Invalid order quantity");
  }

  const payload = {
    quantity,
    product: order.product || "D",
    validity: order.validity || "DAY",
    price: Number(order.price || 0),
    tag: order.tag || undefined,
    instrument_token: order.instrumentKey,
    order_type: order.orderType || "LIMIT",
    transaction_type: order.transactionType,
    disclosed_quantity: Number(order.disclosedQuantity || 0),
    trigger_price: Number(order.triggerPrice || 0),
    is_amo: Boolean(order.isAmo),
    slice: order.slice !== false,
    market_protection: Number(order.marketProtection || 0),
  };

  const response = await axios.post(`${HFT_V3}/order/place`, payload, {
    headers: headers(),
    timeout: 15000,
  });

  return response.data;
}

/* =========================================================
   STATE & HANDLERS
========================================================= */

function setTickHandler(handler) {
  if (handler !== null && typeof handler !== "function") {
    throw new Error("Tick handler must be a function or null");
  }
  onTick = handler;
}

function getSubscribed() {
  return [...subscribed];
}

function isConnected() {
  return connected;
}

function isConnecting() {
  return connecting;
}

function disconnect() {
  if (!streamer) {
    connected = false;
    connecting = false;
    return;
  }

  try {
    streamer.autoReconnect(false);
    streamer.disconnect();
  } catch (error) {
    logger.warn("Upstox websocket disconnect failed", {
      error: error?.message || String(error),
    });
  }

  streamer = null;
  connected = false;
  connecting = false;
}

async function shutdown() {
  for (const timer of pendingUnsubscribe.values()) {
    clearTimeout(timer);
  }
  pendingUnsubscribe.clear();
  subscribed.clear();
  disconnect();
  onTick = null;
  fundamentalsCache.clear();
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  /* Live Market Data */
  subscribe,
  unsubscribe,

  /* REST Market Data */
  fetchOhlc,
  fetchQuotes,
  fetchHistory,

  /* Fundamentals & Financials */
  getFundamentals,
  getStockFinancials,
  getProfile,
  getCorporateActions,
  getCompetitors,
  getBalanceSheet,
  getFunds,

  /* Order Management */
  placeOrder,

  /* Utilities & Stream Handler */
  parseMarketTick,
  setTickHandler,

  /* Connection State */
  getSubscribed,
  isConnected,
  isConnecting,
  disconnect,
  shutdown,
};