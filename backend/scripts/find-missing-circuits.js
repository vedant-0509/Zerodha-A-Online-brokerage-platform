// backend/scripts/find-missing-circuits.js

const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

// Load the SAME .env used by the backend
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
});

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "zerodha";

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI not found in backend/.env");
  process.exit(1);
}

async function main() {
  let client;

  try {
    console.log("🔌 Connecting to MongoDB...");

    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(MONGODB_DB);

    console.log(`✅ Connected to database: ${MONGODB_DB}`);

    const collectionName = "marketStocks";
    const collection = db.collection(collectionName);

    const total = await collection.countDocuments();

    console.log(`📊 Total stocks: ${total}`);
    console.log("🔎 Checking upper/lower circuit values...\n");

    const stocks = await collection
      .find({})
      .project({
        _id: 1,
        tradingSymbol: 1,
        symbol: 1,
        name: 1,
        exchange: 1,
        instrumentKey: 1,
        upperCircuit: 1,
        lowerCircuit: 1,
      })
      .toArray();

    const missing = [];

    for (const stock of stocks) {
      const upperMissing =
        stock.upperCircuit === undefined ||
        stock.upperCircuit === null ||
        stock.upperCircuit === "" ||
        stock.upperCircuit === 0;

      const lowerMissing =
        stock.lowerCircuit === undefined ||
        stock.lowerCircuit === null ||
        stock.lowerCircuit === "" ||
        stock.lowerCircuit === 0;

      if (upperMissing || lowerMissing) {
        missing.push({
          stock,
          upperMissing,
          lowerMissing,
        });
      }
    }

    console.log("========================================");
    console.log(" STOCKS WITH MISSING CIRCUIT VALUES");
    console.log("========================================\n");

    if (missing.length === 0) {
      console.log("✅ Every stock has upper and lower circuit values.");
      return;
    }

    for (const item of missing) {
      const stock = item.stock;

      const symbol =
        stock.tradingSymbol ||
        stock.symbol ||
        stock.name ||
        "UNKNOWN";

      console.log(
        `${symbol} | ` +
        `${stock.exchange || "N/A"} | ` +
        `instrumentKey=${stock.instrumentKey || "N/A"}`
      );

      console.log(
        `   Upper Circuit: ${
          item.upperMissing
            ? "❌ MISSING"
            : stock.upperCircuit
        }`
      );

      console.log(
        `   Lower Circuit: ${
          item.lowerMissing
            ? "❌ MISSING"
            : stock.lowerCircuit
        }`
      );

      console.log("");
    }

    const upperMissingCount = missing.filter(
      (item) => item.upperMissing
    ).length;

    const lowerMissingCount = missing.filter(
      (item) => item.lowerMissing
    ).length;

    console.log("========================================");
    console.log(" SUMMARY");
    console.log("========================================");

    console.log(`Total stocks:             ${total}`);
    console.log(`Stocks with missing data: ${missing.length}`);
    console.log(`Upper circuit missing:   ${upperMissingCount}`);
    console.log(`Lower circuit missing:   ${lowerMissingCount}`);

    console.log("========================================");

  } catch (error) {
    console.error("\n❌ Script failed:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    if (client) {
      await client.close();
      console.log("\n🔌 MongoDB disconnected");
    }
  }
}

main();