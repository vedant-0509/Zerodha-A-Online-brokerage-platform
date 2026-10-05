require('dotenv').config();
const { connectMongoDB, getMongoDB, closeMongoDB } = require('../config/mongodb');
const fs = require('fs');
const path = require('path');

const requiredCollections = [
  'users','instruments','marketStocks','mfSchemes','holdings','watchlist','orders','mfOrders','mfHoldings',
  'orderIdempotency','orderTransactionAudit','detailStockDailyCloses','indexClosingPrices','marketGainerloser',
  'marketNews','stockFinancials','stockFundamentals','stockShareholding','marketUpdateLog'
];

const requiredIndexes = [
  ['users', { email: 1 }, true],
  ['instruments', { instrumentKey: 1 }, true],
  ['holdings', { userId: 1, instrumentKey: 1 }, true],
  ['watchlist', { userId: 1, instrumentKey: 1 }, true],
  ['orderIdempotency', { userId: 1, idempotencyKey: 1 }, true],
];

function sameKeys(actual, expected) {
  const a = Object.entries(actual || {});
  const e = Object.entries(expected || {});
  return a.length === e.length && e.every(([k, v], i) => a[i] && a[i][0] === k && a[i][1] === v);
}

async function duplicateGroups(db, collection, fields) {
  const group = {};
  for (const f of fields) group[f] = `$${f}`;
  return db.collection(collection).aggregate([
    { $group: { _id: group, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 1 }
  ]).toArray();
}

async function main() {
  let failures = 0;
  const pass = (m) => console.log(`[PASS] ${m}`);
  const fail = (m) => { console.log(`[FAIL] ${m}`); failures++; };

  try {
    await connectMongoDB();
    const db = getMongoDB();

    try {
      await db.command({ ping: 1 });
      pass(`MongoDB ping — database=${db.databaseName}`);
    } catch (e) {
      fail(`MongoDB ping — ${e.message}`);
    }

    const collections = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name)
    );
    for (const c of requiredCollections) {
      collections.has(c) ? pass(`Required collection: ${c}`) : fail(`Required collection: ${c}`);
    }

    for (const [collection, keys, unique] of requiredIndexes) {
      const indexes = await db.collection(collection).listIndexes().toArray();
      const match = indexes.find(idx => sameKeys(idx.key, keys));
      if (match && Boolean(match.unique) === unique) {
        pass(`Required index: ${collection}.${match.name} (keys match, unique=${unique})`);
      } else {
        fail(`Required index keys: ${collection}.${JSON.stringify(keys)} unique=${unique}`);
      }
    }

    const dupChecks = [
      ['users', ['email'], 'Duplicate user emails'],
      ['instruments', ['instrumentKey'], 'Duplicate instrument keys'],
      ['holdings', ['userId','instrumentKey'], 'Duplicate holdings user/instrument pairs'],
      ['watchlist', ['userId','instrumentKey'], 'Duplicate watchlist user/instrument pairs'],
    ];
    for (const [collection, fields, label] of dupChecks) {
      const dup = await duplicateGroups(db, collection, fields);
      dup.length ? fail(`${label} — duplicate groups found`) : pass(`${label} — 0 duplicate groups`);
    }

    for (const [collection, expected] of [
      ['instruments',1], ['marketStocks',1], ['mfSchemes',1],
      ['stockFinancials',1], ['stockFundamentals',1], ['stockShareholding',1]
    ]) {
      const count = await db.collection(collection).countDocuments();
      count >= expected
        ? pass(`Data present: ${collection} — ${count} documents`)
        : fail(`Data present: ${collection} — ${count} documents`);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    deps.mongodb
      ? pass(`MongoDB driver dependency present — mongodb=${deps.mongodb}`)
      : fail('MongoDB driver dependency missing');

    if (deps.mysql) fail(`MySQL runtime driver present — mysql=${deps.mysql}`);
    if (deps.mysql2) fail(`MySQL runtime driver present — mysql2=${deps.mysql2}`);
    if (!deps.mysql && !deps.mysql2) pass('MySQL runtime driver absent');

    console.log(
      failures
        ? `MongoDB Phase 7 re-baseline: ${failures} failure(s).`
        : 'MongoDB Phase 7 re-baseline complete — all checks passed.'
    );
    process.exitCode = failures ? 1 : 0;
  } catch (err) {
    console.error('[ERROR] MongoDB Phase 7 verification failed:', err);
    process.exitCode = 1;
  } finally {
    try { await closeMongoDB(); } catch {}
  }
}

main();
