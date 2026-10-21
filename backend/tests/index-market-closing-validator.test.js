const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createClosingSnapshotValidator,
} = require("../indexMarket/closingSnapshotValidator");

const tradingDate = "2026-10-21";
const keys = [
    "NSE_INDEX|Nifty 50",
    "NSE_INDEX|Nifty Bank",
    "BSE_INDEX|SENSEX",
];

function createFakeRedis({ marker = tradingDate, snapshot = {} } = {}) {
    return {
        hget(hash, field, callback) {
            callback(
                null,
                hash === "market_meta" && field === "lastUpstoxUpdate"
                    ? marker
                    : null
            );
        },

        hgetall(hash, callback) {
            callback(null, hash === "market_snapshot" ? snapshot : {});
        },
    };
}

function makeSnapshot(date = tradingDate) {
    return Object.fromEntries(
        keys.map((key, index) => [
            key,
            JSON.stringify({
                ltp: 22800 + index,
                close: 22700 + index,
                tradingDate: date,
                updatedAt: Date.now(),
                source: "Upstox Historical",
            }),
        ])
    );
}

function validatorFor(options = {}) {
    return createClosingSnapshotValidator({
        redis: createFakeRedis({
            marker: options.marker ?? tradingDate,
            snapshot: options.snapshot ?? makeSnapshot(),
        }),
        instruments: keys,
    });
}

test("accepts a complete snapshot for the expected trading date", async () => {
    const validate = validatorFor();

    assert.equal(await validate(tradingDate), true);
});

test("rejects a matching marker when snapshot dates are missing", async () => {
    const snapshot = makeSnapshot();

    for (const key of keys) {
        const record = JSON.parse(snapshot[key]);
        delete record.tradingDate;
        snapshot[key] = JSON.stringify(record);
    }

    const validate = validatorFor({ snapshot });

    assert.equal(await validate(tradingDate), false);
});

test("rejects a snapshot from an older trading date", async () => {
    const validate = validatorFor({
        snapshot: makeSnapshot("2026-10-19"),
    });

    assert.equal(await validate(tradingDate), false);
});

test("rejects a marker for a different date", async () => {
    const validate = validatorFor({
        marker: "2026-10-19",
    });

    assert.equal(await validate(tradingDate), false);
});

test("rejects a snapshot missing a required index", async () => {
    const snapshot = makeSnapshot();
    delete snapshot["BSE_INDEX|SENSEX"];

    const validate = validatorFor({ snapshot });

    assert.equal(await validate(tradingDate), false);
});

test("rejects invalid prices", async () => {
    const snapshot = makeSnapshot();
    snapshot["NSE_INDEX|Nifty 50"] = JSON.stringify({
        ltp: 0,
        close: 22700,
        tradingDate,
    });

    const validate = validatorFor({ snapshot });

    assert.equal(await validate(tradingDate), false);
});

test("rejects malformed cached JSON", async () => {
    const snapshot = makeSnapshot();
    snapshot["NSE_INDEX|Nifty 50"] = "{invalid";

    const validate = validatorFor({ snapshot });

    assert.equal(await validate(tradingDate), false);
});
