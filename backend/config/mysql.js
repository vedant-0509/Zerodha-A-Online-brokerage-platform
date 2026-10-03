const mysql = require("mysql2/promise");
const env = require("./env");

function createMySqlPool(overrides = {}) {
    return mysql.createPool({
        host: env.mysql.host,
        port: env.mysql.port,
        user: env.mysql.user,
        password: env.mysql.password,
        database: env.mysql.database,
        waitForConnections: true,
        connectionLimit: env.mysql.connectionLimit,
        queueLimit: env.mysql.queueLimit,
        enableKeepAlive: true,
        keepAliveInitialDelay: env.mysql.keepAliveInitialDelay,
        connectTimeout: env.mysql.connectTimeout,
        decimalNumbers: true,
        ...overrides,
    });
}

module.exports = { createMySqlPool };
