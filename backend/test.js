require("dotenv").config();

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: "root",
    password: "root",
    database: "zerodha",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
require("dotenv").config();

const MF_API_URL = "https://api.mfapi.in/mf/latest";


function parseNavDate(dateString) {
    if (!dateString) return null;

    const [day, month, year] = dateString.split("-");

    if (!day || !month || !year) return null;

    return `${year}-${month}-${day}`;
}

async function fetchLatestNavs() {
    console.log("Fetching current NAV data...");

    const response = await fetch(MF_API_URL);

    if (!response.ok) {
        throw new Error(
            `MFapi error: ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Invalid MFapi response");
    }

    console.log(`Received ${data.length} current NAV records`);

    return data;
}

async function seedMutualFunds() {
    const connection = await pool.getConnection();

    try {
        console.log("=================================");
        console.log("MF CURRENT NAV SEED");
        console.log("=================================");

        const navs = await fetchLatestNavs();

        let inserted = 0;
        let failed = 0;

        for (const mf of navs) {
            try {
                await connection.execute(
                    `
                    INSERT INTO mf_schemes (
                        scheme_code,
                        scheme_name,
                        fund_house,
                        scheme_type,
                        scheme_category,
                        isin_growth,
                        isin_div_reinvestment,
                        current_nav,
                        nav_date,
                        is_active
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)
                    ON DUPLICATE KEY UPDATE
                        scheme_name = VALUES(scheme_name),
                        fund_house = VALUES(fund_house),
                        scheme_type = VALUES(scheme_type),
                        scheme_category = VALUES(scheme_category),
                        isin_growth = VALUES(isin_growth),
                        isin_div_reinvestment = VALUES(isin_div_reinvestment),
                        current_nav = VALUES(current_nav),
                        nav_date = VALUES(nav_date),
                        is_active = TRUE
                    `,
                    [
                        mf.schemeCode,
                        mf.schemeName,
                        mf.fundHouse || null,
                        mf.schemeType || null,
                        mf.schemeCategory || null,
                        mf.isinGrowth || null,
                        mf.isinDivReinvestment || null,
                        mf.nav ? Number(mf.nav) : null,
                        parseNavDate(mf.date)
                    ]
                );

                inserted++;

                if (inserted % 500 === 0) {
                    console.log(`Processed: ${inserted}/${navs.length}`);
                }

            } catch (error) {
                failed++;

                console.error(
                    `Failed scheme ${mf.schemeCode}: ${error.message}`
                );
            }
        }

        console.log("");
        console.log("=================================");
        console.log("SEED COMPLETED");
        console.log("=================================");
        console.log(`Total received: ${navs.length}`);
        console.log(`Processed:      ${inserted}`);
        console.log(`Failed:         ${failed}`);
        console.log("=================================");

    } catch (error) {
        console.error("MF SEED FAILED:", error);
        process.exitCode = 1;

    } finally {
        connection.release();
        await pool.end();
    }
}

seedMutualFunds();