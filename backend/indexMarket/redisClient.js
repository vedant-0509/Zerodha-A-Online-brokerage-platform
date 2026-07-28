const redis = require("redis");

const client = redis.createClient({host: "127.0.0.1", port: 6379});

// -------------------------------
// Redis Events
// -------------------------------

client.on("connect", () => {
    console.log("🔌 Connecting to Redis...");
});

client.on("ready", () => {
    console.log("✅ Redis Ready");
});

client.on("error", (err) => {
    console.error("❌ Redis Error:", err);
});

client.on("end", () => {
    console.log("🔴 Redis Connection Closed");
});

client.on("reconnecting", () => {
    console.log("♻️ Reconnecting to Redis...");
});

// -------------------------------
// Connect Redis
// -------------------------------

async function connectRedis() {
    return new Promise((resolve, reject) => {
        client.ping((err, reply) => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

module.exports = {redis: client, connectRedis};