const {
  connectMongoDB,
  getMongoDB,
  getMongoClient,
} = require("../config/mongodb");

const logger = require("./logger");

async function getDb() {
  await connectMongoDB();
  return getMongoDB();
}

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function toTradingDate(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const date = normalizeDate(value);

  if (!date) return null;

  return date.toISOString().slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| MongoDB initialization
|--------------------------------------------------------------------------
*/

async function initDb() {
  await connectMongoDB();

  logger.info("MongoDB connected");

  return getMongoDB();
}

/*
|--------------------------------------------------------------------------
| Compatibility helper
|--------------------------------------------------------------------------
|
| Existing detailStock/server.js calls requireDb().
| Return the Mongo database instead of a MySQL pool.
|
*/

function requireDb() {
  return getMongoDB();
}

/*
|--------------------------------------------------------------------------
| Get ISIN by symbol
|--------------------------------------------------------------------------
*/

async function getIsinBySymbol(symbol) {
  const db = await getDb();

  const normalizedSymbol = String(symbol || "")
    .trim()
    .toUpperCase();

  if (!normalizedSymbol) {
    return null;
  }

  const instrument =
    await db.collection("instruments").findOne({
      tradingSymbol: normalizedSymbol,
    });

  if (!instrument) {
    return null;
  }

  if (instrument.isin) {
    return instrument.isin;
  }

  const instrumentKey =
    instrument.instrumentKey;

  if (!instrumentKey) {
    return null;
  }

  if (instrumentKey.includes("|")) {
    return instrumentKey.split("|")[1];
  }

  return instrumentKey;
}

/*
|--------------------------------------------------------------------------
| Get market stock instruments
|--------------------------------------------------------------------------
*/

async function getMarketStockInstruments() {
  const db = await getDb();

  const stocks =
    await db
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
      .toArray();

  if (!stocks.length) {
    return [];
  }

  const instrumentKeys = stocks
    .map((stock) => stock.instrumentKey)
    .filter(Boolean);

  const instruments =
    await db
      .collection("instruments")
      .find({
        instrumentKey: {
          $in: instrumentKeys,
        },
      })
      .toArray();

  const instrumentMap = new Map(
    instruments.map((instrument) => [
      instrument.instrumentKey,
      instrument,
    ])
  );

  return stocks.map((stock) => {
    const instrument =
      instrumentMap.get(
        stock.instrumentKey
      );

    return {
      id:
        stock.mysqlId ??
        stock._id?.toString(),

      symbol:
        instrument?.tradingSymbol ||
        stock.symbol,

      name:
        instrument?.name ||
        stock.name,

      price: stock.price,

      change_value:
        stock.changeValue,

      change_percent:
        stock.changePercent,

      open_price:
        stock.openPrice,

      previous_close:
        stock.previousClose,

      day_high:
        stock.dayHigh,

      day_low:
        stock.dayLow,

      volume:
        stock.volume,

      updated_at:
        stock.updatedAt,

      sector:
        stock.sector,

      instrument_key:
        stock.instrumentKey,

      last_trade_time:
        stock.lastTradeTime,

      market_status:
        stock.marketStatus,

      day_close:
        stock.dayClose,
    };
  });
}

/*
|--------------------------------------------------------------------------
| Market stock count
|--------------------------------------------------------------------------
*/

async function getMarketStockCount() {
  const db = await getDb();

  return db
    .collection("marketStocks")
    .countDocuments({
      instrumentKey: {
        $exists: true,
        $nin: [null, ""],
      },
    });
}

/*
|--------------------------------------------------------------------------
| Get market stock by instrument key
|--------------------------------------------------------------------------
*/

async function getMarketStockByInstrumentKey(
  instrumentKey
) {
  const db = await getDb();

  const stock =
    await db
      .collection("marketStocks")
      .findOne({
        instrumentKey: String(
          instrumentKey
        ),
      });

  if (!stock) {
    return null;
  }

  const instrument =
    await db
      .collection("instruments")
      .findOne({
        instrumentKey: String(
          instrumentKey
        ),
      });

  return {
    ...stock,

    master_exchange:
      instrument?.exchange ?? null,

    master_segment:
      instrument?.segment ?? null,

    master_trading_symbol:
      instrument?.tradingSymbol ?? null,

    master_name:
      instrument?.name ?? null,

    master_isin:
      instrument?.isin ?? null,
  };
}

/*
|--------------------------------------------------------------------------
| Instrument master
|--------------------------------------------------------------------------
*/

async function getInstrumentMaster(
  instrumentKey
) {
  const db = await getDb();

  return (
    await db
      .collection("instruments")
      .findOne({
        instrumentKey: String(
          instrumentKey
        ),
      })
  ) || null;
}

/*
|--------------------------------------------------------------------------
| Instrument by ISIN
|--------------------------------------------------------------------------
*/

async function getInstrumentMasterByIsin(
  isin,
  exchange = null
) {
  const db = await getDb();

  const filter = {
    isin: String(isin).trim(),
    segment: {
      $in: ["NSE_EQ", "BSE_EQ"],
    },
  };

  if (exchange) {
    filter.exchange = exchange;
  }

  const instruments =
    await db
      .collection("instruments")
      .find(filter)
      .sort({
        segment: 1,
      })
      .limit(10)
      .toArray();

  if (!instruments.length) {
    return null;
  }

  /*
   * Preserve the old preference for NSE_EQ.
   */
  instruments.sort((a, b) => {
    if (a.segment === "NSE_EQ") return -1;
    if (b.segment === "NSE_EQ") return 1;
    return 0;
  });

  return instruments[0];
}

/*
|--------------------------------------------------------------------------
| BSE instrument by ISIN
|--------------------------------------------------------------------------
*/

async function getBseInstrumentByIsin(isin) {
  const db = await getDb();

  return (
    await db
      .collection("instruments")
      .findOne({
        isin: String(isin).trim(),
        segment: "BSE_EQ",
      })
  ) || null;
}

/*
|--------------------------------------------------------------------------
| Save daily close
|--------------------------------------------------------------------------
|
| Replaces the old MySQL transaction.
|
| Two MongoDB collections are updated atomically:
|
| marketStocks
| detailStockDailyCloses
|
*/

async function saveDailyClose(
  snapshot,
  tradingDate
) {
  if (
    !snapshot?.instrumentKey ||
    snapshot?.price == null
  ) {
    return false;
  }

  const db = await getDb();
  const client = getMongoClient();

  const session =
    client.startSession();

  const instrumentKey =
    String(snapshot.instrumentKey);

  const normalizedTradingDate =
    toTradingDate(tradingDate);

  if (!normalizedTradingDate) {
    session.endSession();

    return false;
  }

  try {
    await session.withTransaction(
      async () => {
        /*
         * Update marketStocks.
         */

        await db
          .collection("marketStocks")
          .updateOne(
            {
              instrumentKey,
            },
            {
              $set: {
                symbol:
                  snapshot.symbol ??
                  undefined,

                name:
                  snapshot.name ??
                  undefined,

                price:
                  snapshot.price,

                changeValue:
                  snapshot.change ??
                  null,

                changePercent:
                  snapshot.changePercent ??
                  null,

                openPrice:
                  snapshot.open ??
                  null,

                previousClose:
                  snapshot.previousClose ??
                  null,

                dayHigh:
                  snapshot.high ??
                  null,

                dayLow:
                  snapshot.low ??
                  null,

                volume:
                  snapshot.volume ??
                  null,

                updatedAt:
                  new Date(),

                sector:
                  snapshot.sector ??
                  null,

                lastTradeTime:
                  snapshot.lastTradeTime ??
                  null,

                marketStatus:
                  "CLOSED",

                dayClose:
                  snapshot.dayClose ??
                  snapshot.price,
              },

              $setOnInsert: {
                instrumentKey,
                migratedAt: null,
              },
            },
            {
              upsert: true,
              session,
            }
          );

        /*
         * Upsert daily close.
         */

        await db
          .collection(
            "detailStockDailyCloses"
          )
          .updateOne(
            {
              instrumentKey,
              tradingDate:
                normalizedTradingDate,
            },
            {
              $set: {
                symbol:
                  snapshot.symbol ??
                  null,

                closePrice:
                  snapshot.dayClose ??
                  snapshot.price,

                openPrice:
                  snapshot.open ??
                  null,

                highPrice:
                  snapshot.high ??
                  null,

                lowPrice:
                  snapshot.low ??
                  null,

                volume:
                  snapshot.volume ??
                  null,

                previousClose:
                  snapshot.previousClose ??
                  null,

                source:
                  snapshot.source ||
                  "upstox",

                updatedAt:
                  new Date(),
              },

              $setOnInsert: {
                instrumentKey,
                tradingDate:
                  normalizedTradingDate,

                createdAt:
                  new Date(),
              },
            },
            {
              upsert: true,
              session,
            }
          );
      }
    );

    return true;
  } finally {
    await session.endSession();
  }
}

/*
|--------------------------------------------------------------------------
| Previous stored close
|--------------------------------------------------------------------------
*/

async function getPreviousStoredClose(
  instrumentKey,
  beforeTradingDate
) {
  const db = await getDb();

  const row =
    await db
      .collection(
        "detailStockDailyCloses"
      )
      .findOne(
        {
          instrumentKey: String(
            instrumentKey
          ),
          tradingDate: {
            $lt:
              toTradingDate(
                beforeTradingDate
              ),
          },
        },
        {
          sort: {
            tradingDate: -1,
          },
        }
      );

  if (!row) {
    return null;
  }

  return {
    trading_date:
      row.tradingDate,

    close:
      row.closePrice,
  };
}

/*
|--------------------------------------------------------------------------
| Check daily close
|--------------------------------------------------------------------------
*/

async function hasDailyCloseForDate(
  instrumentKey,
  tradingDate
) {
  const db = await getDb();

  const count =
    await db
      .collection(
        "detailStockDailyCloses"
      )
      .countDocuments({
        instrumentKey: String(
          instrumentKey
        ),

        tradingDate:
          toTradingDate(
            tradingDate
          ),
      });

  return count > 0;
}

/*
|--------------------------------------------------------------------------
| Daily close count
|--------------------------------------------------------------------------
*/

async function getDailyCloseCount(
  tradingDate
) {
  const db = await getDb();

  return db
    .collection(
      "detailStockDailyCloses"
    )
    .countDocuments({
      tradingDate:
        toTradingDate(
          tradingDate
        ),
    });
}

/*
|--------------------------------------------------------------------------
| Historical chart data
|--------------------------------------------------------------------------
*/

async function getDbHistory(
  instrumentKey,
  from,
  to
) {
  const db = await getDb();

  const rows =
    await db
      .collection(
        "detailStockDailyCloses"
      )
      .find({
        instrumentKey: String(
          instrumentKey
        ),

        tradingDate: {
          $gte: toTradingDate(from),
          $lte: toTradingDate(to),
        },
      })
      .sort({
        tradingDate: 1,
      })
      .toArray();

  return rows.map((row) => ({
    timestamp:
      `${row.tradingDate}T15:30:00+05:30`,

    open:
      row.openPrice,

    high:
      row.highPrice,

    low:
      row.lowPrice,

    close:
      row.closePrice,

    volume:
      row.volume,
  }));
}

/*
|--------------------------------------------------------------------------
| Close
|--------------------------------------------------------------------------
|
| MongoDB is shared across the application.
| Do NOT close it here because other services may
| still be using the same Mongo connection.
|
*/

async function close() {
  return;
}

module.exports = {
  initDb,
  requireDb,
  close,

  getMarketStockInstruments,
  getMarketStockCount,
  getMarketStockByInstrumentKey,

  getInstrumentMaster,
  getInstrumentMasterByIsin,
  getBseInstrumentByIsin,

  saveDailyClose,
  getPreviousStoredClose,
  hasDailyCloseForDate,
  getDailyCloseCount,
  getDbHistory,

  getIsinBySymbol,
};