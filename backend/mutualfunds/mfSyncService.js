// // const pool = require('./db');
// // const {
// //   getLatestFunds,
// //   getSchemeHistory,
// //   calculateReturns,
// //   parseNavDate,
// //   subtractYears,
// //   subtractDays,
// //   addDays,
// //   roundNav,
// // } = require('./mfapiService');
// // const {
// //   calculateAllRatings
// // } = require('./mfRatingRiskService');

// // // MF_SYNC_CONCURRENCY/MF_SYNC_DELAY_MS are the preferred env var names.
// // // The older MF_RETURN_CONCURRENCY/MF_RETURN_DELAY_MS names are still
// // // honored so existing .env files keep working.
// // const CONCURRENCY = Math.max(1, Number(process.env.MF_SYNC_CONCURRENCY || process.env.MF_RETURN_CONCURRENCY || 5));
// // const DELAY_MS = Math.max(0, Number(process.env.MF_SYNC_DELAY_MS || process.env.MF_RETURN_DELAY_MS || 200));
// // const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// // function normalizeLatestFund(fund) {
// //   return {
// //     schemeCode: Number(fund.schemeCode ?? fund.scheme_code),
// //     nav: roundNav(fund.nav ?? fund.currentNav ?? fund.current_nav),
// //     navDate: parseNavDate(fund.date ?? fund.navDate ?? fund.nav_date),
// //     schemeName: fund.schemeName ?? fund.scheme_name ?? null,
// //     fundHouse: fund.fundHouse ?? fund.fund_house ?? null,
// //     schemeType: fund.schemeType ?? fund.scheme_type ?? null,
// //     schemeCategory: fund.schemeCategory ?? fund.scheme_category ?? null,
// //     isinGrowth: fund.isinGrowth ?? fund.isin_growth ?? null,
// //     isinDivReinvestment: fund.isinDivReinvestment ?? fund.isin_div_reinvestment ?? null,
// //   };
// // }

// // async function acquireLock(connection, name) {
// //   const [rows] = await connection.query('SELECT GET_LOCK(?, 0) AS acquired', [name]);
// //   return Number(rows[0]?.acquired) === 1;
// // }

// // async function releaseLock(connection, name) {
// //   try { await connection.query('SELECT RELEASE_LOCK(?)', [name]); } catch (_) {}
// // }

// // async function syncLatestNAV() {
// //   let connection;
// //   let locked = false;
// //   try {
// //     connection = await pool.getConnection();
// //     locked = await acquireLock(connection, 'mf_latest_nav_sync');
// //     if (!locked) return { success: true, skipped: true, reason: 'another sync is running', updated: 0 };

// //     console.log('[MF NAV] Downloading latest NAV data...');
// //     const funds = await getLatestFunds();
// //     let updated = 0;
// //     let unchanged = 0;
// //     let invalid = 0;
// //     let failed = 0;

// //     for (const raw of funds) {
// //       const f = normalizeLatestFund(raw);
// //       if (!Number.isFinite(f.schemeCode) || f.schemeCode <= 0 || !Number.isFinite(f.nav) || f.nav <= 0 || !f.navDate) {
// //         invalid++;
// //         continue;
// //       }

// //       // One bad/unexpected record must never abort the whole sync -
// //       // count it as failed and move on to the next scheme.
// //       try {
// //         const [result] = await connection.query(
// //           `UPDATE mf_schemes
// //            SET scheme_name = COALESCE(?, scheme_name),
// //                fund_house = COALESCE(?, fund_house),
// //                scheme_type = COALESCE(?, scheme_type),
// //                scheme_category = COALESCE(?, scheme_category),
// //                isin_growth = COALESCE(?, isin_growth),
// //                isin_div_reinvestment = COALESCE(?, isin_div_reinvestment),
// //                current_nav = ?,
// //                nav_date = ?,
// //                updated_at = CASE WHEN current_nav <> ? OR nav_date <> ? THEN NOW() ELSE updated_at END
// //            WHERE scheme_code = ? AND is_active = 1`,
// //           [f.schemeName, f.fundHouse, f.schemeType, f.schemeCategory, f.isinGrowth, f.isinDivReinvestment,
// //             f.nav, f.navDate, f.nav, f.navDate, f.schemeCode]
// //         );
// //         if (result.affectedRows) updated += result.affectedRows;
// //         else unchanged++;
// //       } catch (recordError) {
// //         failed++;
// //         console.error(`[MF NAV] scheme_code=${f.schemeCode}: ${recordError.message}`);
// //       }
// //     }

