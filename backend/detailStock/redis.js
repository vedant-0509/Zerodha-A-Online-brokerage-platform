const {
  createClient
} = require("redis");

const env = require("./env");

const redis = createClient({
  url: env.redisUrl
});

redis.on(
  "error",
  (error) => {
    console.error(
      "Redis Error:",
      error
    );
  }
);

redis.on(
  "connect",
  () => {
    console.log(
      "Redis connecting..."
    );
  }
);

redis.on(
  "ready",
  () => {
    console.log(
      "Redis ready"
    );
  }
);

redis.on(
  "reconnecting",
  () => {
    console.log(
      "Redis reconnecting..."
    );
  }
);

async function connectRedis() {
  if (redis.isOpen) {
    return redis;
  }

  await redis.connect();

  return redis;
}

async function closeRedis() {
  if (!redis.isOpen) {
    return;
  }

  await redis.quit();
}

module.exports = {
  redis,
  connectRedis,
  closeRedis
};