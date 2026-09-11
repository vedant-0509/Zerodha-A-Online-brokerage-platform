const pool = require("./db");

const {
  getSchemeHistory,
  calculateReturns,
  parseNavDate,
} = require("./mfapiService");

const {
  syncLatestNAV,
  syncAllReturns
} = require("./mfSyncService");

const { runDailySyncIfNeeded } = require("./mfSyncScheduler");
const { getSyncStatus } = require("./mfSyncStatusService");

const { v4: uuidv4 } = require("uuid");
/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getFundType(category, name) {
  const value = `${category || ""} ${name || ""}`.toLowerCase();

  /*
    |--------------------------------------------------------------------------
    | Commodity
    |--------------------------------------------------------------------------
    */

  if (
    value.includes("gold") ||
    value.includes("silver") ||
    value.includes("commodity")
  ) {
    return "COMMODITY";
  }

  /*
    |--------------------------------------------------------------------------
    | Hybrid
    |--------------------------------------------------------------------------
    */

  if (
    value.includes("hybrid") ||
    value.includes("balanced advantage") ||
    value.includes("multi asset") ||
    value.includes("multi-asset") ||
    value.includes("aggressive hybrid") ||
    value.includes("conservative hybrid")
  ) {
    return "HYBRID";
  }

  /*
    |--------------------------------------------------------------------------
    | Debt
    |--------------------------------------------------------------------------
    */

  if (
    value.includes("debt") ||
    value.includes("bond") ||
    value.includes("liquid") ||
    value.includes("gilt") ||
    value.includes("overnight") ||
    value.includes("money market") ||
    value.includes("ultra short") ||
    value.includes("short duration") ||
    value.includes("medium duration") ||
    value.includes("long duration") ||
    value.includes("credit risk") ||
    value.includes("floater") ||
    value.includes("banking & psu")
  ) {
    return "DEBT";
  }

  /*
    |--------------------------------------------------------------------------
    | Default
    |--------------------------------------------------------------------------
    */

  return "EQUITY";
}

function getFundSubCategory(category, name) {
  const value = `${category || ""} ${name || ""}`.toLowerCase();

  if (value.includes("flexi")) {
    return "Flexi Cap";
  }

  if (value.includes("large & mid")) {
    return "Large & Mid Cap";
  }

  if (value.includes("large cap")) {
    return "Large Cap";
  }

  if (value.includes("mid cap")) {
    return "Mid Cap";
  }

  if (value.includes("small cap")) {
    return "Small Cap";
  }

  if (value.includes("index")) {
    return "Index";
  }

  if (value.includes("sectoral")) {
    return "Sectoral";
  }

  if (value.includes("thematic")) {
    return "Thematic";
  }

  if (value.includes("gold")) {
    return "Gold";
  }

  if (value.includes("silver")) {
    return "Silver";
  }

  if (value.includes("corporate bond")) {
    return "Corporate Bond";
  }

  if (value.includes("liquid")) {
    return "Liquid";
  }

  if (value.includes("gilt")) {
    return "Gilt";
  }

  if (value.includes("aggressive hybrid")) {
    return "Aggressive Hybrid";
  }

  if (value.includes("conservative hybrid")) {
    return "Conservative Hybrid";
  }

  if (value.includes("multi asset") || value.includes("multi-asset")) {
    return "Multi Asset";
  }

  if (value.includes("retirement")) {
    return "Retirement";
  }

  if (value.includes("children") || value.includes("childrens")) {
    return "Children";
  }

  if (value.includes("fund of fund") || value.includes("fof")) {
    return "Fund of Funds";
  }

  return category || "Other";
}

function normalizeRisk(risk) {
  if (!risk) {
    return null;
  }

  const value = String(risk).trim().toLowerCase();

  if (value.includes("very high")) {
    return "Very High";
  }

  if (value.includes("moderately high")) {
    return "Moderately High";
  }

  if (value === "high") {
    return "High";
  }

  if (value.includes("moderately low")) {
    return "Moderately Low";
  }

  if (value === "low") {
    return "Low";
  }

  if (value.includes("moderate")) {
    return "Moderate";
  }

  return risk;
}