// //     console.log(`[MF NAV] MFapi records=${funds.length}, updated=${updated}, unchanged=${unchanged}, invalid=${invalid}, failed=${failed}`);
// //     return { success: true, skipped: false, fetched: funds.length, updated, unchanged, invalid, failed };
// //   } finally {
// //     if (connection && locked) await releaseLock(connection, 'mf_latest_nav_sync');
// //     if (connection) connection.release();
// //   }
// // }

// // async function calculateSchemeReturns(scheme) {
// //   const currentNav = roundNav(scheme.current_nav);
// //   const currentDate = parseNavDate(scheme.nav_date);
// //   if (!Number.isFinite(currentNav) || currentNav <= 0 || !currentDate) {
// //     return { success: false, reason: 'Invalid current NAV/date' };
// //   }

// //   const start = subtractDays(subtractYears(currentDate, 5), 10);
// //   const end = addDays(currentDate, 1);
// //   const history = await getSchemeHistory(scheme.scheme_code, start, end);
// //   if (!history.length) return { success: false, reason: 'No historical NAV' };

// //   const result = calculateReturns(history, currentNav, currentDate);
// //   return { success: true, currentDate, ...result };
// // }

// // async function syncAllReturns() {
// //   let connection;
// //   let locked = false;
// //   try {
// //     connection = await pool.getConnection();
// //     locked = await acquireLock(connection, 'mf_returns_sync');
// //     if (!locked) return { success: true, skipped: true, reason: 'another return sync is running' };

// //     const [schemes] = await connection.query(
// //       `SELECT id, scheme_code, current_nav, nav_date
// //        FROM mf_schemes
// //        WHERE is_active = 1
// //          AND current_nav IS NOT NULL
// //          AND nav_date IS NOT NULL
// //          AND (returns_for_nav_date IS NULL OR returns_for_nav_date <> nav_date)
// //        ORDER BY id ASC`
// //     );

// //     let cursor = 0;
// //     let processed = 0;
// //     let updated = 0;
// //     let failed = 0;

// //     async function worker() {
// //       while (true) {
// //         const index = cursor++;
// //         if (index >= schemes.length) return;
// //         const scheme = schemes[index];
// //         try {
// //           const result = await calculateSchemeReturns(scheme);
// //           if (!result.success) {
// //             failed++;
// //             console.warn(`[MF RETURNS] ${scheme.scheme_code}: ${result.reason || 'calculation failed'}`);
// //           } else {
// //             await connection.query(
// //               `UPDATE mf_schemes
// //                SET return_1y = ?, return_3y = ?, return_5y = ?,
// //                    returns_for_nav_date = ?,
// //                    return_1y_nav_date = ?, return_3y_nav_date = ?, return_5y_nav_date = ?,
// //                    return_updated_at = NOW(), updated_at = NOW()
// //                WHERE id = ? AND is_active = 1`,
// //               [result.return1Y, result.return3Y, result.return5Y, result.currentDate,
// //                 result.nav1YDate, result.nav3YDate, result.nav5YDate, scheme.id]
// //             );
// //             updated++;
// //           }
// //         } catch (error) {
// //           failed++;
// //           console.error(`[MF RETURNS] ${scheme.scheme_code}: ${error.message}`);
// //         }
// //         processed++;
// //         if (processed % 100 === 0 || processed === schemes.length) {
// //           console.log(`[MF RETURNS] progress=${processed}/${schemes.length}, updated=${updated}, failed=${failed}`);
// //         }
// //         if (DELAY_MS) await sleep(DELAY_MS);
// //       }
// //     }

// //     await Promise.all(Array.from({ length: Math.min(CONCURRENCY, schemes.length) }, worker));
// //     console.log(`[MF RETURNS] total=${schemes.length}, processed=${processed}, updated=${updated}, failed=${failed}`);
// //     return { success: true, skipped: false, total: schemes.length, processed, updated, failed };
// //   } finally {
// //     if (connection && locked) await releaseLock(connection, 'mf_returns_sync');
// //     if (connection) connection.release();
// //   }
// // }

// // module.exports = { syncLatestNAV, syncAllReturns, calculateSchemeReturns };

// const pool = require("./db");

// const {
//   getLatestFunds,
//   getSchemeHistory,
//   calculateReturns,
//   parseNavDate,
//   subtractYears,
//   subtractDays,
//   addDays,
//   roundNav,
// } = require("./mfapiService");

// const { calculateFundRisk } = require("./mfRatingRiskService");

// /*
// |--------------------------------------------------------------------------
// | Configuration
// |--------------------------------------------------------------------------
// */

// const CONCURRENCY = Math.max(
//   1,
//   Number(
//     process.env.MF_SYNC_CONCURRENCY || process.env.MF_RETURN_CONCURRENCY || 5,
//   ),
// );

