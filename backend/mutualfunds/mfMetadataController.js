const {
  connectMongoDB,
  getMongoDB,
} = require("../config/mongodb");

const RISK_VALUES = [
  "Low",
  "Low to Moderate",
  "Moderate",
  "Moderately High",
  "High",
  "Very High",
];

function normalizeRisk(value) {
  if (!value) return null;

  const v = String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (v === "low") return "Low";

  if (
    v === "low to moderate" ||
    v === "moderately low"
  ) {
    return "Low to Moderate";
  }

  if (v === "moderate") return "Moderate";

  if (v === "moderately high") {
    return "Moderately High";
  }

  if (v === "high") return "High";

  if (v === "very high") {
    return "Very High";
  }

  return null;
}

async function importMetadata(req, res) {
  const rows = Array.isArray(req.body?.rows)
    ? req.body.rows
    : [];

  if (!rows.length) {
    return res.status(400).json({
      success: false,
      message: "rows[] is required",
    });
  }

  try {
    await connectMongoDB();

    const db = getMongoDB();
    const schemes = db.collection("mfSchemes");

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const schemeCode = Number(
        row.schemeCode ??
        row.scheme_code
      );

      const rating =
        row.rating === null ||
        row.rating === undefined ||
        row.rating === ""
          ? null
          : Number(row.rating);

      const risk = normalizeRisk(row.risk);

      /*
       * Validate metadata.
       */
      if (
        !Number.isInteger(schemeCode) ||
        schemeCode <= 0 ||
        (
          rating !== null &&
          (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
          )
        ) ||
        (
          risk !== null &&
          !RISK_VALUES.includes(risk)
        )
      ) {
        skipped++;
        continue;
      }

      /*
       * Build MongoDB update.
       *
       * This preserves the old MySQL COALESCE behavior:
       *
       * rating:
       *   supplied value -> update
       *   null -> keep existing value
       *
       * risk:
       *   supplied value -> update
       *   null -> keep existing value
       */
      const setFields = {
        updatedAt: new Date(),
      };

      if (rating !== null) {
        setFields.rating = rating;
        setFields.ratingSource =
          row.ratingSource ||
          "VALUE_RESEARCH";
        setFields.ratingUpdatedAt =
          new Date();
      }

      if (risk !== null) {
        setFields.risk = risk;
        setFields.riskSource =
          row.riskSource ||
          "AMFI";
        setFields.riskUpdatedAt =
          new Date();
      }

      /*
       * Only update active mutual-fund schemes.
       */
      const result =
        await schemes.updateOne(
          {
            schemeCode: schemeCode,
            isActive: true,
          },
          {
            $set: setFields,
          }
        );

      if (result.matchedCount === 1) {
        updated++;
      } else {
        skipped++;
      }
    }

    return res.json({
      success: true,
      data: {
        received: rows.length,
        updated,
        skipped,
      },
    });
  } catch (error) {
    console.error(
      `[MF METADATA] Import failed: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      message: "Metadata import failed",
      error: error.message,
    });
  }
}

module.exports = {
  importMetadata,
};