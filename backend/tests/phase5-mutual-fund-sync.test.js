const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MF = path.join(ROOT, "mutualfunds");

const read = (file) =>
    fs.readFileSync(path.join(MF, file), "utf8");


// =========================================================
// MongoDB connection
// =========================================================

async function getMongo() {
    const {
        connectMongoDB,
        getMongoDB,
        closeMongoDB,
    } = require("../config/mongodb");

    await connectMongoDB();

    return {
        db: getMongoDB(),
        close: closeMongoDB,
    };
}


// =========================================================
// SOURCE TESTS
// =========================================================

test("Phase 5 source: one bulk latest-NAV provider call", () => {
    const source = read("mfSyncService.js");

    assert.equal(
        (source.match(/await getLatestFunds\(\)/g) || []).length,
        1
    );

    assert.match(
        source,
        /isActive/
    );
});


test("Phase 5 source: returns are incremental by NAV date", () => {
    const source = read("mfSyncService.js");

    assert.match(
        source,
        /returnsForNavDate/
    );

    assert.match(
        source,
        /navChangedSameDate/
    );

    assert.match(
        source,
        /shouldRecalculateDerivedMetrics/
    );
});


test("Phase 5 source: same-day NAV correction invalidates derived metrics", () => {
    const source = read("mfSyncService.js");

    assert.match(
        source,
        /return1y/
    );

    assert.match(
        source,
        /return3y/
    );

    assert.match(
        source,
        /return5y/
    );

    assert.match(
        source,
        /risk/
    );
});


test(
    "Phase 5 source: scheduler is 23:15 Asia/Kolkata and startup recovery is guarded",
    () => {
        const source = read("mfSyncScheduler.js");

        assert.match(
            source,
            /23:15|15 23/
        );

        assert.match(
            source,
            /Asia\/Kolkata/
        );

        assert.match(
            source,
            /MF_SYNC_STARTUP_RECOVERY/
        );

        assert.match(
            source,
            /shouldRecoverStartupSync/
        );

        assert.match(
            source,
            /getSyncStatus/
        );

        assert.match(
            source,
            /hasTodaysSyncSucceeded/
        );
    }
);


test(
    "Phase 5 source: daily recovery does not use an attempted-today block",
    () => {
        const source = read("mfSyncScheduler.js");

        assert.doesNotMatch(
            source,
            /hasAttemptedToday\(/
        );

        assert.doesNotMatch(
            source,
            /!isPastScheduledTimeToday\(/
        );

        assert.match(
            source,
            /FAILED|RUNNING|PENDING/
        );
    }
);


test(
    "Phase 5 source: sync monitoring covers daily, NAV, returns and rating stages",
    () => {
        const scheduler = read("mfSyncScheduler.js");
        const controller = read("mutualFundController.js");
        const status = read("mfSyncStatusService.js");

        assert.match(
            scheduler,
            /mf_returns_sync/
        );

        assert.match(
            scheduler,
            /mf_rating_sync/
        );

        assert.match(
            status,
            /getAllSyncStatuses/
        );

        assert.match(
            controller,
            /getAllSyncStatuses/
        );
    }
);


test(
    "Phase 5 source: manual sync and monitoring are ADMIN-only",
    () => {
        const routes = read("mutualFundRoutes.js");

        assert.match(
            routes,
            /sync-now.*authenticateToken.*requireRole.*ADMIN/
        );

        assert.match(
            routes,
            /sync-status.*authenticateToken.*requireRole.*ADMIN/
        );

        assert.match(
            routes,
            /sync.*authenticateToken.*requireRole.*ADMIN/
        );

        assert.match(
            routes,
            /sync-returns.*authenticateToken.*requireRole.*ADMIN/
        );
    }
);


// =========================================================
// MongoDB TESTS
// =========================================================

test(
    "Phase 5 source: unmatched NAV updates are counted as failures, not unchanged",
    () => {
        const source = read("mfSyncService.js");

        assert.match(
            source,
            /result\.matchedCount !== 1/
        );

        assert.match(
            source,
            /failed \+= 1/
        );

        assert.match(
            source,
            /Check the stored schemeCode type and duplicate active scheme records/
        );
    }
);


test(
    "Phase 5 source: separate Render cron can own the schedule without disabling startup recovery",
    () => {
        const source = read("server.js");

        assert.match(
            source,
            /MF_SYNC_EXTERNAL_CRON_ONLY/
        );

        assert.match(
            source,
            /In-process schedule disabled/
        );

        assert.match(
            source,
            /runStartupSync\(\)/
        );
    }
);


test(
    "Phase 5 MongoDB: sync monitoring documents exist",
    async () => {
        const { db, close } = await getMongo();

        try {
            const collection =
                db.collection("mfSyncStatus");

            const names = [
                "mf_daily_sync",
                "mf_nav_sync",
                "mf_returns_sync",
                "mf_rating_sync",
            ];

            const rows = await collection
                .find({
                    syncName: {
                        $in: names,
                    },
                })
                .project({
                    _id: 0,
                    syncName: 1,
                    status: 1,
                })
                .sort({
                    syncName: 1,
                })
                .toArray();

            assert.equal(
                rows.length,
                4,
                "Expected four Phase 5 sync status documents"
            );

            assert.deepEqual(
                rows.map((row) => row.syncName),
                [
                    "mf_daily_sync",
                    "mf_nav_sync",
                    "mf_rating_sync",
                    "mf_returns_sync",
                ]
            );
        } finally {
            await close();
        }
    }
);


test(
    "Phase 5 MongoDB: only active schemes form the sync universe and scheme codes are unique",
    async () => {
        const { db, close } = await getMongo();

        try {
            const collection =
                db.collection("mfSchemes");

            const activeCount =
                await collection.countDocuments({
                    isActive: true,
                });

            assert.ok(
                activeCount > 0,
                "No active mutual-fund schemes are configured"
            );

            const duplicateCodes =
                await collection
                    .aggregate([
                        {
                            $match: {
                                isActive: true,
                            },
                        },
                        {
                            $group: {
                                _id: "$schemeCode",
                                count: {
                                    $sum: 1,
                                },
                            },
                        },
                        {
                            $match: {
                                count: {
                                    $gt: 1,
                                },
                            },
                        },
                        {
                            $limit: 10,
                        },
                    ])
                    .toArray();

            assert.equal(
                duplicateCodes.length,
                0,
                "Duplicate active schemeCode values found"
            );
        } finally {
            await close();
        }
    }
);


test(
    "Phase 5 MongoDB: return audit fields exist for incremental processing",
    async () => {
        const { db, close } = await getMongo();

        try {
            const collection =
                db.collection("mfSchemes");

            const sample =
                await collection.findOne(
                    {
                        isActive: true,
                    },
                    {
                        projection: {
                            _id: 0,

                            returnsForNavDate: 1,
                            return1yNavDate: 1,
                            return3yNavDate: 1,
                            return5yNavDate: 1,
                            riskSource: 1,
                            riskUpdatedAt: 1,
                        },
                    }
                );

            assert.ok(
                sample,
                "No active mutual-fund scheme found"
            );

            const requiredFields = [
                "returnsForNavDate",
                "return1yNavDate",
                "return3yNavDate",
                "return5yNavDate",
                "riskSource",
                "riskUpdatedAt",
            ];

            for (const field of requiredFields) {
                assert.ok(
                    Object.prototype.hasOwnProperty.call(
                        sample,
                        field
                    ),
                    `Missing MongoDB field mfSchemes.${field}`
                );
            }
        } finally {
            await close();
        }
    }
);