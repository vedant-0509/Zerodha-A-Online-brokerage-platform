require('dotenv').config();
const { connectMongoDB, getMongoDB, closeMongoDB } = require('../config/mongodb');

const indexes = [
  { collection: 'users', keys: { email: 1 }, unique: true },
  { collection: 'instruments', keys: { instrumentKey: 1 }, unique: true },
  { collection: 'holdings', keys: { userId: 1, instrumentKey: 1 }, unique: true },
  { collection: 'watchlist', keys: { userId: 1, instrumentKey: 1 }, unique: true },
  { collection: 'orderIdempotency', keys: { userId: 1, idempotencyKey: 1 }, unique: true },
];

function sameKeys(actual, expected) {
  const a = Object.entries(actual || {});
  const e = Object.entries(expected || {});
  return a.length === e.length && e.every(([k, v], i) => a[i] && a[i][0] === k && a[i][1] === v);
}

async function main() {
  await connectMongoDB();
  const db = getMongoDB();
  console.log('MongoDB Phase 7 index verification/creation starting...');

  let failures = 0;
  for (const spec of indexes) {
    try {
      const existing = await db.collection(spec.collection).listIndexes().toArray();
      const match = existing.find(idx => sameKeys(idx.key, spec.keys));

      if (match) {
        if (Boolean(match.unique) !== Boolean(spec.unique)) {
          console.log(`[FAIL] ${spec.collection}: existing index ${match.name} has unique=${match.unique}, expected unique=${spec.unique}`);
          failures++;
        } else {
          console.log(`[PASS] ${spec.collection}: equivalent index exists as ${match.name}`);
        }
        continue;
      }

      const name = Object.keys(spec.keys).map(k => `${k}_${spec.keys[k]}`).join('_');
      const created = await db.collection(spec.collection).createIndex(spec.keys, { unique: spec.unique, name });
      console.log(`[PASS] ${spec.collection}: created ${created}`);
    } catch (err) {
      console.log(`[FAIL] ${spec.collection}: ${err.message}`);
      failures++;
    }
  }

  if (failures) throw new Error(`${failures} index checks failed`);
  console.log('MongoDB Phase 7 indexes are ready.');
}

main().catch(err => {
  console.error('MongoDB Phase 7 index verification/creation failed.');
  console.error(err);
  process.exitCode = 1;
}).finally(async () => {
  try { await closeMongoDB(); } catch {}
});
