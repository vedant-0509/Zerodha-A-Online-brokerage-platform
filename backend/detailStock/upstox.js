const axios = require("axios");
const Upstox = require("upstox-js-sdk");

const env = require("./env");
const logger = require("./logger");

const V2 = "https://api.upstox.com/v2";
const V3 = "https://api.upstox.com/v3";

/*
 * Official SDK authentication.
 */
const defaultClient =
  Upstox.ApiClient.instance;

defaultClient.authentications[
  "OAUTH2"
].accessToken = env.upstoxAccessToken;

let streamer = null;

let connected = false;
let connecting = false;

let onTick = null;

const subscribed = new Set();

const fundamentalsCache = new Map();

const FUNDAMENTALS_TTL =
  15 * 60 * 1000;

/*
 * Do not hammer Upstox when a WebSocket
 * authentication problem occurs.
 */
let websocketBlockedUntil = 0;

const WS_RETRY_DELAY =
  Number(env.upstoxWsRetryDelayMs) || 15000;

const WS_MAX_RETRIES =
  Number(env.upstoxWsMaxRetries) || 10;

let websocketRetryCount = 0;

function safeJson(data) {
  if (data == null) {
    return null;
  }

  if (
    typeof data === "object" &&
    !Buffer.isBuffer(data)
  ) {
    return data;
  }

  try {
    return JSON.parse(
      Buffer.isBuffer(data)
        ? data.toString("utf8")
        : String(data),
    );
  } catch {
    return null;
  }
}

function n(value, fallback = null) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function headers() {
  return {
    Accept: "application/json",

    Authorization:
      `Bearer ${env.upstoxAccessToken}`,
  };
}

/* =========================================================
   FEED NORMALIZATION
========================================================= */

function findFeed(payload, key) {
  return (
    payload?.feeds?.[key] ||
    payload?.feeds?.[
      key?.replace("|", ":")
    ] ||
    payload?.data?.feeds?.[key] ||
    payload?.data?.feeds?.[
      key?.replace("|", ":")
    ] ||
    null
  );
}

function normalizeFeed(
  instrumentKey,
  feed,
) {
  if (!feed) {
    return null;
  }

  const root =
    feed?.fullFeed?.marketFF ||
    feed?.fullFeed?.indexFF ||
    feed?.marketFF ||
    feed?.indexFF ||
    feed?.ff ||
    feed;

  const ltpc =
    root?.ltpc ||
    feed?.ltpc ||
    {};

  const extended =
    root?.eFeedDetails ||
    root?.extendedFeedDetails ||
    {};

  const daily =
    (
      root?.marketOHLC?.ohlc ||
      feed?.marketOHLC?.ohlc ||
      []
    ).find(
      (item) =>
        item.interval === "1d",
    ) || {};

  const ltp = n(
    ltpc.ltp ??
      root?.ltp ??
      feed?.ltp,
  );

  const previousClose = n(
    ltpc.cp ??
      extended.lastClose ??
      root?.lastClose,
  );

  const open = n(
    daily.open ??
      root?.open,
  );

  const high = n(
    daily.high ??
      root?.high,
  );

  const low = n(
    daily.low ??
      root?.low,
  );

  const volume = n(
    daily.volume ??
      extended.tv ??
      root?.volume,
  );

  const lastTradedQuantity = n(
    ltpc.ltq ??
      root?.ltq,
  );

  const lastTradeTime =
    n(
      ltpc.ltt ??
        root?.ltt,
    ) || Date.now();

  if (
    ltp === null &&
    previousClose === null
  ) {
    return null;
  }

  const change =
    ltp !== null &&
    previousClose !== null
      ? ltp - previousClose
      : null;

  const changePercent =
    previousClose
      ? (change / previousClose) * 100
      : null;

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

    lastTradedQuantity,

    lastTradeTime,

    timestamp: Date.now(),

    source: "upstox-websocket",
  };
}

/* =========================================================
   WEBSOCKET
========================================================= */

