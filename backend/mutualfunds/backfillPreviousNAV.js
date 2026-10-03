require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
} = require("../config/mongodb");

const {
  getSchemeHistory,
  parseNavDate,
  subtractDays,
  addDays,
  roundNav,
} = require("./mfapiService");

const CONCURRENCY = Math.max(
  1,
  Number(
    process.env.MF_BACKFILL_CONCURRENCY || 5
  )
);

const DELAY_MS = Math.max(
  0,
  Number(
    process.env.MF_BACKFILL_DELAY_MS || 150
  )
);

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

/*
|--------------------------------------------------------------------------
| Mongo lock
|--------------------------------------------------------------------------
|
| Replaces MySQL GET_LOCK().
|
*/

async function acquireLock(db) {
  const collection =
    db.collection("mfSyncLocks");

  const now = new Date();

  try {
    await collection.insertOne({
      _id: "mf_previous_nav_backfill",
      status: "RUNNING",
      startedAt: now,
      updatedAt: now,
    });

    return true;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }

    throw error;
  }
}

async function releaseLock(db) {
  await db
    .collection("mfSyncLocks")
    .deleteOne({
      _id: "mf_previous_nav_backfill",
    });
}

/*
|--------------------------------------------------------------------------
| Backfill
|--------------------------------------------------------------------------
*/

async function backfill() {
  await connectMongoDB();

  const db = getMongoDB();

  const locked =
    await acquireLock(db);

  if (!locked) {
    console.log(
      "Another previous-NAV backfill is already running."
    );

    return;
  }

  try {
    const schemes =
      await db
        .collection("mfSchemes")
        .find({
          isActive: true,

          currentNav: {
            $ne: null,
            $gt: 0,
          },

          navDate: {
            $ne: null,
          },

          previousNav: null,
        })
        .sort({
          mysqlId: 1,
          schemeCode: 1,
        })
        .toArray();

    console.log(
      `Schemes needing previous NAV: ${schemes.length}`
    );

    let cursor = 0;

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    async function worker() {
      while (true) {
        const index = cursor++;

        if (
          index >=
          schemes.length
        ) {
          return;
        }

        const scheme =
          schemes[index];

        try {
          const currentDate =
            parseNavDate(
              scheme.navDate
            );

          if (!currentDate) {
            skipped++;
            continue;
          }

          const start =
            subtractDays(
              currentDate,
              10
            );

          const end =
            addDays(
              currentDate,
              1
            );

          const history =
            await getSchemeHistory(
              scheme.schemeCode,
              start,
              end
            );

          const currentNav =
            roundNav(
              scheme.currentNav
            );

          const candidates =
            (
              Array.isArray(history)
                ? history
                : []
            )
              .map((item) => {
                if (
                  Array.isArray(item)
                ) {
                  return {
                    date:
                      parseNavDate(
                        item[0]
                      ),

                    nav:
                      roundNav(
                        item[1] ??
                        item[4]
                      ),
                  };
                }

                return {
                  date:
                    parseNavDate(
                      item?.date ??
                      item?.navDate ??
                      item?.nav_date
                    ),

                  nav:
                    roundNav(
                      item?.nav ??
                      item?.current_nav ??
                      item?.close
                    ),
                };
              })
              .filter(
                (item) =>
                  item.date &&
                  Number.isFinite(
                    item.nav
                  ) &&
                  item.nav > 0 &&
                  item.date <
                    currentDate
              )
              .sort((a, b) =>
                a.date < b.date
                  ? 1
                  : -1
              );

          const previous =
            candidates[0];

          if (!previous) {
            skipped++;
            continue;
          }

          const dayReturn =
            previous.nav > 0
              ? (
                  (
                    currentNav -
                    previous.nav
                  ) /
                  previous.nav
                ) * 100
              : null;

          const result =
            await db
              .collection("mfSchemes")
              .updateOne(
                {
                  _id:
                    scheme._id,

                  schemeCode:
                    scheme.schemeCode,

                  isActive: true,

                  previousNav: null,
                },
                {
                  $set: {
                    previousNav:
                      previous.nav,

                    previousNavDate:
                      previous.date,

                    return1d:
                      dayReturn,

                    return1dNavDate:
                      currentDate,

                    updatedAt:
                      new Date(),
                  },
                }
              );

          if (
            result.modifiedCount === 1
          ) {
            updated++;
          } else {
            skipped++;
          }
        } catch (error) {
          failed++;

          console.error(
            `[MF BACKFILL] ${scheme.schemeCode}: ${error.message}`
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
          processed ===
            schemes.length
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
    await releaseLock(db);
  }
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

backfill().catch((error) => {
  console.error(
    "[MF BACKFILL] fatal:",
    error
  );

  process.exitCode = 1;
});