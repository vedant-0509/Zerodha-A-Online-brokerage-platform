const test = require("node:test");
const assert = require("node:assert/strict");

const {
    publishClosingSnapshot,
} = require("../indexMarket/closingPriceService");

test("Redis transaction failure preserves cache and emits no snapshot", async () => {
    const previous = {
        ltp: 100,
        source: "Upstox Historical",
    };

    const marketCache = {
        "NSE_INDEX|Nifty 50": previous,
    };

    const staged = [
        {
            instrumentKey: "NSE_INDEX|Nifty 50",
            latest: { ltp: 110, source: "Upstox Historical" },
        },
    ];

    const redis = {
        multi() {
            return {
                hSet() {
                    return this;
                },
                async exec() {
                    throw new Error("simulated Redis failure");
                },
            };
        },
    };

    const emitted = [];
    const io = {
        emit(...args) {
            emitted.push(args);
        },
    };

    await assert.rejects(
        publishClosingSnapshot({
            staged,
            expectedTradingDate: "2026-10-21",
            marketCache,
            redis,
            io,
        }),
        /simulated Redis failure/,
    );

    assert.deepEqual(marketCache["NSE_INDEX|Nifty 50"], previous);
    assert.equal(emitted.length, 0);
});