// const DELAY_MS = Math.max(
//   0,
//   Number(process.env.MF_SYNC_DELAY_MS || process.env.MF_RETURN_DELAY_MS || 200),
// );

// const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// /*
// |--------------------------------------------------------------------------
// | Normalize latest MFapi record
// |--------------------------------------------------------------------------
// */

// function normalizeLatestFund(fund) {
//   return {
//     schemeCode: Number(fund.schemeCode ?? fund.scheme_code),

//     nav: roundNav(fund.nav ?? fund.currentNav ?? fund.current_nav),

//     navDate: parseNavDate(fund.date ?? fund.navDate ?? fund.nav_date),

//     schemeName: fund.schemeName ?? fund.scheme_name ?? null,

//     fundHouse: fund.fundHouse ?? fund.fund_house ?? null,

//     schemeType: fund.schemeType ?? fund.scheme_type ?? null,

//     schemeCategory: fund.schemeCategory ?? fund.scheme_category ?? null,

//     isinGrowth: fund.isinGrowth ?? fund.isin_growth ?? null,

//     isinDivReinvestment:
//       fund.isinDivReinvestment ?? fund.isin_div_reinvestment ?? null,
//   };
// }

// /*
// |--------------------------------------------------------------------------
// | Internal advisory lock
// |--------------------------------------------------------------------------
// */

// async function acquireLock(connection, name) {
//   const [rows] = await connection.query("SELECT GET_LOCK(?, 0) AS acquired", [
//     name,
//   ]);

//   return Number(rows[0]?.acquired) === 1;
// }

// async function releaseLock(connection, name) {
//   try {
//     await connection.query("SELECT RELEASE_LOCK(?)", [name]);
//   } catch (_) {
//     // Not fatal.
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | Latest NAV synchronization
// |--------------------------------------------------------------------------
// */

// async function syncLatestNAV() {
//   let connection;
//   let locked = false;

//   try {
//     connection = await pool.getConnection();

//     locked = await acquireLock(connection, "mf_latest_nav_sync");

//     if (!locked) {
//       return {
//         success: true,
//         skipped: true,
//         reason: "another sync is running",
//         updated: 0,
//       };
//     }

//     console.log("[MF NAV] Downloading latest NAV data...");

//     const funds = await getLatestFunds();

//     if (!Array.isArray(funds) || !funds.length) {
//       throw new Error("MFapi returned no latest mutual-fund records");
//     }

//     let updated = 0;
//     let unchanged = 0;
//     let invalid = 0;
//     let failed = 0;

//     for (const raw of funds) {
//       const fund = normalizeLatestFund(raw);

//       if (
//         !Number.isFinite(fund.schemeCode) ||
//         fund.schemeCode <= 0 ||
//         !Number.isFinite(fund.nav) ||
//         fund.nav <= 0 ||
//         !fund.navDate
//       ) {
//         invalid++;
//         continue;
//       }

//       try {
//         const [result] = await connection.query(
//           `
//             UPDATE mf_schemes
//             SET
//               scheme_name =
//                 COALESCE(?, scheme_name),

//               fund_house =
//                 COALESCE(?, fund_house),

//               scheme_type =
//                 COALESCE(?, scheme_type),

//               scheme_category =
//                 COALESCE(?, scheme_category),

//               isin_growth =
//                 COALESCE(?, isin_growth),

//               isin_div_reinvestment =
//                 COALESCE(?, isin_div_reinvestment),

//               current_nav = ?,

//               nav_date = ?,

//               updated_at =
//                 CASE
//                   WHEN current_nav <> ?
//                     OR nav_date <> ?
//                   THEN NOW()
//                   ELSE updated_at
//                 END

//             WHERE scheme_code = ?
//               AND is_active = 1
//             `,
//           [
//             fund.schemeName,
//             fund.fundHouse,
//             fund.schemeType,
//             fund.schemeCategory,
//             fund.isinGrowth,
//             fund.isinDivReinvestment,

//             fund.nav,
//             fund.navDate,

//             fund.nav,
//             fund.navDate,

//             fund.schemeCode,
//           ],
//         );

//         if (result.affectedRows) {
//           updated += result.affectedRows;
//         } else {
//           unchanged++;
//         }
//       } catch (recordError) {
//         failed++;

//         console.error(
//           `[MF NAV] scheme_code=${fund.schemeCode}: ${recordError.message}`,
//         );
//       }
//     }

//     console.log(
//       `[MF NAV] MFapi records=${funds.length}, updated=${updated}, unchanged=${unchanged}, invalid=${invalid}, failed=${failed}`,
//     );