/*
|--------------------------------------------------------------------------
| GET MUTUAL FUNDS
|--------------------------------------------------------------------------
|
| Frontend sends:
|
| page=0
| limit=50
| search=hdfc
| fundType=EQUITY
| category=Flexi Cap
| risk=Very High
| rating=4
| fundHouse=HDFC Mutual Fund
| quickFilter=large
| sortBy=1Y
| sortDirection=desc
|
*/

async function getMutualFunds(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);
    const offset = (page - 1) * limit;

    const search = String(req.query.search || '').trim();
    const fundType = String(req.query.fundType || req.query.fund_type || '').trim();
    const category = String(req.query.category || '').trim();
    const risk = String(req.query.risk || '').trim();
    const fundHouse = String(req.query.fundHouse || req.query.fund_house || '').trim();
    const ratingMinRaw = req.query.ratingMin ?? req.query.rating_min;
    const ratingMin = ratingMinRaw === undefined || ratingMinRaw === '' ? null : Number(ratingMinRaw);
    const quickFilter = String(req.query.quickFilter || req.query.quick_filter || '').trim().toLowerCase();
    const indexOnly = String(req.query.indexOnly || req.query.index_only || '').toLowerCase() === 'true';
    const sortBy = String(req.query.sortBy || req.query.sort_by || 'name').trim().toLowerCase();
    const sortDirection = String(req.query.sortDirection || req.query.sort_direction || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const where = ['s.is_active = 1'];
    const params = [];

    if (search) {
      const q = `%${search}%`;
      where.push(`(s.scheme_name LIKE ? OR s.fund_house LIKE ? OR s.scheme_category LIKE ? OR s.fund_sub_category LIKE ?)`);
      params.push(q, q, q, q);
    }

    const csv = (value) => value.split(',').map(v => v.trim()).filter(Boolean);

    if (fundType) {
      const values = csv(fundType);
      where.push(`s.fund_type IN (${values.map(() => '?').join(',')})`);
      params.push(...values);
    }

    if (category) {
      const values = csv(category);
      where.push(`(s.fund_sub_category IN (${values.map(() => '?').join(',')}) OR s.scheme_category IN (${values.map(() => '?').join(',')}))`);
      params.push(...values, ...values);
    }

    if (risk) {
      const values = csv(risk);
      where.push(`s.risk IN (${values.map(() => '?').join(',')})`);
      params.push(...values);
    }

    if (fundHouse) {
      const values = csv(fundHouse);
      where.push(`s.fund_house IN (${values.map(() => '?').join(',')})`);
      params.push(...values);
    }

    if (Number.isFinite(ratingMin)) {
      where.push('s.rating >= ?');
      params.push(ratingMin);
    }

    if (indexOnly) {
      where.push(`(LOWER(s.scheme_name) LIKE '%index%' OR LOWER(s.scheme_category) LIKE '%index%' OR LOWER(s.fund_sub_category) LIKE '%index%')`);
    }

    const addLikeFilter = (parts) => {
      where.push(`(${parts.map(p => `LOWER(${p}) LIKE ?`).join(' OR ')})`);
      params.push(...parts.map(() => `%${quickFilter}%`));
    };

    switch (quickFilter) {
      case 'index':
      case 'index_only':
        where.push(`(LOWER(s.scheme_name) LIKE '%index%' OR LOWER(s.scheme_category) LIKE '%index%' OR LOWER(s.fund_sub_category) LIKE '%index%')`);
        break;
      case 'flexi':
      case 'flexicap':
        where.push(`(LOWER(s.scheme_name) LIKE '%flexi cap%' OR LOWER(s.scheme_category) LIKE '%flexi cap%' OR LOWER(s.fund_sub_category) LIKE '%flexi cap%')`);
        break;
      case 'sectoral':
        where.push(`(LOWER(s.scheme_category) LIKE '%sectoral%' OR LOWER(s.scheme_category) LIKE '%thematic%' OR LOWER(s.fund_sub_category) LIKE '%sectoral%' OR LOWER(s.fund_sub_category) LIKE '%thematic%')`);
        break;
      case 'large':
      case 'largecap':
        where.push(`(LOWER(s.scheme_category) LIKE '%large cap%' OR LOWER(s.fund_sub_category) LIKE '%large cap%')`);
        break;
      case '4plus':
      case 'rating4':
        where.push('s.rating >= 4');
        break;
      default:
        break;
    }

    const sortMap = {
      name: 's.scheme_name',
      schemename: 's.scheme_name',
      '1y': 's.return_1y',
      '3y': 's.return_3y',
      '5y': 's.return_5y',
      rating: 's.rating',
      risk: 's.risk',
      nav: 's.current_nav',
    };
    const orderColumn = sortMap[sortBy] || 's.scheme_name';
    const nullsLast = ['s.return_1y', 's.return_3y', 's.return_5y', 's.rating', 's.current_nav'].includes(orderColumn)
      ? `${orderColumn} IS NULL, ${orderColumn} ${sortDirection}`
      : `${orderColumn} ${sortDirection}`;
    const whereSQL = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM mf_schemes s ${whereSQL}`, params);
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query(
      `SELECT
        s.id, s.scheme_code, s.scheme_name, s.fund_house, s.scheme_type,
        s.scheme_category, s.fund_type, s.fund_sub_category,
        s.isin_growth, s.isin_div_reinvestment, ROUND(s.current_nav, 2) AS current_nav, s.nav_date,
        s.return_1y, s.return_3y, s.return_5y,
        s.returns_for_nav_date,
        s.return_1y_nav_date, s.return_3y_nav_date, s.return_5y_nav_date,
        s.rating, s.rating_source, s.rating_updated_at,
        s.risk, s.risk_source, s.risk_updated_at, s.return_updated_at
       FROM mf_schemes s
       ${whereSQL}
       ORDER BY ${nullsLast}, s.id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        funds: rows,
        total,
        page,
        limit,
        offset,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (error) {
    console.error('[MF API] getMutualFunds:', error);
    res.status(500).json({ success: false, message: 'Failed to load mutual funds', error: error.message });
  }
}

