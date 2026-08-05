require("dotenv").config();

const mysql = require("mysql2/promise");
const axios = require("axios");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const searchRoutes = require("./search");
const { fetchNews } = require("./news");
const updatePreviousClose = require("./reInit"); // <-- fixed case, was "./reinit"

// MySQL (single shared pool used everywhere, including reInit.js)
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

// Upstox
const ACCESS_TOKEN = process.env.UPSTOX_ANALYTIC_TOKEN;

// Time after which today's update is allowed to run (24hr, IST)
// NOTE: 15:30 is the exact close. A couple of minutes' buffer (e.g. 15:32)
// is usually safer since the exchange/Upstox can lag slightly at the bell.
const CUTOFF_HOUR = 15;
const CUTOFF_MIN = 30;

app.use("/search", searchRoutes);

// TOP GAINERS
app.get("/top-gainers", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                symbol,
                company_name AS name,
                close_price AS price,
                volume,
                change_percent,
                change_points,
                exchange
            FROM market_gainerloser
            ORDER BY change_percent DESC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

// TOP LOSERS
app.get("/top-losers", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                symbol,
                company_name AS name,
                close_price AS price,
                volume,
                change_percent,
                change_points,
                exchange
            FROM market_gainerloser
            ORDER BY change_percent ASC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

// VOLUME SHOCKERS
app.get("/volume-shockers", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                symbol,
                company_name AS name,
                close_price AS price,
                volume,
                change_percent,
                change_points,
                exchange
            FROM market_gainerloser
            ORDER BY volume DESC
            LIMIT 10
        `);
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

// SECTOR TRENDS
app.get("/sector-trends", async (req, res) => {
    try {
        const [gainers] = await db.execute(`
            SELECT
                sector,
                COUNT(*) AS total,
                SUM(change_percent > 0) AS gainers,
                SUM(change_percent < 0) AS losers,
                ROUND(AVG(change_percent),2) AS avg_change
            FROM market_gainerloser
            WHERE sector IS NOT NULL
            GROUP BY sector
            ORDER BY avg_change DESC
            LIMIT 5
        `);

        const [losers] = await db.execute(`
            SELECT
                sector,
                COUNT(*) AS total,
                SUM(change_percent > 0) AS gainers,
                SUM(change_percent < 0) AS losers,
                ROUND(AVG(change_percent),2) AS avg_change
            FROM market_gainerloser
            WHERE sector IS NOT NULL
            GROUP BY sector
            ORDER BY avg_change ASC
            LIMIT 5
        `);
        res.json([...gainers, ...losers]);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

// NEWS
app.get("/market-news", async (req, res) => {
    try {
        const [rows] = await db.execute(`
        SELECT m.symbol,
        m.heading AS title,
        m.summary AS description,
        m.thumbnail AS image,
        m.article_link AS link,
        m.published_time AS published_at,
        'Upstox News' AS source
        FROM market_news m
        INNER JOIN (
        SELECT MIN(id) AS id
        FROM market_news
        GROUP BY article_link
    ) x
    ON m.id = x.id
ORDER BY m.published_time DESC
LIMIT 50;
`);
        res.json(rows);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});


// ============================================================
// ONE-TIME-PER-DAY UPDATE, ONLY AFTER MARKET CLOSE, ONLY ON WEEKDAYS
// ============================================================

// Returns the current time as its IST wall-clock fields (works regardless of
// the server's own timezone, e.g. if hosted on a UTC VPS).
function getISTNow() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

async function ensureLogTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS market_update_log (
            id INT PRIMARY KEY,
            last_run_date DATE NULL
        )
    `);
    await db.execute(`
        INSERT INTO market_update_log (id, last_run_date)
        VALUES (1, NULL)
        ON DUPLICATE KEY UPDATE id = id
    `);
}

async function hasAlreadyRunToday(todayStr) {
    const [[row]] = await db.execute(`
        SELECT DATE_FORMAT(last_run_date, '%Y-%m-%d') AS last_run_date
        FROM market_update_log
        WHERE id = 1
    `);
    return row && row.last_run_date === todayStr;
}

async function markRunAsDone(todayStr) {
    await db.execute(`UPDATE market_update_log SET last_run_date = ? WHERE id = 1`, [todayStr]);
}

async function getPreviousTradingDay() {
    const now = getISTNow();
    const d = new Date(now);

    // Before market closes -> "previous close" means yesterday's close
    if (now.getHours() < CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() < CUTOFF_MIN)) {
        d.setDate(d.getDate() - 1);
    }

    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() - 1);
    }

    return formatDate(d);
}

