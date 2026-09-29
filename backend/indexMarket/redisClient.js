// const redis = require("redis");

// const client = redis.createClient({host: "127.0.0.1", port: 6379});

// // -------------------------------
// // Redis Events
// // -------------------------------

// client.on("connect", () => {
//     console.log("🔌 Connecting to Redis...");
// });

// client.on("ready", () => {
//     console.log("✅ Redis Ready");
// });

// client.on("error", (err) => {
//     console.error("❌ Redis Error:", err);
// });

// client.on("end", () => {
//     console.log("🔴 Redis Connection Closed");
// });

// client.on("reconnecting", () => {
//     console.log("♻️ Reconnecting to Redis...");
// });

// // -------------------------------
// // Connect Redis
// // -------------------------------

// async function connectRedis() {
//     return new Promise((resolve, reject) => {
//         client.ping((err, reply) => {
//             if (err) {
//                 return reject(err);
//             }
//             resolve();
//         });
//     });
// }

// module.exports = {redis: client, connectRedis};






















const path = require("path");
const dotenv = require("dotenv");
const redis = require("redis");

/*
|--------------------------------------------------------------------------
| LOAD ROOT BACKEND .ENV
|--------------------------------------------------------------------------
*/

dotenv.config({
    path: path.join(
        __dirname,
        "..",
        ".env"
    ),
});

/*
|--------------------------------------------------------------------------
| REDIS CONFIG
|--------------------------------------------------------------------------
*/

const REDIS_URL =
    process.env.REDIS_URL ||
    "redis://127.0.0.1:6379";

/*
|--------------------------------------------------------------------------
| REDIS CLIENT
|--------------------------------------------------------------------------
*/

const client =
    redis.createClient({
        url: REDIS_URL,
    });

/*
|--------------------------------------------------------------------------
| REDIS EVENTS
|--------------------------------------------------------------------------
*/

client.on(
    "connect",
    () => {
        console.log(
            "🔌 Connecting to Redis..."
        );
    }
);

client.on(
    "ready",
    () => {
        console.log(
            "✅ Redis Ready"
        );
    }
);

client.on(
    "error",
    (err) => {
        console.error(
            "❌ Redis Error:",
            err.message
        );
    }
);

client.on(
    "end",
    () => {
        console.log(
            "🔴 Redis Connection Closed"
        );
    }
);

client.on(
    "reconnecting",
    () => {
        console.log(
            "♻ Reconnecting to Redis..."
        );
    }
);

/*
|--------------------------------------------------------------------------
| CONNECTION LOCK
|--------------------------------------------------------------------------
*/

let connectingPromise =
    null;

/*
|--------------------------------------------------------------------------
| CONNECT REDIS
|--------------------------------------------------------------------------
*/

async function connectRedis() {
    /*
     * Already ready.
     */
    if (
        client.isReady
    ) {
        return client;
    }

    /*
     * Already connecting.
     */
    if (
        connectingPromise
    ) {
        return connectingPromise;
    }

    connectingPromise =
        (async () => {
            try {
                /*
                 * Redis v4/v5 requires
                 * connect() before commands.
                 */
                if (
                    !client.isOpen
                ) {
                    await client.connect();
                }

                /*
                 * Verify connection.
                 */
                await client.ping();

                console.log(
                    "✅ Redis connection verified"
                );

                return client;
            } finally {
                if (
                    client.isReady ||
                    !client.isOpen
                ) {
                    connectingPromise =
                        null;
                }
            }
        })();

    return connectingPromise;
}

/*
|--------------------------------------------------------------------------
| CLOSE REDIS
|--------------------------------------------------------------------------
*/

async function closeRedis() {
    try {
        if (
            client.isOpen
        ) {
            await client.quit();
        }
    } catch (
        error
    ) {
        console.error(
            "Redis shutdown error:",
            error.message
        );
    }
}