async function getMutualFundFilters(req, res) {
  try {
    const [houses] = await pool.query(`
      SELECT DISTINCT fund_house
      FROM mf_schemes
      WHERE is_active = 1 AND fund_house IS NOT NULL AND TRIM(fund_house) <> ''
      ORDER BY fund_house ASC
    `);

    const [categories] = await pool.query(`
      SELECT DISTINCT fund_type, fund_sub_category
      FROM mf_schemes
      WHERE is_active = 1 AND fund_sub_category IS NOT NULL AND TRIM(fund_sub_category) <> ''
      ORDER BY fund_type ASC, fund_sub_category ASC
    `);

    const [risks] = await pool.query(`
      SELECT DISTINCT risk
      FROM mf_schemes
      WHERE is_active = 1 AND risk IS NOT NULL
      ORDER BY FIELD(risk, 'Low', 'Low to Moderate', 'Moderate', 'Moderately High', 'High', 'Very High')
    `);

    const [ratings] = await pool.query(`
      SELECT DISTINCT rating
      FROM mf_schemes
      WHERE is_active = 1 AND rating IS NOT NULL
      ORDER BY rating DESC
    `);

    const grouped = { EQUITY: [], DEBT: [], HYBRID: [], COMMODITY: [] };
    for (const row of categories) {
      if (!grouped[row.fund_type]) grouped[row.fund_type] = [];
      if (!grouped[row.fund_type].includes(row.fund_sub_category)) grouped[row.fund_type].push(row.fund_sub_category);
    }

    res.json({
      success: true,
      data: {
        fundHouses: houses.map(x => x.fund_house),
        categories: categories.map(x => x.fund_sub_category).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i),
        categoryGroups: grouped,
        risks: risks.map(x => x.risk),
        ratings: ratings.map(x => Number(x.rating)),
      },
    });
  } catch (error) {
    console.error('[MF API] getMutualFundFilters:', error);
    res.status(500).json({ success: false, message: 'Failed to load mutual fund filters', error: error.message });
  }
}

