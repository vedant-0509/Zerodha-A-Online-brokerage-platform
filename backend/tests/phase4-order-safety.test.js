const test = require("node:test");
const assert = require("node:assert/strict");

const userId = process.env.PHASE4_TEST_USER_ID;
const instrumentKey = process.env.PHASE4_TEST_INSTRUMENT_KEY;
const canRun = Boolean(userId && instrumentKey);

function key(label) {
  return `phase4-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getMongo() {
  const { connectMongoDB, getMongoDB } = require("../config/mongodb");
  await connectMongoDB();
  return getMongoDB();
}

async function snapshotState(db) {
  const stock = await db.collection("marketStocks").findOne(
    { instrumentKey },
    { projection: { price: 1 } }
  );

  const holding = await db.collection("holdings").findOne(
    { userId, instrumentKey },
    { projection: { holdingId: 1, quantity: 1, investedValue: 1 } }
  );

  return {
    stockPrice: Number(stock?.price),
    holding: holding || null,
  };
}

async function cleanup(db, orderIds = []) {
  if (orderIds.length) {
    await db.collection("orderTransactionAudit").deleteMany({
      orderId: { $in: orderIds },
    });

    await db.collection("orders").deleteMany({
      orderId: { $in: orderIds },
    });
  }

  await db.collection("orderIdempotency").deleteMany({
    userId,
    idempotencyKey: { $regex: /^phase4-/ },
  });
}

test(
  "Phase 4: DB price and idempotency",
  {
    skip: !canRun
      ? "Set PHASE4_TEST_USER_ID and PHASE4_TEST_INSTRUMENT_KEY to run integration tests."
      : false,
  },
  async () => {
    const { simulateOrder } = require("../detailStock/simulatedOrderService");
    const db = await getMongo();

    const before = await snapshotState(db);

    assert.ok(
      Number.isFinite(before.stockPrice) && before.stockPrice > 0,
      "MongoDB marketStocks price must be valid"
    );

    const idempotencyKey = key("same");

    const result1 = await simulateOrder({
      userId,
      instrumentKey,
      transactionType: "BUY",
      quantity: 1,
      orderType: "MARKET",
      product: "CNC",
      limitPrice: null,
      idempotencyKey,
    });

    const result2 = await simulateOrder({
      userId,
      instrumentKey,
      transactionType: "BUY",
      quantity: 1,
      orderType: "MARKET",
      product: "CNC",
      limitPrice: null,
      idempotencyKey,
    });

    assert.equal(result1.success, true);
    assert.equal(result2.orderId, result1.orderId);
    assert.equal(result2.price, before.stockPrice);

    await cleanup(db, [result1.orderId]);
  }
);

test(
  "Phase 4: concurrent BUY requests remain transaction-safe",
  {
    skip: !canRun
      ? "Set PHASE4_TEST_USER_ID and PHASE4_TEST_INSTRUMENT_KEY to run integration tests."
      : false,
  },
  async () => {
    const { simulateOrder } = require("../detailStock/simulatedOrderService");
    const db = await getMongo();

    const before = await snapshotState(db);

    const keys = [
      key("concurrent-a"),
      key("concurrent-b"),
    ];

    const results = await Promise.all(
      keys.map((idempotencyKey) =>
        simulateOrder({
          userId,
          instrumentKey,
          transactionType: "BUY",
          quantity: 1,
          orderType: "MARKET",
          product: "CNC",
          limitPrice: null,
          idempotencyKey,
        })
      )
    );

    assert.equal(
      results.filter((item) => item.success).length,
      2
    );

    const after = await snapshotState(db);

    assert.equal(
      Number(after.holding?.quantity || 0),
      Number(before.holding?.quantity || 0) + 2
    );

    await cleanup(
      db,
      results.map((item) => item.orderId).filter(Boolean)
    );

    if (before.holding) {
      await db.collection("holdings").updateOne(
        { holdingId: before.holding.holdingId },
        {
          $set: {
            quantity: before.holding.quantity,
            investedValue: before.holding.investedValue,
          },
        }
      );
    } else {
      await db.collection("holdings").deleteOne({
        userId,
        instrumentKey,
      });
    }
  }
);
