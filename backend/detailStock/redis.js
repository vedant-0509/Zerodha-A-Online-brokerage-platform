const { createClient } = require("redis");

const redisUrl =
    process.env.REDIS_URL || "redis://127.0.0.1:6379";

const client = createClient({
    url: redisUrl,
});

client.on("error", (err) => {
    console.error("Redis Error:", err);
});

client.on("connect", () => {
    console.log("Redis connecting...");
});

client.on("ready", () => {
    console.log("Redis ready");
});

client.on("reconnecting", () => {
    console.log("Redis reconnecting...");
});

async function connectRedis() {
    if (client.isOpen) {
        return client;
    }

    await client.connect();

    return client;
}

async function closeRedis() {
    if (client.isOpen) {
        await client.quit();
    }
}

module.exports = {
    client,
    connectRedis,
    closeRedis,
};