/*
|--------------------------------------------------------------------------
| GET SINGLE MUTUAL FUND
|--------------------------------------------------------------------------
*/

async function getMutualFund(req, res) {
  try {
    const { schemeCode } = req.params;

    const [rows] = await pool.query(
      `
                SELECT

                    id,

                    scheme_code,

                    scheme_name,

                    fund_house,

                    scheme_type,

                    scheme_category,

                    fund_type,

                    fund_sub_category,

                    isin_growth,

                    isin_div_reinvestment,

                    ROUND(current_nav, 2) AS current_nav,

                    nav_date,

                    return_1y,

                    return_3y,

                    return_5y,

                    rating,

                    risk

                FROM mf_schemes

                WHERE scheme_code = ?

                LIMIT 1
                `,
      [schemeCode],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,

        message: "Mutual fund not found",
      });
    }

    const row = rows[0];

    res.json({
      success: true,

      data: {
        id: row.id,

        schemeCode: row.scheme_code,

        schemeName: row.scheme_name,

        fundHouse: row.fund_house,

        schemeType: row.scheme_type,

        schemeCategory: row.scheme_category,

        fundType: row.fund_type,

        fundSubCategory: row.fund_sub_category,

        currentNav: row.current_nav,

        navDate: row.nav_date,

        return1Y: row.return_1y,

        return3Y: row.return_3y,

        return5Y: row.return_5y,

        rating: row.rating,

        risk: row.risk,
      },
    });
  } catch (error) {
    console.error("getMutualFund error:", error);

    res.status(500).json({
      success: false,

      message: "Unable to load mutual fund",

      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| BUY
|--------------------------------------------------------------------------
|
| {
|     userId: "...",
|     schemeCode: 119551,
|     amount: 5000
| }
|
*/

async function buyMutualFund(req, res) {
  const connection = await pool.getConnection();

  try {
    const { userId, schemeCode, amount } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,

        message: "userId is required",
      });
    }

    if (!schemeCode) {
      return res.status(400).json({
        success: false,

        message: "schemeCode is required",
      });
    }

    const investmentAmount = Number(amount);

    if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) {
      return res.status(400).json({
        success: false,

        message: "amount must be greater than 0",
      });
    }

    await connection.beginTransaction();

    /*
        |--------------------------------------------------------------------------
        | Lock MF scheme
        |--------------------------------------------------------------------------
        */

    const [schemes] = await connection.query(
      `
                SELECT

                    id,

                    scheme_code,

                    scheme_name,

                    current_nav,

                    nav_date

                FROM mf_schemes

                WHERE scheme_code = ?

                  AND is_active = 1

                LIMIT 1

                FOR UPDATE
                `,
      [schemeCode],
    );

    if (!schemes.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message: "Mutual fund not found",
      });
    }

    const scheme = schemes[0];

    const nav = Number(Number(scheme.current_nav).toFixed(2));

    if (!Number.isFinite(nav) || nav <= 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message: "Current NAV unavailable",
      });
    }

    /*
        |--------------------------------------------------------------------------
        | Calculate units
        |--------------------------------------------------------------------------
        */

    const units = investmentAmount / nav;

    /*
        |--------------------------------------------------------------------------
        | Create order
        |--------------------------------------------------------------------------
        */

    const orderId = uuidv4();

    await connection.query(
      `
            INSERT INTO mf_orders (

                order_id,

                user_id,

                scheme_id,

                order_type,

                units,

                nav,

                amount,

                nav_date,

                status,

                completed_at

            )

            VALUES (
                ?,
                ?,
                ?,
                'BUY',
                ?,
                ?,
                ?,
                ?,
                'COMPLETED',
                NOW()
            )
            `,
      [
        orderId,

        userId,

        scheme.id,

        units,

        nav,

        investmentAmount,

        scheme.nav_date,
      ],
    );

    /*
        |--------------------------------------------------------------------------
        | Create / update holding
        |--------------------------------------------------------------------------
        */

    await connection.query(
      `
            INSERT INTO mf_holdings (

                user_id,

                scheme_id,

                units,

                invested_amount

            )

            VALUES (
                ?,
                ?,
                ?,
                ?
            )

            ON DUPLICATE KEY UPDATE

                units =
                    units +
                    VALUES(units),

                invested_amount =
                    invested_amount +
                    VALUES(invested_amount)
            `,
      [userId, scheme.id, units, investmentAmount],
    );

    await connection.commit();

    res.status(201).json({
      success: true,

      message: "Mutual fund BUY order completed",

      data: {
        orderId,

        orderType: "BUY",

        schemeCode: scheme.scheme_code,

        schemeName: scheme.scheme_name,

        units: Number(units.toFixed(8)),

        nav,

        amount: investmentAmount,

        navDate: scheme.nav_date,

        status: "COMPLETED",
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("buyMutualFund error:", error);

    res.status(500).json({
      success: false,

      message: "Unable to place BUY order",

      error: error.message,
    });
  } finally {
    connection.release();
  }
}

/*
|--------------------------------------------------------------------------
| SELL
|--------------------------------------------------------------------------
|
| {
|     userId: "...",
|     schemeCode: 119551,
|     units: 10
| }
|
*/

async function sellMutualFund(req, res) {
  const connection = await pool.getConnection();

  try {
    const { userId, schemeCode, units } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,

        message: "userId is required",
      });
    }

    if (!schemeCode) {
      return res.status(400).json({
        success: false,

        message: "schemeCode is required",
      });
    }

    const sellUnits = Number(units);

    if (!Number.isFinite(sellUnits) || sellUnits <= 0) {
      return res.status(400).json({
        success: false,

        message: "units must be greater than 0",
      });
    }

    await connection.beginTransaction();

    /*
        |--------------------------------------------------------------------------
        | Lock scheme
        |--------------------------------------------------------------------------
        */

    const [schemes] = await connection.query(
      `
                SELECT

                    id,

                    scheme_code,

                    scheme_name,

                    current_nav,

                    nav_date

                FROM mf_schemes

                WHERE scheme_code = ?

                  AND is_active = 1

                LIMIT 1

                FOR UPDATE
                `,
      [schemeCode],
    );

    if (!schemes.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,

        message: "Mutual fund not found",
      });
    }

    const scheme = schemes[0];

    const nav = Number(Number(scheme.current_nav).toFixed(2));

    if (!Number.isFinite(nav) || nav <= 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message: "Current NAV unavailable",
      });
    }

    /*
        |--------------------------------------------------------------------------
        | Lock holding
        |--------------------------------------------------------------------------
        */

    const [holdings] = await connection.query(
      `
                SELECT

                    id,

                    units,

                    invested_amount

                FROM mf_holdings

                WHERE user_id = ?

                  AND scheme_id = ?

                LIMIT 1

                FOR UPDATE
                `,
      [userId, scheme.id],
    );

    if (!holdings.length) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message: "No mutual fund holding found",
      });
    }

    const holding = holdings[0];

    const availableUnits = Number(holding.units);

    if (sellUnits > availableUnits + 0.00000001) {
      await connection.rollback();

      return res.status(400).json({
        success: false,

        message: "Insufficient mutual fund units",

        availableUnits,
      });
    }

    /*
        |--------------------------------------------------------------------------
        | SELL amount
        |--------------------------------------------------------------------------
        */

    const amount = sellUnits * nav;

    /*
        |--------------------------------------------------------------------------
        | Create SELL order
        |--------------------------------------------------------------------------
        */

    const orderId = uuidv4();

    await connection.query(
      `
            INSERT INTO mf_orders (

                order_id,

                user_id,

                scheme_id,

                order_type,

                units,

                nav,

                amount,

                nav_date,

                status,

                completed_at

            )

            VALUES (
                ?,
                ?,
                ?,
                'SELL',
                ?,
                ?,
                ?,
                ?,
                'COMPLETED',
                NOW()
            )
            `,
      [orderId, userId, scheme.id, sellUnits, nav, amount, scheme.nav_date],
    );

    /*
        |--------------------------------------------------------------------------
        | Reduce invested amount proportionally
        |--------------------------------------------------------------------------
        */

    const oldInvested = Number(holding.invested_amount);

    let remainingInvested = 0;

    if (availableUnits > 0) {
      remainingInvested =
        oldInvested * ((availableUnits - sellUnits) / availableUnits);
    }

    const remainingUnits = availableUnits - sellUnits;

    /*
        |--------------------------------------------------------------------------
        | Update holding
        |--------------------------------------------------------------------------
        */

    if (remainingUnits <= 0.00000001) {
      await connection.query(
        `
                DELETE FROM mf_holdings

                WHERE id = ?
                `,
        [holding.id],
      );
    } else {
      await connection.query(
        `
                UPDATE mf_holdings

                SET

                    units = ?,

                    invested_amount = ?

                WHERE id = ?
                `,
        [remainingUnits, remainingInvested, holding.id],
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,

      message: "Mutual fund SELL order completed",

      data: {
        orderId,

        orderType: "SELL",

        schemeCode: scheme.scheme_code,

        schemeName: scheme.scheme_name,

        units: Number(sellUnits.toFixed(8)),

        nav,

        amount: Number(amount.toFixed(2)),

        navDate: scheme.nav_date,

        status: "COMPLETED",
      },
    });
  } catch (error) {
    await connection.rollback();

    console.error("sellMutualFund error:", error);

    res.status(500).json({
      success: false,

      message: "Unable to place SELL order",

      error: error.message,
    });
  } finally {
    connection.release();
  }
}