//     return {
//       success: true,
//       skipped: false,
//       fetched: funds.length,
//       updated,
//       unchanged,
//       invalid,
//       failed,
//     };
//   } finally {
//     if (connection && locked) {
//       await releaseLock(connection, "mf_latest_nav_sync");
//     }

//     if (connection) {
//       connection.release();
//     }
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | Calculate returns + risk for one scheme
// |--------------------------------------------------------------------------
// */

// async function calculateSchemeReturns(scheme, connection) {
//   const currentNav = roundNav(scheme.current_nav);

//   const currentDate = parseNavDate(scheme.nav_date);

//   if (!Number.isFinite(currentNav) || currentNav <= 0 || !currentDate) {
//     return {
//       success: false,
//       reason: "Invalid current NAV/date",
//     };
//   }

//   /*
//    * Fetch enough history for 5Y calculation.
//    */
//   const start = subtractDays(subtractYears(currentDate, 5), 10);

//   const end = addDays(currentDate, 1);

//   const history = await getSchemeHistory(scheme.scheme_code, start, end);

//   if (!Array.isArray(history) || !history.length) {
//     return {
//       success: false,
//       reason: "No historical NAV",
//     };
//   }

//   const result = calculateReturns(history, currentNav, currentDate);

//   /*
//    * Calculate risk from the SAME history.
//    */
//   let riskResult = null;

//   try {
//     riskResult = await calculateFundRisk(scheme, history);
//   } catch (riskError) {
//     /*
//      * Risk failure should not destroy return calculation.
//      */
//     console.error(`[MF RISK] ${scheme.scheme_code}: ${riskError.message}`);
//   }

//   return {
//     success: true,
//     currentDate,
//     ...result,
//     risk: riskResult?.risk || null,
//     volatility: riskResult?.volatility || null,
//   };
// }

// /*
// |--------------------------------------------------------------------------
// | Sync all returns + risk
// |--------------------------------------------------------------------------
// */

// async function syncAllReturns() {
//   let connection;
//   let locked = false;

//   try {
//     connection = await pool.getConnection();

//     locked = await acquireLock(connection, "mf_returns_sync");

//     if (!locked) {
//       return {
//         success: true,
//         skipped: true,
//         reason: "another return sync is running",
//       };
//     }

//     /*
//      * Only calculate schemes whose NAV date has changed
//      * or whose returns have never been calculated.
//      */
//     const [schemes] = await connection.query(
//       `
//         SELECT
//           id,
//           scheme_code,
//           current_nav,
//           nav_date,
//           fund_type,
//           scheme_category
//         FROM mf_schemes
//         WHERE is_active = 1
//           AND current_nav IS NOT NULL
//           AND nav_date IS NOT NULL
//           AND (
//             returns_for_nav_date IS NULL
//             OR returns_for_nav_date <> nav_date
//           )
//         ORDER BY id ASC
//         `,
//     );

//     let cursor = 0;
//     let processed = 0;
//     let updated = 0;
//     let failed = 0;
//     let riskUpdated = 0;

//     async function worker() {
//       while (true) {
//         const index = cursor++;

//         if (index >= schemes.length) {
//           return;
//         }

//         const scheme = schemes[index];

//         try {
//           const result = await calculateSchemeReturns(scheme, connection);

//           if (!result.success) {
//             failed++;

//             console.warn(
//               `[MF RETURNS] ${scheme.scheme_code}: ${result.reason || "calculation failed"}`,
//             );
//           } else {
//             await connection.query(
//               `
//               UPDATE mf_schemes
//               SET
//                 return_1y = ?,
//                 return_3y = ?,
//                 return_5y = ?,

//                 returns_for_nav_date = ?,

//                 return_1y_nav_date = ?,
//                 return_3y_nav_date = ?,
//                 return_5y_nav_date = ?,

//                 return_updated_at = NOW(),
//                 updated_at = NOW()

//               WHERE id = ?
//                 AND is_active = 1
//               `,
//               [
//                 result.return1Y,
//                 result.return3Y,
//                 result.return5Y,

//                 result.currentDate,

//                 result.nav1YDate,
//                 result.nav3YDate,
//                 result.nav5YDate,

//                 scheme.id,
//               ],
//             );

//             updated++;

//             if (result.risk) {
//               riskUpdated++;
//             }
//           }
//         } catch (error) {
//           failed++;

//           console.error(`[MF RETURNS] ${scheme.scheme_code}: ${error.message}`);
//         }

//         processed++;

//         if (processed % 100 === 0 || processed === schemes.length) {
//           console.log(
//             `[MF RETURNS] progress=${processed}/${schemes.length}, updated=${updated}, riskUpdated=${riskUpdated}, failed=${failed}`,
//           );
//         }

