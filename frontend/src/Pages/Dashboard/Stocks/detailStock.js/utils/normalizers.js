import { numberValue, getFinancialNumber } from "./formatters";
import { parseHistoryTimestamp, indiaDateFromTimestamp, isISTTradingTimestamp, getIndiaDate } from "./dateHelpers";

export function unwrapResponse(json) {
  if (!json) return null;
  if (json.data !== undefined) return unwrapResponse(json.data);
  if (json.result !== undefined) return unwrapResponse(json.result);
  if (json.payload !== undefined) return unwrapResponse(json.payload);
  return json;
}

export function getArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function normalizeStock(json, fallbackSymbol) {
  const data = unwrapResponse(json) || {};
  return {
    ...data,
    symbol: data.symbol || data.tradingSymbol || data.trading_symbol || fallbackSymbol,
    companyName: data.companyName || data.company_name || data.name || fallbackSymbol,
    name: data.name || data.companyName || data.company_name || fallbackSymbol,
    exchange: data.exchange || data.exchangeName || data.exchange_name || "NSE",
    instrumentKey: data.instrumentKey || data.instrument_key || data.instrumentkey || data.instrument,
    isin: data.isin || data.ISIN || data.isin_code || data.isinCode,
  };
}

export function normalizeFundamentals(json) {
  const data = unwrapResponse(json) || {};
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...data,
      ...(data.fundamentals && typeof data.fundamentals === "object" ? data.fundamentals : {}),
    };
  }
  return data;
}

export function normalizeShareholding(json) {
  const data = unwrapResponse(json) || {};
  const list = getArray(
    data.shareholding,
    data.shareholdingPattern,
    data.shareholding_pattern,
    data.holdings,
    data.data,
    Array.isArray(data) ? data : null
  );


  const SHAREHOLDING_LABELS = {
    PROMOTERS: "Promoters",
    PROMOTER: "Promoters",
    FII: "FII",
    FPI: "FII / FPI",
    MUTUAL_FUNDS: "Mutual Funds",
    MUTUAL_FUND: "Mutual Funds",
    MF: "Mutual Funds",
    OTHER_DII: "Other DII",
    DII: "DII",
    RETAIL_AND_OTHER: "Retail & Others",
    RETAIL_AND_OTHERS: "Retail & Others",
    RETAIL: "Retail",
    OTHERS: "Others",
    OTHER: "Others",
  };

  if (list.length > 0) {
    return list.map((item) => {
      // Extract raw string value from item
      const rawCategory = (item.category || item.label || item.name || item.type || "OTHERS").toString().trim().toUpperCase();

      // Map to clean label, or fall back to raw input / "Others"
      const label = SHAREHOLDING_LABELS[rawCategory] || item.category || item.name || "Others";
      if (Array.isArray(item.history)) {
        return {
          label,
          history: item.history.map((h) => ({
            period: h.period || h.quarter || h.date || h.quarterName || h.label || h.year || "",
            percentage: numberValue(h.percentage ?? h.percent ?? h.value ?? h.holding, 0),
          })),
        };
      }
      const period = item.period || item.quarter || item.date || item.quarterName || item.label || item.year || "";
      return {
        label,
        history: period ? [{ period, percentage: numberValue(item.percentage ?? item.percent ?? item.value, 0) }] : [],
      };
    });
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    const categoryMap = {};
    Object.entries(data).forEach(([period, holdings]) => {
      if (holdings && typeof holdings === "object" && !Array.isArray(holdings)) {
        Object.entries(holdings).forEach(([category, val]) => {
          if (!categoryMap[category]) categoryMap[category] = [];
          categoryMap[category].push({ period, percentage: numberValue(val, 0) });
        });
      }
    });
    return Object.entries(categoryMap).map(([label, history]) => ({ label, history }));
  }

  return [];
}

export function normalizeMutualFunds(json) {
  const data = unwrapResponse(json) || {};
  return getArray(
    data.mutualFunds,
    data.mutual_funds,
    data.mutualFundHoldings,
    data.mfHoldings,
    data.data,
    Array.isArray(data) ? data : null
  );
}

export function sortFinancialRowsChronologically(rows) {
  const parsePeriod = (p) => {
    if (!p) return 0;
    const str = String(p).trim();
    const yearMatch = str.match(/(20\d\d|\b\d\d\b)/);
    const year = yearMatch ? (yearMatch[0].length === 2 ? Number("20" + yearMatch[0]) : Number(yearMatch[0])) : 0;
    const monthMap = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, q1: 3, q2: 6, q3: 9, q4: 12 };
    let month = 0;
    for (const [key, m] of Object.entries(monthMap)) {
      if (str.toLowerCase().includes(key)) {
        month = m;
        break;
      }
    }
    return year * 100 + month;
  };

  return [...rows].sort((a, b) => {
    const scoreA = parsePeriod(a.quarter);
    const scoreB = parsePeriod(b.quarter);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return String(a.quarter).localeCompare(String(b.quarter), undefined, { numeric: true });
  });
}

