require('dotenv').config();

const pool = require('./db');

const {
  getSchemeHistory,
  parseNavDate,
  subtractDays,
  addDays,
  roundNav,
} = require('./mfapiService');

const CONCURRENCY = Math.max(
  1,
  Number(process.env.MF_BACKFILL_CONCURRENCY || 5)
);

const DELAY_MS = Math.max(
  0,
  Number(process.env.MF_BACKFILL_DELAY_MS || 150)
);

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function backfill() {
  const connection = await pool.getConnection();

  let locked = false;

  try {
    /* -----------------------------------------
       Advisory lock
    ------------------------------------------ */
    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      ['mf_previous_nav_backfill']
    );

    locked = Number(lockRows[0]?.acquired) === 1;

    if (!locked) {
      console.log(
        'Another previous-NAV backfill is already running.'
      );

      return;
    }

    /* -----------------------------------------
       Get schemes that need previous NAV
    ------------------------------------------ */
    const [schemes] = await connection.query(
      `
      SELECT
        id,
        scheme_code,
        current_nav,
        nav_date
      FROM mf_schemes
      WHERE is_active = 1
        AND current_nav IS NOT NULL
        AND current_nav > 0
        AND nav_date IS NOT NULL
        AND previous_nav IS NULL
      ORDER BY id ASC
      `
    );

    console.log(
      `Schemes needing previous NAV: ${schemes.length}`
    );

    let cursor = 0;

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    /* -----------------------------------------
       Worker
    ------------------------------------------ */
    async function worker() {
      while (true) {
        const index = cursor++;

        if (index >= schemes.length) {
          return;
        }

        const scheme = schemes[index];

        try {
          const currentDate = parseNavDate(
            scheme.nav_date
          );

          if (!currentDate) {
            skipped++;
            continue;
          }

          /*
            Search a small historical window.
            No daily NAV table is created.
          */
          const start = subtractDays(
            currentDate,
            10
          );

          const end = addDays(
            currentDate,
            1
          );

          const history = await getSchemeHistory(
            scheme.scheme_code,
            start,
            end
          );

          const currentNav = roundNav(
            scheme.current_nav
          );

          const candidates = (
            Array.isArray(history)
              ? history
              : []
          )
            .map((item) => {
              /*
                MFAPI may return arrays.
              */
              if (Array.isArray(item)) {
                return {
                  date: parseNavDate(item[0]),
                  nav: roundNav(
                    item[1] ?? item[4]
                  ),
                };
              }

              /*
                Or object-like data.
              */
              return {
                date: parseNavDate(
                  item?.date ??
                  item?.navDate ??
                  item?.nav_date
                ),

                nav: roundNav(
                  item?.nav ??
                  item?.current_nav ??
                  item?.close
                ),
              };
            })
            .filter(
              (item) =>
                item.date &&
                Number.isFinite(item.nav) &&
                item.nav > 0 &&
                item.date < currentDate
            )
            .sort((a, b) =>
              a.date < b.date ? 1 : -1
            );

          const previous = candidates[0];

          if (!previous) {
            skipped++;
            continue;
          }

          const dayReturn =
            previous.nav > 0
              ? (
                  (currentNav - previous.nav) /
                  previous.nav
                ) * 100
              : null;

          await connection.query(
            `
            UPDATE mf_schemes
            SET
              previous_nav = ?,
              previous_nav_date = ?,
              return_1d = ?,
              return_1d_nav_date = ?,
              updated_at = NOW()
            WHERE id = ?
            `,
            [
              previous.nav,
              previous.date,
              dayReturn,
              currentDate,
              scheme.id,
            ]
          );

          updated++;
        } catch (error) {
          failed++;

          console.error(
            `[MF BACKFILL] ${scheme.scheme_code}: ${error.message}`
          );
        }

        if (DELAY_MS) {
          await sleep(DELAY_MS);
        }

        const processed =
          updated +
          skipped +
          failed;

        if (
          processed % 100 === 0 ||
          processed === schemes.length
        ) {
          console.log(
            `[MF BACKFILL] ${processed}/${schemes.length} ` +
            `updated=${updated} ` +
            `skipped=${skipped} ` +
            `failed=${failed}`
          );
        }
      }
    }

    /* -----------------------------------------
       Start workers
    ------------------------------------------ */
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

    console.log(
      `[MF BACKFILL] complete ` +
      `updated=${updated}, ` +
      `skipped=${skipped}, ` +
      `failed=${failed}`
    );
  } finally {
    /* -----------------------------------------
       Release advisory lock
    ------------------------------------------ */
    if (locked) {
      try {
        await connection.query(
          'SELECT RELEASE_LOCK(?)',
          ['mf_previous_nav_backfill']
        );
      } catch (_) {
        // Ignore release errors.
      }
    }

    connection.release();
  }
}

/* -----------------------------------------
   Run
------------------------------------------ */
backfill()
  .catch((error) => {
    console.error(
      '[MF BACKFILL] fatal:',
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // Ignore pool close errors.
    }
  });