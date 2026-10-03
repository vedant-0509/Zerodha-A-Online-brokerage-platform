const { connectMongoDB, getMongoDB } = require("../config/mongodb");
const { getHistoricalNAV } = require("./mfapiService");

const RATING_SOURCE = "Internal MF Rating Model";
const RISK_SOURCE = "Internal NAV Risk Model";

const MIN_HISTORY_DAYS = 180;

const RISK_THRESHOLDS = {
  LOW: 0.03,
  LOW_TO_MODERATE: 0.07,
  MODERATE: 0.12,
  MODERATELY_HIGH: 0.18,
  HIGH: 0.25,
};

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  if (!values.length) return null;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function standardDeviation(values) {
  if (values.length < 2) return null;

  const avg = mean(values);

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - avg, 2),
      0
    ) /
    (values.length - 1);

  return Math.sqrt(variance);
}

function calculateDailyReturns(navRows) {
  const rows = navRows
    .map((row) => ({
      date: row.date,
      nav: safeNumber(row.nav),
    }))
    .filter(
      (row) =>
        row.nav !== null &&
        row.nav > 0
    )
    .sort((a, b) =>
      String(a.date).localeCompare(
        String(b.date)
      )
    );

  const returns = [];

  for (
    let i = 1;
    i < rows.length;
    i += 1
  ) {
    const previous = rows[i - 1].nav;
    const current = rows[i].nav;

    if (!previous || !current) {
      continue;
    }

    const dailyReturn =
      current / previous - 1;

    if (Number.isFinite(dailyReturn)) {
      returns.push(dailyReturn);
    }
  }

  return returns;
}

function calculateAnnualizedVolatility(navRows) {
  const dailyReturns =
    calculateDailyReturns(navRows);

  if (
    dailyReturns.length <
    MIN_HISTORY_DAYS
  ) {
    return null;
  }

  const dailyStdDev =
    standardDeviation(dailyReturns);

  if (dailyStdDev === null) {
    return null;
  }

  return (
    dailyStdDev *
    Math.sqrt(252)
  );
}

function calculateRisk(volatility) {
  if (volatility === null) {
    return null;
  }

  if (
    volatility <
    RISK_THRESHOLDS.LOW
  ) {
    return "Low";
  }

  if (
    volatility <
    RISK_THRESHOLDS.LOW_TO_MODERATE
  ) {
    return "Low to Moderate";
  }

  if (
    volatility <
    RISK_THRESHOLDS.MODERATE
  ) {
    return "Moderate";
  }

  if (
    volatility <
    RISK_THRESHOLDS.MODERATELY_HIGH
  ) {
    return "Moderately High";
  }

  if (
    volatility <
    RISK_THRESHOLDS.HIGH
  ) {
    return "High";
  }

  return "Very High";
}

function calculatePerformanceScore(row) {
  const r1 = safeNumber(
    row.return1y ??
      row.return_1y
  );

  const r3 = safeNumber(
    row.return3y ??
      row.return_3y
  );

  const r5 = safeNumber(
    row.return5y ??
      row.return_5y
  );

  const values = [];

  if (r1 !== null) {
    values.push({
      value: r1,
      weight: 0.20,
    });
  }

  if (r3 !== null) {
    values.push({
      value: r3,
      weight: 0.35,
    });
  }

  if (r5 !== null) {
    values.push({
      value: r5,
      weight: 0.45,
    });
  }

  if (!values.length) {
    return null;
  }

  const totalWeight =
    values.reduce(
      (sum, item) =>
        sum + item.weight,
      0
    );

  return (
    values.reduce(
      (sum, item) =>
        sum +
        item.value *
          item.weight,
      0
    ) / totalWeight
  );
}

function percentileRank(
  value,
  sortedValues
) {
  if (!sortedValues.length) {
    return null;
  }

  if (sortedValues.length === 1) {
    return 1;
  }

  let below = 0;

  for (
    const current of sortedValues
  ) {
    if (current < value) {
      below += 1;
    }
  }

  return (
    below /
    (sortedValues.length - 1)
  );
}

function percentileToStars(
  percentile
) {
  if (percentile === null) {
    return null;
  }

  if (percentile >= 0.90) {
    return 5;
  }

  if (percentile >= 0.675) {
    return 4;
  }

  if (percentile >= 0.325) {
    return 3;
  }

  if (percentile >= 0.10) {
    return 2;
  }

  return 1;
}

