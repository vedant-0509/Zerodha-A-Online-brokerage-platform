const crypto = require("crypto");

const { getMongoDB, getMongoClient } = require("../config/mongodb");

// ============================================================
// HELPERS
// ============================================================

function createOrderId() {
  return crypto.randomUUID();
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();

  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) {
    const error = new Error("A valid Idempotency-Key header is required.");

    error.code = "INVALID_IDEMPOTENCY_KEY";
    error.httpStatus = 400;

    throw error;
  }

  return key;
}

function createRequestHash({
  instrumentKey,
  transactionType,
  quantity,
  orderType,
  product,
  limitPrice,
}) {
  const payload = JSON.stringify({
    instrumentKey: String(instrumentKey || ""),

    transactionType: String(transactionType || "").toUpperCase(),

    quantity: Number(quantity),

    orderType: String(orderType || "MARKET").toUpperCase(),

    product: String(product || "CNC").toUpperCase(),

    limitPrice:
      limitPrice == null || limitPrice === "" ? null : Number(limitPrice),
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

function parseStoredResponse(raw) {
  if (!raw) {
    return null;
  }

  if (typeof raw === "object") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCollection(name) {
  return getMongoDB().collection(name);
}

// ============================================================
// AUDIT
// ============================================================

async function writeAudit(
  db,
  {
    orderId,
    userId,
    idempotencyKey,
    eventType,
    status,
    details = null,
    session = null,
  },
) {
  await db.collection("orderTransactionAudit").insertOne(
    {
      auditId: crypto.randomUUID(),

      orderId,

      userId,

      idempotencyKey: idempotencyKey || null,

      eventType,

      status,

      details,

      createdAt: new Date(),
    },
    session ? { session } : undefined,
  );
}

// ============================================================
// ROLLBACK AUDIT
// ============================================================

async function writeRollbackAudit({ orderId, userId, idempotencyKey, error }) {
  try {
    const db = getMongoDB();

    await writeAudit(db, {
      orderId,

      userId,

      idempotencyKey,

      eventType: "ORDER_ROLLED_BACK",

      status: "ROLLED_BACK",

      details: {
        errorCode: error?.code || "INTERNAL_ERROR",

        message: error?.message || "Order transaction rolled back.",
      },
    });
  } catch {
    // Original order error is more important.
  }
}

// ============================================================
// IDEMPOTENCY
// ============================================================

async function getIdempotencyRecord(db, userId, idempotencyKey) {
  return db.collection("orderIdempotency").findOne({
    userId,
    idempotencyKey,
  });
}

// ============================================================
// BUSINESS FAILURE
// ============================================================

function createBusinessFailure({
  orderId,
  transactionType,
  orderType,
  product,
  instrumentKey,
  symbol,
  quantity,
  price,
  investedAmount,
  message,
  code = "ORDER_FAILED",
}) {
  return {
    success: false,

    status: "FAILED",

    simulated: true,

    code,

    orderId,

    transactionType,

    orderType,

    product,

    instrumentKey,

    symbol,

    quantity,

    price,

    investedAmount,

    message,
  };
}

// ============================================================
// SIMULATE ORDER
// ============================================================

async function simulateOrder({
  userId,

  instrumentKey,

  transactionType,

  quantity,

  orderType = "MARKET",

  product = "CNC",

  limitPrice = null,

  idempotencyKey,
}) {
  const db = getMongoDB();

  const client = getMongoClient();

  // ========================================================
  // NORMALIZATION
  // ========================================================

  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);

  const normalizedTransactionType = String(transactionType || "").toUpperCase();

  const normalizedOrderType = String(orderType || "MARKET").toUpperCase();

  const normalizedProduct = String(product || "CNC").toUpperCase();

  const qty = Number(quantity);

  const normalizedLimitPrice =
    limitPrice == null || limitPrice === "" ? null : Number(limitPrice);

  // ========================================================
  // VALIDATION
  // ========================================================

  if (!Number.isInteger(qty) || qty <= 0) {
    const error = new Error("Quantity must be a positive integer.");

    error.code = "INVALID_QUANTITY";

    error.httpStatus = 400;

    throw error;
  }

  if (!["BUY", "SELL"].includes(normalizedTransactionType)) {
    const error = new Error("transactionType must be BUY or SELL.");

    error.code = "INVALID_TRANSACTION_TYPE";

    error.httpStatus = 400;

    throw error;
  }

  if (!["MARKET", "LIMIT"].includes(normalizedOrderType)) {
    const error = new Error("Invalid orderType.");

    error.code = "INVALID_ORDER_TYPE";

    error.httpStatus = 400;

    throw error;
  }

  if (
    normalizedOrderType === "LIMIT" &&
    (!Number.isFinite(normalizedLimitPrice) || normalizedLimitPrice <= 0)
  ) {
    const error = new Error(
      "A positive limitPrice is required for LIMIT orders.",
    );

    error.code = "INVALID_LIMIT_PRICE";

    error.httpStatus = 400;

    throw error;
  }

  // ========================================================
  // REQUEST HASH
  // ========================================================

  const requestHash = createRequestHash({
    instrumentKey,

    transactionType: normalizedTransactionType,

    quantity: qty,

    orderType: normalizedOrderType,

    product: normalizedProduct,

    limitPrice: normalizedLimitPrice,
  });

  const orderId = createOrderId();

  const session = client.startSession();

  let transactionStarted = false;

  try {
    // ====================================================
    // START TRANSACTION
    // ====================================================

    session.startTransaction();

    transactionStarted = true;

    // ====================================================
    // IDEMPOTENCY INSERT
    // ====================================================

    try {
      await getCollection("orderIdempotency").insertOne(
        {
          userId,

          idempotencyKey: normalizedKey,

          requestHash,

          status: "PROCESSING",

          orderId,

          responseJson: null,

          createdAt: new Date(),

          updatedAt: new Date(),
        },

        { session },
      );
    } catch (error) {
      // Mongo duplicate-key error
      if (error?.code !== 11000) {
        throw error;
      }

      // Another request owns this
      // idempotency key.

      await session.abortTransaction();

      transactionStarted = false;

      const existing = await getIdempotencyRecord(db, userId, normalizedKey);

      if (!existing) {
        const retryError = new Error(
          "Unable to resolve idempotent order request.",
        );

        retryError.code = "IDEMPOTENCY_RETRY_REQUIRED";

        retryError.httpStatus = 409;

        throw retryError;
      }

      if (existing.requestHash !== requestHash) {
        const conflict = new Error(
          "The Idempotency-Key was already used with a different order request.",
        );

        conflict.code = "IDEMPOTENCY_KEY_REUSED";

        conflict.httpStatus = 409;

        throw conflict;
      }

      if (existing.status === "COMPLETED" && existing.responseJson) {
        return (
          parseStoredResponse(existing.responseJson) || {
            success: false,

            status: "FAILED",

            code: "IDEMPOTENCY_RESPONSE_UNAVAILABLE",

            message: "The previous order response could not be read.",
          }
        );
      }

      const processing = new Error(
        "This order request is already being processed. Please retry with the same Idempotency-Key.",
      );

      processing.code = "ORDER_PROCESSING";

      processing.httpStatus = 409;

      throw processing;
    }

    // ====================================================
    // ORDER START AUDIT
    // ====================================================

    await writeAudit(
      db,
      {
        orderId,

        userId,

        idempotencyKey: normalizedKey,

        eventType: "ORDER_STARTED",

        status: "PROCESSING",

        details: {
          instrumentKey,

          transactionType: normalizedTransactionType,

          quantity: qty,

          orderType: normalizedOrderType,

          product: normalizedProduct,
        },
      },
      session,
    );

    // ====================================================
    // SERVER-AUTHORITATIVE STOCK PRICE
    // ====================================================

    const stock = await getCollection("marketStocks").findOne(
      {
        instrumentKey,
      },
      {
        session,
        projection: {
          instrumentKey: 1,
          symbol: 1,
          name: 1,
          price: 1,
        },
      },
    );

    if (!stock) {
      const error = new Error("Stock not found.");

      error.code = "STOCK_NOT_FOUND";

      error.httpStatus = 404;

      throw error;
    }

    // IMPORTANT:
    // Client price is NEVER used
    // as execution price.

    const executionPrice = Number(stock.price);

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      const error = new Error("Invalid server execution price.");

      error.code = "INVALID_EXECUTION_PRICE";

      error.httpStatus = 409;

      throw error;
    }

    // ====================================================
    // LIMIT ORDER CHECK
    // ====================================================

    if (normalizedOrderType === "LIMIT") {
      const limitSatisfied =
        normalizedTransactionType === "BUY"
          ? executionPrice <= normalizedLimitPrice
          : executionPrice >= normalizedLimitPrice;

      if (!limitSatisfied) {
        const exchangeSegment = String(instrumentKey).split("|")[0] || "";

        const exchange =
          exchangeSegment === "NSE_EQ"
            ? "NSE"
            : exchangeSegment === "BSE_EQ"
              ? "BSE"
              : exchangeSegment.replace("_EQ", "");

        const investedAmount = executionPrice * qty;

        const result = createBusinessFailure({
          orderId,

          transactionType: normalizedTransactionType,

          orderType: normalizedOrderType,

          product: normalizedProduct,

          instrumentKey,

          symbol: stock.symbol,

          quantity: qty,

          price: executionPrice,

          investedAmount,

          code: "LIMIT_NOT_MARKETABLE",

          message:
            normalizedTransactionType === "BUY"
              ? `Current market price ₹${executionPrice.toFixed(2)} is above your limit price ₹${normalizedLimitPrice.toFixed(2)}.`
              : `Current market price ₹${executionPrice.toFixed(2)} is below your limit price ₹${normalizedLimitPrice.toFixed(2)}.`,
        });

        // FAILED ORDER

        await getCollection("orders").insertOne(
          {
            orderId,

            userId,

            instrumentKey,

            symbol: stock.symbol,

            instrumentName: stock.name,

            exchange,

            orderType: normalizedTransactionType,

            product: normalizedProduct,

            quantity: qty,

            price: executionPrice,

            investedAmount,

            orderStatus: "FAILED",

            failureReason: result.message,

            placedAt: new Date(),

            executedAt: null,

            createdAt: new Date(),

            updatedAt: new Date(),
          },

          { session },
        );

        await writeAudit(
          db,
          {
            orderId,

            userId,

            idempotencyKey: normalizedKey,

            eventType: "ORDER_REJECTED",

            status: "FAILED",

            details: {
              code: result.code,

              executionPrice,

              limitPrice: normalizedLimitPrice,
            },
          },
          session,
        );

        await getCollection("orderIdempotency").updateOne(
          {
            userId,

            idempotencyKey: normalizedKey,
          },

          {
            $set: {
              status: "COMPLETED",

              responseJson: result,

              updatedAt: new Date(),
            },
          },

          { session },
        );

        await session.commitTransaction();

        transactionStarted = false;

        return result;
      }
    }

    // ====================================================
    // INVESTED AMOUNT
    // ====================================================

    const investedAmount = executionPrice * qty;

    // ====================================================
    // EXCHANGE
    // ====================================================

    const exchangeSegment = String(instrumentKey).split("|")[0] || "";

    const exchange =
      exchangeSegment === "NSE_EQ"
        ? "NSE"
        : exchangeSegment === "BSE_EQ"
          ? "BSE"
          : exchangeSegment.replace("_EQ", "");

    // ====================================================
    // BUY
    // ====================================================

    if (normalizedTransactionType === "BUY") {
      const holdingsCollection = getCollection("holdings");

      const holding = await holdingsCollection.findOne(
        {
          userId,

          instrumentKey,
        },
        {
          session,
        },
      );

      if (holding) {
        const currentQuantity = Number(holding.quantity || 0);

        const currentInvested = Number(holding.investedValue || 0);

        const newQuantity = currentQuantity + qty;

        const newInvestedValue = currentInvested + investedAmount;

        await holdingsCollection.updateOne(
          {
            _id: holding._id,
          },

          {
            $set: {
              quantity: newQuantity,

              investedValue: newInvestedValue,

              updatedAt: new Date(),
            },
          },

          { session },
        );
      } else {
        await holdingsCollection.insertOne(
          {
            holdingId: createOrderId(),

            userId,

            instrumentKey,

            quantity: qty,

            investedValue: investedAmount,

            purchaseDate: new Date(),

            createdAt: new Date(),

            updatedAt: new Date(),
          },

          { session },
        );
      }
    }

    // ====================================================
    // SELL
    // ====================================================

    if (normalizedTransactionType === "SELL") {
      const holdingsCollection = getCollection("holdings");

      const holding = await holdingsCollection.findOne(
        {
          userId,

          instrumentKey,
        },
        {
          session,
        },
      );

      if (!holding) {
        const result = createBusinessFailure({
          orderId,

          transactionType: normalizedTransactionType,

          orderType: normalizedOrderType,

          product: normalizedProduct,

          instrumentKey,

          symbol: stock.symbol,

          quantity: qty,

          price: executionPrice,

          investedAmount,

          message: "You do not own this stock.",
        });

        await getCollection("orders").insertOne(
          {
            orderId,

            userId,

            instrumentKey,

            symbol: stock.symbol,

            instrumentName: stock.name,

            exchange,

            orderType: normalizedTransactionType,

            product: normalizedProduct,

            quantity: qty,

            price: executionPrice,

            investedAmount,

            orderStatus: "FAILED",

            failureReason: result.message,

            placedAt: new Date(),

            executedAt: null,

            createdAt: new Date(),

            updatedAt: new Date(),
          },

          { session },
        );

        await writeAudit(
          db,
          {
            orderId,

            userId,

            idempotencyKey: normalizedKey,

            eventType: "ORDER_REJECTED",

            status: "FAILED",

            details: {
              code: result.code,

              reason: result.message,
            },
          },
          session,
        );

        await getCollection("orderIdempotency").updateOne(
          {
            userId,

            idempotencyKey: normalizedKey,
          },

          {
            $set: {
              status: "COMPLETED",

              responseJson: result,

              updatedAt: new Date(),
            },
          },

          { session },
        );

        await session.commitTransaction();

        transactionStarted = false;

        return result;
      }

      const currentQuantity = Number(holding.quantity || 0);

      const currentInvested = Number(holding.investedValue || 0);

      if (currentQuantity < qty) {
        const result = createBusinessFailure({
          orderId,

          transactionType: normalizedTransactionType,

          orderType: normalizedOrderType,

          product: normalizedProduct,

          instrumentKey,

          symbol: stock.symbol,

          quantity: qty,

          price: executionPrice,

          investedAmount,

          message: `Insufficient quantity. Available: ${currentQuantity}`,
        });

        await getCollection("orders").insertOne(
          {
            orderId,

            userId,

            instrumentKey,

            symbol: stock.symbol,

            instrumentName: stock.name,

            exchange,

            orderType: normalizedTransactionType,

            product: normalizedProduct,

            quantity: qty,

            price: executionPrice,

            investedAmount,

            orderStatus: "FAILED",

            failureReason: result.message,

            placedAt: new Date(),

            executedAt: null,

            createdAt: new Date(),

            updatedAt: new Date(),
          },

          { session },
        );

        await writeAudit(
          db,
          {
            orderId,

            userId,

            idempotencyKey: normalizedKey,

            eventType: "ORDER_REJECTED",

            status: "FAILED",

            details: {
              code: result.code,

              reason: result.message,
            },
          },
          session,
        );

        await getCollection("orderIdempotency").updateOne(
          {
            userId,

            idempotencyKey: normalizedKey,
          },

          {
            $set: {
              status: "COMPLETED",

              responseJson: result,

              updatedAt: new Date(),
            },
          },

          { session },
        );

        await session.commitTransaction();

        transactionStarted = false;

        return result;
      }

      // Average cost calculation

      const averageCost =
        currentQuantity > 0 ? currentInvested / currentQuantity : 0;

      const costRemoved = averageCost * qty;

      const remainingQuantity = currentQuantity - qty;

      const remainingInvested = Math.max(0, currentInvested - costRemoved);

      if (remainingQuantity === 0) {
        await holdingsCollectionDelete(holding, session);
      } else {
        await holdingsCollection.updateOne(
          {
            _id: holding._id,
          },

          {
            $set: {
              quantity: remainingQuantity,

              investedValue: remainingInvested,

              updatedAt: new Date(),
            },
          },

          { session },
        );
      }
    }

    // ====================================================
    // COMPLETED ORDER
    // ====================================================

    await getCollection("orders").insertOne(
      {
        orderId,

        userId,

        instrumentKey,

        symbol: stock.symbol,

        instrumentName: stock.name,

        exchange,

        orderType: normalizedTransactionType,

        product: normalizedProduct,

        quantity: qty,

        price: executionPrice,

        investedAmount,

        orderStatus: "COMPLETED",

        failureReason: null,

        placedAt: new Date(),

        executedAt: new Date(),

        createdAt: new Date(),

        updatedAt: new Date(),
      },

      { session },
    );

    const result = {
      success: true,

      status: "COMPLETED",

      simulated: true,

      orderId,

      transactionType: normalizedTransactionType,

      orderType: normalizedOrderType,

      product: normalizedProduct,

      instrumentKey,

      symbol: stock.symbol,

      quantity: qty,

      price: executionPrice,

      investedAmount,
    };

    // ====================================================
    // COMPLETION AUDIT
    // ====================================================

    await writeAudit(
      db,
      {
        orderId,

        userId,

        idempotencyKey: normalizedKey,

        eventType: "ORDER_COMPLETED",

        status: "COMPLETED",

        details: {
          executionPrice,

          quantity: qty,

          investedAmount,
        },
      },
      session,
    );

    // ====================================================
    // SAVE IDEMPOTENCY RESPONSE
    // ====================================================

    await getCollection("orderIdempotency").updateOne(
      {
        userId,

        idempotencyKey: normalizedKey,
      },

      {
        $set: {
          status: "COMPLETED",

          responseJson: result,

          updatedAt: new Date(),
        },
      },

      { session },
    );

    // ====================================================
    // COMMIT
    // ====================================================

    await session.commitTransaction();

    transactionStarted = false;

    return result;
  } catch (error) {
    // ====================================================
    // ROLLBACK
    // ====================================================

    if (transactionStarted) {
      try {
        await session.abortTransaction();
      } catch {
        // Preserve original error.
      }
    }

    await writeRollbackAudit({
      orderId,

      userId,

      idempotencyKey: normalizedKey,

      error,
    });

    throw error;
  } finally {
    await session.endSession();
  }
}

// ============================================================
// DELETE HOLDING HELPER
// ============================================================

async function holdingsCollectionDelete(holding, session) {
  await getCollection("holdings").deleteOne(
    {
      _id: holding._id,
    },
    {
      session,
    },
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  simulateOrder,

  createRequestHash,

  normalizeIdempotencyKey,
};