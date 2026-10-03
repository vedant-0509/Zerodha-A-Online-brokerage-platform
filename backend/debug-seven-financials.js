require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("./config/mongodb");

const symbols = [
  "SUNPHARMA",
  "ABCOTS",
  "ACEINTEG",
  "ACI",
  "ADROITINFO",
  "AERONEU",
  "AGARIND",
];

(async () => {
  try {
    await connectMongoDB();

    const db = getMongoDB();

    for (const symbol of symbols) {
      console.log("\n========================================");
      console.log("SYMBOL:", symbol);
      console.log("========================================");

      const instruments = await db
        .collection("instruments")
        .find({
          tradingSymbol: symbol,
        })
        .toArray();

      if (!instruments.length) {
        console.log("NO INSTRUMENT FOUND");
        continue;
      }

      for (const instrument of instruments) {
        const key = instrument.instrumentKey;
        const isin = instrument.isin;

        const fundamentalCount = await db
          .collection("stockFundamentals")
          .countDocuments({
            instrumentKey: key,
          });

        const financialCount = await db
          .collection("stockFinancials")
          .countDocuments({
            instrumentKey: key,
          });

        const shareholdingCount = await db
          .collection("stockShareholding")
          .countDocuments({
            instrumentKey: key,
          });

        console.log({
          exchange: instrument.exchange,
          segment: instrument.segment,
          tradingSymbol: instrument.tradingSymbol,
          isin,
          instrumentKey: key,
          fundamentalCount,
          financialCount,
          shareholdingCount,
        });
      }

      console.log(
        "\nFINANCIAL DOCUMENTS BY ISIN:",
        await db
          .collection("stockFinancials")
          .countDocuments({
            $or: [
              { isin: isin },
              { ISIN: isin },
            ],
          }),
      );
    }
  } catch (error) {
    console.error("\nDIAGNOSTIC ERROR:", error);
    process.exitCode = 1;
  } finally {
    await closeMongoDB().catch(() => {});
  }
})();