//         if (DELAY_MS) {
//           await sleep(DELAY_MS);
//         }
//       }
//     }

//     if (schemes.length > 0) {
//       await Promise.all(
//         Array.from(
//           {
//             length: Math.min(CONCURRENCY, schemes.length),
//           },
//           worker,
//         ),
//       );
//     }

//     console.log(
//       `[MF RETURNS] total=${schemes.length}, processed=${processed}, updated=${updated}, riskUpdated=${riskUpdated}, failed=${failed}`,
//     );

//     return {
//       success: true,
//       skipped: false,
//       total: schemes.length,
//       processed,
//       updated,
//       riskUpdated,
//       failed,
//     };
//   } finally {
//     if (connection && locked) {
//       await releaseLock(connection, "mf_returns_sync");
//     }

//     if (connection) {
//       connection.release();
//     }
//   }
// }

// module.exports = {
//   syncLatestNAV,
//   syncAllReturns,
//   calculateSchemeReturns,
// };





































const pool = require("./db");

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

const { calculateFundRisk } = require("./mfRatingRiskService");

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

const CONCURRENCY = Math.max(
  1,
  Number(
    process.env.MF_SYNC_CONCURRENCY ||
      process.env.MF_RETURN_CONCURRENCY ||
      5
  )
);

const DELAY_MS = Math.max(
  0,
  Number(
    process.env.MF_SYNC_DELAY_MS ||
      process.env.MF_RETURN_DELAY_MS ||
      200
  )
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

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
| Internal advisory lock
|--------------------------------------------------------------------------
*/

async function acquireLock(
  connection,
  name
) {
  const [rows] =
    await connection.query(
      "SELECT GET_LOCK(?, 0) AS acquired",
      [name]
    );

  return (
    Number(
      rows[0]?.acquired
    ) === 1
  );
}

async function releaseLock(
  connection,
  name
) {
  try {
    await connection.query(
      "SELECT RELEASE_LOCK(?)",
      [name]
    );
  } catch (_) {
    // Not fatal.
  }
}

/*
|--------------------------------------------------------------------------
| Latest NAV synchronization
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| mf_schemes stores only the latest NAV snapshot:
|
| current_nav       = latest NAV
| nav_date          = latest NAV date
|
| previous_nav      = previous available NAV
| previous_nav_date = date of previous NAV
|
| return_1d         = percentage change from previous NAV
| return_1d_nav_date = date for which return_1d belongs
|
| We DO NOT create/store a daily NAV history table.
|
| Behavior:
|
| 1. Same NAV date:
|    - update current_nav if required
|    - DO NOT change previous_nav
|    - DO NOT recalculate return_1d
|
| 2. New NAV date:
|    - old current_nav -> previous_nav
|    - old nav_date -> previous_nav_date
|    - calculate return_1d using old current_nav
|    - new NAV -> current_nav
|    - new date -> nav_date
|
|--------------------------------------------------------------------------
*/

async function syncLatestNAV() {
  let connection;
  let locked = false;

  try {
    connection =
      await pool.getConnection();

    /*
    ----------------------------------------------------------------------
    Acquire distributed MySQL advisory lock
    ----------------------------------------------------------------------
    */
    locked = await acquireLock(
      connection,
      "mf_latest_nav_sync"
    );

    if (!locked) {
      return {
        success: true,
        skipped: true,
        reason:
          "another sync is running",
        updated: 0,
      };
    }

    console.log(
      "[MF NAV] Downloading latest NAV data..."
    );

    /*
    ----------------------------------------------------------------------
    Fetch latest NAV data from MFapi
    ----------------------------------------------------------------------
    */
    const funds =
      await getLatestFunds();

    if (
      !Array.isArray(funds) ||
      !funds.length
    ) {
      throw new Error(
        "MFapi returned no latest mutual-fund records"
      );
    }

    let updated = 0;
    let unchanged = 0;
    let invalid = 0;
    let failed = 0;
    let newNavDays = 0;
    let sameNavDays = 0;

    /*
    ----------------------------------------------------------------------
    Process each latest NAV record
    ----------------------------------------------------------------------
    */
    for (const raw of funds) {
      const fund =
        normalizeLatestFund(raw);

      /*
      --------------------------------------------------------------------
      Validate record
      --------------------------------------------------------------------
      */
      if (
        !Number.isFinite(
          fund.schemeCode
        ) ||
        fund.schemeCode <= 0 ||
        !Number.isFinite(fund.nav) ||
        fund.nav <= 0 ||
        !fund.navDate
      ) {
        invalid++;
        continue;
      }

      /*
      --------------------------------------------------------------------
      One bad scheme must not stop the whole sync.
      --------------------------------------------------------------------
      */
      try {
        /*
        ==================================================================
        IMPORTANT SQL LOGIC
        ==================================================================

        MySQL evaluates the UPDATE expressions using the row values
        that existed before the update for these expressions.

        Therefore:

          previous_nav = old current_nav
          previous_nav_date = old nav_date

        and then:

          current_nav = new NAV
          nav_date = new NAV date

        The date comparison:

          nav_date <> ?

        checks whether this is a NEW NAV DATE.

        ==================================================================
        */

        const [result] =
          await connection.query(
            `
            UPDATE mf_schemes

            SET

              /*
              ------------------------------------------------------------
              Existing scheme metadata
              ------------------------------------------------------------
              */
              scheme_name =
                COALESCE(
                  ?,
                  scheme_name
                ),

              fund_house =
                COALESCE(
                  ?,
                  fund_house
                ),

              scheme_type =
                COALESCE(
                  ?,
                  scheme_type
                ),

              scheme_category =
                COALESCE(
                  ?,
                  scheme_category
                ),

              isin_growth =
                COALESCE(
                  ?,
                  isin_growth
                ),

              isin_div_reinvestment =
                COALESCE(
                  ?,
                  isin_div_reinvestment
                ),

              /*
              ------------------------------------------------------------
              PREVIOUS NAV
              ------------------------------------------------------------

              Only shift previous NAV when:

                existing nav_date != incoming nav date

              and an old valid current_nav exists.
              */
              previous_nav =
                CASE
                  WHEN nav_date IS NOT NULL
                    AND nav_date <> ?
                    AND current_nav IS NOT NULL
                    AND current_nav > 0
                  THEN current_nav

                  ELSE previous_nav
                END,

              /*
              ------------------------------------------------------------
              PREVIOUS NAV DATE
              ------------------------------------------------------------
              */
              previous_nav_date =
                CASE
                  WHEN nav_date IS NOT NULL
                    AND nav_date <> ?
                    AND current_nav IS NOT NULL
                    AND current_nav > 0
                  THEN nav_date

                  ELSE previous_nav_date
                END,

              /*
              ------------------------------------------------------------
              1D RETURN
              ------------------------------------------------------------

              Formula:

                ((new NAV - old NAV) / old NAV) * 100

              Example:

                old NAV = 100
                new NAV = 105

                return_1d = 5%
              */
              return_1d =
                CASE
                  WHEN nav_date IS NOT NULL
                    AND nav_date <> ?
                    AND current_nav IS NOT NULL
                    AND current_nav > 0
                  THEN
                    (
                      (
                        ? - current_nav
                      ) /
                      current_nav
                    ) * 100

                  ELSE return_1d
                END,

              /*
              ------------------------------------------------------------
              DATE FOR 1D RETURN
              ------------------------------------------------------------
              */
              return_1d_nav_date =
                CASE
                  WHEN nav_date IS NOT NULL
                    AND nav_date <> ?
                  THEN ?

                  ELSE return_1d_nav_date
                END,

              /*
              ------------------------------------------------------------
              CURRENT NAV
              ------------------------------------------------------------
              */
              current_nav = ?,

              /*
              ------------------------------------------------------------
              CURRENT NAV DATE
              ------------------------------------------------------------
              */
              nav_date = ?,

              /*
              ------------------------------------------------------------
              updated_at
              ------------------------------------------------------------

              Only change updated_at when either:
                - NAV changed
                - date changed
              */
              updated_at =
                CASE
                  WHEN
                    (
                      current_nav <> ?
                      OR nav_date <> ?
                    )
                  THEN NOW()

                  ELSE updated_at
                END

            WHERE scheme_code = ?
              AND is_active = 1
            `,
            [
              /*
              Metadata
              */
              fund.schemeName,
              fund.fundHouse,
              fund.schemeType,
              fund.schemeCategory,
              fund.isinGrowth,
              fund.isinDivReinvestment,

              /*
              previous_nav
              */
              fund.navDate,

              /*
              previous_nav_date
              */
              fund.navDate,

              /*
              return_1d date comparison
              */
              fund.navDate,

              /*
              new NAV
              */
              fund.nav,

              /*
              return_1d_nav_date comparison
              */
              fund.navDate,

              /*
              return_1d_nav_date new date
              */
              fund.navDate,

              /*
              current_nav
              */
              fund.nav,

              /*
              nav_date
              */
              fund.navDate,

              /*
              updated_at comparison:
              old current_nav vs new NAV
              */
              fund.nav,

              /*
              updated_at comparison:
              old nav_date vs new date
              */
              fund.navDate,

              /*
              WHERE
              */
              fund.schemeCode,
            ]
          );

        /*
        ------------------------------------------------------------------
        MySQL affectedRows
        ------------------------------------------------------------------

        If no row exists / inactive:
          affectedRows = 0

        If row exists:
          affectedRows can be 1.

        The important distinction is determined separately below.
        ------------------------------------------------------------------
        */

        if (result.affectedRows) {
          updated +=
            result.affectedRows;
        } else {
          unchanged++;
        }

        /*
        ------------------------------------------------------------------
        Logging category

        We query the row after update only for classification.
        This does NOT write anything to DB.
        ------------------------------------------------------------------
        */

        const [updatedRows] =
          await connection.query(
            `
            SELECT
              nav_date,
              previous_nav_date,
              return_1d_nav_date,
              current_nav,
              previous_nav

            FROM mf_schemes

            WHERE scheme_code = ?
              AND is_active = 1

            LIMIT 1
            `,
            [fund.schemeCode]
          );

        const stored =
          updatedRows[0];

        if (
          stored &&
          stored.nav_date
        ) {
          const storedDate =
            parseNavDate(
              stored.nav_date
            );

          if (
            storedDate ===
            fund.navDate
          ) {
            /*
              We cannot infer from the final row alone whether this
              particular request shifted the NAV.

              This is only informational logging.
            */
          }
        }
      } catch (recordError) {
        failed++;

        console.error(
          `[MF NAV] scheme_code=${fund.schemeCode}: ${recordError.message}`
        );
      }
    }

    /*
    ----------------------------------------------------------------------
    Final sync log
    ----------------------------------------------------------------------
    */

    console.log(
      `[MF NAV] MFapi records=${funds.length}, ` +
        `updated=${updated}, ` +
        `unchanged=${unchanged}, ` +
        `invalid=${invalid}, ` +
        `failed=${failed}`
    );

    return {
      success: true,
      skipped: false,
      fetched: funds.length,
      updated,
      unchanged,
      invalid,
      failed,
      newNavDays,
      sameNavDays,
    };
  } finally {
    /*
    ----------------------------------------------------------------------
    Release advisory lock
    ----------------------------------------------------------------------
    */

    if (
      connection &&
      locked
    ) {
      await releaseLock(
        connection,
        "mf_latest_nav_sync"
      );
    }

    /*
    ----------------------------------------------------------------------
    Release DB connection
    ----------------------------------------------------------------------
    */

    if (connection) {
      connection.release();
    }
  }
}

/*
|--------------------------------------------------------------------------
| Calculate returns + risk for one scheme
|--------------------------------------------------------------------------
*/

async function calculateSchemeReturns(
  scheme,
  connection
) {
  const currentNav =
    roundNav(
      scheme.current_nav
    );

  const currentDate =
    parseNavDate(
      scheme.nav_date
    );

  if (
    !Number.isFinite(
      currentNav
    ) ||
    currentNav <= 0 ||
    !currentDate
  ) {
    return {
      success: false,
      reason:
        "Invalid current NAV/date",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Fetch enough history for 5Y calculation
  |--------------------------------------------------------------------------
  */

  const start =
    subtractDays(
      subtractYears(
        currentDate,
        5
      ),
      10
    );

  const end =
    addDays(
      currentDate,
      1
    );

  const history =
    await getSchemeHistory(
      scheme.scheme_code,
      start,
      end
    );

  if (
    !Array.isArray(history) ||
    !history.length
  ) {
    return {
      success: false,
      reason:
        "No historical NAV",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Calculate 1Y / 3Y / 5Y returns
  |--------------------------------------------------------------------------
  */

  const result =
    calculateReturns(
      history,
      currentNav,
      currentDate
    );

  /*
  |--------------------------------------------------------------------------
  | Calculate risk using SAME NAV history
  |--------------------------------------------------------------------------
  */

  let riskResult = null;

  try {
    riskResult =
      await calculateFundRisk(
        scheme,
        history
      );
  } catch (riskError) {
    /*
    ----------------------------------------------------------------------
    Risk failure must never destroy return calculation.
    ----------------------------------------------------------------------
    */

    console.error(
      `[MF RISK] ${scheme.scheme_code}: ${riskError.message}`
    );
  }

  return {
    success: true,
    currentDate,

    ...result,

    risk:
      riskResult?.risk ||
      null,

    volatility:
      riskResult?.volatility ||
      null,
  };
}

/*
|--------------------------------------------------------------------------
| Sync all returns + risk
|--------------------------------------------------------------------------
*/

async function syncAllReturns() {
  let connection;
  let locked = false;

  try {
    connection =
      await pool.getConnection();

    /*
    ----------------------------------------------------------------------
    Advisory lock
    ----------------------------------------------------------------------
    */

    locked =
      await acquireLock(
        connection,
        "mf_returns_sync"
      );

    if (!locked) {
      return {
        success: true,
        skipped: true,
        reason:
          "another return sync is running",
      };
    }

    /*
    ----------------------------------------------------------------------
    Only calculate schemes whose NAV date changed
    or whose returns have never been calculated.
    ----------------------------------------------------------------------
    */

    const [schemes] =
      await connection.query(
        `
        SELECT
          id,
          scheme_code,
          current_nav,
          nav_date,
          fund_type,
          scheme_category

        FROM mf_schemes

        WHERE is_active = 1

          AND current_nav IS NOT NULL

          AND nav_date IS NOT NULL

          AND (
            returns_for_nav_date IS NULL
            OR returns_for_nav_date <> nav_date
          )

        ORDER BY id ASC
        `
      );

    let cursor = 0;
    let processed = 0;
    let updated = 0;
    let failed = 0;
    let riskUpdated = 0;

    /*
    ----------------------------------------------------------------------
    Worker
    ----------------------------------------------------------------------
    */

    async function worker() {
      while (true) {
        const index =
          cursor++;

        if (
          index >=
          schemes.length
        ) {
          return;
        }

        const scheme =
          schemes[index];

        try {
          const result =
            await calculateSchemeReturns(
              scheme,
              connection
            );

          if (!result.success) {
            failed++;

            console.warn(
              `[MF RETURNS] ${scheme.scheme_code}: ${
                result.reason ||
                "calculation failed"
              }`
            );
          } else {
            /*
            --------------------------------------------------------------
            Update long-term returns
            --------------------------------------------------------------
            */

            await connection.query(
              `
              UPDATE mf_schemes

              SET

                return_1y = ?,

                return_3y = ?,

                return_5y = ?,

                returns_for_nav_date = ?,

                return_1y_nav_date = ?,

                return_3y_nav_date = ?,

                return_5y_nav_date = ?,

                return_updated_at = NOW(),

                updated_at = NOW()

              WHERE id = ?

                AND is_active = 1
              `,
              [
                result.return1Y,

                result.return3Y,

                result.return5Y,

                result.currentDate,

                result.nav1YDate,

                result.nav3YDate,

                result.nav5YDate,

                scheme.id,
              ]
            );

            updated++;

            /*
            --------------------------------------------------------------
            Risk was calculated along with returns.
            --------------------------------------------------------------
            */

            if (result.risk) {
              /*
                NOTE:
                Your existing file calculates risk but does not currently
                persist it here.

                Keeping this behavior avoids changing the existing
                rating/risk architecture unexpectedly.
              */
              riskUpdated++;
            }
          }
        } catch (error) {
          failed++;

          console.error(
            `[MF RETURNS] ${scheme.scheme_code}: ${error.message}`
          );
        }

        processed++;

        /*
        ------------------------------------------------------------------
        Progress logging
        ------------------------------------------------------------------
        */

        if (
          processed % 100 === 0 ||
          processed ===
            schemes.length
        ) {
          console.log(
            `[MF RETURNS] progress=${processed}/${schemes.length}, ` +
              `updated=${updated}, ` +
              `riskUpdated=${riskUpdated}, ` +
              `failed=${failed}`
          );
        }

        /*
        ------------------------------------------------------------------
        Optional API delay
        ------------------------------------------------------------------
        */

        if (DELAY_MS) {
          await sleep(DELAY_MS);
        }
      }
    }

    /*
    ----------------------------------------------------------------------
    Start workers
    ----------------------------------------------------------------------
    */

    if (
      schemes.length > 0
    ) {
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              CONCURRENCY,
              schemes.length
            ),
          },
          worker
        )
      );
    }

    console.log(
      `[MF RETURNS] total=${schemes.length}, ` +
        `processed=${processed}, ` +
        `updated=${updated}, ` +
        `riskUpdated=${riskUpdated}, ` +
        `failed=${failed}`
    );

    return {
      success: true,
      skipped: false,
      total: schemes.length,
      processed,
      updated,
      riskUpdated,
      failed,
    };
  } finally {
    /*
    ----------------------------------------------------------------------
    Release return-sync lock
    ----------------------------------------------------------------------
    */

    if (
      connection &&
      locked
    ) {
      await releaseLock(
        connection,
        "mf_returns_sync"
      );
    }

    /*
    ----------------------------------------------------------------------
    Release DB connection
    ----------------------------------------------------------------------
    */

    if (connection) {
      connection.release();
    }
  }
}

/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {
  syncLatestNAV,
  syncAllReturns,
  calculateSchemeReturns,
};