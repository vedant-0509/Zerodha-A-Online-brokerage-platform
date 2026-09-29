const axios = require("axios");

const MFAPI_BASE_URL = process.env.MFAPI_BASE_URL || "https://api.mfapi.in";
const AMFI_NAV_URL =
  process.env.AMFI_NAV_URL || "https://portal.amfiindia.com/spages/NAVAll.txt";
const NAV_DECIMALS = 2;
const TIMEOUT_MS = Number(process.env.MFAPI_TIMEOUT_MS || 60000);

const http = axios.create({
  baseURL: MFAPI_BASE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "User-Agent": "Zerodha-MF-Module/3.0",
  },
});

const amfiHttp = axios.create({
  timeout: TIMEOUT_MS,
  maxRedirects: 5,
  headers: {
    Accept: "text/plain,text/*,*/*;q=0.8",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36",
    Referer: "https://www.amfiindia.com/",
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function roundNav(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(NAV_DECIMALS));
}

function parseNavDate(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const s = String(value).trim();
  if (!s) return null;

  const months = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  let m = s.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const month = months[m[2].toLowerCase()];
    return month ? `${m[3]}-${month}-${m[1]}` : null;
  }

  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

function formatApiDate(date) {
  const iso = parseNavDate(date);
  if (!iso) return null;
  const [yyyy, mm, dd] = iso.split("-");
  return `${dd}-${mm}-${yyyy}`;
}

function subtractDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function subtractYears(dateString, years) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const d = new Date(`${dateString}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/*
 * AMFI Complete NAV Report supports the current published layouts:
 *
 * 6 columns:
 *   code;isin-growth;isin-reinvestment;scheme-name;nav;date
 *
 * 8 columns:
 *   code;isin-growth;isin-reinvestment;scheme-name;plan;option;nav;date
 *
 * Headers/category rows are ignored because the first field is not numeric.
 */
function parseAMFINAVReport(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  const funds = [];

  for (const line of lines) {
    const parts = line.split(";").map((item) => item.trim());

    if (parts.length < 6) {
      continue;
    }

    const schemeCode = Number(parts[0]);

    if (!Number.isInteger(schemeCode) || schemeCode <= 0) {
      continue;
    }

    const isinGrowth = parts[1] && parts[1] !== "-" ? parts[1] : null;

    const isinDivReinvestment = parts[2] && parts[2] !== "-" ? parts[2] : null;

    let schemeName = parts[3] || null;

    let nav;
    let navDate;

    /*
    |--------------------------------------------------------------------------
    | AMFI 8-column format
    |--------------------------------------------------------------------------
    |
    | code;
    | isinGrowth;
    | isinReinvestment;
    | schemeName;
    | plan;
    | option;
    | nav;
    | date
    |
    |--------------------------------------------------------------------------
    */

    if (parts.length >= 8 && Number.isFinite(Number(parts[6]))) {
      const plan = parts[4] || "";

      const option = parts[5] || "";

      nav = roundNav(parts[6]);

      navDate = parseNavDate(parts[7]);

      /*
      ----------------------------------------------------------------------
      Preserve Plan + Option in scheme_name.
      ----------------------------------------------------------------------
      */

      const nameParts = [schemeName, plan, option].filter(
        (value) => value && value !== "-" && value.trim() !== "",
      );

      schemeName = nameParts.join(" - ");
    } else {

    /*
    |--------------------------------------------------------------------------
    | AMFI 6-column format
    |--------------------------------------------------------------------------
    |
    | code;
    | isinGrowth;
    | isinReinvestment;
    | schemeName;
    | nav;
    | date
    |
    |--------------------------------------------------------------------------
    */
      nav = roundNav(parts[4]);

      navDate = parseNavDate(parts[5]);
    }

    if (!navDate || !Number.isFinite(nav) || nav <= 0) {
      continue;
    }

    funds.push({
      schemeCode,
      schemeName,
      nav,
      date: navDate,
      navDate,
      fundHouse: null,
      schemeType: null,
      schemeCategory: null,
      isinGrowth,
      isinDivReinvestment,
    });
  }

  return funds;
}

async function getLatestFunds() {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.log(
        `[MF NAV] Downloading AMFI NAV report: ${AMFI_NAV_URL} (attempt ${attempt}/3)...`,
      );

      const response = await amfiHttp.get(AMFI_NAV_URL, {
        responseType: "arraybuffer",
        transformResponse: [(data) => data],
      });

      const buffer = Buffer.from(response.data);
      let text = buffer.toString("utf8");
      if (text.includes("\u0000") || text.length < 1000) {
        text = buffer.toString("latin1");
      }

      console.log(`[MF NAV] AMFI HTTP status: ${response.status}`);
      console.log(`[MF NAV] AMFI response length: ${text.length}`);
      console.log(
        `[MF NAV] AMFI response preview: ${text.slice(0, 250).replace(/\s+/g, " ").trim()}`,
      );

      if (/<html|<!doctype|access denied|cloudflare/i.test(text)) {
        throw new Error(
          "AMFI returned HTML/access-denied content instead of NAV text",
        );
      }

      const funds = parseAMFINAVReport(text);
      if (!funds.length) {
        throw new Error("AMFI Complete NAV Report returned zero valid records");
      }

      const dates = funds
        .map((fund) => fund.navDate)
        .filter(Boolean)
        .sort();
      const latestDate = dates.length ? dates[dates.length - 1] : null;

      console.log(`[MF NAV] AMFI records loaded: ${funds.length}`);
      console.log(`[MF NAV] Latest date present in AMFI report: ${latestDate}`);

      return funds;
    } catch (error) {
      lastError = error;
      console.error(
        `[MF NAV] AMFI attempt ${attempt} failed: ${error.message}`,
      );
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }

  throw lastError;
}

async function getHistoricalNAV(schemeCode, startDate, endDate) {
  const url =
    `${MFAPI_BASE_URL}/mf/${schemeCode}` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}`;

  const response = await axios.get(url, { timeout: TIMEOUT_MS });
  if (!response.data) return [];

  if (Array.isArray(response.data.data)) {
    return response.data.data
      .map((row) => ({
        date: parseNavDate(row.date),
        nav: roundNav(row.nav),
      }))
      .filter((row) => row.date && Number.isFinite(row.nav));
  }

  if (Array.isArray(response.data)) {
    return response.data
      .map((row) => ({
        date: parseNavDate(row.date),
        nav: roundNav(row.nav),
      }))
      .filter((row) => row.date && Number.isFinite(row.nav));
  }

  return [];
}

async function getSchemeHistory(schemeCode, startDate, endDate) {
  const params = {};
  const start = formatApiDate(startDate);
  const end = formatApiDate(endDate);
  if (start) params.startDate = start;
  if (end) params.endDate = end;

  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await http.get(`/mf/${schemeCode}`, { params });
      if (!Array.isArray(response.data?.data)) {
        throw new Error(
          `Invalid historical NAV response for scheme ${schemeCode}`,
        );
      }

      const byDate = new Map();
      for (const row of response.data.data) {
        const date = parseNavDate(row.date);
        const nav = roundNav(row.nav);
        if (date && Number.isFinite(nav) && nav > 0) byDate.set(date, nav);
      }

      return [...byDate.entries()]
        .map(([date, nav]) => ({ date, nav }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

function findNavOnOrBefore(history, targetDate) {
  let found = null;
  for (const row of history) {
    if (row.date <= targetDate) found = row;
    else break;
  }
  return found;
}

function calculatePointToPoint(currentNav, oldNav) {
  if (
    !Number.isFinite(currentNav) ||
    !Number.isFinite(oldNav) ||
    currentNav <= 0 ||
    oldNav <= 0
  )
    return null;
  return Number(((currentNav / oldNav - 1) * 100).toFixed(4));
}

function calculateCAGR(currentNav, oldNav, years) {
  if (
    !Number.isFinite(currentNav) ||
    !Number.isFinite(oldNav) ||
    currentNav <= 0 ||
    oldNav <= 0 ||
    years <= 0
  )
    return null;
  return Number(
    ((Math.pow(currentNav / oldNav, 1 / years) - 1) * 100).toFixed(4),
  );
}

function calculateReturns(history, currentNav, currentDate) {
  if (
    !history?.length ||
    !Number.isFinite(currentNav) ||
    currentNav <= 0 ||
    !currentDate
  ) {
    return {
      return1Y: null,
      return3Y: null,
      return5Y: null,
      nav1YDate: null,
      nav3YDate: null,
      nav5YDate: null,
    };
  }

  const target1Y = subtractYears(currentDate, 1);
  const target3Y = subtractYears(currentDate, 3);
  const target5Y = subtractYears(currentDate, 5);

  const nav1Y = findNavOnOrBefore(history, target1Y);
  const nav3Y = findNavOnOrBefore(history, target3Y);
  const nav5Y = findNavOnOrBefore(history, target5Y);

  return {
    return1Y: nav1Y ? calculatePointToPoint(currentNav, nav1Y.nav) : null,
    return3Y: nav3Y ? calculateCAGR(currentNav, nav3Y.nav, 3) : null,
    return5Y: nav5Y ? calculateCAGR(currentNav, nav5Y.nav, 5) : null,
    nav1YDate: nav1Y?.date || null,
    nav3YDate: nav3Y?.date || null,
    nav5YDate: nav5Y?.date || null,
    target1YDate: target1Y,
    target3YDate: target3Y,
    target5YDate: target5Y,
  };
}

module.exports = {
  NAV_DECIMALS,
  AMFI_NAV_URL,
  roundNav,
  getLatestFunds,
  getHistoricalNAV,
  getSchemeHistory,
  calculateReturns,
  calculatePointToPoint,
  calculateCAGR,
  parseNavDate,
  formatApiDate,
  subtractYears,
  subtractDays,
  addDays,
  findNavOnOrBefore,
};