function scheduleReconnect() {
  if (!subscribed.size) {
    return;
  }

  if (
    websocketRetryCount >=
    WS_MAX_RETRIES
  ) {
    logger.error(
      "Upstox WebSocket retry limit reached",
      {
        retries: websocketRetryCount,
        subscribed:
          subscribed.size,
      },
    );

    return;
  }

  websocketRetryCount += 1;

  const delay =
    Math.min(
      WS_RETRY_DELAY *
        Math.pow(
          2,
          websocketRetryCount - 1,
        ),
      120000,
    );

  logger.warn(
    "Scheduling Upstox WebSocket reconnect",
    {
      retry:
        websocketRetryCount,
      delayMs: delay,
    },
  );

  setTimeout(() => {
    if (!subscribed.size) {
      return;
    }

    connectStreamer();
  }, delay);
}

function createStreamer() {
  /*
   * Important:
   *
   * The official Node SDK constructor accepts
   * instrumentKeys + mode.
   *
   * We start with no instruments and dynamically
   * subscribe/unsubscribe.
   */
  streamer =
    new Upstox.MarketDataStreamerV3();

  /*
   * We control reconnect ourselves.
   * This prevents the previous implementation from
   * continuously hitting Upstox after a 403.
   */
  streamer.autoReconnect(
    false,
  );

  streamer.on(
    "open",
    () => {
      connected = true;
      connecting = false;

      websocketRetryCount = 0;

      websocketBlockedUntil = 0;

      logger.info(
        "Upstox MarketDataStreamerV3 connected",
        {
          subscriptions:
            subscribed.size,
        },
      );

      /*
       * Re-subscribe everything after reconnect.
       */
      if (subscribed.size) {
        try {
          streamer.subscribe(
            [...subscribed],
            env.upstoxStreamMode ||
              "full",
          );
        } catch (error) {
          logger.error(
            "Upstox resubscribe failed",
            {
              error:
                error.message,
            },
          );
        }
      }
    },
  );

  streamer.on(
    "close",
    () => {
      connected = false;
      connecting = false;

      logger.warn(
        "Upstox MarketDataStreamerV3 closed",
      );

      scheduleReconnect();
    },
  );

  streamer.on(
    "reconnecting",
    () => {
      logger.info(
        "Upstox MarketDataStreamerV3 reconnecting",
      );
    },
  );

  streamer.on(
    "autoReconnectStopped",
    () => {
      logger.warn(
        "Upstox automatic reconnect stopped",
      );
    },
  );

  streamer.on(
    "error",
    (error) => {
      connected = false;
      connecting = false;

      const message =
        error?.message ||
        String(error);

      logger.error(
        "Upstox WebSocket error",
        {
          error: message,
        },
      );

      /*
       * A 403 should not cause a rapid retry loop.
       */
      if (
        message.includes("403") ||
        message.includes(
          "Unexpected server response",
        )
      ) {
        websocketBlockedUntil =
          Date.now() + WS_RETRY_DELAY;

        logger.error(
          "Upstox WebSocket authentication rejected; retry delayed",
          {
            retryAfterMs:
              WS_RETRY_DELAY,
          },
        );
      }
    },
  );

  streamer.on(
    "message",
    (raw) => {
      const payload =
        safeJson(raw);

      if (!payload) {
        return;
      }

      /*
       * A message can contain multiple instruments.
       */
      for (const key of subscribed) {
        const feed =
          findFeed(
            payload,
            key,
          );

        const tick =
          normalizeFeed(
            key,
            feed,
          );

        if (
          tick &&
          typeof onTick === "function"
        ) {
          try {
            onTick(tick);
          } catch (error) {
            logger.error(
              "Tick handler failed",
              {
                instrumentKey:
                  key,
                error:
                  error.message,
              },
            );
          }
        }
      }
    },
  );

  return streamer;
}

function connectStreamer() {
  if (!subscribed.size) {
    return;
  }

  if (connected || connecting) {
    return;
  }

  if (
    Date.now() <
    websocketBlockedUntil
  ) {
    return;
  }

  connecting = true;

  if (!streamer) {
    createStreamer();
  }

  try {
    logger.info(
      "Connecting to Upstox MarketDataStreamerV3",
      {
        subscriptionCount:
          subscribed.size,
      },
    );

    streamer.connect();
  } catch (error) {
    connected = false;
    connecting = false;

    logger.error(
      "Upstox WebSocket connect failed",
      {
        error:
          error.message,
      },
    );

    scheduleReconnect();
  }
}

