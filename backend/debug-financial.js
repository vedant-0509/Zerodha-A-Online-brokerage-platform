require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("./config/mongodb");

const symbols = ["RELIANCE", "INFY"];

(async () => {
  try {
    await connectMongoDB();

    const db = getMongoDB();

    console.log("\n================ COLLECTION COUNTS ================\n");

    for (const name of [
      "instruments",
      "stockFundamentals",
      "stockFinancials",
      "stockShareholding",
    ]) {
      console.log(
        name,
        "=>",
        await db.collection(name).countDocuments(),
      );
    }

    for (const symbol of symbols) {
      console.log(
        `\n\n================ ${symbol} ================\n`,
      );

      const instrument =
        await db.collection("instruments").findOne({
          tradingSymbol: symbol,
        });

      console.log("\nINSTRUMENT:");
      console.log(JSON.stringify(instrument, null, 2));

      const isin = instrument?.isin;

      const identityValues = [
        symbol,
        isin,
        instrument?.instrumentKey,
      ].filter(Boolean);

      const identityFilter = {
        $or: [
          ...identityValues.flatMap((value) => [
            { symbol: value },
            { SYMBOL: value },
            { tradingSymbol: value },
            { trading_symbol: value },
            { isin: value },
            { ISIN: value },
            { instrumentKey: value },
            { instrument_key: value },
          ]),
        ],
      };

      for (const collectionName of [
        "stockFundamentals",
        "stockFinancials",
        "stockShareholding",
      ]) {
        const collection = db.collection(collectionName);

        const count =
          await collection.countDocuments(identityFilter);

        console.log(
          `\n${collectionName} MATCH COUNT:`,
          count,
        );

        const sample =
          await collection.findOne(identityFilter);

        if (sample) {
          console.log(
            `${collectionName} SAMPLE KEYS:`,
            Object.keys(sample),
          );

          console.log(
            `${collectionName} SAMPLE:`,
            JSON.stringify(sample, null, 2),
          );
        } else {
          console.log(
            `${collectionName}: NO MATCH`,
          );
        }
      }
    }

    console.log(
      "\n\n================ FIRST FINANCIAL DOCUMENT ================\n",
    );

    const firstFinancial =
      await db.collection("stockFinancials").findOne({});

    if (firstFinancial) {
      console.log(
        "Keys:",
        Object.keys(firstFinancial),
      );

      console.log(
        JSON.stringify(firstFinancial, null, 2),
      );
    }

    console.log(
      "\n\n================ FIRST FUNDAMENTAL DOCUMENT ================\n",
    );

    const firstFundamental =
      await db.collection("stockFundamentals").findOne({});

    if (firstFundamental) {
      console.log(
        "Keys:",
        Object.keys(firstFundamental),
      );

      console.log(
        JSON.stringify(firstFundamental, null, 2),
      );
    }

  } catch (error) {
    console.error(
      "\nDIAGNOSTIC ERROR:",
      error,
    );
    process.exitCode = 1;
  } finally {
    await closeMongoDB().catch(() => {});
  }
})();
