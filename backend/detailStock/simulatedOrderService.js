const crypto = require("crypto");
const { requireDb } = require("./db");

function createOrderId() {
  return crypto.randomUUID();
}

async function simulateOrder({
  userId,
  instrumentKey,
  transactionType,
  quantity,
  price,
  orderType = "MARKET",
  product = "CNC",
}) {
  const db = requireDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // ---------------------------------------------------------
    // Get stock
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
      throw new Error("Stock not found.");
    }

    const stock = stockRows[0];

    // ---------------------------------------------------------
    // Determine simulation execution price
    // ---------------------------------------------------------
    const dbPrice = Number(stock.price);

    const executionPrice =
      Number.isFinite(Number(price)) && Number(price) > 0
        ? Number(price)
        : dbPrice;

    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      throw new Error("Invalid execution price.");
    }

    // ---------------------------------------------------------
    // Validate quantity
    // ---------------------------------------------------------
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Quantity must be a positive integer.");
    }

    const investedAmount = executionPrice * qty;

    const exchangeSegment = String(instrumentKey).split("|")[0] || "";

    const exchange =      exchangeSegment === "NSE_EQ"       ? "NSE"        : exchangeSegment === "BSE_EQ"          ? "BSE"          : exchangeSegment.replace("_EQ", "");

    // =========================================================
    // BUY
    // =========================================================
    if (transactionType === "BUY") {
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

      // Existing holding
      if (holdingRows.length > 0) {
        const holding = holdingRows[0];

        const currentQuantity = Number(holding.quantity);
        const currentInvested = Number(holding.invested_value);

        const newQuantity = currentQuantity + qty;

        const newInvestedValue = currentInvested + investedAmount;

        await connection.execute(
          `
          UPDATE holdings
          SET
            quantity = ?,
            invested_value = ?,
            updated_at = NOW()
          WHERE holding_id = ?
          `,
          [newQuantity, newInvestedValue, holding.holding_id],
        );
      } else {
        // New holding
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
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            CURDATE(),
            NOW(),
            NOW()
          )
          `,
          [createOrderId(), userId, instrumentKey, qty, investedAmount],
        );
      }
    }

    // =========================================================
    // SELL
    // =========================================================
    if (transactionType === "SELL") {
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

      // No holding
      if (!holdingRows.length) {
        const orderId = createOrderId();

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
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'FAILED',
            ?,
            NOW(),
            NULL
          )
          `,
          [
            orderId,
            userId,
            instrumentKey,
            stock.symbol,
            stock.name,
            exchange,
            transactionType,
            product,
            qty,
            executionPrice,
            investedAmount,
            "No holdings available to sell.",
          ],
        );

        await connection.commit();

        return {
          success: false,
          status: "FAILED",
          orderId,
          message: "You do not own this stock.",
        };
      }

      const holding = holdingRows[0];

      const currentQuantity = Number(holding.quantity);
      const currentInvested = Number(holding.invested_value);

      // Trying to sell more than owned
      if (currentQuantity < qty) {
        const orderId = createOrderId();

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
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'FAILED',
            ?,
            NOW(),
            NULL
          )
          `,
          [
            orderId,
            userId,
            instrumentKey,
            stock.symbol,
            stock.name,
            exchange,
            transactionType,
            product,
            qty,
            executionPrice,
            investedAmount,
            `Insufficient quantity. Available: ${currentQuantity}`,
          ],
        );

        await connection.commit();

        return {
          success: false,
          status: "FAILED",
          orderId,
          message: `Insufficient quantity. Available: ${currentQuantity}`,
        };
      }

      // -------------------------------------------------------
      // Reduce holding using average cost
      // -------------------------------------------------------
      const averageCost =
        currentQuantity > 0 ? currentInvested / currentQuantity : 0;

      const costRemoved = averageCost * qty;

      const remainingQuantity = currentQuantity - qty;

      const remainingInvested = Math.max(0, currentInvested - costRemoved);

      if (remainingQuantity === 0) {
        await connection.execute(
          `
          DELETE FROM holdings
          WHERE holding_id = ?
          `,
          [holding.holding_id],
        );
      } else {
        await connection.execute(
          `
          UPDATE holdings
          SET
            quantity = ?,
            invested_value = ?,
            updated_at = NOW()
          WHERE holding_id = ?
          `,
          [remainingQuantity, remainingInvested, holding.holding_id],
        );
      }
    }

    // =========================================================
    // COMPLETED SIMULATED ORDER
    // =========================================================
    const orderId = createOrderId();

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
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'COMPLETED',
        NULL,
        NOW(),
        NOW()
      )
      `,
      [
        orderId,
        userId,
        instrumentKey,
        stock.symbol,
        stock.name,
        exchange,
        transactionType,
        product,
        qty,
        executionPrice,
        investedAmount,
      ],
    );

    await connection.commit();

    return {
      success: true,
      status: "COMPLETED",
      simulated: true,
      orderId,
      transactionType,
      orderType,
      product,
      instrumentKey,
      symbol: stock.symbol,
      quantity: qty,
      price: executionPrice,
      investedAmount,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  simulateOrder,
};