/* =========================================================
   SUBSCRIBE
========================================================= */

async function subscribe(
  instrumentKey,
) {
  if (!instrumentKey) {
    throw new Error(
      "instrumentKey is required",
    );
  }

  const wasSubscribed =
    subscribed.has(
      instrumentKey,
    );

  /*
   * This is the critical duplicate protection.
   *
   * 100 users clicking Reliance:
   *
   * subscribed.has(...) === true
   *
   * therefore only ONE provider subscription.
   */
  subscribed.add(
    instrumentKey,
  );

  /*
   * Only create/connect the provider socket
   * when the first active subscription exists.
   */
  if (!wasSubscribed) {
    if (!connected) {
      connectStreamer();
    } else {
      try {
        streamer.subscribe(
          [instrumentKey],
          env.upstoxStreamMode ||
            "full",
        );
      } catch (error) {
        logger.error(
          "Upstox subscribe failed",
          {
            instrumentKey,
            error:
              error.message,
          },
        );

        throw error;
      }
    }
  }

  return {
    subscribed: true,
    alreadySubscribed:
      wasSubscribed,
    connected,
  };
}

/* =========================================================
   UNSUBSCRIBE
========================================================= */

async function unsubscribe(
  instrumentKey,
) {
  if (
    !subscribed.has(
      instrumentKey,
    )
  ) {
    return;
  }

  subscribed.delete(
    instrumentKey,
  );

  if (
    streamer &&
    connected
  ) {
    try {
      streamer.unsubscribe([
        instrumentKey,
      ]);
    } catch (error) {
      logger.warn(
        "Upstox unsubscribe failed",
        {
          instrumentKey,
          error:
            error.message,
        },
      );
    }
  }

  /*
   * If nobody is viewing anything anymore,
   * disconnect the provider WebSocket.
   */
  if (!subscribed.size) {
    disconnect();
  }
}

/* =========================================================
   DISCONNECT
========================================================= */

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
    logger.warn(
      "Upstox disconnect failed",
      {
        error:
          error.message,
      },
    );
  }

  connected = false;
  connecting = false;
}

/* =========================================================
   REST - OHLC
========================================================= */

async function fetchOhlc(
  instrumentKey,
) {
  const response =
    await axios.get(
      `${V3}/market-quote/ohlc`,
      {
        params: {
          instrument_key:
            instrumentKey,
          interval: "1d",
        },

        headers: headers(),

        timeout: 10000,
      },
    );

  const data =
    response.data?.data || {};

  const q =
    Object.values(data)[0];

  if (!q) {
    throw new Error(
      "No OHLC data returned by Upstox",
    );
  }

  const ltp =
    n(q.last_price);

  const previousClose =
    n(q.prev_ohlc?.close);

  const change =
    ltp !== null &&
    previousClose !== null
      ? ltp - previousClose
      : null;

  return {
    instrumentKey,

    ltp,
    price: ltp,

    previousClose,

    change,

    changePercent:
      previousClose
        ? (change /
            previousClose) *
          100
        : null,

    open: n(
      q.live_ohlc?.open ??
        q.prev_ohlc?.open,
    ),

    high: n(
      q.live_ohlc?.high ??
        q.prev_ohlc?.high,
    ),

    low: n(
      q.live_ohlc?.low ??
        q.prev_ohlc?.low,
    ),

    volume: n(
      q.live_ohlc?.volume,
    ),

    lastTradeTime:
      n(q.last_trade_time) ||
      null,

    timestamp: Date.now(),

    source:
      "upstox-rest",
  };
}

/* =========================================================
   REST - QUOTES
========================================================= */

async function fetchQuotes(
  instrumentKeys,
) {
  const keys = [
    ...new Set(
      (instrumentKeys || [])
        .filter(Boolean),
    ),
  ];

  if (!keys.length) {
    return {};
  }

  /*
   * Do not make one request per stock.
   *
   * Batch them.
   */
  const response =
    await axios.get(
      `${V2}/market-quote/quotes`,
      {
        params: {
          instrument_key:
            keys.join(","),
        },

        headers: headers(),

        timeout: 20000,
      },
    );

  return (
    response.data?.data ||
    {}
  );
}