async function updateMarketData() {
    console.log("\nFetching today's market data...\n");

    let success = true;

    const [stocks] = await db.execute(`
        SELECT
            instrument_key,
            previous_close
        FROM market_gainerloser
        ORDER BY instrument_key
    `);

    console.log(`Found ${stocks.length} stocks\n`);

    for (const stock of stocks) {
        try {
            const previousClose = Number(stock.previous_close);
            const url = `https://api.upstox.com/v3/historical-candle/intraday/${encodeURIComponent(stock.instrument_key)}/days/1`;

            const { data } = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    Accept: "application/json",
                },
            });

            const candle = data?.data?.candles?.[0];

            if (!candle) {
                console.log(`No candle : ${stock.instrument_key}`);
                continue;
            }

            const open = Number(candle[1]);
            const high = Number(candle[2]);
            const low = Number(candle[3]);
            const close = Number(candle[4]);
            const volume = Number(candle[5]);

            let changePoints = 0;
            let changePercent = 0;

            if (previousClose > 0) {
                changePoints = +(close - previousClose).toFixed(2);
                changePercent = +((changePoints / previousClose) * 100).toFixed(2);
            }

            console.log({ symbol: stock.instrument_key, previousClose, close, changePoints, changePercent });

            await db.execute(`
                UPDATE market_gainerloser
                SET
                    trading_date = CURDATE(),
                    open_price=?,
                    high_price=?,
                    low_price=?,
                    close_price=?,
                    change_points=?,
                    change_percent=?,
                    volume=?,
                    updated_at = NOW()
                WHERE instrument_key=?
            `, [
                open,
                high,
                low,
                close,
                changePoints,
                changePercent,
                volume,
                stock.instrument_key
            ]);

            console.log(`✓ ${stock.instrument_key}  ${previousClose} -> ${close} (${changePercent}%)`);
        }
        catch (err) {
            success = false;
            console.log(`Error : ${stock.instrument_key}`);

            if (err.response) console.log(err.response.data);
            else console.log(err.message);
        }
    }

    if (success) {
        await db.execute(`
        UPDATE market_gainerloser
        SET previous_close = close_price`);
    } else {
        console.log("⚠ Some stocks failed. previous_close NOT updated.");
    }
}

async function checkAndRunDailyUpdate() {
    try {
        const now = getISTNow();
        const day = now.getDay();

        if (day === 0 || day === 6) return; // weekend, do nothing

        const afterCutoff = now.getHours() > CUTOFF_HOUR || (now.getHours() === CUTOFF_HOUR && now.getMinutes() >= CUTOFF_MIN);
        if (!afterCutoff) return; // market still open (or not yet closed), do nothing

        const todayStr = formatDate(now);
        if (await hasAlreadyRunToday(todayStr)) return; // already ran today, do nothing

        console.log(`\n[${todayStr}] Running post-market-close update...`);

        const previousTradingDay = await getPreviousTradingDay();
        console.log("Previous Trading Day:", previousTradingDay);

        await updatePreviousClose(db, previousTradingDay);
        await fetchNews();
        await updateMarketData();
        await markRunAsDone(todayStr);

        console.log(`[${todayStr}] Daily update marked as done.\n`);
    } catch (err) {
        console.error("checkAndRunDailyUpdate error:", err);
        // NOTE: markRunAsDone was never called, so a failed run will be
        // retried automatically on the next 60s tick.
    }
}

// ============================================================
// START SERVER
// ============================================================

(async () => {
    await ensureLogTable();
    await checkAndRunDailyUpdate(); // covers the case where server restarts after 3:30pm

    setInterval(checkAndRunDailyUpdate, 60 * 1000); // poll every 60s

    app.listen(3001, () => {
        console.log("Server Running...");
    });
})();