/*
|--------------------------------------------------------------------------
| MODERN REDIS METHODS
|--------------------------------------------------------------------------
|
| These use the current node-redis API.
|
|--------------------------------------------------------------------------
*/

function hGetAll(
    key
) {
    return client.hGetAll(
        key
    );
}

function hGet(
    key,
    field
) {
    return client.hGet(
        key,
        field
    );
}

function hSet(
    key,
    field,
    value
) {
    return client.hSet(
        key,
        field,
        value
    );
}

/*
|--------------------------------------------------------------------------
| BACKWARD-COMPATIBILITY METHODS
|--------------------------------------------------------------------------
|
| Your existing Index Market code uses old-style names:
|
| redis.hgetall(...)
| redis.hget(...)
| redis.hset(...)
|
| Keep those working so we do not have to rewrite the existing service.
|
| These wrappers support BOTH:
|
| redis.hgetall(key)
|
| and old callback style:
|
| redis.hgetall(key, callback)
|
|--------------------------------------------------------------------------
*/

function hgetall(
    key,
    callback
) {
    const promise =
        client.hGetAll(
            key
        );

    if (
        typeof callback ===
        "function"
    ) {
        promise
            .then(
                (result) =>
                    callback(
                        null,
                        result
                    )
            )
            .catch(
                (error) =>
                    callback(
                        error
                    )
            );

        return;
    }

    return promise;
}

function hget(
    key,
    field,
    callback
) {
    const promise =
        client.hGet(
            key,
            field
        );

    if (
        typeof callback ===
        "function"
    ) {
        promise
            .then(
                (result) =>
                    callback(
                        null,
                        result
                    )
            )
            .catch(
                (error) =>
                    callback(
                        error
                    )
            );

        return;
    }

    return promise;
}

function hset(
    key,
    field,
    value,
    callback
) {
    const promise =
        client.hSet(
            key,
            field,
            value
        );

    if (
        typeof callback ===
        "function"
    ) {
        promise
            .then(
                (result) =>
                    callback(
                        null,
                        result
                    )
            )
            .catch(
                (error) =>
                    callback(
                        error
                    )
            );

        return;
    }

    return promise;
}

/*
|--------------------------------------------------------------------------
| GENERIC GET / SET COMPATIBILITY
|--------------------------------------------------------------------------
*/

function get(
    key
) {
    return client.get(
        key
    );
}

function set(
    key,
    value,
    options
) {
    return client.set(
        key,
        value,
        options
    );
}

function del(
    key
) {
    return client.del(
        key
    );
}

/*
|--------------------------------------------------------------------------
| EXPORTED REDIS OBJECT
|--------------------------------------------------------------------------
|
| Existing code can continue doing:
|
| const { redis } = require("./redisClient");
|
| and use:
|
| redis.hgetall(...)
| redis.hget(...)
| redis.hset(...)
| redis.hGetAll(...)
| redis.hGet(...)
| redis.hSet(...)
|
|--------------------------------------------------------------------------
*/

const redisClient = {
    /*
     * Connection state
     */
    get isOpen() {
        return client.isOpen;
    },

    get isReady() {
        return client.isReady;
    },

    /*
     * Connection
     */
    connect: () =>
        connectRedis(),

    ping: () =>
        client.ping(),

    quit: () =>
        closeRedis(),

    disconnect:
        () => {
            if (
                typeof client.disconnect ===
                "function"
            ) {
                return client.disconnect();
            }
        },

    /*
     * String
     */
    get,

    set,

    del,

    /*
     * Modern Hash API
     */
    hGetAll,

    hGet,

    hSet,

    /*
     * Legacy Hash API
     */
    hgetall,

    hget,

    hset,

    /*
     * Expose events where existing
     * modules may need them.
     */
    on:
        (
            ...args
        ) =>
            client.on(
                ...args
            ),
};

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    redis:
        redisClient,

    redisClient:
        redisClient,

    client,

    connectRedis,

    closeRedis,
};