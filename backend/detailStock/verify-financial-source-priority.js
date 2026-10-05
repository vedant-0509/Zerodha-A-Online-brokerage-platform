/**
 * Static verification for the financial source-priority fix.
 *
 * Expected contract:
 * 1. Upstox is queried first.
 * 2. MongoDB is fallback only when Upstox fails/has no usable data.
 * 3. ?refresh=1 bypasses the Detail Stock application cache.
 */
const fs = require("fs");
const path = require("path");

const serverPath = path.join(__dirname, "server.js");
const source = fs.readFileSync(serverPath, "utf8");

const checks = [
  ["Upstox primary call", /const providerData = await upstox\.getFundamentals\(\s*normalizedIsin,\s*force,\s*\)/s],
  ["Upstox source marker", /source:\s*"upstox"/],
  ["Mongo fallback", /const stored = await getStoredFundamentals\(normalizedIsin\)/],
  ["Refresh query support", /req\.query\.refresh/],
  ["Forced refresh passed through", /getFundamentalsCached\(isin, forceRefresh\)/],
];

let failed = false;
for (const [name, pattern] of checks) {
  const ok = pattern.test(source);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

process.exitCode = failed ? 1 : 0;
