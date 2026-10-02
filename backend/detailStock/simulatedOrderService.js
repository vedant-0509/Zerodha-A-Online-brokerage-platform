const crypto = require("crypto");
const { requireDb } = require("./db");

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
      limitPrice == null || limitPrice === ""
        ? null
        : Number(limitPrice),
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

function parseStoredResponse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeAudit(connection, {
  orderId,
  userId,
  idempotencyKey,
  eventType,
  status,
  details = null,
}) {
  await connection.execute(
    `
      INSERT INTO order_transaction_audit (
        order_id,
        user_id,
        idempotency_key,
        event_type,
        status,
        details,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `,
    [
      orderId,
      userId,
      idempotencyKey || null,
      eventType,
      status,
      details ? JSON.stringify(details) : null,
    ],
  );
}

async function writeRollbackAudit({
  orderId,
  userId,
  idempotencyKey,
  error,
}) {
  const db = requireDb();
  let auditConnection;

  try {
    auditConnection = await db.getConnection();
    await writeAudit(auditConnection, {
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
    // The original order error is more important than an audit-write error.
  } finally {
    auditConnection?.release();
  }
}

async function getIdempotencyRecord(db, userId, idempotencyKey) {
  const [rows] = await db.execute(
    `
      SELECT
        user_id,
        idempotency_key,
        request_hash,
        status,
        order_id,
        response_json
      FROM order_idempotency
      WHERE user_id = ?
        AND idempotency_key = ?
      LIMIT 1
    `,
    [userId, idempotencyKey],
  );

  return rows[0] || null;
}

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
  const db = requireDb();

  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const normalizedTransactionType = String(transactionType || "").toUpperCase();
  const normalizedOrderType = String(orderType || "MARKET").toUpperCase();
  const normalizedProduct = String(product || "CNC").toUpperCase();
  const qty = Number(quantity);
  const normalizedLimitPrice =
    limitPrice == null || limitPrice === ""
      ? null
      : Number(limitPrice);

  if (!Number.isInteger(qty) || qty <= 0) {
    const error = new Error("Quantity must be a positive integer.");
    error.code = "INVALID_QUANTITY";
    error.httpStatus = 400;
    throw error;
  }

  if (!['BUY', 'SELL'].includes(normalizedTransactionType)) {
    const error = new Error("transactionType must be BUY or SELL.");
    error.code = "INVALID_TRANSACTION_TYPE";
    error.httpStatus = 400;
    throw error;
  }

  if (!['MARKET', 'LIMIT'].includes(normalizedOrderType)) {
    const error = new Error("Invalid orderType.");
    error.code = "INVALID_ORDER_TYPE";
    error.httpStatus = 400;
    throw error;
  }

  if (
    normalizedOrderType === "LIMIT" &&
    (!Number.isFinite(normalizedLimitPrice) || normalizedLimitPrice <= 0)
  ) {
    const error = new Error("A positive limitPrice is required for LIMIT orders.");
    error.code = "INVALID_LIMIT_PRICE";
    error.httpStatus = 400;
    throw error;
  }

  const requestHash = createRequestHash({
    instrumentKey,
    transactionType: normalizedTransactionType,
    quantity: qty,
    orderType: normalizedOrderType,
    product: normalizedProduct,
    limitPrice: normalizedLimitPrice,
  });

  const connection = await db.getConnection();
  const orderId = createOrderId();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // The unique DB constraint serializes the same user + idempotency key.
    // A duplicate means another request already owns this key.
    try {
      await connection.execute(
        `
          INSERT INTO order_idempotency (
            user_id,
            idempotency_key,
            request_hash,
            status,
            order_id,
            response_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, 'PROCESSING', ?, NULL, NOW(), NOW())
        `,
        [userId, normalizedKey, requestHash, orderId],
      );
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;

      await connection.rollback();
      transactionStarted = false;

      const existing = await getIdempotencyRecord(
        db,
        userId,
        normalizedKey,
      );

      if (!existing) {
        const retryError = new Error("Unable to resolve idempotent order request.");
        retryError.code = "IDEMPOTENCY_RETRY_REQUIRED";
        retryError.httpStatus = 409;
        throw retryError;
      }

      if (existing.request_hash !== requestHash) {
        const conflict = new Error(
          "The Idempotency-Key was already used with a different order request.",
        );
        conflict.code = "IDEMPOTENCY_KEY_REUSED";
        conflict.httpStatus = 409;
        throw conflict;
      }

      if (existing.status === "COMPLETED" && existing.response_json) {
        return parseStoredResponse(existing.response_json) || {
          success: false,
          status: "FAILED",
          code: "IDEMPOTENCY_RESPONSE_UNAVAILABLE",
          message: "The previous order response could not be read.",
        };
      }

      const processing = new Error(
        "This order request is already being processed. Please retry with the same Idempotency-Key.",
      );
      processing.code = "ORDER_PROCESSING";
      processing.httpStatus = 409;
      throw processing;
    }

    await writeAudit(connection, {
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
    });

    // ---------------------------------------------------------
    // Lock the stock row and read the execution price from DB.
    // Client-supplied values can never become the execution price.
    // ---------------------------------------------------------
    const [stockRows] = await connection.execute(
      `
        SELECT
          id,
          symbol,
          name,
          price,
          instrument_key
        FROM market_stocks_data
        WHERE instrument_key = ?
        LIMIT 1
        FOR UPDATE
      `,
      [instrumentKey],
    );

    if (!stockRows.length) {
      const error = new Error("Stock not found.");
      error.code = "STOCK_NOT_FOUND";
      error.httpStatus = 404;
      throw error;
    }

    const stock = stockRows[0];
    const executionPrice = Number(stock.price);

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      const error = new Error("Invalid server execution price.");
      error.code = "INVALID_EXECUTION_PRICE";
      error.httpStatus = 409;
      throw error;
    }

    // A LIMIT price is only a server-side condition. It is never stored as
    // the execution price. MARKET orders ignore any client price entirely.
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

        await connection.execute(
          `
            INSERT INTO orders (
              order_id,
              user_id,
              instrument_key,
              symbol,
              instrument_name,
              exchange,
              order_type,
              product,
              quantity,
              price,
              invested_amount,
              order_status,
              failure_reason,
              placed_at,
              executed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, NOW(), NULL)
          `,
          [
            orderId,
            userId,
            instrumentKey,
            stock.symbol,
            stock.name,
            exchange,
            normalizedTransactionType,
            normalizedProduct,
            qty,
            executionPrice,
            investedAmount,
            result.message,
          ],
        );

        await writeAudit(connection, {
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
        });

        await connection.execute(
          `
            UPDATE order_idempotency
            SET status = 'COMPLETED', response_json = ?, updated_at = NOW()
            WHERE user_id = ? AND idempotency_key = ?
          `,
          [JSON.stringify(result), userId, normalizedKey],
        );

        await connection.commit();
        transactionStarted = false;
        return result;
      }
    }

    const investedAmount = executionPrice * qty;

    const exchangeSegment = String(instrumentKey).split("|")[0] || "";
    const exchange =
      exchangeSegment === "NSE_EQ"
        ? "NSE"
        : exchangeSegment === "BSE_EQ"
          ? "BSE"
          : exchangeSegment.replace("_EQ", "");

    // =========================================================
    // BUY
    // =========================================================
    if (normalizedTransactionType === "BUY") {
      const [holdingRows] = await connection.execute(
        `
          SELECT
            holding_id,
            quantity,
            invested_value
          FROM holdings
          WHERE user_id = ?
            AND instrument_key = ?
          LIMIT 1
          FOR UPDATE
        `,
        [userId, instrumentKey],
      );

      if (holdingRows.length > 0) {
        const holding = holdingRows[0];
        const currentQuantity = Number(holding.quantity);
        const currentInvested = Number(holding.invested_value);
        const newQuantity = currentQuantity + qty;
        const newInvestedValue = currentInvested + investedAmount;

        await connection.execute(
          `
            UPDATE holdings
            SET quantity = ?, invested_value = ?, updated_at = NOW()
            WHERE holding_id = ?
          `,
          [newQuantity, newInvestedValue, holding.holding_id],
        );
      } else {
        await connection.execute(
          `
            INSERT INTO holdings (
              holding_id,
              user_id,
              instrument_key,
              quantity,
              invested_value,
              purchase_date,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURDATE(), NOW(), NOW())
          `,
          [createOrderId(), userId, instrumentKey, qty, investedAmount],
        );
      }
    }

    // =========================================================
    // SELL
    // =========================================================
    if (normalizedTransactionType === "SELL") {
      const [holdingRows] = await connection.execute(
        `
          SELECT
            holding_id,
            quantity,
            invested_value
          FROM holdings
          WHERE user_id = ?
            AND instrument_key = ?
          LIMIT 1
          FOR UPDATE
        `,
        [userId, instrumentKey],
      );

      if (!holdingRows.length) {
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

        await connection.execute(
          `
            INSERT INTO orders (
              order_id, user_id, instrument_key, symbol, instrument_name,
              exchange, order_type, product, quantity, price, invested_amount,
              order_status, failure_reason, placed_at, executed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, NOW(), NULL)
          `,
          [
            orderId,
            userId,
            instrumentKey,
            stock.symbol,
            stock.name,
            exchange,
            normalizedTransactionType,
            normalizedProduct,
            qty,
            executionPrice,
            investedAmount,
            result.message,
          ],
        );

        await writeAudit(connection, {
          orderId,
          userId,
          idempotencyKey: normalizedKey,
          eventType: "ORDER_REJECTED",
          status: "FAILED",
          details: { code: result.code, reason: result.message },
        });

        await connection.execute(
          `
            UPDATE order_idempotency
            SET status = 'COMPLETED', response_json = ?, updated_at = NOW()
            WHERE user_id = ? AND idempotency_key = ?
          `,
          [JSON.stringify(result), userId, normalizedKey],
        );

        await connection.commit();
        transactionStarted = false;
        return result;
      }

      const holding = holdingRows[0];
      const currentQuantity = Number(holding.quantity);
      const currentInvested = Number(holding.invested_value);

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

        await connection.execute(
          `
            INSERT INTO orders (
              order_id, user_id, instrument_key, symbol, instrument_name,
              exchange, order_type, product, quantity, price, invested_amount,
              order_status, failure_reason, placed_at, executed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FAILED', ?, NOW(), NULL)
          `,
          [
            orderId,
            userId,
            instrumentKey,
            stock.symbol,
            stock.name,
            exchange,
            normalizedTransactionType,
            normalizedProduct,
            qty,
            executionPrice,
            investedAmount,
            result.message,
          ],
        );

        await writeAudit(connection, {
          orderId,
          userId,
          idempotencyKey: normalizedKey,
          eventType: "ORDER_REJECTED",
          status: "FAILED",
          details: { code: result.code, reason: result.message },
        });

        await connection.execute(
          `
            UPDATE order_idempotency
            SET status = 'COMPLETED', response_json = ?, updated_at = NOW()
            WHERE user_id = ? AND idempotency_key = ?
          `,
          [JSON.stringify(result), userId, normalizedKey],
        );

        await connection.commit();
        transactionStarted = false;
        return result;
      }

      const averageCost =
        currentQuantity > 0 ? currentInvested / currentQuantity : 0;
      const costRemoved = averageCost * qty;
      const remainingQuantity = currentQuantity - qty;
      const remainingInvested = Math.max(0, currentInvested - costRemoved);

      if (remainingQuantity === 0) {
        await connection.execute(
          `DELETE FROM holdings WHERE holding_id = ?`,
          [holding.holding_id],
        );
      } else {
        await connection.execute(
          `
            UPDATE holdings
            SET quantity = ?, invested_value = ?, updated_at = NOW()
            WHERE holding_id = ?
          `,
          [remainingQuantity, remainingInvested, holding.holding_id],
        );
      }
    }

    // =========================================================
    // COMPLETED SIMULATED ORDER
    // =========================================================
    await connection.execute(
      `
        INSERT INTO orders (
          order_id, user_id, instrument_key, symbol, instrument_name,
          exchange, order_type, product, quantity, price, invested_amount,
          order_status, failure_reason, placed_at, executed_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', NULL, NOW(), NOW())
      `,
      [
        orderId,
        userId,
        instrumentKey,
        stock.symbol,
        stock.name,
        exchange,
        normalizedTransactionType,
        normalizedProduct,
        qty,
        executionPrice,
        investedAmount,
      ],
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

    await writeAudit(connection, {
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
    });

    await connection.execute(
      `
        UPDATE order_idempotency
        SET status = 'COMPLETED', response_json = ?, updated_at = NOW()
        WHERE user_id = ? AND idempotency_key = ?
      `,
      [JSON.stringify(result), userId, normalizedKey],
    );

    await connection.commit();
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Ignore rollback errors and preserve the original error.
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
    connection.release();
  }
}

module.exports = {
  simulateOrder,
  createRequestHash,
  normalizeIdempotencyKey,
};