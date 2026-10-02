const test = require("node:test");
const assert = require("node:assert/strict");

const userId = process.env.PHASE4_TEST_USER_ID;
const instrumentKey = process.env.PHASE4_TEST_INSTRUMENT_KEY;
const canRun = Boolean(userId && instrumentKey);

function key(label) {
  return `phase4-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function getPool() {
  const mysql = require("mysql2/promise");
  const env = require("../detailStock/env");
  return mysql.createPool({
    host: env.mysql.host, port: env.mysql.port, user: env.mysql.user,
    password: env.mysql.password, database: env.mysql.database,
    connectionLimit: 10, decimalNumbers: true,
  });
}

async function snapshotState(db) {
  const [stocks] = await db.execute(`SELECT price FROM market_stocks_data WHERE instrument_key = ? LIMIT 1`, [instrumentKey]);
  const [holdings] = await db.execute(`SELECT holding_id, quantity, invested_value FROM holdings WHERE user_id = ? AND instrument_key = ? LIMIT 1`, [userId, instrumentKey]);
  return { stockPrice: Number(stocks[0]?.price), holding: holdings[0] || null };
}

async function cleanup(db, orderIds = []) {
  if (orderIds.length) {
    const placeholders = orderIds.map(() => "?").join(",");
    await db.execute(`DELETE FROM order_transaction_audit WHERE order_id IN (${placeholders})`, orderIds);
    await db.execute(`DELETE FROM orders WHERE order_id IN (${placeholders})`, orderIds);
  }
  await db.execute(`DELETE FROM order_idempotency WHERE user_id = ? AND idempotency_key LIKE 'phase4-%'`, [userId]);
}

test("Phase 4: DB price and idempotency", { skip: !canRun ? "Set PHASE4_TEST_USER_ID and PHASE4_TEST_INSTRUMENT_KEY to run integration tests." : false }, async () => {
  const { initDb, close: closeDb } = require("../detailStock/db");
  const { simulateOrder } = require("../detailStock/simulatedOrderService");
  const db = await getPool();
  await initDb();
  const before = await snapshotState(db);
  assert.ok(Number.isFinite(before.stockPrice) && before.stockPrice > 0);

  const idempotencyKey = key("same");
  const result1 = await simulateOrder({ userId, instrumentKey, transactionType: "BUY", quantity: 1, orderType: "MARKET", product: "CNC", limitPrice: null, idempotencyKey });
  const result2 = await simulateOrder({ userId, instrumentKey, transactionType: "BUY", quantity: 1, orderType: "MARKET", product: "CNC", limitPrice: null, idempotencyKey });

  assert.equal(result1.success, true);
  assert.equal(result2.orderId, result1.orderId);
  assert.equal(result2.price, before.stockPrice);

  await cleanup(db, [result1.orderId]);
  await db.end();
  await closeDb();
});

test("Phase 4: concurrent BUY requests remain transaction-safe", { skip: !canRun ? "Set PHASE4_TEST_USER_ID and PHASE4_TEST_INSTRUMENT_KEY to run integration tests." : false }, async () => {
  const { initDb, close: closeDb } = require("../detailStock/db");
  const { simulateOrder } = require("../detailStock/simulatedOrderService");
  const db = await getPool();
  await initDb();
  const before = await snapshotState(db);
  const keys = [key("concurrent-a"), key("concurrent-b")];
  const results = await Promise.all(keys.map((idempotencyKey) => simulateOrder({ userId, instrumentKey, transactionType: "BUY", quantity: 1, orderType: "MARKET", product: "CNC", limitPrice: null, idempotencyKey })));

  assert.equal(results.filter((item) => item.success).length, 2);
  const after = await snapshotState(db);
  assert.equal(Number(after.holding?.quantity || 0), Number(before.holding?.quantity || 0) + 2);

  await cleanup(db, results.map((item) => item.orderId));

  if (before.holding) {
    await db.execute(
      `UPDATE holdings SET quantity = ?, invested_value = ? WHERE holding_id = ?`,
      [before.holding.quantity, before.holding.invested_value, before.holding.holding_id],
    );
  } else {
    await db.execute(
      `DELETE FROM holdings WHERE user_id = ? AND instrument_key = ?`,
      [userId, instrumentKey],
    );
  }
  await db.end();
  await closeDb();
});