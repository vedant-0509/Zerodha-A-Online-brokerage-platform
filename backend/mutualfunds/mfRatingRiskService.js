const pool = require('./db');
const {
  getHistoricalNAV,
  roundNav
} = require('./mfapiService');

const RATING_SOURCE = 'Internal MF Rating Model';
const RISK_SOURCE = 'Internal NAV Risk Model';

/*
 * ---------------------------------------------------------
 * CONFIGURATION
 * ---------------------------------------------------------
 */

const MIN_HISTORY_DAYS = 180;

// Risk thresholds based on annualized volatility.
const RISK_THRESHOLDS = {
  LOW: 0.03,
  LOW_TO_MODERATE: 0.07,
  MODERATE: 0.12,
  MODERATELY_HIGH: 0.18,
  HIGH: 0.25
};

/*
 * ---------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------
 */

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  if (!values.length) return null;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return null;

  const avg = mean(values);

  const variance =
    values.reduce((sum, value) => {
      return sum + Math.pow(value - avg, 2);
    }, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/*
 * NAV observations are converted into daily returns.
 */
function calculateDailyReturns(navRows) {
  const rows = navRows
    .map(row => ({
      date: row.date,
      nav: safeNumber(row.nav)
    }))
    .filter(row => row.nav !== null && row.nav > 0)
    .sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      return da - db;
    });

  const returns = [];

  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1].nav;
    const current = rows[i].nav;

    if (!previous || !current) continue;

    const dailyReturn = current / previous - 1;

    if (Number.isFinite(dailyReturn)) {
      returns.push(dailyReturn);
    }
  }

  return returns;
}

/*
 * Annualized volatility.
 *
 * Mutual funds generally have ~252 trading observations/year,
 * but NAVs can be published on more calendar days. Using 252
 * gives us a standardized annualized volatility measure.
 */
function calculateAnnualizedVolatility(navRows) {
  const dailyReturns = calculateDailyReturns(navRows);

  if (dailyReturns.length < MIN_HISTORY_DAYS) {
    return null;
  }

  const dailyStdDev = standardDeviation(dailyReturns);

  if (dailyStdDev === null) {
    return null;
  }

  return dailyStdDev * Math.sqrt(252);
}

/*
 * ---------------------------------------------------------
 * RISK
 * ---------------------------------------------------------
 */

function calculateRisk(volatility, fundType, schemeCategory) {
  if (volatility === null) {
    return null;
  }

  /*
   * Base risk comes from annualized NAV volatility.
   */
  let risk;

  if (volatility < RISK_THRESHOLDS.LOW) {
    risk = 'Low';
  } else if (volatility < RISK_THRESHOLDS.LOW_TO_MODERATE) {
    risk = 'Low to Moderate';
  } else if (volatility < RISK_THRESHOLDS.MODERATE) {
    risk = 'Moderate';
  } else if (volatility < RISK_THRESHOLDS.MODERATELY_HIGH) {
    risk = 'Moderately High';
  } else if (volatility < RISK_THRESHOLDS.HIGH) {
    risk = 'High';
  } else {
    risk = 'Very High';
  }

  return risk;
}

/*
 * ---------------------------------------------------------
 * RETURN SCORE
 * ---------------------------------------------------------
 *
 * We calculate a performance score using:
 *
 * 1Y  = 20%
 * 3Y  = 35%
 * 5Y  = 45%
 *
 * Longer-term performance gets more weight.
 */

function calculatePerformanceScore(row) {
  const r1 = safeNumber(row.return_1y);
  const r3 = safeNumber(row.return_3y);
  const r5 = safeNumber(row.return_5y);

  const values = [];

  if (r1 !== null) {
    values.push({
      value: r1,
      weight: 0.20
    });
  }

  if (r3 !== null) {
    values.push({
      value: r3,
      weight: 0.35
    });
  }

  if (r5 !== null) {
    values.push({
      value: r5,
      weight: 0.45
    });
  }

  if (!values.length) {
    return null;
  }

  const totalWeight = values.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  return values.reduce(
    (sum, item) => sum + item.value * item.weight,
    0
  ) / totalWeight;
}

/*
 * ---------------------------------------------------------
 * RATING
 * ---------------------------------------------------------
 *
 * Rating is calculated RELATIVE TO OTHER FUNDS IN THE SAME
 * broad category.
 *
 * We use percentile ranking rather than hard-coded return
 * thresholds because:
 *
 * Equity returns cannot fairly be compared with debt returns.
 */

function percentileRank(value, sortedValues) {
  if (!sortedValues.length) {
    return null;
  }

  if (sortedValues.length === 1) {
    return 1;
  }

  let below = 0;

  for (const current of sortedValues) {
    if (current < value) {
      below++;
    }
  }

  return below / (sortedValues.length - 1);
}