/*
|--------------------------------------------------------------------------
| GET USER HOLDINGS
|--------------------------------------------------------------------------
*/

async function getMutualFundHoldings(req, res) {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
                SELECT

                    h.id,

                    h.user_id,

                    h.units,

                    h.invested_amount,

                    h.created_at,

                    h.updated_at,

                    s.id AS scheme_id,

                    s.scheme_code,

                    s.scheme_name,

                    s.fund_house,

                    s.scheme_category,

                    s.fund_type,

                    s.fund_sub_category,

                    s.current_nav,

                    s.nav_date,

                    s.return_1y,

                    s.return_3y,

                    s.return_5y,

                    s.rating,

                    s.risk,

                    (
                        h.units *
                        s.current_nav
                    ) AS current_value

                FROM mf_holdings h

                INNER JOIN mf_schemes s
                    ON s.id = h.scheme_id

                WHERE h.user_id = ?

                ORDER BY
                    h.updated_at DESC
                `,
      [userId],
    );

    const holdings = rows.map((row) => {
      const invested = Number(row.invested_amount);

      const currentValue = Number(row.current_value);

      return {
        id: row.id,

        userId: row.user_id,

        schemeId: row.scheme_id,

        schemeCode: row.scheme_code,

        schemeName: row.scheme_name,

        fundHouse: row.fund_house,

        schemeCategory: row.scheme_category,

        fundType: row.fund_type,

        fundSubCategory: row.fund_sub_category,

        units: Number(row.units),

        investedAmount: invested,

        currentNav: Number(Number(row.current_nav).toFixed(2)),

        currentValue,

        navDate: row.nav_date,

        return1Y: row.return_1y,

        return3Y: row.return_3y,

        return5Y: row.return_5y,

        rating: row.rating,

        risk: row.risk,

        profitLoss: Number((currentValue - invested).toFixed(2)),

        createdAt: row.created_at,

        updatedAt: row.updated_at,
      };
    });

    res.json({
      success: true,

      data: holdings,

      holdings,
    });
  } catch (error) {
    console.error("getMutualFundHoldings error:", error);

    res.status(500).json({
      success: false,

      message: "Unable to load mutual fund holdings",

      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET USER ORDERS
|--------------------------------------------------------------------------
*/

async function getMutualFundOrders(req, res) {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
                SELECT

                    o.id,

                    o.order_id,

                    o.user_id,

                    o.order_type,

                    o.units,

                    o.nav,

                    o.amount,

                    o.nav_date,

                    o.status,

                    o.created_at,

                    o.completed_at,

                    s.scheme_code,

                    s.scheme_name,

                    s.fund_house

                FROM mf_orders o

                INNER JOIN mf_schemes s
                    ON s.id = o.scheme_id

                WHERE o.user_id = ?

                ORDER BY
                    o.created_at DESC
                `,
      [userId],
    );

    const orders = rows.map((row) => ({
      id: row.id,

      orderId: row.order_id,

      userId: row.user_id,

      orderType: row.order_type,

      units: Number(row.units),

      nav: Number(row.nav),

      amount: Number(row.amount),

      navDate: row.nav_date,

      status: row.status,

      createdAt: row.created_at,

      completedAt: row.completed_at,

      schemeCode: row.scheme_code,

      schemeName: row.scheme_name,

      fundHouse: row.fund_house,
    }));

    res.json({
      success: true,

      data: orders,

      orders,
    });
  } catch (error) {
    console.error("getMutualFundOrders error:", error);

    res.status(500).json({
      success: false,

      message: "Unable to load mutual fund orders",

      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| SYNC LATEST NAV
|--------------------------------------------------------------------------
|
| POST /api/mutual-funds/sync
|
| This gets the latest NAV from MFapi
| and updates mf_schemes.
|
*/

async function syncLatestNAVController(
  req,
  res
) {
  try {
    const result =
      await syncLatestNAV();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "[MF CONTROLLER] NAV sync failed:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to synchronize latest NAV",
      error: error.message,
    });
  }
}

async function syncReturnsController(
  req,
  res
) {
  try {
    const result =
      await syncAllReturns();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "[MF CONTROLLER] Return sync failed:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to calculate mutual fund returns",
      error: error.message,
    });
  }
}


function formatMySqlDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    const year = value.getFullYear();

    const month = String(
      value.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
      value.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return null;
}

/*
|--------------------------------------------------------------------------
| REFRESH RETURNS
|--------------------------------------------------------------------------
|
| POST /api/mutual-funds/sync-returns
|
| This uses MFapi historical NAV for each scheme.
|
| IMPORTANT:
| This can take time because MFapi has to be called
| separately for each scheme.
|
*/

async function syncReturns(req, res) {
  try {
    const result = await syncAllReturns();
    res.json({ success: true, message: "Mutual fund returns refresh completed", data: result });
  } catch (error) {
    console.error("syncReturns error:", error);
    res.status(500).json({ success: false, message: "Unable to refresh mutual fund returns", error: error.message });
  }
}

/*
|--------------------------------------------------------------------------
| SYNC STATUS (read-only)
|--------------------------------------------------------------------------
|
| GET /api/mutual-funds/sync-status
|
| Reads mf_sync_status only. Never triggers MFapi. Useful to verify that
| a server restart correctly skipped a sync that already succeeded today.
|
*/

async function getMFSyncStatus(req, res) {
  try {
    const status = await getSyncStatus('mf_daily_sync');
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[MF CONTROLLER] getMFSyncStatus:', error);
    res.status(500).json({ success: false, message: 'Failed to load sync status', error: error.message });
  }
}

/*
|--------------------------------------------------------------------------
| TRIGGER SYNC (manual, safe)
|--------------------------------------------------------------------------
|
| POST /api/mutual-funds/sync-now
|
| Runs the SAME checked sync entry point used by startup/cron - it will
| still skip if today's sync already succeeded, and still uses the
| advisory lock, so this cannot create a duplicate concurrent sync.
|
*/

async function triggerSyncNow(req, res) {
  try {
    const result = await runDailySyncIfNeeded('manual');
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[MF CONTROLLER] triggerSyncNow:', error);
    res.status(500).json({ success: false, message: 'Failed to run sync', error: error.message });
  }
}

module.exports = {
  getMutualFunds,
  getMutualFundFilters,
  getMutualFund,
  buyMutualFund,
  sellMutualFund,
  getMutualFundHoldings,
  getMutualFundOrders,
  syncLatestNAVController,
  syncReturnsController,
  syncReturns,
  getMFSyncStatus,
  triggerSyncNow,
};