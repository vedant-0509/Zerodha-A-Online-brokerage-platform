const { redis } = require("./redisClient");
const { instruments } = require("./indexMarketService");

function redisHGet(client, key, field) {
    return new Promise((resolve, reject) => {
        client.hget(key, field, (err, value) => {
            if (err) return reject(err);
            resolve(value);
        });
    });
}

function redisHGetAll(client, key) {
    return new Promise((resolve, reject) => {
        client.hgetall(key, (err, value) => {
            if (err) return reject(err);
            resolve(value || {});
        });
    });
}

function createClosingSnapshotValidator({ redis, instruments }) {
    return async function isClosingSnapshotComplete(expectedTradingDate) {
        if (
            typeof expectedTradingDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(expectedTradingDate)
        ) {
            return false;
        }

        if (!Array.isArray(instruments) || instruments.length === 0) {
            throw new Error("Cannot validate an empty index instrument list");
        }

        const [completedDate, snapshot] = await Promise.all([
            redisHGet(redis, "market_meta", "lastUpstoxUpdate"),
            redisHGetAll(redis, "market_snapshot"),
        ]);

        if (completedDate !== expectedTradingDate) {
            return false;
        }

        for (const key of instruments) {
            if (typeof key !== "string" || !key.trim()) {
                throw new Error("Invalid index instrument key");
            }

            let record;

            try {
                record = JSON.parse(snapshot[key] || "null");
            } catch {
                console.warn(`[Index Market] Invalid cached JSON for ${key}`);
                return false;
            }

            if (
                !record ||
                record.tradingDate !== expectedTradingDate ||
                typeof record.ltp !== "number" ||
                !Number.isFinite(record.ltp) ||
                record.ltp <= 0 ||
                typeof record.close !== "number" ||
                !Number.isFinite(record.close) ||
                record.close <= 0
            ) {
                console.warn(
                    `[Index Market] Closing snapshot incomplete for ${key}; expected ${expectedTradingDate}.`
                );
                return false;
            }
        }

        return true;
    };
}

const isClosingSnapshotComplete = createClosingSnapshotValidator({
    redis,
    instruments,
});

module.exports = {
    isClosingSnapshotComplete,
    createClosingSnapshotValidator,
};