function percentileToStars(percentile) {
  if (percentile === null) {
    return null;
  }

  /*
   * Approximation of a five-tier star distribution:
   *
   * Top 10%       -> 5
   * Next 22.5%    -> 4
   * Middle 35%    -> 3
   * Next 22.5%    -> 2
   * Bottom 10%    -> 1
   */

  if (percentile >= 0.90) return 5;
  if (percentile >= 0.675) return 4;
  if (percentile >= 0.325) return 3;
  if (percentile >= 0.10) return 2;

  return 1;
}

/*
 * ---------------------------------------------------------
 * FETCH HISTORICAL NAV
 * ---------------------------------------------------------
 */

async function getSchemeHistoricalNAV(schemeCode) {
  const today = new Date();

  const start = new Date(today);
  start.setFullYear(start.getFullYear() - 5);
  start.setDate(start.getDate() - 15);

  const startDate = start.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  const response = await getHistoricalNAV(
    schemeCode,
    startDate,
    endDate
  );

  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

/*
 * ---------------------------------------------------------
 * CALCULATE RISK FOR ONE FUND
 * ---------------------------------------------------------
 */

async function calculateFundRisk(scheme) {
  const historicalNAV = await getSchemeHistoricalNAV(
    scheme.scheme_code
  );

  if (historicalNAV.length < MIN_HISTORY_DAYS) {
    return {
      risk: null,
      volatility: null
    };
  }

  const volatility = calculateAnnualizedVolatility(
    historicalNAV
  );

  const risk = calculateRisk(
    volatility,
    scheme.fund_type,
    scheme.scheme_category
  );

  return {
    risk,
    volatility
  };
}

/*
 * ---------------------------------------------------------
 * CALCULATE ALL RATINGS
 * ---------------------------------------------------------
 */

async function calculateAllRatings(connection = pool) {
  const [funds] = await connection.query(`
    SELECT
      id,
      scheme_code,
      scheme_name,
      fund_type,
      scheme_category,
      return_1y,
      return_3y,
      return_5y
    FROM mf_schemes
    WHERE is_active = 1
  `);

  if (!funds.length) {
    return {
      processed: 0,
      updated: 0,
      failed: 0
    };
  }

  /*
   * First calculate performance scores.
   */
  const performance = funds.map(fund => ({
    ...fund,
    performanceScore: calculatePerformanceScore(fund)
  }));

  /*
   * Group funds by broad fund type + category.
   *
   * This prevents equity/debt/hybrid funds from competing
   * directly with one another.
   */
  const groups = new Map();

  for (const fund of performance) {
    if (fund.performanceScore === null) {
      continue;
    }

    const groupKey = [
      fund.fund_type || 'UNKNOWN',
      fund.scheme_category || 'UNKNOWN'
    ].join('|');

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey).push(fund);
  }

  /*
   * Calculate percentile and star rating.
   */
  const ratingMap = new Map();

  for (const [groupKey, group] of groups.entries()) {
    const sortedScores = group
      .map(fund => fund.performanceScore)
      .sort((a, b) => a - b);

    for (const fund of group) {
      const percentile = percentileRank(
        fund.performanceScore,
        sortedScores
      );

      const rating = percentileToStars(percentile);

      ratingMap.set(fund.id, rating);
    }
  }

  let updated = 0;
  let failed = 0;

  /*
   * Calculate risk individually.
   *
   * We intentionally limit concurrency to avoid hammering MFapi.
   */
  const concurrency = Math.max(
    1,
    Number(process.env.MF_RATING_CONCURRENCY || 3)
  );

  for (let i = 0; i < performance.length; i += concurrency) {
    const batch = performance.slice(
      i,
      i + concurrency
    );

    await Promise.all(
      batch.map(async fund => {
        try {
          const rating = ratingMap.get(fund.id) || null;

          const riskResult = await calculateFundRisk(fund);

          await connection.query(
            `
            UPDATE mf_schemes
            SET
              rating = ?,
              rating_source = ?,
              rating_updated_at = NOW(),
              risk = ?,
              risk_source = ?,
              risk_updated_at = NOW()
            WHERE id = ?
            `,
            [
              rating,
              RATING_SOURCE,
              riskResult.risk,
              RISK_SOURCE,
              fund.id
            ]
          );

          updated++;
        } catch (error) {
          failed++;

          console.error(
            `[MF RATING/RISK] Failed ${fund.scheme_code}:`,
            error.message
          );
        }
      })
    );

    console.log(
      `[MF RATING/RISK] Progress ${Math.min(
        i + batch.length,
        performance.length
      )}/${performance.length}`
    );
  }

  return {
    processed: funds.length,
    updated,
    failed
  };
}

module.exports = {
  calculateAllRatings,
  calculateFundRisk,
  calculateRisk,
  calculatePerformanceScore
};