export function normalizeFinancialRows(source) {
  if (!source) return [];
  let raw = unwrapResponse(source) || source;
  if (raw && typeof raw === "object") {
    if (raw.financials) raw = raw.financials;
    if (raw.financialPerformance) raw = raw.financialPerformance;
    if (raw.financial_performance) raw = raw.financial_performance;
  }

  let statement = raw?.incomeStatement || raw?.income_statement || raw?.statement || raw;
  if (statement && typeof statement === "object" && !Array.isArray(statement)) {
    if (statement.incomeStatement) statement = statement.incomeStatement;
    else if (statement.income_statement) statement = statement.income_statement;
  }

  // Some stocks return only the latest financial summary at the top level.
  // Preserve that valid data so the Financial Performance section is not
  // incorrectly shown as empty.
  const directRevenue = getFinancialNumber(
    raw?.revenue, raw?.totalRevenue, raw?.total_revenue, raw?.sales, raw?.income,
  );
  const directProfit = getFinancialNumber(
    raw?.netProfit, raw?.net_profit, raw?.profit, raw?.pat,
    raw?.profitAfterTax, raw?.profit_after_tax, raw?.netIncome, raw?.operatingProfit,
  );
  const directPeriod =
    raw?.revenuePeriod || raw?.revenue_period ||
    raw?.netProfitPeriod || raw?.net_profit_period ||
    raw?.period || raw?.quarter || raw?.reportPeriod || raw?.report_period ||
    raw?.asOf || raw?.as_of || raw?.reportDate || raw?.report_date;

  if ((directRevenue !== null || directProfit !== null) && directPeriod) {
    return sortFinancialRowsChronologically([{
      quarter: String(directPeriod),
      revenue: directRevenue ?? 0,
      profit: directProfit ?? 0,
    }]);
  }

  const categoryList = getArray(
    statement?.income_statement,
    statement?.incomeStatement,
    statement?.categories,
    statement?.full_statement,
    Array.isArray(statement) ? statement : null
  );

  if (categoryList.length > 0 && categoryList.some((item) => item && Array.isArray(item.history || item.values || item.data))) {
    const periodMap = {};
    for (const catObj of categoryList) {
      if (!catObj) continue;
      const historyArr = getArray(catObj.history, catObj.values, catObj.data);
      if (!historyArr.length) continue;

      const catName = String(catObj.category || catObj.particular || catObj.name || "").toLowerCase();
      const isRevenue = /revenue|sales|income|turnover|earned/i.test(catName);
      const isNetProfit = /net_profit|net profit|pat|profit after tax|net income|net_income/i.test(catName);
      const isOperatingProfit = /operating_profit|operating profit|ebitda|ebit/i.test(catName);
      const isGeneralProfit = /profit/i.test(catName);

      if (!isRevenue && !isNetProfit && !isOperatingProfit && !isGeneralProfit) continue;

      for (const point of historyArr) {
        if (!point || typeof point !== "object") continue;
        const period = String(point.period || point.quarter || point.quarterName || point.quarter_name || point.date || point.year || point.label || "").trim();
        if (!period) continue;

        if (!periodMap[period]) {
          periodMap[period] = { quarter: period, revenue: null, profit: null, profitPriority: 0 };
        }

        const val = getFinancialNumber(point.value, point.amount, point.val);
        if (val !== null) {
          if (isRevenue && periodMap[period].revenue === null) periodMap[period].revenue = val;
          let priority = isNetProfit ? 3 : isOperatingProfit ? 2 : isGeneralProfit ? 1 : 0;
          if (priority > periodMap[period].profitPriority) {
            periodMap[period].profit = val;
            periodMap[period].profitPriority = priority;
          }
        }
      }
    }
    const rows = Object.values(periodMap)
      .filter((row) => row.revenue !== null || row.profit !== null)
      .map((row) => ({ quarter: row.quarter, revenue: row.revenue ?? 0, profit: row.profit ?? 0 }));
    if (rows.length > 0) return sortFinancialRowsChronologically(rows);
  }

  const arrayCandidates = [];
  function collectArrays(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 3) return;
    if (Array.isArray(obj)) {
      arrayCandidates.push(obj);
      return;
    }
    for (const k of Object.keys(obj)) {
      if (Array.isArray(obj[k])) arrayCandidates.push(obj[k]);
      else if (typeof obj[k] === "object" && obj[k] !== null) collectArrays(obj[k], depth + 1);
    }
  }

  collectArrays(raw);
  for (const candidate of arrayCandidates) {
    if (!Array.isArray(candidate) || !candidate.length) continue;
    const rows = candidate
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const period = String(row.quarter || row.period || row.date || row.year || row.label || row.quarterName || row.quarter_name || "").trim();
        if (!period) return null;
        const revenue = getFinancialNumber(row.revenue, row.totalRevenue, row.total_revenue, row.sales, row.income, row.totalIncome, row.total_income);
        const profit = getFinancialNumber(row.profit, row.netProfit, row.net_profit, row.pat, row.profitAfterTax, row.profit_after_tax, row.netIncome, row.operatingProfit);
        if (revenue === null && profit === null) return null;
        return { quarter: period, revenue: revenue ?? 0, profit: profit ?? 0 };
      })
      .filter(Boolean);

    if (rows.length > 0) return sortFinancialRowsChronologically(rows);
  }

  return [];
}

