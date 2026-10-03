const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
    path: path.join(__dirname, "..", ".env"),
});

function required(name) {
    const value = process.env[name];

    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        throw new Error(`${name} is required in backend/.env`);
    }

    return String(value).trim();
}

const env = {
    nodeEnv: process.env.NODE_ENV || "development",

    port: Number(process.env.PORT || 3000),

    internalHost:
        process.env.INTERNAL_HOST || "127.0.0.1",

    authPort: Number(process.env.AUTH_PORT || 3010),
    stocksPort: Number(process.env.STOCKS_PORT || 3001),
    holdingsPort: Number(process.env.HOLDINGS_PORT || 3006),
    ordersPort: Number(process.env.ORDERS_PORT || 3007),
    watchlistPort: Number(process.env.WATCHLIST_PORT || 3008),
    indexMarketPort: Number(process.env.INDEX_MARKET_PORT || 3020),
    detailStockPort: Number(process.env.DETAIL_STOCK_PORT || 3021),
    mutualFundPort: Number(process.env.MF_PORT || 5000),

    jwtSecret: required("JWT_SECRET"),

    jwtExpiresIn:
        process.env.JWT_EXPIRES_IN || "7d",

    frontendOrigins: String(
        process.env.FRONTEND_ORIGINS ||
            "http://localhost:3002,http://localhost:3000,http://localhost:3001,http://localhost:5173"
    )
        .split(",")
        .map((value) =>
            value.trim().replace(/\/+$/, "")
        )
        .filter(Boolean),

    mysql: {
        host:
            process.env.MYSQL_HOST || "127.0.0.1",
        port:
            Number(process.env.MYSQL_PORT || 3306),
        // Phase 7: application traffic uses a dedicated DB account.
        // MYSQL_USER / MYSQL_PASSWORD remain as backward-compatible fallbacks.
        user:
            process.env.MYSQL_APP_USER ||
            process.env.MYSQL_USER ||
            "root",
        password:
            process.env.MYSQL_APP_PASSWORD ??
            process.env.MYSQL_PASSWORD ??
            "",
        database:
            process.env.MYSQL_DATABASE || "zerodha",
        connectionLimit:
            Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
        queueLimit:
            Number(process.env.MYSQL_QUEUE_LIMIT || 0),
        keepAliveInitialDelay:
            Number(process.env.MYSQL_KEEPALIVE_INITIAL_DELAY_MS || 10000),
        connectTimeout:
            Number(process.env.MYSQL_CONNECT_TIMEOUT_MS || 10000),
    },

    apiRateLimits: {
        windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60 * 1000),
        limit: Number(process.env.API_RATE_LIMIT || 300),
    },

    authRateLimits: {
        loginWindowMs:
            Number(
                process.env.AUTH_LOGIN_WINDOW_MS ||
                    15 * 60 * 1000
            ),
        loginLimit:
            Number(
                process.env.AUTH_LOGIN_LIMIT || 5
            ),
        signupWindowMs:
            Number(
                process.env.AUTH_SIGNUP_WINDOW_MS ||
                    60 * 60 * 1000
            ),
        signupLimit:
            Number(
                process.env.AUTH_SIGNUP_LIMIT || 10
            ),
    },
};

module.exports = env;