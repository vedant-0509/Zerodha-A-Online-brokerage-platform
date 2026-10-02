const pool = require('./db');

const {
  getLatestFunds,
  getSchemeHistory,
  calculateReturns,
  parseNavDate,
  subtractYears,
  subtractDays,
  addDays,
  roundNav,
} = require('./mfapiService');

const {
  calculateRisk,
} = require('./mfRatingRiskService');

const NAV_LOCK_NAME = 'mf_latest_nav_sync';
const RETURNS_LOCK_NAME = 'mf_returns_sync';

const CONCURRENCY = Math.max(
  1,
  Number(process.env.MF_SYNC_CONCURRENCY || process.env.MF_RETURN_CONCURRENCY || 10)
);

const DELAY_MS = Math.max(
  0,
  Number(process.env.MF_SYNC_DELAY_MS || process.env.MF_RETURN_DELAY_MS || 0)
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireLock(connection, name, timeoutSeconds = 0) {
  const [rows] = await connection.query(
    'SELECT GET_LOCK(?, ?) AS acquired',
    [name, timeoutSeconds]
  );
  return Number(rows[0]?.acquired) === 1;
}

async function releaseLock(connection, name) {
  try {
    await connection.query('SELECT RELEASE_LOCK(?)', [name]);
  } catch (_) {
    // Non-fatal.
  }
}

function normalizeLatestFund(fund) {
  return {
    schemeCode: Number(fund.schemeCode ?? fund.scheme_code),
    nav: roundNav(fund.nav ?? fund.currentNav ?? fund.current_nav),
    navDate: parseNavDate(fund.date ?? fund.navDate ?? fund.nav_date),
    schemeName: fund.schemeName ?? fund.scheme_name ?? null,
    fundHouse: fund.fundHouse ?? fund.fund_house ?? null,
    schemeType: fund.schemeType ?? fund.scheme_type ?? null,
    schemeCategory: fund.schemeCategory ?? fund.scheme_category ?? null,
    isinGrowth: fund.isinGrowth ?? fund.isin_growth ?? null,
    isinDivReinvestment: fund.isinDivReinvestment ?? fund.isin_div_reinvestment ?? null,
  };
}

async function syncLatestNAV() {
  let connection = null;
  let locked = false;

  try {
    connection = await pool.getConnection();
    locked = await acquireLock(connection, NAV_LOCK_NAME, 0);

    if (!locked) {
      return {
        success: true,
        skipped: true,
        reason: 'another NAV sync is running',
        fetched: 0,
        updated: 0,
        unchanged: 0,
        invalid: 0,
        failed: 0,
        newNavDays: 0,
        sameNavDays: 0,
        missingActive: 0,
      };
    }

    const [activeRows] = await connection.query(
      `SELECT id, scheme_code, current_nav, nav_date
       FROM mf_schemes
       WHERE is_active = 1
       ORDER BY id ASC`
    );

    if (!activeRows.length) {
      throw new Error('No active mutual funds configured');
    }

    console.log(`[MF NAV] Active DB universe: ${activeRows.length}`);

    const activeByCode = new Map(
      activeRows.map((row) => [Number(row.scheme_code), row])
    );

    console.log('[MF NAV] Downloading latest NAV data...');
    const providerFunds = await getLatestFunds();

    if (!Array.isArray(providerFunds) || !providerFunds.length) {
      throw new Error('NAV provider returned zero records');
    }

    const bySchemeCode = new Map();
    for (const raw of providerFunds) {
      const fund = normalizeLatestFund(raw);
      if (!Number.isFinite(fund.schemeCode) || fund.schemeCode <= 0) continue;
      const previous = bySchemeCode.get(fund.schemeCode);
      if (!previous || String(fund.navDate) > String(previous.navDate)) {
        bySchemeCode.set(fund.schemeCode, fund);
      }
    }

    const selectedFunds = [];
    let missingActive = 0;

    for (const active of activeRows) {
      const fund = bySchemeCode.get(Number(active.scheme_code));
      if (fund) selectedFunds.push(fund);
      else missingActive += 1;
    }

    console.log(`[MF NAV] Provider records: ${providerFunds.length}`);
    console.log(`[MF NAV] Active records selected: ${selectedFunds.length}/${activeRows.length}`);

    let updated = 0;
    let unchanged = 0;
    let invalid = 0;
    let failed = 0;
    let newNavDays = 0;
    let sameNavDays = 0;
    let latestActiveNavDate = null;

    for (const fund of selectedFunds) {
      if (
        !Number.isFinite(fund.schemeCode) ||
        fund.schemeCode <= 0 ||
        !Number.isFinite(fund.nav) ||
        fund.nav <= 0 ||
        !fund.navDate
      ) {
        invalid += 1;
        continue;
      }

      if (!latestActiveNavDate || fund.navDate > latestActiveNavDate) {
        latestActiveNavDate = fund.navDate;
      }

      const existing = activeByCode.get(fund.schemeCode);
      const existingDate = parseNavDate(existing?.nav_date);

      if (existingDate && fund.navDate < existingDate) {
        unchanged += 1;
        continue;
      }

      try {
        const isNewDate = !existingDate || fund.navDate > existingDate;
        const isSameDate = existingDate && fund.navDate === existingDate;
        const existingNav = Number(existing?.current_nav);
        const navChangedSameDate =
          isSameDate &&
          Number.isFinite(existingNav) &&
          Math.abs(existingNav - fund.nav) > 0.0000001;
        const shouldRecalculateDerivedMetrics =
          isNewDate || navChangedSameDate;

        const [result] = await connection.query(
          `UPDATE mf_schemes
           SET
             scheme_name = COALESCE(?, scheme_name),
             isin_growth = COALESCE(?, isin_growth),
             isin_div_reinvestment = COALESCE(?, isin_div_reinvestment),

             previous_nav = CASE
               WHEN ? = 1 AND current_nav IS NOT NULL AND current_nav > 0
               THEN current_nav
               ELSE previous_nav
             END,

             previous_nav_date = CASE
               WHEN ? = 1 AND nav_date IS NOT NULL
               THEN nav_date
               ELSE previous_nav_date
             END,

             return_1d = CASE
               WHEN ? = 1 AND previous_nav IS NOT NULL AND previous_nav > 0
               THEN ROUND(((? - previous_nav) / previous_nav) * 100, 4)
               ELSE return_1d
             END,

             return_1d_nav_date = CASE
               WHEN ? = 1 THEN ?
               ELSE return_1d_nav_date
             END,

             returns_for_nav_date = CASE
               WHEN ? = 1 THEN NULL
               ELSE returns_for_nav_date
             END,

             return_1y_nav_date = CASE
               WHEN ? = 1 THEN NULL
               ELSE return_1y_nav_date
             END,

             return_3y_nav_date = CASE
               WHEN ? = 1 THEN NULL
               ELSE return_3y_nav_date
             END,

             return_5y_nav_date = CASE
               WHEN ? = 1 THEN NULL
               ELSE return_5y_nav_date
             END,

             risk_source = CASE
               WHEN ? = 1 THEN NULL
               ELSE risk_source
             END,

             risk_updated_at = CASE
               WHEN ? = 1 THEN NULL
               ELSE risk_updated_at
             END,

             current_nav = ?,
             nav_date = ?,

             updated_at = CASE
               WHEN current_nav <> ? OR nav_date <> ?
               THEN NOW()
               ELSE updated_at
             END

           WHERE scheme_code = ?
             AND is_active = 1`,
          [
            fund.schemeName,
            fund.isinGrowth,
            fund.isinDivReinvestment,
            isNewDate ? 1 : 0,
            isNewDate ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            fund.nav,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            fund.navDate,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            shouldRecalculateDerivedMetrics ? 1 : 0,
            fund.nav,
            fund.navDate,
            fund.nav,
            fund.navDate,
            fund.schemeCode,
          ]
        );

        if (result.affectedRows) updated += result.affectedRows;
        else unchanged += 1;

        if (isNewDate) newNavDays += 1;
        else if (isSameDate && !navChangedSameDate) sameNavDays += 1;
      } catch (error) {
        failed += 1;
        console.error(`[MF NAV] ${fund.schemeCode}: ${error.message}`);
      }
    }

    if (missingActive > 0) {
      console.warn(`[MF NAV] ${missingActive} active DB funds were not present in the provider report.`);
    }

    console.log(
      `[MF NAV] active=${activeRows.length}, provider=${providerFunds.length}, ` +
      `selected=${selectedFunds.length}, updated=${updated}, unchanged=${unchanged}, ` +
      `newDate=${newNavDays}, sameDate=${sameNavDays}, invalid=${invalid}, failed=${failed}, missing=${missingActive}`
    );

    return {
      success: true,
      skipped: false,
      fetched: selectedFunds.length,
      providerFetched: providerFunds.length,
      activeFunds: activeRows.length,
      updated,
      unchanged,
      invalid,
      failed,
      newNavDays,
      sameNavDays,
      missingActive,
      latestActiveNavDate,
    };
  } finally {
    if (connection && locked) await releaseLock(connection, NAV_LOCK_NAME);
    if (connection) connection.release();
  }
}

async function calculateSchemeReturns(scheme, connection) {
  const currentNav = roundNav(scheme.current_nav);
  const currentDate = parseNavDate(scheme.nav_date);

  if (!Number.isFinite(currentNav) || currentNav <= 0 || !currentDate) {
    return { success: false, reason: 'Invalid current NAV/date' };
  }

  const start = subtractDays(subtractYears(currentDate, 5), 10);
  const end = addDays(currentDate, 1);
  const history = await getSchemeHistory(scheme.scheme_code, start, end);

  if (!history.length) {
    return { success: false, reason: 'No historical NAV' };
  }

  const returns = calculateReturns(history, currentNav, currentDate);

  const riskVolatility = calculateVolatility(history);
  const risk = calculateRisk(riskVolatility, scheme.fund_type, scheme.scheme_category);

  return {
    success: true,
    currentDate,
    ...returns,
    risk,
    volatility: riskVolatility,
  };
}

function calculateVolatility(history) {
  const values = history
    .map((row) => ({ date: row.date, nav: Number(row.nav) }))
    .filter((row) => Number.isFinite(row.nav) && row.nav > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (values.length < 181) return null;

  const dailyReturns = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1].nav;
    const curr = values[i].nav;
    if (prev > 0 && curr > 0) dailyReturns.push(curr / prev - 1);
  }

  if (dailyReturns.length < 180) return null;

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (dailyReturns.length - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  return Number.isFinite(volatility) ? Number(volatility.toFixed(6)) : null;
}

async function syncAllReturns() {
  let connection = null;
  let locked = false;

  try {
    connection = await pool.getConnection();
    locked = await acquireLock(connection, RETURNS_LOCK_NAME, 0);

    if (!locked) {
      return {
        success: true,
        skipped: true,
        reason: 'another return sync is running',
        total: 0,
        processed: 0,
        updated: 0,
        failed: 0,
      };
    }

    const [schemes] = await connection.query(
      `SELECT
         id,
         scheme_code,
         current_nav,
         nav_date,
         fund_type,
         scheme_category
       FROM mf_schemes
       WHERE is_active = 1
         AND current_nav IS NOT NULL
         AND current_nav > 0
         AND nav_date IS NOT NULL
         AND (returns_for_nav_date IS NULL OR returns_for_nav_date <> nav_date)
       ORDER BY id ASC`
    );

    console.log(`[MF RETURNS] Schemes requiring recalculation: ${schemes.length}`);

    let cursor = 0;
    let processed = 0;
    let updated = 0;
    let failed = 0;

    async function worker() {
      while (true) {
        const index = cursor++;
        if (index >= schemes.length) return;

        const scheme = schemes[index];

        try {
          const result = await calculateSchemeReturns(scheme, connection);

          if (!result.success) {
            failed += 1;
            console.warn(`[MF RETURNS] ${scheme.scheme_code}: ${result.reason}`);
          } else {
            await connection.query(
              `UPDATE mf_schemes
               SET
                 return_1y = ?,
                 return_3y = ?,
                 return_5y = ?,
                 returns_for_nav_date = ?,
                 return_1y_nav_date = ?,
                 return_3y_nav_date = ?,
                 return_5y_nav_date = ?,
                 risk = ?,
                 risk_source = ?,
                 risk_updated_at = NOW(),
                 return_updated_at = NOW(),
                 updated_at = NOW()
               WHERE id = ?
                 AND is_active = 1`,
              [
                result.return1Y,
                result.return3Y,
                result.return5Y,
                result.currentDate,
                result.nav1YDate,
                result.nav3YDate,
                result.nav5YDate,
                result.risk,
                'Internal NAV Risk Model',
                scheme.id,
              ]
            );
            updated += 1;
          }
        } catch (error) {
          failed += 1;
          console.error(`[MF RETURNS] ${scheme.scheme_code}: ${error.message}`);
        }

        processed += 1;

        if (processed % 100 === 0 || processed === schemes.length) {
          console.log(
            `[MF RETURNS] progress=${processed}/${schemes.length}, updated=${updated}, failed=${failed}`
          );
        }

        if (DELAY_MS) await sleep(DELAY_MS);
      }
    }

    if (schemes.length) {
      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, schemes.length) },
          worker
        )
      );
    }

    console.log(
      `[MF RETURNS] total=${schemes.length}, processed=${processed}, updated=${updated}, failed=${failed}`
    );

    return {
      success: true,
      skipped: false,
      total: schemes.length,
      processed,
      updated,
      failed,
    };
  } finally {
    if (connection && locked) await releaseLock(connection, RETURNS_LOCK_NAME);
    if (connection) connection.release();
  }
}

module.exports = {
  syncLatestNAV,
  syncAllReturns,
  calculateSchemeReturns,
};