async function getSchemeHistoricalNAV(
  schemeCode
) {
  const today = new Date();

  const start = new Date(today);

  start.setFullYear(
    start.getFullYear() - 5
  );

  start.setDate(
    start.getDate() - 15
  );

  return getHistoricalNAV(
    schemeCode,
    start
      .toISOString()
      .slice(0, 10),
    today
      .toISOString()
      .slice(0, 10)
  );
}

async function calculateFundRisk(
  scheme,
  providedHistory = null
) {
  /*
   * Support both the old MySQL field name
   * and the new MongoDB field name.
   */
  const schemeCode =
    scheme?.schemeCode ??
    scheme?.scheme_code;

  const historicalNAV =
    Array.isArray(providedHistory)
      ? providedHistory
      : await getSchemeHistoricalNAV(
          schemeCode
        );

  if (
    !Array.isArray(
      historicalNAV
    ) ||
    historicalNAV.length <
      MIN_HISTORY_DAYS
  ) {
    return {
      risk: null,
      volatility: null,
    };
  }

  const volatility =
    calculateAnnualizedVolatility(
      historicalNAV
    );

  const risk =
    calculateRisk(volatility);

  return {
    risk,
    volatility,
  };
}

/*
|--------------------------------------------------------------------------
| Calculate ratings from MongoDB
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Rating calculation uses only values already stored
| in mfSchemes. It does NOT perform another provider
| history sweep.
|
*/

async function calculateAllRatings() {
  await connectMongoDB();

  const db = getMongoDB();

  const schemes =
    db.collection("mfSchemes");

  const funds =
    await schemes
      .find({
        isActive: true,
      })
      .sort({
        mysqlId: 1,
        schemeCode: 1,
      })
      .toArray();

  if (!funds.length) {
    return {
      processed: 0,
      updated: 0,
      failed: 0,
    };
  }

  const performance =
    funds.map((fund) => ({
      ...fund,
      performanceScore:
        calculatePerformanceScore(
          fund
        ),
    }));

  /*
   * Group funds by fund type + category.
   */
  const groups = new Map();

  for (
    const fund of performance
  ) {
    if (
      fund.performanceScore ===
      null
    ) {
      continue;
    }

    const groupKey =
      `${fund.fundType || "UNKNOWN"}|` +
      `${fund.schemeCategory || "UNKNOWN"}`;

    if (!groups.has(groupKey)) {
      groups.set(
        groupKey,
        []
      );
    }

    groups
      .get(groupKey)
      .push(fund);
  }

  /*
   * Calculate percentile-based rating.
   */
  const ratingMap = new Map();

  for (
    const group of groups.values()
  ) {
    const sortedScores =
      group
        .map(
          (fund) =>
            fund.performanceScore
        )
        .sort(
          (a, b) => a - b
        );

    for (
      const fund of group
    ) {
      const percentile =
        percentileRank(
          fund.performanceScore,
          sortedScores
        );

      ratingMap.set(
        fund._id.toString(),
        percentileToStars(
          percentile
        )
      );
    }
  }

  let updated = 0;
  let failed = 0;

  for (
    const fund of funds
  ) {
    try {
      const rating =
        ratingMap.get(
          fund._id.toString()
        ) || null;

      const update = {
        rating,
        ratingSource:
          RATING_SOURCE,
        ratingUpdatedAt:
          new Date(),
        updatedAt:
          new Date(),
      };

      /*
       * Preserve existing behavior:
       * only update risk metadata if risk
       * already exists.
       */
      if (
        fund.risk !== null &&
        fund.risk !== undefined
      ) {
        update.riskSource =
          RISK_SOURCE;

        update.riskUpdatedAt =
          new Date();
      }

      const result =
        await schemes.updateOne(
          {
            _id: fund._id,
            schemeCode:
              fund.schemeCode,
            isActive: true,
          },
          {
            $set: update,
          }
        );

      if (
        result.matchedCount === 1
      ) {
        updated += 1;
      }
    } catch (error) {
      failed += 1;

      console.error(
        `[MF RATING] Failed ${fund.schemeCode}: ${error.message}`
      );
    }
  }

  return {
    processed: funds.length,
    updated,
    failed,
  };
}

module.exports = {
  calculateAllRatings,
  calculateFundRisk,
  calculateRisk,
  calculatePerformanceScore,
};