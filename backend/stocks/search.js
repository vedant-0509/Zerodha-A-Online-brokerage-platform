const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

router.get("/", async (req, res) => {
    try {
        const search = (req.query.q || "").trim().toUpperCase();

        if (search.length < 2) {
            return res.json([]);
        }

        const [rows] = await db.execute(
            `
            SELECT
                instrument_key,
                symbol,
                name
            FROM market_stocks_data
            WHERE
                instrument_key IS NOT NULL
                AND (
                    SUBSTRING_INDEX(symbol,'.',1) LIKE ?
                    OR name LIKE ?
                )
            ORDER BY
                CASE
                    WHEN SUBSTRING_INDEX(symbol,'.',1)=? THEN 1
                    WHEN SUBSTRING_INDEX(symbol,'.',1) LIKE ? THEN 2
                    WHEN name LIKE ? THEN 3
                    ELSE 4
                END,
                symbol
            LIMIT 15
            `,
            [
                `%${search}%`,
                `%${search}%`,
                search,
                `${search}%`,
                `${search}%`
            ]
        );

        res.json(rows);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Search Failed"
        });
    }
});

module.exports = router;