export function normalizeHistory(json, range = "1D") {
  const data = unwrapResponse(json);
  let rows = [];

  if (Array.isArray(data)) rows = data;
  else if (Array.isArray(data?.candles)) rows = data.candles;
  else if (Array.isArray(data?.history)) rows = data.history;
  else if (Array.isArray(data?.prices)) rows = data.prices;
  else if (Array.isArray(data?.data)) rows = data.data;

  if (!rows.length) return [];

  const withTimestamps = rows
    .map((row) => {
      const rawTime = Array.isArray(row)
        ? row[0]
        : row?.timestamp ?? row?.time ?? row?.date ?? row?.datetime ?? row?.dateTime ?? row?.ts ?? row?.epoch ?? row?.t ?? row?.ltt;
      return { row, timestamp: parseHistoryTimestamp(rawTime), session: indiaDateFromTimestamp(rawTime) };
    })
    .filter((item) => Number.isFinite(item.timestamp));

  if (range === "1D") {
    const today = getIndiaDate();
    const todayRows = withTimestamps.filter((item) => item.session === today && isISTTradingTimestamp(item.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
    if (todayRows.length) return todayRows.map((item) => item.row);

    const sessions = new Map();
    withTimestamps.forEach((item) => {
      if (!isISTTradingTimestamp(item.timestamp)) return;
      if (!sessions.has(item.session)) sessions.set(item.session, []);
      sessions.get(item.session).push(item);
    });

    const latestSession = [...sessions.keys()].sort().pop();
    return latestSession ? sessions.get(latestSession).sort((a, b) => a.timestamp - b.timestamp).map((item) => item.row) : [];
  }

  return withTimestamps.sort((a, b) => a.timestamp - b.timestamp).map((item) => item.row);
}

export function normalizeMarketStatus(json) {
  const data = unwrapResponse(json) || {};
  if (typeof data === "boolean") return data;
  if (typeof data.marketOpen === "boolean") return data.marketOpen;
  if (typeof data.isOpen === "boolean") return data.isOpen;
  if (typeof data.open === "boolean") return data.open;

  const status = String(data.marketStatus || data.status || data.market_status || "").toLowerCase();
  if (status === "open" || status === "market_open" || status === "live") return true;
  if (status === "closed" || status === "market_closed") return false;

  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(new Date())
    .split(":");

  const totalMinutes = Number(parts[0]) * 60 + Number(parts[1]);
  return totalMinutes >= 9 * 60 + 15 && totalMinutes <= 15 * 60 + 30;
}

export function normalizeAbout(profile, fundamentals, fallbackSymbol) {
  const p = profile || {};
  const f = fundamentals || {};
  return {
    description: p.company_profile || p.description || p.about || p.business_description || p.businessDescription || f.about || f.description || "Company profile information is not available from the backend.",
    sector: p.sector || f.sector || "N/A",
    sectorMarketCapInr: p.sector_market_cap_inr || null,
    sectorMarketCapUsd: p.sector_market_cap_usd || null,
    ceo: p.ceo || p.ceo_name || p.ceoName || p.management?.ceo || "N/A",
    founded: p.foundedIn || p.founded_in || p.founded || p.incorporation_date || "N/A",
    nseSymbol: p.nseSymbol || p.nse_symbol || p.symbol || fallbackSymbol || "N/A",
  };
}