const path = require("path");
const dotenv = require("dotenv");

/*
|--------------------------------------------------------------------------
| ALWAYS LOAD THE ROOT BACKEND .env
|--------------------------------------------------------------------------
|
| backend/
|   .env
|   config/
|      env.js
|
|--------------------------------------------------------------------------
*/

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

function required(name) {
  const value = process.env[name];

  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${name} is required in backend/.env`);
  }

  return String(value).trim();
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",

  authPort: Number(process.env.AUTH_PORT || 3010),

  jwtSecret: required("JWT_SECRET"),

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  frontendOrigins: String(
    process.env.FRONTEND_ORIGINS ||
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:3002",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),

  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",

    port: Number(process.env.MYSQL_PORT || 3306),

    user: process.env.MYSQL_USER || "root",

    password: process.env.MYSQL_PASSWORD || "",

    database: process.env.MYSQL_DATABASE || "zerodha",

    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),

    queueLimit: Number(process.env.MYSQL_QUEUE_LIMIT || 0),
  },

  authRateLimits: {
    loginWindowMs: Number(process.env.AUTH_LOGIN_WINDOW_MS || 15 * 60 * 1000),

    loginLimit: Number(process.env.AUTH_LOGIN_LIMIT || 5),

    signupWindowMs: Number(process.env.AUTH_SIGNUP_WINDOW_MS || 60 * 60 * 1000),

    signupLimit: Number(process.env.AUTH_SIGNUP_LIMIT || 10),
  },
};

if (
  !Number.isInteger(env.authPort) ||
  env.authPort < 1 ||
  env.authPort > 65535
) {
  throw new Error(`Invalid AUTH_PORT/PORT: ${env.authPort}`);
}

module.exports = env;
