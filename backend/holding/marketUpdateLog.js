const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

async function alreadyUpdatedToday() {

    const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });

    const [rows] = await db.execute(
        `
        SELECT *
        FROM market_update_log
        WHERE last_run_date = ?
        `,
        [today]
    );

    return rows.length > 0;
}

async function saveUpdateLog() {

    const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
    });

    await db.execute(
        `
        INSERT INTO market_update_log(last_run_date)
        VALUES(?)
        ON DUPLICATE KEY UPDATE
        last_run_date = VALUES(last_run_date)
        `,
        [today]
    );
}

module.exports = {
    alreadyUpdatedToday,
    saveUpdateLog
};