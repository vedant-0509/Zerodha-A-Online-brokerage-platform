const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MF = path.join(ROOT, 'mutualfunds');
const read = (file) => fs.readFileSync(path.join(MF, file), 'utf8');

function loadEnvFile(file) {
  const values = {};
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return values;
}

async function dbConnection() {
  const mysql = require('mysql2/promise');
  const env = loadEnvFile(path.join(MF, '.env'));
  return mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || 'root',
    database: env.DB_NAME || 'zerodha',
  });
}

test('Phase 5 source: one bulk latest-NAV provider call', () => {
  const source = read('mfSyncService.js');
  assert.equal((source.match(/await getLatestFunds\(\)/g) || []).length, 1);
  assert.match(source, /WHERE is_active = 1/);
});

test('Phase 5 source: returns are incremental by NAV date', () => {
  const source = read('mfSyncService.js');
  assert.match(source, /returns_for_nav_date IS NULL OR returns_for_nav_date <> nav_date/);
  assert.match(source, /navChangedSameDate/);
  assert.match(source, /shouldRecalculateDerivedMetrics/);
  assert.match(source, /returns_for_nav_date = CASE/);
});

test('Phase 5 source: same-day NAV correction invalidates derived metrics', () => {
  const source = read('mfSyncService.js');
  assert.match(source, /return_1y_nav_date = CASE/);
  assert.match(source, /return_3y_nav_date = CASE/);
  assert.match(source, /return_5y_nav_date = CASE/);
  assert.match(source, /risk_source = CASE/);
  assert.match(source, /risk_updated_at = CASE/);
});

test('Phase 5 source: scheduler is 23:15 Asia/Kolkata and startup recovery is guarded', () => {
  const source = read('mfSyncScheduler.js');
  assert.match(source, /15 23 \* \* 1-5/);
  assert.match(source, /Asia\/Kolkata/);
  assert.match(source, /MF_SYNC_STARTUP_RECOVERY/);
  assert.match(source, /isPastScheduledTimeToday\(\)/);
  assert.match(source, /hasTodaysSyncSucceeded\(DAILY_SYNC_NAME/);
});

test('Phase 5 source: daily recovery does not use an attempted-today block', () => {
  const source = read('mfSyncScheduler.js');
  assert.doesNotMatch(source, /hasAttemptedToday\(/);
  assert.match(source, /FAILED\/RUNNING\/PENDING states are recoverable/);
});

test('Phase 5 source: sync monitoring covers daily, NAV, returns and rating stages', () => {
  const scheduler = read('mfSyncScheduler.js');
  const controller = read('mutualFundController.js');
  const status = read('mfSyncStatusService.js');
  assert.match(scheduler, /mf_returns_sync/);
  assert.match(scheduler, /mf_rating_sync/);
  assert.match(status, /getAllSyncStatuses/);
  assert.match(controller, /getAllSyncStatuses/);
});

test('Phase 5 source: manual sync and monitoring are ADMIN-only', () => {
  const routes = read('mutualFundRoutes.js');
  assert.match(routes, /router\.post\('\/sync-now', authenticateToken, requireRole\('ADMIN'\)/);
  assert.match(routes, /router\.get\('\/sync-status', authenticateToken, requireRole\('ADMIN'\)/);
  assert.match(routes, /router\.post\('\/sync', authenticateToken, requireRole\('ADMIN'\)/);
  assert.match(routes, /router\.post\('\/sync-returns', authenticateToken, requireRole\('ADMIN'\)/);
});

test('Phase 5 migration creates monitoring rows', () => {
  const migration = fs.readFileSync(path.join(MF, 'sql', '008_phase5_mf_sync_monitoring.sql'), 'utf8');
  assert.match(migration, /mf_returns_sync/);
  assert.match(migration, /mf_rating_sync/);
  assert.match(migration, /INSERT IGNORE/);
});

test('Phase 5 DB: sync monitoring table and stage rows exist', async () => {
  const db = await dbConnection();
  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'mf_sync_status'");
    assert.equal(tables.length, 1, 'mf_sync_status table is missing; run 008_phase5_mf_sync_monitoring.sql');

    const [rows] = await db.query(
      `SELECT sync_name, status
       FROM mf_sync_status
       WHERE sync_name IN ('mf_daily_sync','mf_nav_sync','mf_returns_sync','mf_rating_sync')
       ORDER BY sync_name`
    );
    assert.equal(rows.length, 4, 'Expected four Phase 5 sync status rows');
    assert.deepEqual(rows.map((row) => row.sync_name), [
      'mf_daily_sync',
      'mf_nav_sync',
      'mf_rating_sync',
      'mf_returns_sync',
    ]);
  } finally {
    await db.end();
  }
});

test('Phase 5 DB: only active schemes form the sync universe and scheme codes are unique', async () => {
  const db = await dbConnection();
  try {
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS active_count,
              COUNT(DISTINCT scheme_code) AS distinct_active_codes
       FROM mf_schemes
       WHERE is_active = 1`
    );
    assert.ok(Number(counts.active_count) > 0, 'No active mutual-fund schemes are configured');
    assert.equal(Number(counts.active_count), Number(counts.distinct_active_codes), 'Duplicate active scheme_code values found');
  } finally {
    await db.end();
  }
});

test('Phase 5 DB: return audit columns exist for incremental processing', async () => {
  const db = await dbConnection();
  try {
    const [rows] = await db.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'mf_schemes'
         AND COLUMN_NAME IN (
           'returns_for_nav_date', 'return_1y_nav_date', 'return_3y_nav_date',
           'return_5y_nav_date', 'risk_source', 'risk_updated_at'
         )`
    );
    const names = new Set(rows.map((row) => row.COLUMN_NAME));
    for (const required of [
      'returns_for_nav_date', 'return_1y_nav_date', 'return_3y_nav_date',
      'return_5y_nav_date', 'risk_source', 'risk_updated_at'
    ]) {
      assert.ok(names.has(required), `Missing mf_schemes.${required}`);
    }
  } finally {
    await db.end();
  }
});
