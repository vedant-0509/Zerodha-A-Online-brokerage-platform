const {
  connectMongoDB,
  getMongoDB,
} = require("../config/mongodb");

const {
  getLatestFunds,
  getSchemeHistory,
  calculateReturns,
  parseNavDate,
  subtractYears,
  subtractDays,
  addDays,
  roundNav,
} = require("./mfapiService");

const {
  calculateRisk,
} = require("./mfRatingRiskService");

const NAV_LOCK_NAME = "mf_latest_nav_sync";
const RETURNS_LOCK_NAME = "mf_returns_sync";

const CONCURRENCY = Math.max(
  1,
  Number(
    process.env.MF_SYNC_CONCURRENCY ||
      process.env.MF_RETURN_CONCURRENCY ||
      10
  )
);

const DELAY_MS = Math.max(
  0,
  Number(
    process.env.MF_SYNC_DELAY_MS ||
      process.env.MF_RETURN_DELAY_MS ||
      0
  )
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function getDb() {
  await connectMongoDB();
  return getMongoDB();
}

/*
|--------------------------------------------------------------------------
| MongoDB advisory lock
|--------------------------------------------------------------------------
*/

async function acquireLock(name, timeoutMs = 0) {
  const db = await getDb();
  const collection = db.collection("mfSyncLocks");

  const owner = `${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.max(timeoutMs, 10 * 60 * 1000)
  );

  try {
    const result = await collection.updateOne(
      {
        _id: name,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $set: {
          owner,
          expiresAt,
          updatedAt: now,
        },
      }
    );

    if (result.matchedCount === 1) {
      return { acquired: true, owner };
    }

    await collection.insertOne({
      _id: name,
      owner,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    return { acquired: true, owner };
  } catch (error) {
    if (error.code === 11000) {
      return { acquired: false, owner: null };
    }

    throw error;
  }
}

async function releaseLock(name, owner) {
  if (!owner) return;

  try {
    const db = await getDb();

    await db.collection("mfSyncLocks").deleteOne({
      _id: name,
      owner,
    });
  } catch (_) {
    // Lock cleanup is non-fatal.
  }
}

/*
|--------------------------------------------------------------------------
| Normalize latest MFapi record
|--------------------------------------------------------------------------
*/

function normalizeLatestFund(fund) {
  return {
    schemeCode: Number(
      fund.schemeCode ??
        fund.scheme_code
    ),

    nav: roundNav(
      fund.nav ??
        fund.currentNav ??
        fund.current_nav
    ),

    navDate: parseNavDate(
      fund.date ??
        fund.navDate ??
        fund.nav_date
    ),

    schemeName:
      fund.schemeName ??
      fund.scheme_name ??
      null,

    fundHouse:
      fund.fundHouse ??
      fund.fund_house ??
      null,

    schemeType:
      fund.schemeType ??
      fund.scheme_type ??
      null,

    schemeCategory:
      fund.schemeCategory ??
      fund.scheme_category ??
      null,

    isinGrowth:
      fund.isinGrowth ??
      fund.isin_growth ??
      null,

    isinDivReinvestment:
      fund.isinDivReinvestment ??
      fund.isin_div_reinvestment ??
      null,
  };
}

/*
|--------------------------------------------------------------------------
| Latest NAV synchronization
|--------------------------------------------------------------------------
*/

async function syncLatestNAV() {
  let lock = null;

  try {
    const db = await getDb();
    const schemes = db.collection("mfSchemes");

    lock = await acquireLock(NAV_LOCK_NAME);

    if (!lock.acquired) {
      return {
        success: true,
        skipped: true,
        reason: "another NAV sync is running",
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

    const activeRows = await schemes
      .find({
        isActive: true,
      })
      .sort({
        mysqlId: 1,
        schemeCode: 1,
      })
      .toArray();

    if (!activeRows.length) {
      throw new Error(
        "No active mutual funds configured"
      );
    }

    console.log(
      `[MF NAV] Active DB universe: ${activeRows.length}`
    );

    const activeByCode = new Map(
      activeRows.map((row) => [
        Number(row.schemeCode),
        row,
      ])
    );

    console.log(
      "[MF NAV] Downloading latest NAV data..."
    );

    const providerFunds = await getLatestFunds();

    if (
      !Array.isArray(providerFunds) ||
      !providerFunds.length
    ) {
      throw new Error(
        "NAV provider returned zero records"
      );
    }

    /*
     * Keep only the newest provider record for each
     * scheme code.
     */
    const bySchemeCode = new Map();

    for (const raw of providerFunds) {
      const fund = normalizeLatestFund(raw);

      if (
        !Number.isFinite(fund.schemeCode) ||
        fund.schemeCode <= 0
      ) {
        continue;
      }

      const previous =
        bySchemeCode.get(fund.schemeCode);

      if (
        !previous ||
        String(fund.navDate) >
          String(previous.navDate)
      ) {
        bySchemeCode.set(
          fund.schemeCode,
          fund
        );
      }
    }

    const selectedFunds = [];
    let missingActive = 0;

    for (const active of activeRows) {
      const fund = bySchemeCode.get(
        Number(active.schemeCode)
      );

      if (fund) {
        selectedFunds.push(fund);
      } else {
        missingActive += 1;
      }
    }

    console.log(
      `[MF NAV] Provider records: ${providerFunds.length}`
    );

    console.log(
      `[MF NAV] Active records selected: ${selectedFunds.length}/${activeRows.length}`
    );

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

      if (
        !latestActiveNavDate ||
        fund.navDate > latestActiveNavDate
      ) {
        latestActiveNavDate = fund.navDate;
      }

      const existing =
        activeByCode.get(fund.schemeCode);

      const existingDate =
        parseNavDate(existing?.navDate);

      if (
        existingDate &&
        fund.navDate < existingDate
      ) {
        unchanged += 1;
        continue;
      }

      try {
        const isNewDate =
          !existingDate ||
          fund.navDate > existingDate;

        const isSameDate =
          existingDate &&
          fund.navDate === existingDate;

        const existingNav =
          Number(existing?.currentNav);

        const navChangedSameDate =
          isSameDate &&
          Number.isFinite(existingNav) &&
          Math.abs(
            existingNav - fund.nav
          ) > 0.0000001;

        const shouldRecalculateDerivedMetrics =
          isNewDate ||
          navChangedSameDate;

        const update = {
          schemeName:
            fund.schemeName ??
            existing?.schemeName ??
            null,

          isinGrowth:
            fund.isinGrowth ??
            existing?.isinGrowth ??
            null,

          isinDivReinvestment:
            fund.isinDivReinvestment ??
            existing?.isinDivReinvestment ??
            null,

          currentNav: fund.nav,
          navDate: fund.navDate,

          updatedAt: new Date(),
        };

        /*
         * Only a NEW NAV date moves current NAV into
         * previous NAV.
         *
         * A same-day correction keeps previous NAV.
         */
        if (isNewDate) {
          if (
            Number.isFinite(existingNav) &&
            existingNav > 0
          ) {
            update.previousNav =
              existingNav;
          }

          if (existingDate) {
            update.previousNavDate =
              existingDate;
          }
        }

        /*
         * Recalculate 1D return for both:
         * - new NAV date
         * - same-day NAV correction
         */
        if (
          shouldRecalculateDerivedMetrics &&
          Number.isFinite(
            Number(
              existing?.previousNav
            )
          ) &&
          Number(existing.previousNav) > 0
        ) {
          update.return1d = Number(
            (
              ((fund.nav -
                Number(existing.previousNav)) /
                Number(existing.previousNav)) *
              100
            ).toFixed(4)
          );

          update.return1dNavDate =
            fund.navDate;
        }

        /*
         * New NAV or same-day correction invalidates
         * historical return/risk calculations.
         */
        if (
          shouldRecalculateDerivedMetrics
        ) {
          update.returnsForNavDate =
            null;

          update.return1yNavDate = null;
          update.return3yNavDate = null;
          update.return5yNavDate = null;

          update.riskSource = null;
          update.riskUpdatedAt = null;
        }

        const result =
          await schemes.updateOne(
            {
              schemeCode: fund.schemeCode,
              isActive: true,
            },
            {
              $set: update,
            }
          );

        if (result.matchedCount !== 1) {
          failed += 1;

          console.error(
            `[MF NAV] schemeCode=${fund.schemeCode}: MongoDB update matched ${result.matchedCount} active documents; expected exactly 1. Check the stored schemeCode type and duplicate active scheme records.`
          );

          continue;
        }

        updated += 1;

        if (isNewDate) {
          newNavDays += 1;
        } else if (
          isSameDate &&
          !navChangedSameDate
        ) {
          sameNavDays += 1;
        }

        /*
         * Update our local copy so subsequent processing
         * uses the latest state if needed.
         */
        activeByCode.set(
          fund.schemeCode,
          {
            ...existing,
            ...update,
          }
        );
      } catch (error) {
        failed += 1;

        console.error(
          `[MF NAV] schemeCode=${fund.schemeCode}: ${error.message}`
        );
      }
    }

    if (missingActive > 0) {
      console.warn(
        `[MF NAV] ${missingActive} active DB funds were not present in the provider report.`
      );
    }

    console.log(
      `[MF NAV] active=${activeRows.length}, provider=${providerFunds.length}, ` +
        `selected=${selectedFunds.length}, updated=${updated}, unchanged=${unchanged}, ` +
        `newDate=${newNavDays}, sameDate=${sameNavDays}, invalid=${invalid}, ` +
        `failed=${failed}, missing=${missingActive}`
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
    if (lock?.acquired) {
      await releaseLock(
        NAV_LOCK_NAME,
        lock.owner
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| Calculate returns + risk for one scheme
|--------------------------------------------------------------------------
*/

async function calculateSchemeReturns(
  scheme
) {
  const currentNav = roundNav(
    scheme.currentNav
  );

  const currentDate = parseNavDate(
    scheme.navDate
  );

  if (
    !Number.isFinite(currentNav) ||
    currentNav <= 0 ||
    !currentDate
  ) {
    return {
      success: false,
      reason: "Invalid current NAV/date",
    };
  }

  const start = subtractDays(
    subtractYears(currentDate, 5),
    10
  );

  const end = addDays(
    currentDate,
    1
  );

  const history =
    await getSchemeHistory(
      scheme.schemeCode,
      start,
      end
    );

  if (
    !Array.isArray(history) ||
    !history.length
  ) {
    return {
      success: false,
      reason: "No historical NAV",
    };
  }

  const returns =
    calculateReturns(
      history,
      currentNav,
      currentDate
    );

  const riskVolatility =
    calculateVolatility(history);

  const risk = calculateRisk(
    riskVolatility,
    scheme.fundType,
    scheme.schemeCategory
  );

  return {
    success: true,
    currentDate,
    ...returns,
    risk,
    volatility: riskVolatility,
  };
}

/*
|--------------------------------------------------------------------------
| Volatility
|--------------------------------------------------------------------------
*/

function calculateVolatility(history) {
  const values = history
    .map((row) => ({
      date: row.date,
      nav: Number(row.nav),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.nav) &&
        row.nav > 0
    )
    .sort((a, b) =>
      String(a.date).localeCompare(
        String(b.date)
      )
    );

  if (values.length < 181) {
    return null;
  }

  const dailyReturns = [];

  for (
    let i = 1;
    i < values.length;
    i += 1
  ) {
    const prev = values[i - 1].nav;
    const curr = values[i].nav;

    if (
      prev > 0 &&
      curr > 0
    ) {
      dailyReturns.push(
        curr / prev - 1
      );
    }
  }

  if (dailyReturns.length < 180) {
    return null;
  }

  const mean =
    dailyReturns.reduce(
      (a, b) => a + b,
      0
    ) / dailyReturns.length;

  const variance =
    dailyReturns.reduce(
      (sum, value) =>
        sum +
        Math.pow(
          value - mean,
          2
        ),
      0
    ) /
    (dailyReturns.length - 1);

  const volatility =
    Math.sqrt(variance) *
    Math.sqrt(252);

  return Number.isFinite(volatility)
    ? Number(volatility.toFixed(6))
    : null;
}

/*
|--------------------------------------------------------------------------
| Sync all returns + risk
|--------------------------------------------------------------------------
*/

async function syncAllReturns() {
  let lock = null;

  try {
    const db = await getDb();
    const schemes =
      db.collection("mfSchemes");

    lock = await acquireLock(
      RETURNS_LOCK_NAME
    );

    if (!lock.acquired) {
      return {
        success: true,
        skipped: true,
        reason:
          "another return sync is running",
        total: 0,
        processed: 0,
        updated: 0,
        failed: 0,
      };
    }

    /*
     * Only active schemes whose returns are stale
     * relative to the current NAV date.
     */
    const schemeRows =
      await schemes
        .find({
          isActive: true,

          currentNav: {
            $ne: null,
          },

          navDate: {
            $ne: null,
          },

          $or: [
            {
              returnsForNavDate:
                null,
            },
            {
              $expr: {
                $ne: [
                  "$returnsForNavDate",
                  "$navDate",
                ],
              },
            },
          ],
        })
        .sort({
          mysqlId: 1,
          schemeCode: 1,
        })
        .toArray();

    console.log(
      `[MF RETURNS] Schemes requiring recalculation: ${schemeRows.length}`
    );

    let cursor = 0;
    let processed = 0;
    let updated = 0;
    let failed = 0;

    async function worker() {
      while (true) {
        const index = cursor++;

        if (
          index >= schemeRows.length
        ) {
          return;
        }

        const scheme =
          schemeRows[index];

        try {
          const result =
            await calculateSchemeReturns(
              scheme
            );

          if (!result.success) {
            failed += 1;

            console.warn(
              `[MF RETURNS] ${scheme.schemeCode}: ${result.reason}`
            );
          } else {
            await schemes.updateOne(
              {
                _id: scheme._id,
                schemeCode:
                  scheme.schemeCode,
                isActive: true,
              },
              {
                $set: {
                  return1y:
                    result.return1Y,

                  return3y:
                    result.return3Y,

                  return5y:
                    result.return5Y,

                  returnsForNavDate:
                    result.currentDate,

                  return1yNavDate:
                    result.nav1YDate,

                  return3yNavDate:
                    result.nav3YDate,

                  return5yNavDate:
                    result.nav5YDate,

                  risk:
                    result.risk,

                  riskSource:
                    "Internal NAV Risk Model",

                  riskUpdatedAt:
                    new Date(),

                  returnUpdatedAt:
                    new Date(),

                  updatedAt:
                    new Date(),
                },
              }
            );

            updated += 1;
          }
        } catch (error) {
          failed += 1;

          console.error(
            `[MF RETURNS] ${scheme.schemeCode}: ${error.message}`
          );
        }

        processed += 1;

        if (
          processed % 100 === 0 ||
          processed === schemeRows.length
        ) {
          console.log(
            `[MF RETURNS] progress=${processed}/${schemeRows.length}, ` +
              `updated=${updated}, failed=${failed}`
          );
        }

        if (DELAY_MS) {
          await sleep(DELAY_MS);
        }
      }
    }

    if (schemeRows.length) {
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              CONCURRENCY,
              schemeRows.length
            ),
          },
          worker
        )
      );
    }

    console.log(
      `[MF RETURNS] total=${schemeRows.length}, ` +
        `processed=${processed}, updated=${updated}, failed=${failed}`
    );

    return {
      success: true,
      skipped: false,
      total: schemeRows.length,
      processed,
      updated,
      failed,
    };
  } finally {
    if (lock?.acquired) {
      await releaseLock(
        RETURNS_LOCK_NAME,
        lock.owner
      );
    }
  }
}

module.exports = {
  syncLatestNAV,
  syncAllReturns,
  calculateSchemeReturns,
};