/* =========================================================
   HISTORY
========================================================= */

async function fetchHistory(
  instrumentKey,
  unit,
  interval,
  to,
  from,
) {
  const path =
    `${V3}/historical-candle/` +
    `${encodeURIComponent(
      instrumentKey,
    )}/` +
    `${unit}/` +
    `${interval}/` +
    `${to}` +
    `${
      from
        ? `/${from}`
        : ""
    }`;

  const response =
    await axios.get(
      path,
      {
        headers: headers(),
        timeout: 15000,
      },
    );

  return (
    response.data?.data?.candles ||
    []
  )
    .map((candle) => ({
      timestamp: candle[0],

      open: n(
        candle[1],
        0,
      ),

      high: n(
        candle[2],
        0,
      ),

      low: n(
        candle[3],
        0,
      ),

      close: n(
        candle[4],
        0,
      ),

      volume: n(
        candle[5],
        0,
      ),

      openInterest: n(
        candle[6],
        0,
      ),
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp) -
        new Date(b.timestamp),
    );
}

/* =========================================================
   FUNDAMENTALS
========================================================= */

async function fundamentalsRequest(
  isin,
  endpoint,
  params = {},
) {
  const response =
    await axios.get(
      `${V2}/fundamentals/` +
        `${encodeURIComponent(
          isin,
        )}/` +
        `${endpoint}`,
      {
        params,

        headers: headers(),

        timeout: 15000,
      },
    );

  return response.data?.data;
}

function ratioMap(rows) {
  const result = {};

  for (const row of rows || []) {
    const key =
      String(row.name || "")
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          "",
        );

    result[key] =
      row.company_value;

    result[
      `${key}Sector`
    ] = row.sector_value;
  }

  return result;
}

function latestCategory(
  data,
  category,
) {
  return (
    data?.income_statement?.find(
      (item) =>
        item.category ===
        category,
    )?.history?.[0] ||
    null
  );
}

function latestParticular(
  data,
  regex,
) {
  return (
    data?.full_statement?.find(
      (item) =>
        regex.test(
          String(
            item.particular ||
              "",
          ),
        ),
    )?.history?.[0] ||
    null
  );
}

function normalizeShareholding(
  rows,
) {
  const labels = {
    promoters: "Promoters",
    fii: "FII",
    other_dii: "DII",
    mutual_funds:
      "Mutual Funds",
    retail_and_other:
      "Retail & Other",
  };

  return (rows || []).map(
    (row) => ({
      category:
        row.category,

      label:
        labels[
          row.category
        ] ||
        row.category,

      history: (
        row.history || []
      ).map((history) => ({
        period:
          history.period,

        percentage:
          n(
            history.value,
            0,
          ),
      })),
    }),
  );
}

function mutualFundAggregate(
  shareholding,
) {
  const row =
    shareholding.find(
      (item) =>
        item.category ===
        "mutual_funds",
    );

  if (!row) {
    return [];
  }

  return [
    {
      name: "Mutual Funds",

      type: "aggregate",

      percentage:
        row.history?.[0]
          ?.percentage ?? 0,

      period:
        row.history?.[0]
          ?.period ?? null,

      history:
        row.history || [],
    },
  ];
}

