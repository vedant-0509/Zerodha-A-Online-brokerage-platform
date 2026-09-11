const axios = require('axios');

const MFAPI_BASE_URL = process.env.MFAPI_BASE_URL || 'https://api.mfapi.in';
const NAV_DECIMALS = 2;

function roundNav(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(NAV_DECIMALS));
}
const http = axios.create({
  baseURL: MFAPI_BASE_URL,
  timeout: Number(process.env.MFAPI_TIMEOUT_MS || 60000),
  headers: { Accept: 'application/json', 'User-Agent': 'Zerodha-MF-Module/2.0' },
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseNavDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function formatApiDate(date) {
  const iso = parseNavDate(date);
  if (!iso) return null;
  const [yyyy, mm, dd] = iso.split('-');
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

async function getLatestFunds() {
  // Retry a handful of times with backoff before giving up - a single
  // transient network blip should not fail the whole daily sync and
  // must not be treated the same as a hard MFapi outage.
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await http.get('/mf/latest');
      const p = response.data;
      if (Array.isArray(p)) return p;
      if (Array.isArray(p?.data)) return p.data;
      if (Array.isArray(p?.data?.funds)) return p.data.funds;
      if (Array.isArray(p?.funds)) return p.funds;
      throw new Error('Unexpected MFapi /mf/latest response format');
    } catch (err) {
      lastError = err;
      if (attempt < 4) await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function getHistoricalNAV(
  schemeCode,
  startDate,
  endDate
) {
  const url =
    `${MFAPI_BASE_URL}/mf/${schemeCode}` +
    `?startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}`;

  const response = await axios.get(url, {
    timeout: MFAPI_TIMEOUT_MS
  });

  if (!response.data) {
    return [];
  }

  if (Array.isArray(response.data.data)) {
    return response.data.data.map(row => ({
      date: row.date,
      nav: roundNav(row.nav)
    }));
  }

  if (Array.isArray(response.data)) {
    return response.data.map(row => ({
      date: row.date,
      nav: roundNav(row.nav)
    }));
  }

  return [];
}

async function getSchemeHistory(schemeCode, startDate, endDate) {
  const params = {};
  const start = formatApiDate(startDate);
  const end = formatApiDate(endDate);
  if (start) params.startDate = start;
  if (end) params.endDate = end;

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await http.get(`/mf/${schemeCode}`, { params });
      if (!Array.isArray(response.data?.data)) {
        throw new Error(`Invalid historical NAV response for scheme ${schemeCode}`);
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
    } catch (err) {
      lastError = err;
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
  if (!Number.isFinite(currentNav) || !Number.isFinite(oldNav) || currentNav <= 0 || oldNav <= 0) return null;
  return Number((((currentNav / oldNav) - 1) * 100).toFixed(4));
}

function calculateCAGR(currentNav, oldNav, years) {
  if (!Number.isFinite(currentNav) || !Number.isFinite(oldNav) || currentNav <= 0 || oldNav <= 0 || years <= 0) return null;
  return Number(((Math.pow(currentNav / oldNav, 1 / years) - 1) * 100).toFixed(4));
}

function calculateReturns(history, currentNav, currentDate) {
  if (!history?.length || !Number.isFinite(currentNav) || currentNav <= 0 || !currentDate) {
    return { return1Y: null, return3Y: null, return5Y: null, nav1YDate: null, nav3YDate: null, nav5YDate: null };
  }

  const target1Y = subtractYears(currentDate, 1);
  const target3Y = subtractYears(currentDate, 3);
  const target5Y = subtractYears(currentDate, 5);

  const nav1Y = findNavOnOrBefore(history, target1Y);
  const nav3Y = findNavOnOrBefore(history, target3Y);
  const nav5Y = findNavOnOrBefore(history, target5Y);

  return {
    // 1Y is point-to-point. For one year this is mathematically the same as CAGR.
    return1Y: nav1Y ? calculatePointToPoint(currentNav, nav1Y.nav) : null,
    // 3Y and 5Y are annualized CAGR, which is the standard presentation for multi-year MF returns.
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
  roundNav,
  getLatestFunds,
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
  getHistoricalNAV
};