async function getFundamentals(
  isin,
  force = false,
) {
  const cached =
    fundamentalsCache.get(
      isin,
    );

  if (
    !force &&
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.value;
  }

  const results =
    await Promise.allSettled([
      fundamentalsRequest(
        isin,
        "profile",
      ),

      fundamentalsRequest(
        isin,
        "key-ratios",
      ),

      fundamentalsRequest(
        isin,
        "income-statement",
        {
          type:
            "consolidated",

          time_period:
            "yearly",

          fs: true,
        },
      ),

      fundamentalsRequest(
        isin,
        "balance-sheet",
        {
          type:
            "consolidated",

          fs: true,
        },
      ),

      fundamentalsRequest(
        isin,
        "cash-flow",
        {
          type:
            "consolidated",

          fs: true,
        },
      ),

      fundamentalsRequest(
        isin,
        "share-holdings",
      ),

      fundamentalsRequest(
        isin,
        "corporate-actions",
      ),

      fundamentalsRequest(
        isin,
        "competitors",
      ),
    ]);

  const get =
    (index) =>
      results[index]
        .status ===
      "fulfilled"
        ? results[index].value
        : null;

  const profile = get(0);

  const ratioRows =
    get(1) || [];

  const income =
    get(2);

  const balanceSheet =
    get(3);

  const cashFlow =
    get(4);

  const shareholding =
    normalizeShareholding(
      get(5),
    );

  const corporateActions =
    get(6) || [];

  const competitors =
    get(7) || [];

  const ratios =
    ratioMap(
      ratioRows,
    );

  const revenue =
    latestCategory(
      income,
      "revenue",
    );

  const operatingProfit =
    latestCategory(
      income,
      "operating_profit",
    );

  const netProfit =
    latestCategory(
      income,
      "net_profit",
    );

  const eps =
    latestParticular(
      income,
      /^EPS\s*-\s*Basic$/i,
    );

  const fundamentals = {
    marketCap: null,

    sector:
      profile?.sector ||
      null,

    sectorMarketCap:
      profile
        ?.sector_market_cap_inr
        ?.formatted ||
      null,

    peRatio:
      ratios.pe ??
      null,

    pbRatio:
      ratios.pb ??
      null,

    roe:
      ratios.roe ??
      null,

    roa:
      ratios.roa ??
      null,

    roce:
      ratios.roce ??
      null,

    evEbitda:
      ratios.evebitda ??
      null,

    eps:
      eps?.value ??
      null,

    revenue:
      revenue?.value ??
      null,

    revenuePeriod:
      revenue?.period ??
      null,

    operatingProfit:
      operatingProfit?.value ??
      null,

    operatingProfitPeriod:
      operatingProfit?.period ??
      null,

    netProfit:
      netProfit?.value ??
      null,

    netProfitPeriod:
      netProfit?.period ??
      null,
  };

  const value = {
    fundamentals,

    profile,

    ratios:
      ratioRows,

    incomeStatement:
      income,

    balanceSheet,

    cashFlow,

    shareholding,

    mutualFunds:
      mutualFundAggregate(
        shareholding,
      ),

    corporateActions,

    competitors,

    updatedAt:
      Date.now(),
  };

  fundamentalsCache.set(
    isin,
    {
      value,

      expiresAt:
        Date.now() +
        FUNDAMENTALS_TTL,
    },
  );

  return value;
}

/* =========================================================
   FUNDAMENTAL HELPERS
========================================================= */

async function getCorporateActions(
  isin,
) {
  return (
    (await fundamentalsRequest(
      isin,
      "corporate-actions",
    )) || []
  );
}

async function getCompetitors(
  isin,
) {
  return (
    (await fundamentalsRequest(
      isin,
      "competitors",
    )) || []
  );
}

async function getBalanceSheet(
  isin,
  type = "consolidated",
) {
  return fundamentalsRequest(
    isin,
    "balance-sheet",
    {
      type,
      fs: true,
    },
  );
}

async function getProfile(
  isin,
) {
  return fundamentalsRequest(
    isin,
    "profile",
  );
}

/* =========================================================
   STATE
========================================================= */

function setTickHandler(
  handler,
) {
  onTick = handler;
}

function getSubscribed() {
  return [
    ...subscribed,
  ];
}

function isConnected() {
  return connected;
}

function isConnecting() {
  return connecting;
}

/* =========================================================
   SHUTDOWN
========================================================= */

async function shutdown() {
  subscribed.clear();

  disconnect();

  streamer = null;

  connected = false;

  connecting = false;
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  subscribe,
  unsubscribe,

  fetchOhlc,
  fetchQuotes,
  fetchHistory,

  getFundamentals,
  getCorporateActions,
  getCompetitors,
  getBalanceSheet,
  getProfile,

  setTickHandler,

  getSubscribed,
  isConnected,
  isConnecting,

  shutdown,
};