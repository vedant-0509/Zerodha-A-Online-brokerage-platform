// const {
//   connectMongoDB,
//   getMongoDB,
//   getMongoClient,
// } = require("../config/mongodb");

// const { syncLatestNAV, syncAllReturns } = require("./mfSyncService");

// const { runDailySyncIfNeeded } = require("./mfSyncScheduler");

// const { getAllSyncStatuses } = require("./mfSyncStatusService");

// const { v4: uuidv4 } = require("uuid");

// /*
// |--------------------------------------------------------------------------
// | Mongo helpers
// |--------------------------------------------------------------------------
// */

// async function getDB() {
//   await connectMongoDB();
//   return getMongoDB();
// }

// function getClient() {
//   return getMongoClient();
// }

// /*
// |--------------------------------------------------------------------------
// | Helpers
// |--------------------------------------------------------------------------
// */

// function getFundType(category, name) {
//   const value = `${category || ""} ${name || ""}`.toLowerCase();

//   if (
//     value.includes("gold") ||
//     value.includes("silver") ||
//     value.includes("commodity")
//   ) {
//     return "COMMODITY";
//   }

//   if (
//     value.includes("hybrid") ||
//     value.includes("balanced advantage") ||
//     value.includes("multi asset") ||
//     value.includes("multi-asset") ||
//     value.includes("aggressive hybrid") ||
//     value.includes("conservative hybrid")
//   ) {
//     return "HYBRID";
//   }

//   if (
//     value.includes("debt") ||
//     value.includes("bond") ||
//     value.includes("liquid") ||
//     value.includes("gilt") ||
//     value.includes("overnight") ||
//     value.includes("money market") ||
//     value.includes("ultra short") ||
//     value.includes("short duration") ||
//     value.includes("medium duration") ||
//     value.includes("long duration") ||
//     value.includes("credit risk") ||
//     value.includes("floater") ||
//     value.includes("banking & psu")
//   ) {
//     return "DEBT";
//   }

//   return "EQUITY";
// }

// function getFundSubCategory(category, name) {
//   const value = `${category || ""} ${name || ""}`.toLowerCase();

//   if (value.includes("flexi")) return "Flexi Cap";
//   if (value.includes("large & mid")) return "Large & Mid Cap";
//   if (value.includes("large cap")) return "Large Cap";
//   if (value.includes("mid cap")) return "Mid Cap";
//   if (value.includes("small cap")) return "Small Cap";
//   if (value.includes("index")) return "Index";
//   if (value.includes("sectoral")) return "Sectoral";
//   if (value.includes("thematic")) return "Thematic";
//   if (value.includes("gold")) return "Gold";
//   if (value.includes("silver")) return "Silver";
//   if (value.includes("corporate bond")) return "Corporate Bond";
//   if (value.includes("liquid")) return "Liquid";
//   if (value.includes("gilt")) return "Gilt";
//   if (value.includes("aggressive hybrid")) {
//     return "Aggressive Hybrid";
//   }
//   if (value.includes("conservative hybrid")) {
//     return "Conservative Hybrid";
//   }
//   if (value.includes("multi asset") || value.includes("multi-asset")) {
//     return "Multi Asset";
//   }
//   if (value.includes("retirement")) return "Retirement";
//   if (value.includes("children") || value.includes("childrens")) {
//     return "Children";
//   }
//   if (value.includes("fund of fund") || value.includes("fof")) {
//     return "Fund of Funds";
//   }

//   return category || "Other";
// }

// function normalizeRisk(risk) {
//   if (!risk) return null;

//   const value = String(risk).trim().toLowerCase();

//   if (value.includes("very high")) {
//     return "Very High";
//   }

//   if (value.includes("moderately high")) {
//     return "Moderately High";
//   }

//   if (value === "high") {
//     return "High";
//   }

//   if (value.includes("moderately low")) {
//     return "Moderately Low";
//   }

//   if (value === "low") {
//     return "Low";
//   }

//   if (value.includes("moderate")) {
//     return "Moderate";
//   }

//   return risk;
// }

// function normalizeDate(value) {
//   if (!value) return null;

//   if (value instanceof Date) {
//     return value;
//   }

//   const date = new Date(value);

//   return Number.isNaN(date.getTime()) ? null : date;
// }

// function round(value, decimals = 2) {
//   const n = Number(value);

//   if (!Number.isFinite(n)) {
//     return null;
//   }

//   return Number(n.toFixed(decimals));
// }

// /*
// |--------------------------------------------------------------------------
// | GET TOP RETURNS
// |--------------------------------------------------------------------------
// */

// async function getTopReturns(req, res) {
//   try {
//     const db = await getDB();

//     const requestedLimit = Number(req.query.limit || 12);

//     const requestedOffset = Number(req.query.offset || 0);

//     const limit = Math.min(
//       Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 12, 1),
//       52,
//     );

//     const offset = Math.max(
//       Number.isFinite(requestedOffset) ? requestedOffset : 0,
//       0,
//     );

//     const schemes = db.collection("mfSchemes");

//     /*
//      * Get the best 1D-return fund from
//      * each fund house.
//      */
//     const rows = await schemes
//       .aggregate([
//         {
//           $match: {
//             isActive: true,
//             fundHouse: {
//               $exists: true,
//               $nin: ["", null],
//             },
//             currentNav: {
//               $gt: 0,
//             },
//             previousNav: {
//               $gt: 0,
//             },
//             return1d: {
//               $ne: null,
//             },
//           },
//         },

//         {
//           $sort: {
//             fundHouse: 1,
//             return1d: -1,
//             schemeName: 1,
//             schemeCode: 1,
//           },
//         },

//         {
//           $group: {
//             _id: "$fundHouse",
//             fund: {
//               $first: "$$ROOT",
//             },
//           },
//         },

//         {
//           $replaceRoot: {
//             newRoot: "$fund",
//           },
//         },

//         {
//           $sort: {
//             return1d: -1,
//             fundHouse: 1,
//             schemeName: 1,
//           },
//         },

//         {
//           $skip: offset,
//         },

//         {
//           $limit: limit,
//         },

//         {
//           $project: {
//             _id: 0,
//             schemeId: {
//               $ifNull: ["$mysqlId", "$_id"],
//             },
//             schemeCode: 1,
//             schemeName: 1,
//             fundHouse: 1,
//             schemeType: 1,
//             schemeCategory: 1,
//             fundSubCategory: 1,
//             currentNav: 1,
//             previousNav: 1,
//             navDate: 1,
//             previousNavDate: 1,
//             dayReturn: "$return1d",
//             dayReturnNavDate: "$return1dNavDate",
//             return1Y: "$return1y",
//             return3Y: "$return3y",
//             return5Y: "$return5y",
//             rating: 1,
//             risk: 1,
//           },
//         },
//       ])
//       .toArray();

//     const totalHousesResult = await schemes
//       .aggregate([
//         {
//           $match: {
//             isActive: true,
//             fundHouse: {
//               $exists: true,
//               $nin: ["", null],
//             },
//             currentNav: {
//               $gt: 0,
//             },
//             previousNav: {
//               $gt: 0,
//             },
//             return1d: {
//               $ne: null,
//             },
//           },
//         },

//         {
//           $group: {
//             _id: "$fundHouse",
//           },
//         },

//         {
//           $count: "totalHouses",
//         },
//       ])
//       .toArray();

//     const totalHouses = Number(totalHousesResult[0]?.totalHouses || 0);

//     return res.json({
//       success: true,
//       data: rows,
//       totalHouses,
//       returned: rows.length,
//       offset,
//       limit,
//       hasMore: offset + rows.length < totalHouses,
//     });
//   } catch (error) {
//     console.error("[MF TOP RETURNS]", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to fetch top mutual funds",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET MUTUAL FUNDS
// |--------------------------------------------------------------------------
// */

// async function getMutualFunds(req, res) {
//   try {
//     const db = await getDB();

//     const page = Math.max(Number(req.query.page) || 1, 1);

//     const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);

//     const offset = (page - 1) * limit;

//     const search = String(req.query.search || "").trim();

//     const fundType = String(
//       req.query.fundType || req.query.fund_type || "",
//     ).trim();

//     const category = String(req.query.category || "").trim();

//     const risk = String(req.query.risk || "").trim();

//     const fundHouse = String(
//       req.query.fundHouse || req.query.fund_house || "",
//     ).trim();

//     const ratingMinRaw = req.query.ratingMin ?? req.query.rating_min;

//     const ratingMin =
//       ratingMinRaw === undefined || ratingMinRaw === ""
//         ? null
//         : Number(ratingMinRaw);

//     const quickFilter = String(
//       req.query.quickFilter || req.query.quick_filter || "",
//     )
//       .trim()
//       .toLowerCase();

//     const indexOnly =
//       String(
//         req.query.indexOnly || req.query.index_only || "",
//       ).toLowerCase() === "true";

//     const sortBy = String(req.query.sortBy || req.query.sort_by || "name")
//       .trim()
//       .toLowerCase();

//     const sortDirection =
//       String(
//         req.query.sortDirection || req.query.sort_direction || "asc",
//       ).toLowerCase() === "desc"
//         ? -1
//         : 1;

//     const filter = {
//       isActive: true,
//     };

//     if (search) {
//       const regex = new RegExp(
//         search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i",
//       );

//       filter.$or = [
//         { schemeName: regex },
//         { fundHouse: regex },
//         { schemeCategory: regex },
//         { fundSubCategory: regex },
//       ];
//     }

//     const csv = (value) =>
//       value
//         .split(",")
//         .map((v) => v.trim())
//         .filter(Boolean);

//     if (fundType) {
//       filter.fundType = {
//         $in: csv(fundType),
//       };
//     }

//     if (category) {
//       const values = csv(category);

//       filter.$or = [
//         {
//           fundSubCategory: {
//             $in: values,
//           },
//         },
//         {
//           schemeCategory: {
//             $in: values,
//           },
//         },
//       ];
//     }

//     if (risk) {
//       filter.risk = {
//         $in: csv(risk),
//       };
//     }

//     if (fundHouse) {
//       filter.fundHouse = {
//         $in: csv(fundHouse),
//       };
//     }

//     if (Number.isFinite(ratingMin)) {
//       filter.rating = {
//         $gte: ratingMin,
//       };
//     }

//     if (indexOnly) {
//       filter.$and = filter.$and || [];

//       filter.$and.push({
//         $or: [
//           {
//             schemeName: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//           {
//             schemeCategory: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//           {
//             fundSubCategory: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//         ],
//       });
//     }

//     /*
//      * Quick filters.
//      */
//     switch (quickFilter) {
//       case "index":
//       case "index_only":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeName: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//             {
//               schemeCategory: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "flexi":
//       case "flexicap":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeName: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//             {
//               schemeCategory: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "sectoral":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeCategory: {
//                 $regex: "sectoral|thematic",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "sectoral|thematic",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "large":
//       case "largecap":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeCategory: {
//                 $regex: "large cap",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "large cap",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "4plus":
//       case "rating4":
//         filter.rating = {
//           ...(filter.rating || {}),
//           $gte: 4,
//         };
//         break;

//       default:
//         break;
//     }

//     const sortMap = {
//       name: "schemeName",
//       schemename: "schemeName",
//       "1y": "return1y",
//       "3y": "return3y",
//       "5y": "return5y",
//       rating: "rating",
//       risk: "risk",
//       nav: "currentNav",
//     };

//     const orderColumn = sortMap[sortBy] || "schemeName";

//     const total = await db.collection("mfSchemes").countDocuments(filter);

//     const documents = await db
//       .collection("mfSchemes")
//       .find(filter)
//       .sort({
//         [orderColumn]: sortDirection,
//         mysqlId: 1,
//         schemeCode: 1,
//       })
//       .skip(offset)
//       .limit(limit)
//       .toArray();

//     const funds = documents.map((s) => ({
//       id: s.mysqlId ?? s._id?.toString(),

//       scheme_code: s.schemeCode,

//       scheme_name: s.schemeName,

//       fund_house: s.fundHouse,

//       scheme_type: s.schemeType,

//       scheme_category: s.schemeCategory,

//       fund_type: s.fundType,

//       fund_sub_category: s.fundSubCategory,

//       isin_growth: s.isinGrowth,

//       isin_div_reinvestment: s.isinDivReinvestment,

//       current_nav: round(s.currentNav),

//       nav_date: s.navDate,

//       return_1y: s.return1y,

//       return_3y: s.return3y,

//       return_5y: s.return5y,

//       returns_for_nav_date: s.returnsForNavDate,

//       return_1y_nav_date: s.return1yNavDate,

//       return_3y_nav_date: s.return3yNavDate,

//       return_5y_nav_date: s.return5yNavDate,

//       rating: s.rating,

//       rating_source: s.ratingSource,

//       rating_updated_at: s.ratingUpdatedAt,

//       risk: normalizeRisk(s.risk),

//       risk_source: s.riskSource,

//       risk_updated_at: s.riskUpdatedAt,

//       return_updated_at: s.returnUpdatedAt,
//     }));

//     return res.json({
//       success: true,
//       data: {
//         funds,
//         total,
//         page,
//         limit,
//         offset,
//         hasMore: offset + funds.length < total,
//       },
//     });
//   } catch (error) {
//     console.error("[MF API] getMutualFunds:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load mutual funds",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET MUTUAL FUND FILTERS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundFilters(req, res) {
//   try {
//     const db = await getDB();

//     const schemes = db.collection("mfSchemes");

//     const activeFilter = {
//       isActive: true,
//     };

//     const houses = await schemes.distinct("fundHouse", {
//       ...activeFilter,
//       fundHouse: {
//         $exists: true,
//         $nin: ["", null],
//       },
//     });

//     const categoryDocuments = await schemes
//       .find(
//         {
//           ...activeFilter,
//           fundSubCategory: {
//             $exists: true,
//             $nin: ["", null],
//           },
//         },
//         {
//           projection: {
//             fundType: 1,
//             fundSubCategory: 1,
//           },
//         },
//       )
//       .toArray();

//     const risks = await schemes.distinct("risk", {
//       ...activeFilter,
//       risk: {
//         $exists: true,
//         $nin: ["", null],
//       },
//     });

//     const ratings = await schemes.distinct("rating", {
//       ...activeFilter,
//       rating: {
//         $exists: true,
//         $ne: null,
//       },
//     });

//     const grouped = {
//       EQUITY: [],
//       DEBT: [],
//       HYBRID: [],
//       COMMODITY: [],
//     };

//     for (const row of categoryDocuments) {
//       if (!grouped[row.fundType]) {
//         grouped[row.fundType] = [];
//       }

//       if (
//         row.fundSubCategory &&
//         !grouped[row.fundType].includes(row.fundSubCategory)
//       ) {
//         grouped[row.fundType].push(row.fundSubCategory);
//       }
//     }

//     const categories = [
//       ...new Set(
//         categoryDocuments.map((x) => x.fundSubCategory).filter(Boolean),
//       ),
//     ];

//     risks.sort((a, b) => String(a).localeCompare(String(b)));

//     ratings.sort((a, b) => Number(b) - Number(a));

//     return res.json({
//       success: true,
//       data: {
//         fundHouses: houses.filter(Boolean).sort(),

//         categories,

//         categoryGroups: grouped,

//         risks,

//         ratings: ratings.map(Number),
//       },
//     });
//   } catch (error) {
//     console.error("[MF API] getMutualFundFilters:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load mutual fund filters",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET SINGLE MUTUAL FUND
// |--------------------------------------------------------------------------
// */

// async function getMutualFund(req, res) {
//   try {
//     const { schemeCode } = req.params;

//     const db = await getDB();

//     const numericCode = Number(schemeCode);

//     const query = Number.isFinite(numericCode)
//       ? {
//           schemeCode: numericCode,
//           isActive: true,
//         }
//       : {
//           schemeCode: schemeCode,
//           isActive: true,
//         };

//     const scheme = await db.collection("mfSchemes").findOne(query);

//     if (!scheme) {
//       return res.status(404).json({
//         success: false,
//         message: "Mutual fund not found",
//       });
//     }

//     return res.json({
//       success: true,
//       data: {
//         id: scheme.mysqlId ?? scheme._id?.toString(),

//         schemeCode: scheme.schemeCode,

//         schemeName: scheme.schemeName,

//         fundHouse: scheme.fundHouse,

//         schemeType: scheme.schemeType,

//         schemeCategory: scheme.schemeCategory,

//         fundType: scheme.fundType,

//         fundSubCategory: scheme.fundSubCategory,

//         currentNav: round(scheme.currentNav),

//         navDate: scheme.navDate,

//         return1Y: scheme.return1y,

//         return3Y: scheme.return3y,

//         return5Y: scheme.return5y,

//         rating: scheme.rating,

//         risk: scheme.risk,
//       },
//     });
//   } catch (error) {
//     console.error("getMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to load mutual fund",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | BUY MUTUAL FUND
// |--------------------------------------------------------------------------
// |
// | MongoDB transaction replaces:
// |   MySQL BEGIN
// |   SELECT ... FOR UPDATE
// |   INSERT order
// |   INSERT/UPDATE holding
// |   COMMIT
// |
// */

// async function buyMutualFund(req, res) {
//   const userId = req.userId;

//   if (!userId) {
//     return res.status(401).json({
//       success: false,
//       message: "Authentication required",
//     });
//   }

//   const { schemeCode, units } = req.body;

//   if (!schemeCode) {
//     return res.status(400).json({
//       success: false,
//       message: "schemeCode is required",
//     });
//   }

//   const buyUnits = Number(units);

//   if (!Number.isFinite(buyUnits) || buyUnits <= 0) {
//     return res.status(400).json({
//       success: false,
//       message: "units must be greater than 0",
//     });
//   }

//   try {
//     await connectMongoDB();

//     const db = getMongoDB();
//     const client = getClient();

//     const session = client.startSession();

//     let responseData = null;

//     try {
//       await session.withTransaction(async () => {
//         const schemes = db.collection("mfSchemes");

//         const orders = db.collection("mfOrders");

//         const holdings = db.collection("mfHoldings");

//         const numericCode = Number(schemeCode);

//         const schemeQuery = Number.isFinite(numericCode)
//           ? {
//               schemeCode: numericCode,
//               isActive: true,
//             }
//           : {
//               schemeCode: schemeCode,
//               isActive: true,
//             };

//         /*
//          * MongoDB transaction provides
//          * the consistency boundary.
//          */
//         const scheme = await schemes.findOne(schemeQuery, {
//           session,
//         });

//         if (!scheme) {
//           const error = new Error("Mutual fund not found");

//           error.statusCode = 404;

//           throw error;
//         }

//         const nav = round(scheme.currentNav, 2);

//         if (!Number.isFinite(nav) || nav <= 0) {
//           const error = new Error("Current NAV unavailable");

//           error.statusCode = 400;

//           throw error;
//         }

//         const amount = round(buyUnits * nav, 2);

//         if (!Number.isFinite(amount) || amount <= 0) {
//           const error = new Error("Unable to calculate purchase amount");

//           error.statusCode = 400;

//           throw error;
//         }

//         const orderId = uuidv4();

//         const now = new Date();

//         /*
//          * Create MF order.
//          */
//         await orders.insertOne(
//           {
//             mysqlId: null,

//             orderId,

//             userId: String(userId),

//             schemeId: scheme.mysqlId ?? scheme._id,

//             schemeCode: scheme.schemeCode,

//             schemeName: scheme.schemeName,

//             orderType: "BUY",

//             units: buyUnits,

//             nav,

//             amount,

//             navDate: scheme.navDate,

//             status: "COMPLETED",

//             createdAt: now,

//             completedAt: now,
//           },
//           {
//             session,
//           },
//         );

//         /*
//          * Update existing holding.
//          *
//          * Your migrated data uses userId +
//          * schemeCode for the holding identity.
//          */
//         const existingHolding = await holdings.findOne(
//           {
//             userId: String(userId),

//             schemeCode: scheme.schemeCode,
//           },
//           {
//             session,
//           },
//         );

//         if (existingHolding) {
//           await holdings.updateOne(
//             {
//               _id: existingHolding._id,
//             },
//             {
//               $inc: {
//                 units: buyUnits,

//                 investedAmount: amount,
//               },

//               $set: {
//                 updatedAt: now,
//               },
//             },
//             {
//               session,
//             },
//           );
//         } else {
//           await holdings.insertOne(
//             {
//               mysqlId: null,

//               userId: String(userId),

//               schemeId: scheme.mysqlId ?? scheme._id,

//               schemeCode: scheme.schemeCode,

//               schemeName: scheme.schemeName,

//               units: buyUnits,

//               investedAmount: amount,

//               createdAt: now,

//               updatedAt: now,
//             },
//             {
//               session,
//             },
//           );
//         }

//         responseData = {
//           orderId,

//           orderType: "BUY",

//           schemeCode: scheme.schemeCode,

//           schemeName: scheme.schemeName,

//           units: Number(buyUnits.toFixed(8)),

//           nav,

//           amount,

//           navDate: scheme.navDate,

//           status: "COMPLETED",
//         };
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Mutual fund BUY order completed",
//         data: responseData,
//       });
//     } catch (error) {
//       console.error("buyMutualFund transaction error:", error);

//       const status = Number(error.statusCode) || 500;

//       return res.status(status).json({
//         success: false,
//         message: status === 500 ? "Unable to place BUY order" : error.message,
//       });
//     } finally {
//       await session.endSession();
//     }
//   } catch (error) {
//     console.error("buyMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to place BUY order",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SELL MUTUAL FUND
// |--------------------------------------------------------------------------
// */

// async function sellMutualFund(req, res) {
//   const userId = req.userId;

//   if (!userId) {
//     return res.status(401).json({
//       success: false,
//       message: "Authentication required",
//     });
//   }

//   const { schemeCode, units } = req.body;

//   if (!schemeCode) {
//     return res.status(400).json({
//       success: false,
//       message: "schemeCode is required",
//     });
//   }

//   const sellUnits = Number(units);

//   if (!Number.isFinite(sellUnits) || sellUnits <= 0) {
//     return res.status(400).json({
//       success: false,
//       message: "units must be greater than 0",
//     });
//   }

//   try {
//     await connectMongoDB();

//     const db = getMongoDB();
//     const client = getClient();

//     const session = client.startSession();

//     let responseData = null;

//     try {
//       await session.withTransaction(async () => {
//         const schemes = db.collection("mfSchemes");

//         const orders = db.collection("mfOrders");

//         const holdings = db.collection("mfHoldings");

//         const numericCode = Number(schemeCode);

//         const schemeQuery = Number.isFinite(numericCode)
//           ? {
//               schemeCode: numericCode,
//               isActive: true,
//             }
//           : {
//               schemeCode: schemeCode,
//               isActive: true,
//             };

//         const scheme = await schemes.findOne(schemeQuery, {
//           session,
//         });

//         if (!scheme) {
//           const error = new Error("Mutual fund not found");

//           error.statusCode = 404;

//           throw error;
//         }

//         const nav = round(scheme.currentNav, 2);

//         if (!Number.isFinite(nav) || nav <= 0) {
//           const error = new Error("Current NAV unavailable");

//           error.statusCode = 400;

//           throw error;
//         }

//         /*
//          * Find the user's holding.
//          */
//         const holding = await holdings.findOne(
//           {
//             userId: String(userId),

//             schemeCode: scheme.schemeCode,
//           },
//           {
//             session,
//           },
//         );

//         if (!holding) {
//           const error = new Error("No mutual fund holding found");

//           error.statusCode = 400;

//           throw error;
//         }

//         const availableUnits = Number(holding.units || 0);

//         if (sellUnits > availableUnits + 0.00000001) {
//           const error = new Error("Insufficient mutual fund units");

//           error.statusCode = 400;

//           error.availableUnits = availableUnits;

//           throw error;
//         }

//         const amount = round(sellUnits * nav, 2);

//         const oldInvested = Number(holding.investedAmount || 0);

//         const remainingUnits = availableUnits - sellUnits;

//         let remainingInvested = 0;

//         if (availableUnits > 0) {
//           remainingInvested = oldInvested * (remainingUnits / availableUnits);
//         }

//         const orderId = uuidv4();

//         const now = new Date();

//         /*
//          * Create SELL order.
//          */
//         await orders.insertOne(
//           {
//             mysqlId: null,

//             orderId,

//             userId: String(userId),

//             schemeId: scheme.mysqlId ?? scheme._id,

//             schemeCode: scheme.schemeCode,

//             schemeName: scheme.schemeName,

//             orderType: "SELL",

//             units: sellUnits,

//             nav,

//             amount,

//             navDate: scheme.navDate,

//             status: "COMPLETED",

//             createdAt: now,

//             completedAt: now,
//           },
//           {
//             session,
//           },
//         );

//         /*
//          * Remove holding when all units
//          * have been sold.
//          */
//         if (remainingUnits <= 0.00000001) {
//           await holdings.deleteOne(
//             {
//               _id: holding._id,
//             },
//             {
//               session,
//             },
//           );
//         } else {
//           await holdings.updateOne(
//             {
//               _id: holding._id,
//             },
//             {
//               $set: {
//                 units: remainingUnits,

//                 investedAmount: Number(remainingInvested.toFixed(2)),

//                 updatedAt: now,
//               },
//             },
//             {
//               session,
//             },
//           );
//         }

//         responseData = {
//           orderId,

//           orderType: "SELL",

//           schemeCode: scheme.schemeCode,

//           schemeName: scheme.schemeName,

//           units: Number(sellUnits.toFixed(8)),

//           nav,

//           amount,

//           navDate: scheme.navDate,

//           status: "COMPLETED",
//         };
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Mutual fund SELL order completed",
//         data: responseData,
//       });
//     } catch (error) {
//       console.error("sellMutualFund transaction error:", error);

//       const status = Number(error.statusCode) || 500;

//       return res.status(status).json({
//         success: false,
//         message: status === 500 ? "Unable to place SELL order" : error.message,

//         ...(error.availableUnits !== undefined
//           ? {
//               availableUnits: error.availableUnits,
//             }
//           : {}),
//       });
//     } finally {
//       await session.endSession();
//     }
//   } catch (error) {
//     console.error("sellMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to place SELL order",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET USER HOLDINGS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundHoldings(req, res) {
//   try {
//     const userId = req.userId;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required",
//       });
//     }

//     const db = await getDB();

//     const holdingsCollection = db.collection("mfHoldings");

//     const schemesCollection = db.collection("mfSchemes");

//     const holdings = await holdingsCollection
//       .find({
//         userId: String(userId),

//         units: {
//           $gt: 0,
//         },
//       })
//       .sort({
//         schemeName: 1,
//       })
//       .toArray();

//     let investedAmount = 0;
//     let currentValue = 0;
//     let todaysPnL = 0;
//     let totalReturn = 0;

//     const data = [];

//     for (const holding of holdings) {
//       const scheme = await schemesCollection.findOne({
//         schemeCode: holding.schemeCode,
//         isActive: true,
//       });

//       if (!scheme) {
//         continue;
//       }

//       const units = Number(holding.units || 0);

//       const invested = Number(holding.investedAmount || 0);

//       const currentNav = Number(scheme.currentNav || 0);

//       const previousNav = Number(scheme.previousNav || 0);

//       const value = units * currentNav;

//       const previousValue = previousNav > 0 ? units * previousNav : value;

//       const dayPnL = value - previousValue;

//       const dayPercent = previousValue > 0 ? (dayPnL / previousValue) * 100 : 0;

//       const totalPnL = value - invested;

//       const totalPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;

//       investedAmount += invested;

//       currentValue += value;

//       todaysPnL += dayPnL;

//       totalReturn += totalPnL;

//       data.push({
//         id: holding.mysqlId ?? holding._id?.toString(),

//         userId: holding.userId,

//         schemeId: holding.schemeId,

//         schemeCode: holding.schemeCode,

//         schemeName: scheme.schemeName,

//         fundHouse: scheme.fundHouse,

//         schemeType: scheme.schemeType,

//         schemeCategory: scheme.schemeCategory,

//         fundSubCategory: scheme.fundSubCategory,

//         units,

//         investedAmount: invested,

//         currentNav,

//         navDate: scheme.navDate,

//         previousNav,

//         previousNavDate: scheme.previousNavDate,

//         currentValue: value,

//         previousValue,

//         todaysPnL: dayPnL,

//         todaysReturnPercent: dayPercent,

//         totalReturn: totalPnL,

//         totalReturnPercent: totalPercent,

//         return1D: Number(scheme.return1d ?? 0),

//         return1Y: scheme.return1y,

//         return3Y: scheme.return3y,

//         return5Y: scheme.return5y,

//         rating: scheme.rating,

//         risk: scheme.risk,

//         createdAt: holding.createdAt,

//         updatedAt: holding.updatedAt,
//       });
//     }

//     const xirr = await calculatePortfolioXirr(db, userId, currentValue);

//     const totalReturnPercent =
//       investedAmount > 0 ? (totalReturn / investedAmount) * 100 : 0;

//     const todaysReturnPercent =
//       currentValue - todaysPnL > 0
//         ? (todaysPnL / (currentValue - todaysPnL)) * 100
//         : 0;

//     return res.json({
//       success: true,

//       summary: {
//         investedAmount,
//         currentValue,

//         todaysPnL,
//         todaysReturnPercent,

//         totalReturn,
//         totalReturnPercent,

//         xirr,
//       },

//       data,

//       holdings: data,
//     });
//   } catch (error) {
//     console.error("[MF HOLDINGS]", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to fetch mutual fund holdings",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | XIRR
// |--------------------------------------------------------------------------
// */

// function calculateXirrFromCashFlows(cashFlows) {
//   if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
//     return null;
//   }

//   const sorted = [...cashFlows].sort(
//     (a, b) => a.date.getTime() - b.date.getTime(),
//   );

//   const firstDate = sorted[0].date;

//   const yearFraction = (date) =>
//     (date.getTime() - firstDate.getTime()) / (365 * 24 * 60 * 60 * 1000);

//   const npv = (rate) =>
//     sorted.reduce((sum, flow) => {
//       const years = yearFraction(flow.date);

//       return sum + flow.amount / Math.pow(1 + rate, years);
//     }, 0);

//   let low = -0.9999;
//   let high = 10;

//   let lowValue = npv(low);

//   let highValue = npv(high);

//   if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
//     return null;
//   }

//   if (lowValue * highValue > 0) {
//     return null;
//   }

//   for (let i = 0; i < 200; i++) {
//     const mid = (low + high) / 2;

//     const value = npv(mid);

//     if (!Number.isFinite(value)) {
//       return null;
//     }

//     if (Math.abs(value) < 0.000001) {
//       return mid * 100;
//     }

//     if (lowValue * value <= 0) {
//       high = mid;
//       highValue = value;
//     } else {
//       low = mid;
//       lowValue = value;
//     }
//   }

//   return ((low + high) / 2) * 100;
// }

// async function calculatePortfolioXirr(db, userId, currentValue) {
//   try {
//     const orders = await db
//       .collection("mfOrders")
//       .find({
//         userId: String(userId),

//         status: "COMPLETED",
//       })
//       .sort({
//         createdAt: 1,
//       })
//       .toArray();

//     if (!orders.length) {
//       return null;
//     }

//     const cashFlows = [];

//     for (const order of orders) {
//       const amount = Number(order.amount || 0);

//       if (!Number.isFinite(amount) || amount <= 0) {
//         continue;
//       }

//       const date = normalizeDate(order.completedAt || order.createdAt);

//       if (!date) {
//         continue;
//       }

//       if (order.orderType === "BUY") {
//         cashFlows.push({
//           amount: -amount,
//           date,
//         });
//       }

//       if (order.orderType === "SELL") {
//         cashFlows.push({
//           amount,
//           date,
//         });
//       }
//     }

//     if (Number.isFinite(Number(currentValue)) && Number(currentValue) > 0) {
//       cashFlows.push({
//         amount: Number(currentValue),
//         date: new Date(),
//       });
//     }

//     const hasNegative = cashFlows.some((flow) => flow.amount < 0);

//     const hasPositive = cashFlows.some((flow) => flow.amount > 0);

//     if (!hasNegative || !hasPositive) {
//       return null;
//     }

//     return calculateXirrFromCashFlows(cashFlows);
//   } catch (error) {
//     console.error("[MF XIRR]", error);

//     return null;
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET USER ORDERS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundOrders(req, res) {
//   try {
//     const userId = req.userId;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required",
//       });
//     }

//     const db = await getDB();

//     const orders = await db
//       .collection("mfOrders")
//       .find({
//         userId: String(userId),
//       })
//       .sort({
//         createdAt: -1,
//       })
//       .toArray();

//     const schemes = db.collection("mfSchemes");

//     const result = [];

//     for (const order of orders) {
//       let scheme = null;

//       if (order.schemeCode !== undefined) {
//         scheme = await schemes.findOne({
//           schemeCode: order.schemeCode,
//         });
//       }

//       result.push({
//         id: order.mysqlId ?? order._id?.toString(),

//         orderId: order.orderId,

//         userId: order.userId,

//         orderType: order.orderType,

//         units: Number(order.units),

//         nav: Number(order.nav),

//         amount: Number(order.amount),

//         navDate: order.navDate,

//         status: order.status,

//         createdAt: order.createdAt,

//         completedAt: order.completedAt,

//         schemeCode: order.schemeCode ?? scheme?.schemeCode,

//         schemeName: order.schemeName ?? scheme?.schemeName,

//         fundHouse: scheme?.fundHouse,
//       });
//     }

//     return res.json({
//       success: true,
//       data: result,
//       orders: result,
//     });
//   } catch (error) {
//     console.error("getMutualFundOrders error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to load mutual fund orders",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC LATEST NAV
// |--------------------------------------------------------------------------
// */

// async function syncLatestNAVController(req, res) {
//   try {
//     const result = await syncLatestNAV();

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] NAV sync failed:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to synchronize latest NAV",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC RETURNS
// |--------------------------------------------------------------------------
// */

// async function syncReturnsController(req, res) {
//   try {
//     const result = await syncAllReturns();

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] Return sync failed:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to calculate mutual fund returns",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | LEGACY RETURNS SYNC
// |--------------------------------------------------------------------------
// */

// async function syncReturns(req, res) {
//   try {
//     const result = await syncAllReturns();

//     return res.json({
//       success: true,
//       message: "Mutual fund returns refresh completed",
//       data: result,
//     });
//   } catch (error) {
//     console.error("syncReturns error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to refresh mutual fund returns",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC STATUS
// |--------------------------------------------------------------------------
// */

// async function getMFSyncStatus(req, res) {
//   try {
//     const statuses = await getAllSyncStatuses();

//     return res.json({
//       success: true,

//       data: {
//         statuses,

//         daily:
//           statuses.find((item) => item.sync_name === "mf_daily_sync") || null,

//         nav: statuses.find((item) => item.sync_name === "mf_nav_sync") || null,

//         returns:
//           statuses.find((item) => item.sync_name === "mf_returns_sync") || null,

//         rating:
//           statuses.find((item) => item.sync_name === "mf_rating_sync") || null,
//       },
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] getMFSyncStatus:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load sync status",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | MANUAL SYNC
// |--------------------------------------------------------------------------
// */

// async function triggerSyncNow(req, res) {
//   try {
//     const result = await runDailySyncIfNeeded("manual");

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] triggerSyncNow:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to run sync",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | EXPORTS
// |--------------------------------------------------------------------------
// */

// module.exports = {
//   getMutualFunds,
//   getMutualFundFilters,
//   getMutualFund,
//   buyMutualFund,
//   sellMutualFund,
//   getMutualFundHoldings,
//   getMutualFundOrders,
//   syncLatestNAVController,
//   syncReturnsController,
//   syncReturns,
//   getMFSyncStatus,
//   triggerSyncNow,
//   getTopReturns,
// };































// const {
//   connectMongoDB,
//   getMongoDB,
//   getMongoClient,
// } = require("../config/mongodb");

// const { syncLatestNAV, syncAllReturns } = require("./mfSyncService");

// const { runDailySyncIfNeeded } = require("./mfSyncScheduler");

// const { getAllSyncStatuses } = require("./mfSyncStatusService");

// const { v4: uuidv4 } = require("uuid");

// /*
// |--------------------------------------------------------------------------
// | Mongo helpers
// |--------------------------------------------------------------------------
// */

// async function getDB() {
//   await connectMongoDB();
//   return getMongoDB();
// }

// function getClient() {
//   return getMongoClient();
// }

// /*
// |--------------------------------------------------------------------------
// | Helpers
// |--------------------------------------------------------------------------
// */

// function getFundType(category, name) {
//   const value = `${category || ""} ${name || ""}`.toLowerCase();

//   if (
//     value.includes("gold") ||
//     value.includes("silver") ||
//     value.includes("commodity")
//   ) {
//     return "COMMODITY";
//   }

//   if (
//     value.includes("hybrid") ||
//     value.includes("balanced advantage") ||
//     value.includes("multi asset") ||
//     value.includes("multi-asset") ||
//     value.includes("aggressive hybrid") ||
//     value.includes("conservative hybrid")
//   ) {
//     return "HYBRID";
//   }

//   if (
//     value.includes("debt") ||
//     value.includes("bond") ||
//     value.includes("liquid") ||
//     value.includes("gilt") ||
//     value.includes("overnight") ||
//     value.includes("money market") ||
//     value.includes("ultra short") ||
//     value.includes("short duration") ||
//     value.includes("medium duration") ||
//     value.includes("long duration") ||
//     value.includes("credit risk") ||
//     value.includes("floater") ||
//     value.includes("banking & psu")
//   ) {
//     return "DEBT";
//   }

//   return "EQUITY";
// }

// function getFundSubCategory(category, name) {
//   const value = `${category || ""} ${name || ""}`.toLowerCase();

//   if (value.includes("flexi")) return "Flexi Cap";
//   if (value.includes("large & mid")) return "Large & Mid Cap";
//   if (value.includes("large cap")) return "Large Cap";
//   if (value.includes("mid cap")) return "Mid Cap";
//   if (value.includes("small cap")) return "Small Cap";
//   if (value.includes("index")) return "Index";
//   if (value.includes("sectoral")) return "Sectoral";
//   if (value.includes("thematic")) return "Thematic";
//   if (value.includes("gold")) return "Gold";
//   if (value.includes("silver")) return "Silver";
//   if (value.includes("corporate bond")) return "Corporate Bond";
//   if (value.includes("liquid")) return "Liquid";
//   if (value.includes("gilt")) return "Gilt";
//   if (value.includes("aggressive hybrid")) {
//     return "Aggressive Hybrid";
//   }
//   if (value.includes("conservative hybrid")) {
//     return "Conservative Hybrid";
//   }
//   if (value.includes("multi asset") || value.includes("multi-asset")) {
//     return "Multi Asset";
//   }
//   if (value.includes("retirement")) return "Retirement";
//   if (value.includes("children") || value.includes("childrens")) {
//     return "Children";
//   }
//   if (value.includes("fund of fund") || value.includes("fof")) {
//     return "Fund of Funds";
//   }

//   return category || "Other";
// }

// function normalizeRisk(risk) {
//   if (!risk) return null;

//   const value = String(risk).trim().toLowerCase();

//   if (value.includes("very high")) {
//     return "Very High";
//   }

//   if (value.includes("moderately high")) {
//     return "Moderately High";
//   }

//   if (value === "high") {
//     return "High";
//   }

//   if (value.includes("moderately low")) {
//     return "Moderately Low";
//   }

//   if (value === "low") {
//     return "Low";
//   }

//   if (value.includes("moderate")) {
//     return "Moderate";
//   }

//   return risk;
// }

// function normalizeDate(value) {
//   if (!value) return null;

//   if (value instanceof Date) {
//     return value;
//   }

//   const date = new Date(value);

//   return Number.isNaN(date.getTime()) ? null : date;
// }

// function round(value, decimals = 2) {
//   const n = Number(value);

//   if (!Number.isFinite(n)) {
//     return null;
//   }

//   return Number(n.toFixed(decimals));
// }

// /*
// |--------------------------------------------------------------------------
// | GET TOP RETURNS
// |--------------------------------------------------------------------------
// */

// async function getTopReturns(req, res) {
//   try {
//     const db = await getDB();

//     const requestedLimit = Number(req.query.limit || 12);

//     const requestedOffset = Number(req.query.offset || 0);

//     const limit = Math.min(
//       Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 12, 1),
//       52,
//     );

//     const offset = Math.max(
//       Number.isFinite(requestedOffset) ? requestedOffset : 0,
//       0,
//     );

//     const schemes = db.collection("mfSchemes");

//     /*
//      * Get the best 1D-return fund from
//      * each fund house.
//      */
//     const rows = await schemes
//       .aggregate([
//         {
//           $match: {
//             isActive: true,
//             fundHouse: {
//               $exists: true,
//               $nin: ["", null],
//             },
//             currentNav: {
//               $gt: 0,
//             },
//             previousNav: {
//               $gt: 0,
//             },
//             return1d: {
//               $ne: null,
//             },
//           },
//         },

//         {
//           $sort: {
//             fundHouse: 1,
//             return1d: -1,
//             schemeName: 1,
//             schemeCode: 1,
//           },
//         },

//         {
//           $group: {
//             _id: "$fundHouse",
//             fund: {
//               $first: "$$ROOT",
//             },
//           },
//         },

//         {
//           $replaceRoot: {
//             newRoot: "$fund",
//           },
//         },

//         {
//           $sort: {
//             return1d: -1,
//             fundHouse: 1,
//             schemeName: 1,
//           },
//         },

//         {
//           $skip: offset,
//         },

//         {
//           $limit: limit,
//         },

//         {
//           $project: {
//             _id: 0,
//             schemeId: {
//               $ifNull: ["$mysqlId", "$_id"],
//             },
//             schemeCode: 1,
//             schemeName: 1,
//             fundHouse: 1,
//             schemeType: 1,
//             schemeCategory: 1,
//             fundSubCategory: 1,
//             currentNav: 1,
//             previousNav: 1,
//             navDate: 1,
//             previousNavDate: 1,
//             dayReturn: "$return1d",
//             dayReturnNavDate: "$return1dNavDate",
//             return1Y: "$return1y",
//             return3Y: "$return3y",
//             return5Y: "$return5y",
//             rating: 1,
//             risk: 1,
//           },
//         },
//       ])
//       .toArray();

//     const totalHousesResult = await schemes
//       .aggregate([
//         {
//           $match: {
//             isActive: true,
//             fundHouse: {
//               $exists: true,
//               $nin: ["", null],
//             },
//             currentNav: {
//               $gt: 0,
//             },
//             previousNav: {
//               $gt: 0,
//             },
//             return1d: {
//               $ne: null,
//             },
//           },
//         },

//         {
//           $group: {
//             _id: "$fundHouse",
//           },
//         },

//         {
//           $count: "totalHouses",
//         },
//       ])
//       .toArray();

//     const totalHouses = Number(totalHousesResult[0]?.totalHouses || 0);

//     return res.json({
//       success: true,
//       data: rows,
//       totalHouses,
//       returned: rows.length,
//       offset,
//       limit,
//       hasMore: offset + rows.length < totalHouses,
//     });
//   } catch (error) {
//     console.error("[MF TOP RETURNS]", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to fetch top mutual funds",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET MUTUAL FUNDS
// |--------------------------------------------------------------------------
// */

// async function getMutualFunds(req, res) {
//   try {
//     const db = await getDB();

//     const page = Math.max(Number(req.query.page) || 1, 1);

//     const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 20);

//     const offset = (page - 1) * limit;

//     const search = String(req.query.search || "").trim();

//     const fundType = String(
//       req.query.fundType || req.query.fund_type || "",
//     ).trim();

//     const category = String(req.query.category || "").trim();

//     const risk = String(req.query.risk || "").trim();

//     const fundHouse = String(
//       req.query.fundHouse || req.query.fund_house || "",
//     ).trim();

//     const ratingMinRaw = req.query.ratingMin ?? req.query.rating_min;

//     const ratingMin =
//       ratingMinRaw === undefined || ratingMinRaw === ""
//         ? null
//         : Number(ratingMinRaw);

//     const quickFilter = String(
//       req.query.quickFilter || req.query.quick_filter || "",
//     )
//       .trim()
//       .toLowerCase();

//     const indexOnly =
//       String(
//         req.query.indexOnly || req.query.index_only || "",
//       ).toLowerCase() === "true";

//     const sortBy = String(req.query.sortBy || req.query.sort_by || "name")
//       .trim()
//       .toLowerCase();

//     const sortDirection =
//       String(
//         req.query.sortDirection || req.query.sort_direction || "asc",
//       ).toLowerCase() === "desc"
//         ? -1
//         : 1;

//     const filter = {
//       isActive: true,
//     };

//     if (search) {
//       const regex = new RegExp(
//         search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
//         "i",
//       );

//       filter.$or = [
//         { schemeName: regex },
//         { fundHouse: regex },
//         { schemeCategory: regex },
//         { fundSubCategory: regex },
//       ];
//     }

//     const csv = (value) =>
//       value
//         .split(",")
//         .map((v) => v.trim())
//         .filter(Boolean);

//     if (fundType) {
//       filter.fundType = {
//         $in: csv(fundType),
//       };
//     }

//     if (category) {
//       const values = csv(category);

//       filter.$or = [
//         {
//           fundSubCategory: {
//             $in: values,
//           },
//         },
//         {
//           schemeCategory: {
//             $in: values,
//           },
//         },
//       ];
//     }

//     if (risk) {
//       filter.risk = {
//         $in: csv(risk),
//       };
//     }

//     if (fundHouse) {
//       filter.fundHouse = {
//         $in: csv(fundHouse),
//       };
//     }

//     if (Number.isFinite(ratingMin)) {
//       filter.rating = {
//         $gte: ratingMin,
//       };
//     }

//     if (indexOnly) {
//       filter.$and = filter.$and || [];

//       filter.$and.push({
//         $or: [
//           {
//             schemeName: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//           {
//             schemeCategory: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//           {
//             fundSubCategory: {
//               $regex: "index",
//               $options: "i",
//             },
//           },
//         ],
//       });
//     }

//     /*
//      * Quick filters.
//      */
//     switch (quickFilter) {
//       case "index":
//       case "index_only":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeName: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//             {
//               schemeCategory: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "index",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "flexi":
//       case "flexicap":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeName: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//             {
//               schemeCategory: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "flexi cap",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "sectoral":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeCategory: {
//                 $regex: "sectoral|thematic",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "sectoral|thematic",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "large":
//       case "largecap":
//         filter.$and = filter.$and || [];

//         filter.$and.push({
//           $or: [
//             {
//               schemeCategory: {
//                 $regex: "large cap",
//                 $options: "i",
//               },
//             },
//             {
//               fundSubCategory: {
//                 $regex: "large cap",
//                 $options: "i",
//               },
//             },
//           ],
//         });
//         break;

//       case "4plus":
//       case "rating4":
//         filter.rating = {
//           ...(filter.rating || {}),
//           $gte: 4,
//         };
//         break;

//       default:
//         break;
//     }

//     const sortMap = {
//       name: "schemeName",
//       schemename: "schemeName",
//       "1y": "return1y",
//       "3y": "return3y",
//       "5y": "return5y",
//       rating: "rating",
//       risk: "risk",
//       nav: "currentNav",
//     };

//     const orderColumn = sortMap[sortBy] || "schemeName";

//     const total = await db.collection("mfSchemes").countDocuments(filter);

//     const documents = await db
//       .collection("mfSchemes")
//       .find(filter)
//       .sort({
//         [orderColumn]: sortDirection,
//         mysqlId: 1,
//         schemeCode: 1,
//       })
//       .skip(offset)
//       .limit(limit)
//       .toArray();

//     const funds = documents.map((s) => ({
//       id: s.mysqlId ?? s._id?.toString(),

//       scheme_code: s.schemeCode,

//       scheme_name: s.schemeName,

//       fund_house: s.fundHouse,

//       scheme_type: s.schemeType,

//       scheme_category: s.schemeCategory,

//       fund_type: s.fundType,

//       fund_sub_category: s.fundSubCategory,

//       isin_growth: s.isinGrowth,

//       isin_div_reinvestment: s.isinDivReinvestment,

//       current_nav: round(s.currentNav),

//       nav_date: s.navDate,

//       return_1y: s.return1y,

//       return_3y: s.return3y,

//       return_5y: s.return5y,

//       returns_for_nav_date: s.returnsForNavDate,

//       return_1y_nav_date: s.return1yNavDate,

//       return_3y_nav_date: s.return3yNavDate,

//       return_5y_nav_date: s.return5yNavDate,

//       rating: s.rating,

//       rating_source: s.ratingSource,

//       rating_updated_at: s.ratingUpdatedAt,

//       risk: normalizeRisk(s.risk),

//       risk_source: s.riskSource,

//       risk_updated_at: s.riskUpdatedAt,

//       return_updated_at: s.returnUpdatedAt,
//     }));

//     return res.json({
//       success: true,
//       data: {
//         funds,
//         total,
//         page,
//         limit,
//         offset,
//         hasMore: offset + funds.length < total,
//       },
//     });
//   } catch (error) {
//     console.error("[MF API] getMutualFunds:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load mutual funds",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET MUTUAL FUND FILTERS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundFilters(req, res) {
//   try {
//     const db = await getDB();

//     const schemes = db.collection("mfSchemes");

//     const activeFilter = {
//       isActive: true,
//     };

//     const houses = await schemes.distinct("fundHouse", {
//       ...activeFilter,
//       fundHouse: {
//         $exists: true,
//         $nin: ["", null],
//       },
//     });

//     const categoryDocuments = await schemes
//       .find(
//         {
//           ...activeFilter,
//           fundSubCategory: {
//             $exists: true,
//             $nin: ["", null],
//           },
//         },
//         {
//           projection: {
//             fundType: 1,
//             fundSubCategory: 1,
//           },
//         },
//       )
//       .toArray();

//     const risks = await schemes.distinct("risk", {
//       ...activeFilter,
//       risk: {
//         $exists: true,
//         $nin: ["", null],
//       },
//     });

//     const ratings = await schemes.distinct("rating", {
//       ...activeFilter,
//       rating: {
//         $exists: true,
//         $ne: null,
//       },
//     });

//     const grouped = {
//       EQUITY: [],
//       DEBT: [],
//       HYBRID: [],
//       COMMODITY: [],
//     };

//     for (const row of categoryDocuments) {
//       if (!grouped[row.fundType]) {
//         grouped[row.fundType] = [];
//       }

//       if (
//         row.fundSubCategory &&
//         !grouped[row.fundType].includes(row.fundSubCategory)
//       ) {
//         grouped[row.fundType].push(row.fundSubCategory);
//       }
//     }

//     const categories = [
//       ...new Set(
//         categoryDocuments.map((x) => x.fundSubCategory).filter(Boolean),
//       ),
//     ];

//     risks.sort((a, b) => String(a).localeCompare(String(b)));

//     ratings.sort((a, b) => Number(b) - Number(a));

//     return res.json({
//       success: true,
//       data: {
//         fundHouses: houses.filter(Boolean).sort(),

//         categories,

//         categoryGroups: grouped,

//         risks,

//         ratings: ratings.map(Number),
//       },
//     });
//   } catch (error) {
//     console.error("[MF API] getMutualFundFilters:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load mutual fund filters",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET SINGLE MUTUAL FUND
// |--------------------------------------------------------------------------
// */

// async function getMutualFund(req, res) {
//   try {
//     const { schemeCode } = req.params;

//     const db = await getDB();

//     const numericCode = Number(schemeCode);

//     const query = Number.isFinite(numericCode)
//       ? {
//           schemeCode: numericCode,
//           isActive: true,
//         }
//       : {
//           schemeCode: schemeCode,
//           isActive: true,
//         };

//     const scheme = await db.collection("mfSchemes").findOne(query);

//     if (!scheme) {
//       return res.status(404).json({
//         success: false,
//         message: "Mutual fund not found",
//       });
//     }

//     return res.json({
//       success: true,
//       data: {
//         id: scheme.mysqlId ?? scheme._id?.toString(),

//         schemeCode: scheme.schemeCode,

//         schemeName: scheme.schemeName,

//         fundHouse: scheme.fundHouse,

//         schemeType: scheme.schemeType,

//         schemeCategory: scheme.schemeCategory,

//         fundType: scheme.fundType,

//         fundSubCategory: scheme.fundSubCategory,

//         currentNav: round(scheme.currentNav),

//         navDate: scheme.navDate,

//         return1Y: scheme.return1y,

//         return3Y: scheme.return3y,

//         return5Y: scheme.return5y,

//         rating: scheme.rating,

//         risk: scheme.risk,
//       },
//     });
//   } catch (error) {
//     console.error("getMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to load mutual fund",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | BUY MUTUAL FUND
// |--------------------------------------------------------------------------
// |
// | MongoDB transaction replaces:
// |   MySQL BEGIN
// |   SELECT ... FOR UPDATE
// |   INSERT order
// |   INSERT/UPDATE holding
// |   COMMIT
// |
// */

// async function buyMutualFund(req, res) {
//   const userId = req.userId;

//   if (!userId) {
//     return res.status(401).json({
//       success: false,
//       message: "Authentication required",
//     });
//   }

//   const { schemeCode, units } = req.body;

//   if (!schemeCode) {
//     return res.status(400).json({
//       success: false,
//       message: "schemeCode is required",
//     });
//   }

//   const buyUnits = Number(units);

//   if (!Number.isFinite(buyUnits) || buyUnits <= 0) {
//     return res.status(400).json({
//       success: false,
//       message: "units must be greater than 0",
//     });
//   }

//   try {
//     await connectMongoDB();

//     const db = getMongoDB();
//     const client = getClient();

//     const session = client.startSession();

//     let responseData = null;

//     try {
//       await session.withTransaction(async () => {
//         const schemes = db.collection("mfSchemes");

//         const orders = db.collection("mfOrders");

//         const holdings = db.collection("mfHoldings");

//         const numericCode = Number(schemeCode);

//         const schemeQuery = Number.isFinite(numericCode)
//           ? {
//               schemeCode: numericCode,
//               isActive: true,
//             }
//           : {
//               schemeCode: schemeCode,
//               isActive: true,
//             };

//         /*
//          * MongoDB transaction provides
//          * the consistency boundary.
//          */
//         const scheme = await schemes.findOne(schemeQuery, {
//           session,
//         });

//         if (!scheme) {
//           const error = new Error("Mutual fund not found");

//           error.statusCode = 404;

//           throw error;
//         }

//         const nav = round(scheme.currentNav, 2);

//         if (!Number.isFinite(nav) || nav <= 0) {
//           const error = new Error("Current NAV unavailable");

//           error.statusCode = 400;

//           throw error;
//         }

//         const amount = round(buyUnits * nav, 2);

//         if (!Number.isFinite(amount) || amount <= 0) {
//           const error = new Error("Unable to calculate purchase amount");

//           error.statusCode = 400;

//           throw error;
//         }

//         const orderId = uuidv4();

//         const now = new Date();

//         /*
//          * Create MF order.
//          */
//         await orders.insertOne(
//           {
//             mysqlId: null,

//             orderId,

//             userId: String(userId),

//             schemeId: scheme.mysqlId ?? scheme._id,

//             schemeCode: scheme.schemeCode,

//             schemeName: scheme.schemeName,

//             orderType: "BUY",

//             units: buyUnits,

//             nav,

//             amount,

//             navDate: scheme.navDate,

//             status: "COMPLETED",

//             createdAt: now,

//             completedAt: now,
//           },
//           {
//             session,
//           },
//         );

//         /*
//          * Update existing holding.
//          *
//          * Your migrated data uses userId +
//          * schemeCode for the holding identity.
//          */
//         const existingHolding = await holdings.findOne(
//           {
//             userId: String(userId),

//             schemeCode: scheme.schemeCode,
//           },
//           {
//             session,
//           },
//         );

//         if (existingHolding) {
//           await holdings.updateOne(
//             {
//               _id: existingHolding._id,
//             },
//             {
//               $inc: {
//                 units: buyUnits,

//                 investedAmount: amount,
//               },

//               $set: {
//                 updatedAt: now,
//               },
//             },
//             {
//               session,
//             },
//           );
//         } else {
//           await holdings.insertOne(
//             {
//               mysqlId: null,

//               userId: String(userId),

//               schemeId: scheme.mysqlId ?? scheme._id,

//               schemeCode: scheme.schemeCode,

//               schemeName: scheme.schemeName,

//               units: buyUnits,

//               investedAmount: amount,

//               createdAt: now,

//               updatedAt: now,
//             },
//             {
//               session,
//             },
//           );
//         }

//         responseData = {
//           orderId,

//           orderType: "BUY",

//           schemeCode: scheme.schemeCode,

//           schemeName: scheme.schemeName,

//           units: Number(buyUnits.toFixed(8)),

//           nav,

//           amount,

//           navDate: scheme.navDate,

//           status: "COMPLETED",
//         };
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Mutual fund BUY order completed",
//         data: responseData,
//       });
//     } catch (error) {
//       console.error("buyMutualFund transaction error:", error);

//       const status = Number(error.statusCode) || 500;

//       return res.status(status).json({
//         success: false,
//         message: status === 500 ? "Unable to place BUY order" : error.message,
//       });
//     } finally {
//       await session.endSession();
//     }
//   } catch (error) {
//     console.error("buyMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to place BUY order",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SELL MUTUAL FUND
// |--------------------------------------------------------------------------
// */

// async function sellMutualFund(req, res) {
//   const userId = req.userId;

//   if (!userId) {
//     return res.status(401).json({
//       success: false,
//       message: "Authentication required",
//     });
//   }

//   const { schemeCode, units } = req.body;

//   if (!schemeCode) {
//     return res.status(400).json({
//       success: false,
//       message: "schemeCode is required",
//     });
//   }

//   const sellUnits = Number(units);

//   if (!Number.isFinite(sellUnits) || sellUnits <= 0) {
//     return res.status(400).json({
//       success: false,
//       message: "units must be greater than 0",
//     });
//   }

//   try {
//     await connectMongoDB();

//     const db = getMongoDB();
//     const client = getClient();

//     const session = client.startSession();

//     let responseData = null;

//     try {
//       await session.withTransaction(async () => {
//         const schemes = db.collection("mfSchemes");

//         const orders = db.collection("mfOrders");

//         const holdings = db.collection("mfHoldings");

//         const numericCode = Number(schemeCode);

//         const schemeQuery = Number.isFinite(numericCode)
//           ? {
//               schemeCode: numericCode,
//               isActive: true,
//             }
//           : {
//               schemeCode: schemeCode,
//               isActive: true,
//             };

//         const scheme = await schemes.findOne(schemeQuery, {
//           session,
//         });

//         if (!scheme) {
//           const error = new Error("Mutual fund not found");

//           error.statusCode = 404;

//           throw error;
//         }

//         const nav = round(scheme.currentNav, 2);

//         if (!Number.isFinite(nav) || nav <= 0) {
//           const error = new Error("Current NAV unavailable");

//           error.statusCode = 400;

//           throw error;
//         }

//         /*
//          * Find the user's holding.
//          */
//         const holding = await holdings.findOne(
//           {
//             userId: String(userId),

//             schemeCode: scheme.schemeCode,
//           },
//           {
//             session,
//           },
//         );

//         if (!holding) {
//           const error = new Error("No mutual fund holding found");

//           error.statusCode = 400;

//           throw error;
//         }

//         const availableUnits = Number(holding.units || 0);

//         if (sellUnits > availableUnits + 0.00000001) {
//           const error = new Error("Insufficient mutual fund units");

//           error.statusCode = 400;

//           error.availableUnits = availableUnits;

//           throw error;
//         }

//         const amount = round(sellUnits * nav, 2);

//         const oldInvested = Number(holding.investedAmount || 0);

//         const remainingUnits = availableUnits - sellUnits;

//         let remainingInvested = 0;

//         if (availableUnits > 0) {
//           remainingInvested = oldInvested * (remainingUnits / availableUnits);
//         }

//         const orderId = uuidv4();

//         const now = new Date();

//         /*
//          * Create SELL order.
//          */
//         await orders.insertOne(
//           {
//             mysqlId: null,

//             orderId,

//             userId: String(userId),

//             schemeId: scheme.mysqlId ?? scheme._id,

//             schemeCode: scheme.schemeCode,

//             schemeName: scheme.schemeName,

//             orderType: "SELL",

//             units: sellUnits,

//             nav,

//             amount,

//             navDate: scheme.navDate,

//             status: "COMPLETED",

//             createdAt: now,

//             completedAt: now,
//           },
//           {
//             session,
//           },
//         );

//         /*
//          * Remove holding when all units
//          * have been sold.
//          */
//         if (remainingUnits <= 0.00000001) {
//           await holdings.deleteOne(
//             {
//               _id: holding._id,
//             },
//             {
//               session,
//             },
//           );
//         } else {
//           await holdings.updateOne(
//             {
//               _id: holding._id,
//             },
//             {
//               $set: {
//                 units: remainingUnits,

//                 investedAmount: Number(remainingInvested.toFixed(2)),

//                 updatedAt: now,
//               },
//             },
//             {
//               session,
//             },
//           );
//         }

//         responseData = {
//           orderId,

//           orderType: "SELL",

//           schemeCode: scheme.schemeCode,

//           schemeName: scheme.schemeName,

//           units: Number(sellUnits.toFixed(8)),

//           nav,

//           amount,

//           navDate: scheme.navDate,

//           status: "COMPLETED",
//         };
//       });

//       return res.status(201).json({
//         success: true,
//         message: "Mutual fund SELL order completed",
//         data: responseData,
//       });
//     } catch (error) {
//       console.error("sellMutualFund transaction error:", error);

//       const status = Number(error.statusCode) || 500;

//       return res.status(status).json({
//         success: false,
//         message: status === 500 ? "Unable to place SELL order" : error.message,

//         ...(error.availableUnits !== undefined
//           ? {
//               availableUnits: error.availableUnits,
//             }
//           : {}),
//       });
//     } finally {
//       await session.endSession();
//     }
//   } catch (error) {
//     console.error("sellMutualFund error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to place SELL order",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET USER HOLDINGS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundHoldings(req, res) {
//   try {
//     const userId = req.userId;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required",
//       });
//     }

//     const db = await getDB();

//     const holdingsCollection = db.collection("mfHoldings");

//     const schemesCollection = db.collection("mfSchemes");

//     const holdings = await holdingsCollection
//       .find({
//         userId: String(userId),

//         units: {
//           $gt: 0,
//         },
//       })
//       .sort({
//         schemeName: 1,
//       })
//       .toArray();

//     let investedAmount = 0;
//     let currentValue = 0;
//     let todaysPnL = 0;
//     let totalReturn = 0;

//     const data = [];

//     for (const holding of holdings) {
//       const scheme = await schemesCollection.findOne({
//         schemeCode: holding.schemeCode,
//         isActive: true,
//       });

//       if (!scheme) {
//         continue;
//       }

//       const units = Number(holding.units || 0);

//       const invested = Number(holding.investedAmount || 0);

//       const currentNav = Number(scheme.currentNav || 0);

//       const previousNav = Number(scheme.previousNav || 0);

//       const value = units * currentNav;

//       const previousValue = previousNav > 0 ? units * previousNav : value;

//       const dayPnL = value - previousValue;

//       const dayPercent = previousValue > 0 ? (dayPnL / previousValue) * 100 : 0;

//       const totalPnL = value - invested;

//       const totalPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;

//       investedAmount += invested;

//       currentValue += value;

//       todaysPnL += dayPnL;

//       totalReturn += totalPnL;

//       data.push({
//         id: holding.mysqlId ?? holding._id?.toString(),

//         userId: holding.userId,

//         schemeId: holding.schemeId,

//         schemeCode: holding.schemeCode,

//         schemeName: scheme.schemeName,

//         fundHouse: scheme.fundHouse,

//         schemeType: scheme.schemeType,

//         schemeCategory: scheme.schemeCategory,

//         fundSubCategory: scheme.fundSubCategory,

//         units,

//         investedAmount: invested,

//         currentNav,

//         navDate: scheme.navDate,

//         previousNav,

//         previousNavDate: scheme.previousNavDate,

//         currentValue: value,

//         previousValue,

//         todaysPnL: dayPnL,

//         todaysReturnPercent: dayPercent,

//         totalReturn: totalPnL,

//         totalReturnPercent: totalPercent,

//         return1D: Number(scheme.return1d ?? 0),

//         return1Y: scheme.return1y,

//         return3Y: scheme.return3y,

//         return5Y: scheme.return5y,

//         rating: scheme.rating,

//         risk: scheme.risk,

//         createdAt: holding.createdAt,

//         updatedAt: holding.updatedAt,
//       });
//     }

//     const xirr = await calculatePortfolioXirr(db, userId, currentValue);

//     const totalReturnPercent =
//       investedAmount > 0 ? (totalReturn / investedAmount) * 100 : 0;

//     const todaysReturnPercent =
//       currentValue - todaysPnL > 0
//         ? (todaysPnL / (currentValue - todaysPnL)) * 100
//         : 0;

//     return res.json({
//       success: true,

//       summary: {
//         investedAmount,
//         currentValue,

//         todaysPnL,
//         todaysReturnPercent,

//         totalReturn,
//         totalReturnPercent,

//         xirr,
//       },

//       data,

//       holdings: data,
//     });
//   } catch (error) {
//     console.error("[MF HOLDINGS]", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to fetch mutual fund holdings",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | XIRR
// |--------------------------------------------------------------------------
// */

// function calculateXirrFromCashFlows(cashFlows) {
//   if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
//     return null;
//   }

//   const sorted = [...cashFlows].sort(
//     (a, b) => a.date.getTime() - b.date.getTime(),
//   );

//   const firstDate = sorted[0].date;

//   const yearFraction = (date) =>
//     (date.getTime() - firstDate.getTime()) / (365 * 24 * 60 * 60 * 1000);

//   const npv = (rate) =>
//     sorted.reduce((sum, flow) => {
//       const years = yearFraction(flow.date);

//       return sum + flow.amount / Math.pow(1 + rate, years);
//     }, 0);

//   let low = -0.9999;
//   let high = 10;

//   let lowValue = npv(low);

//   let highValue = npv(high);

//   if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
//     return null;
//   }

//   if (lowValue * highValue > 0) {
//     return null;
//   }

//   for (let i = 0; i < 200; i++) {
//     const mid = (low + high) / 2;

//     const value = npv(mid);

//     if (!Number.isFinite(value)) {
//       return null;
//     }

//     if (Math.abs(value) < 0.000001) {
//       return mid * 100;
//     }

//     if (lowValue * value <= 0) {
//       high = mid;
//       highValue = value;
//     } else {
//       low = mid;
//       lowValue = value;
//     }
//   }

//   return ((low + high) / 2) * 100;
// }

// async function calculatePortfolioXirr(db, userId, currentValue) {
//   try {
//     const orders = await db
//       .collection("mfOrders")
//       .find({
//         userId: String(userId),

//         status: "COMPLETED",
//       })
//       .sort({
//         createdAt: 1,
//       })
//       .toArray();

//     if (!orders.length) {
//       return null;
//     }

//     const cashFlows = [];

//     for (const order of orders) {
//       const amount = Number(order.amount || 0);

//       if (!Number.isFinite(amount) || amount <= 0) {
//         continue;
//       }

//       const date = normalizeDate(order.completedAt || order.createdAt);

//       if (!date) {
//         continue;
//       }

//       if (order.orderType === "BUY") {
//         cashFlows.push({
//           amount: -amount,
//           date,
//         });
//       }

//       if (order.orderType === "SELL") {
//         cashFlows.push({
//           amount,
//           date,
//         });
//       }
//     }

//     if (Number.isFinite(Number(currentValue)) && Number(currentValue) > 0) {
//       cashFlows.push({
//         amount: Number(currentValue),
//         date: new Date(),
//       });
//     }

//     const hasNegative = cashFlows.some((flow) => flow.amount < 0);

//     const hasPositive = cashFlows.some((flow) => flow.amount > 0);

//     if (!hasNegative || !hasPositive) {
//       return null;
//     }

//     return calculateXirrFromCashFlows(cashFlows);
//   } catch (error) {
//     console.error("[MF XIRR]", error);

//     return null;
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | GET USER ORDERS
// |--------------------------------------------------------------------------
// */

// async function getMutualFundOrders(req, res) {
//   try {
//     const userId = req.userId;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required",
//       });
//     }

//     const db = await getDB();

//     const orders = await db
//       .collection("mfOrders")
//       .find({
//         userId: String(userId),
//       })
//       .sort({
//         createdAt: -1,
//       })
//       .toArray();

//     const schemes = db.collection("mfSchemes");

//     const result = [];

//     for (const order of orders) {
//       let scheme = null;

//       if (order.schemeCode !== undefined) {
//         scheme = await schemes.findOne({
//           schemeCode: order.schemeCode,
//         });
//       }

//       result.push({
//         id: order.mysqlId ?? order._id?.toString(),

//         orderId: order.orderId,

//         userId: order.userId,

//         orderType: order.orderType,

//         units: Number(order.units),

//         nav: Number(order.nav),

//         amount: Number(order.amount),

//         navDate: order.navDate,

//         status: order.status,

//         createdAt: order.createdAt,

//         completedAt: order.completedAt,

//         schemeCode: order.schemeCode ?? scheme?.schemeCode,

//         schemeName: order.schemeName ?? scheme?.schemeName,

//         fundHouse: scheme?.fundHouse,
//       });
//     }

//     return res.json({
//       success: true,
//       data: result,
//       orders: result,
//     });
//   } catch (error) {
//     console.error("getMutualFundOrders error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to load mutual fund orders",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC LATEST NAV
// |--------------------------------------------------------------------------
// */

// async function syncLatestNAVController(req, res) {
//   try {
//     const result = await syncLatestNAV();

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] NAV sync failed:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to synchronize latest NAV",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC RETURNS
// |--------------------------------------------------------------------------
// */

// async function syncReturnsController(req, res) {
//   try {
//     const result = await syncAllReturns();

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] Return sync failed:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to calculate mutual fund returns",
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | LEGACY RETURNS SYNC
// |--------------------------------------------------------------------------
// */

// async function syncReturns(req, res) {
//   try {
//     const result = await syncAllReturns();

//     return res.json({
//       success: true,
//       message: "Mutual fund returns refresh completed",
//       data: result,
//     });
//   } catch (error) {
//     console.error("syncReturns error:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Unable to refresh mutual fund returns",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | SYNC STATUS
// |--------------------------------------------------------------------------
// */

// async function getMFSyncStatus(req, res) {
//   try {
//     const statuses = await getAllSyncStatuses();

//     return res.json({
//       success: true,

//       data: {
//         statuses,

//         daily:
//           statuses.find((item) => item.sync_name === "mf_daily_sync") || null,

//         nav: statuses.find((item) => item.sync_name === "mf_nav_sync") || null,

//         returns:
//           statuses.find((item) => item.sync_name === "mf_returns_sync") || null,

//         rating:
//           statuses.find((item) => item.sync_name === "mf_rating_sync") || null,
//       },
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] getMFSyncStatus:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to load sync status",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | MANUAL SYNC
// |--------------------------------------------------------------------------
// */

// async function triggerSyncNow(req, res) {
//   try {
//     const result = await runDailySyncIfNeeded("manual");

//     return res.json({
//       success: true,
//       data: result,
//     });
//   } catch (error) {
//     console.error("[MF CONTROLLER] triggerSyncNow:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Failed to run sync",
//       error: error.message,
//     });
//   }
// }

// /*
// |--------------------------------------------------------------------------
// | EXPORTS
// |--------------------------------------------------------------------------
// */

// module.exports = {
//   getMutualFunds,
//   getMutualFundFilters,
//   getMutualFund,
//   buyMutualFund,
//   sellMutualFund,
//   getMutualFundHoldings,
//   getMutualFundOrders,
//   syncLatestNAVController,
//   syncReturnsController,
//   syncReturns,
//   getMFSyncStatus,
//   triggerSyncNow,
//   getTopReturns,
// };



































const {
  connectMongoDB,
  getMongoDB,
  getMongoClient,
} = require("../config/mongodb");

const { syncLatestNAV, syncAllReturns } = require("./mfSyncService");

const { runDailySyncIfNeeded } = require("./mfSyncScheduler");

const { getAllSyncStatuses } = require("./mfSyncStatusService");

const { v4: uuidv4 } = require("uuid");

/*
|--------------------------------------------------------------------------
| Mongo helpers
|--------------------------------------------------------------------------
*/

async function getDB() {
  await connectMongoDB();
  return getMongoDB();
}

function getClient() {
  return getMongoClient();
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function getFundType(category, name) {
  const value = `${category || ""} ${name || ""}`.toLowerCase();

  if (
    value.includes("gold") ||
    value.includes("silver") ||
    value.includes("commodity")
  ) {
    return "COMMODITY";
  }

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

  return "EQUITY";
}

function getFundSubCategory(category, name) {
  const value = `${category || ""} ${name || ""}`.toLowerCase();

  if (value.includes("flexi")) return "Flexi Cap";
  if (value.includes("large & mid")) return "Large & Mid Cap";
  if (value.includes("large cap")) return "Large Cap";
  if (value.includes("mid cap")) return "Mid Cap";
  if (value.includes("small cap")) return "Small Cap";
  if (value.includes("index")) return "Index";
  if (value.includes("sectoral")) return "Sectoral";
  if (value.includes("thematic")) return "Thematic";
  if (value.includes("gold")) return "Gold";
  if (value.includes("silver")) return "Silver";
  if (value.includes("corporate bond")) return "Corporate Bond";
  if (value.includes("liquid")) return "Liquid";
  if (value.includes("gilt")) return "Gilt";
  if (value.includes("aggressive hybrid")) {
    return "Aggressive Hybrid";
  }
  if (value.includes("conservative hybrid")) {
    return "Conservative Hybrid";
  }
  if (value.includes("multi asset") || value.includes("multi-asset")) {
    return "Multi Asset";
  }
  if (value.includes("retirement")) return "Retirement";
  if (value.includes("children") || value.includes("childrens")) {
    return "Children";
  }
  if (value.includes("fund of fund") || value.includes("fof")) {
    return "Fund of Funds";
  }

  return category || "Other";
}

function normalizeRisk(risk) {
  if (!risk) return null;

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

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value, decimals = 2) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return Number(n.toFixed(decimals));
}

/*
|--------------------------------------------------------------------------
| GET TOP RETURNS
|--------------------------------------------------------------------------
*/

async function getTopReturns(req, res) {
  try {
    const db = await getDB();

    const requestedLimit = Number(req.query.limit || 12);

    const requestedOffset = Number(req.query.offset || 0);

    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 12, 1),
      52,
    );

    const offset = Math.max(
      Number.isFinite(requestedOffset) ? requestedOffset : 0,
      0,
    );

    const schemes = db.collection("mfSchemes");

    /*
     * Get the best 1D-return fund from
     * each fund house.
     */
    const rows = await schemes
      .aggregate([
        {
          $match: {
            isActive: true,
            fundHouse: {
              $exists: true,
              $nin: ["", null],
            },
            currentNav: {
              $gt: 0,
            },
            previousNav: {
              $gt: 0,
            },
            return1d: {
              $ne: null,
            },
          },
        },

        {
          $sort: {
            fundHouse: 1,
            return1d: -1,
            schemeName: 1,
            schemeCode: 1,
          },
        },

        {
          $group: {
            _id: "$fundHouse",
            fund: {
              $first: "$$ROOT",
            },
          },
        },

        {
          $replaceRoot: {
            newRoot: "$fund",
          },
        },

        {
          $sort: {
            return1d: -1,
            fundHouse: 1,
            schemeName: 1,
          },
        },

        {
          $skip: offset,
        },

        {
          $limit: limit,
        },

        {
          $project: {
            _id: 0,
            schemeId: {
              $ifNull: ["$mysqlId", "$_id"],
            },
            schemeCode: 1,
            schemeName: 1,
            fundHouse: 1,
            schemeType: 1,
            schemeCategory: 1,
            fundSubCategory: 1,
            currentNav: 1,
            previousNav: 1,
            navDate: 1,
            previousNavDate: 1,
            dayReturn: "$return1d",
            dayReturnNavDate: "$return1dNavDate",
            return1Y: "$return1y",
            return3Y: "$return3y",
            return5Y: "$return5y",
            rating: 1,
            risk: 1,
          },
        },
      ])
      .toArray();

    const totalHousesResult = await schemes
      .aggregate([
        {
          $match: {
            isActive: true,
            fundHouse: {
              $exists: true,
              $nin: ["", null],
            },
            currentNav: {
              $gt: 0,
            },
            previousNav: {
              $gt: 0,
            },
            return1d: {
              $ne: null,
            },
          },
        },

        {
          $group: {
            _id: "$fundHouse",
          },
        },

        {
          $count: "totalHouses",
        },
      ])
      .toArray();

    const totalHouses = Number(totalHousesResult[0]?.totalHouses || 0);

    return res.json({
      success: true,
      data: rows,
      totalHouses,
      returned: rows.length,
      offset,
      limit,
      hasMore: offset + rows.length < totalHouses,
    });
  } catch (error) {
    console.error("[MF TOP RETURNS]", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch top mutual funds",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET MUTUAL FUNDS
|--------------------------------------------------------------------------
*/

async function getMutualFunds(req, res) {
  try {
    const db = await getDB();

    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(Math.max(Number(req.query.limit) || 10000, 1), 10000);

    const offset = (page - 1) * limit;

    const search = String(req.query.search || "").trim();

    const fundType = String(
      req.query.fundType || req.query.fund_type || "",
    ).trim();

    const category = String(req.query.category || "").trim();

    const risk = String(req.query.risk || "").trim();

    const fundHouse = String(
      req.query.fundHouse || req.query.fund_house || "",
    ).trim();

    const ratingMinRaw = req.query.ratingMin ?? req.query.rating_min;

    const ratingMin =
      ratingMinRaw === undefined || ratingMinRaw === ""
        ? null
        : Number(ratingMinRaw);

    const quickFilter = String(
      req.query.quickFilter || req.query.quick_filter || "",
    )
      .trim()
      .toLowerCase();

    const indexOnly =
      String(
        req.query.indexOnly || req.query.index_only || "",
      ).toLowerCase() === "true";

    const sortBy = String(req.query.sortBy || req.query.sort_by || "name")
      .trim()
      .toLowerCase();

    const sortDirection =
      String(
        req.query.sortDirection || req.query.sort_direction || "asc",
      ).toLowerCase() === "desc"
        ? -1
        : 1;

    const filter = {
      isActive: true,
    };

    if (search) {
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { schemeName: regex },
          { fundHouse: regex },
          { schemeCategory: regex },
          { fundSubCategory: regex },
          { schemeType: regex },
          { fundType: regex },
        ],
      });
    }

    const csv = (value) =>
      value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

    if (fundType) {
      filter.fundType = {
        $in: csv(fundType),
      };
    }

    if (category) {
      const values = csv(category);

      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          {
            fundSubCategory: {
              $in: values,
            },
          },
          {
            schemeCategory: {
              $in: values,
            },
          },
        ],
      });
    }

    if (risk) {
      filter.risk = {
        $in: csv(risk),
      };
    }

    if (fundHouse) {
      filter.fundHouse = {
        $in: csv(fundHouse),
      };
    }

    if (Number.isFinite(ratingMin)) {
      filter.rating = {
        $gte: ratingMin,
      };
    }

    if (indexOnly) {
      filter.$and = filter.$and || [];

      filter.$and.push({
        $or: [
          {
            schemeName: {
              $regex: "index",
              $options: "i",
            },
          },
          {
            schemeCategory: {
              $regex: "index",
              $options: "i",
            },
          },
          {
            fundSubCategory: {
              $regex: "index",
              $options: "i",
            },
          },
        ],
      });
    }

    /*
     * Quick filters.
     */
    switch (quickFilter) {
      case "index":
      case "index_only":
        filter.$and = filter.$and || [];

        filter.$and.push({
          $or: [
            {
              schemeName: {
                $regex: "index",
                $options: "i",
              },
            },
            {
              schemeCategory: {
                $regex: "index",
                $options: "i",
              },
            },
            {
              fundSubCategory: {
                $regex: "index",
                $options: "i",
              },
            },
          ],
        });
        break;

      case "flexi":
      case "flexicap":
        filter.$and = filter.$and || [];

        filter.$and.push({
          $or: [
            {
              schemeName: {
                $regex: "flexi cap",
                $options: "i",
              },
            },
            {
              schemeCategory: {
                $regex: "flexi cap",
                $options: "i",
              },
            },
            {
              fundSubCategory: {
                $regex: "flexi cap",
                $options: "i",
              },
            },
          ],
        });
        break;

      case "sectoral":
        filter.$and = filter.$and || [];

        filter.$and.push({
          $or: [
            {
              schemeCategory: {
                $regex: "sectoral|thematic",
                $options: "i",
              },
            },
            {
              fundSubCategory: {
                $regex: "sectoral|thematic",
                $options: "i",
              },
            },
          ],
        });
        break;

      case "large":
      case "largecap":
        filter.$and = filter.$and || [];

        filter.$and.push({
          $or: [
            {
              schemeCategory: {
                $regex: "large cap",
                $options: "i",
              },
            },
            {
              fundSubCategory: {
                $regex: "large cap",
                $options: "i",
              },
            },
          ],
        });
        break;

      case "4plus":
      case "rating4":
        filter.rating = {
          ...(filter.rating || {}),
          $gte: 4,
        };
        break;

      case "5plus":
      case "rating5":
        filter.rating = {
          ...(filter.rating || {}),
          $gte: 5,
        };
        break;

      default:
        break;
    }

    const sortMap = {
      name: "schemeName",
      schemename: "schemeName",
      "1y": "return1y",
      "3y": "return3y",
      "5y": "return5y",
      rating: "rating",
      risk: "risk",
      nav: "currentNav",
    };

    const orderColumn = sortMap[sortBy] || "schemeName";

    const total = await db.collection("mfSchemes").countDocuments(filter);

    const documents = await db
      .collection("mfSchemes")
      .find(filter)
      .sort({
        [orderColumn]: sortDirection,
        mysqlId: 1,
        schemeCode: 1,
      })
      .skip(offset)
      .limit(limit)
      .toArray();

    const funds = documents.map((s) => ({
      id: s.mysqlId ?? s._id?.toString(),

      scheme_code: s.schemeCode,

      scheme_name: s.schemeName,

      fund_house: s.fundHouse,

      scheme_type: s.schemeType,

      scheme_category: s.schemeCategory,

      fund_type: s.fundType,

      fund_sub_category: s.fundSubCategory,

      isin_growth: s.isinGrowth,

      isin_div_reinvestment: s.isinDivReinvestment,

      current_nav: round(s.currentNav),

      nav_date: s.navDate,

      return_1y: s.return1y,

      return_3y: s.return3y,

      return_5y: s.return5y,

      returns_for_nav_date: s.returnsForNavDate,

      return_1y_nav_date: s.return1yNavDate,

      return_3y_nav_date: s.return3yNavDate,

      return_5y_nav_date: s.return5yNavDate,

      rating: s.rating,

      rating_source: s.ratingSource,

      rating_updated_at: s.ratingUpdatedAt,

      risk: normalizeRisk(s.risk),

      risk_source: s.riskSource,

      risk_updated_at: s.riskUpdatedAt,

      return_updated_at: s.returnUpdatedAt,
    }));

    return res.json({
      success: true,
      data: {
        funds,
        total,
        page,
        limit,
        offset,
        hasMore: offset + funds.length < total,
      },
    });
  } catch (error) {
    console.error("[MF API] getMutualFunds:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load mutual funds",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET MUTUAL FUND FILTERS
|--------------------------------------------------------------------------
*/

async function getMutualFundFilters(req, res) {
  try {
    const db = await getDB();

    const schemes = db.collection("mfSchemes");

    const activeFilter = {
      isActive: true,
    };

    const houses = await schemes.distinct("fundHouse", {
      ...activeFilter,
      fundHouse: {
        $exists: true,
        $nin: ["", null],
      },
    });

    const categoryDocuments = await schemes
      .find(
        {
          ...activeFilter,
          $or: [
            { fundSubCategory: { $exists: true, $nin: ["", null] } },
            { schemeCategory: { $exists: true, $nin: ["", null] } },
          ],
        },
        {
          projection: {
            fundType: 1,
            fundSubCategory: 1,
            schemeCategory: 1,
          },
        },
      )
      .toArray();

    const risks = await schemes.distinct("risk", {
      ...activeFilter,
      risk: {
        $exists: true,
        $nin: ["", null],
      },
    });

    const ratings = await schemes.distinct("rating", {
      ...activeFilter,
      rating: {
        $exists: true,
        $ne: null,
      },
    });

    const grouped = {
      EQUITY: [],
      DEBT: [],
      HYBRID: [],
      COMMODITY: [],
    };

    for (const row of categoryDocuments) {
      if (!grouped[row.fundType]) {
        grouped[row.fundType] = [];
      }

      const category = row.fundSubCategory || row.schemeCategory;

      if (category && !grouped[row.fundType].includes(category)) {
        grouped[row.fundType].push(category);
      }
    }

    const categories = [
      ...new Set(
        categoryDocuments
          .map((x) => x.fundSubCategory || x.schemeCategory)
          .filter(Boolean),
      ),
    ];

    risks.sort((a, b) => String(a).localeCompare(String(b)));

    ratings.sort((a, b) => Number(b) - Number(a));

    return res.json({
      success: true,
      data: {
        fundHouses: houses.filter(Boolean).sort(),

        categories,

        categoryGroups: grouped,

        risks,

        ratings: ratings.map(Number),
      },
    });
  } catch (error) {
    console.error("[MF API] getMutualFundFilters:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load mutual fund filters",
    });
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

    const db = await getDB();

    const numericCode = Number(schemeCode);

    const query = Number.isFinite(numericCode)
      ? {
          schemeCode: numericCode,
          isActive: true,
        }
      : {
          schemeCode: schemeCode,
          isActive: true,
        };

    const scheme = await db.collection("mfSchemes").findOne(query);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: "Mutual fund not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: scheme.mysqlId ?? scheme._id?.toString(),

        schemeCode: scheme.schemeCode,

        schemeName: scheme.schemeName,

        fundHouse: scheme.fundHouse,

        schemeType: scheme.schemeType,

        schemeCategory: scheme.schemeCategory,

        fundType: scheme.fundType,

        fundSubCategory: scheme.fundSubCategory,

        currentNav: round(scheme.currentNav),

        navDate: scheme.navDate,

        return1Y: scheme.return1y,

        return3Y: scheme.return3y,

        return5Y: scheme.return5y,

        rating: scheme.rating,

        risk: scheme.risk,
      },
    });
  } catch (error) {
    console.error("getMutualFund error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load mutual fund",
    });
  }
}

/*
|--------------------------------------------------------------------------
| BUY MUTUAL FUND
|--------------------------------------------------------------------------
|
| MongoDB transaction replaces:
|   MySQL BEGIN
|   SELECT ... FOR UPDATE
|   INSERT order
|   INSERT/UPDATE holding
|   COMMIT
|
*/

async function buyMutualFund(req, res) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const { schemeCode, units } = req.body;

  if (!schemeCode) {
    return res.status(400).json({
      success: false,
      message: "schemeCode is required",
    });
  }

  const buyUnits = Number(units);

  if (!Number.isFinite(buyUnits) || buyUnits <= 0) {
    return res.status(400).json({
      success: false,
      message: "units must be greater than 0",
    });
  }

  try {
    await connectMongoDB();

    const db = getMongoDB();
    const client = getClient();

    const session = client.startSession();

    let responseData = null;

    try {
      await session.withTransaction(async () => {
        const schemes = db.collection("mfSchemes");

        const orders = db.collection("mfOrders");

        const holdings = db.collection("mfHoldings");

        const numericCode = Number(schemeCode);

        const schemeQuery = Number.isFinite(numericCode)
          ? {
              schemeCode: numericCode,
              isActive: true,
            }
          : {
              schemeCode: schemeCode,
              isActive: true,
            };

        /*
         * MongoDB transaction provides
         * the consistency boundary.
         */
        const scheme = await schemes.findOne(schemeQuery, {
          session,
        });

        if (!scheme) {
          const error = new Error("Mutual fund not found");

          error.statusCode = 404;

          throw error;
        }

        const nav = round(scheme.currentNav, 2);

        if (!Number.isFinite(nav) || nav <= 0) {
          const error = new Error("Current NAV unavailable");

          error.statusCode = 400;

          throw error;
        }

        const amount = round(buyUnits * nav, 2);

        if (!Number.isFinite(amount) || amount <= 0) {
          const error = new Error("Unable to calculate purchase amount");

          error.statusCode = 400;

          throw error;
        }

        const orderId = uuidv4();

        const now = new Date();

        /*
         * Create MF order.
         */
        await orders.insertOne(
          {
            mysqlId: null,

            orderId,

            userId: String(userId),

            schemeId: scheme.mysqlId ?? scheme._id,

            schemeCode: scheme.schemeCode,

            schemeName: scheme.schemeName,

            orderType: "BUY",

            units: buyUnits,

            nav,

            amount,

            navDate: scheme.navDate,

            status: "COMPLETED",

            createdAt: now,

            completedAt: now,
          },
          {
            session,
          },
        );

        /*
         * Update existing holding.
         *
         * Your migrated data uses userId +
         * schemeCode for the holding identity.
         */
        const existingHolding = await holdings.findOne(
          {
            userId: String(userId),

            schemeCode: scheme.schemeCode,
          },
          {
            session,
          },
        );

        if (existingHolding) {
          await holdings.updateOne(
            {
              _id: existingHolding._id,
            },
            {
              $inc: {
                units: buyUnits,

                investedAmount: amount,
              },

              $set: {
                updatedAt: now,
              },
            },
            {
              session,
            },
          );
        } else {
          await holdings.insertOne(
            {
              mysqlId: null,

              userId: String(userId),

              schemeId: scheme.mysqlId ?? scheme._id,

              schemeCode: scheme.schemeCode,

              schemeName: scheme.schemeName,

              units: buyUnits,

              investedAmount: amount,

              createdAt: now,

              updatedAt: now,
            },
            {
              session,
            },
          );
        }

        responseData = {
          orderId,

          orderType: "BUY",

          schemeCode: scheme.schemeCode,

          schemeName: scheme.schemeName,

          units: Number(buyUnits.toFixed(8)),

          nav,

          amount,

          navDate: scheme.navDate,

          status: "COMPLETED",
        };
      });

      return res.status(201).json({
        success: true,
        message: "Mutual fund BUY order completed",
        data: responseData,
      });
    } catch (error) {
      console.error("buyMutualFund transaction error:", error);

      const status = Number(error.statusCode) || 500;

      return res.status(status).json({
        success: false,
        message: status === 500 ? "Unable to place BUY order" : error.message,
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("buyMutualFund error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to place BUY order",
    });
  }
}

/*
|--------------------------------------------------------------------------
| SELL MUTUAL FUND
|--------------------------------------------------------------------------
*/

async function sellMutualFund(req, res) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const { schemeCode, units } = req.body;

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

  try {
    await connectMongoDB();

    const db = getMongoDB();
    const client = getClient();

    const session = client.startSession();

    let responseData = null;

    try {
      await session.withTransaction(async () => {
        const schemes = db.collection("mfSchemes");

        const orders = db.collection("mfOrders");

        const holdings = db.collection("mfHoldings");

        const numericCode = Number(schemeCode);

        const schemeQuery = Number.isFinite(numericCode)
          ? {
              schemeCode: numericCode,
              isActive: true,
            }
          : {
              schemeCode: schemeCode,
              isActive: true,
            };

        const scheme = await schemes.findOne(schemeQuery, {
          session,
        });

        if (!scheme) {
          const error = new Error("Mutual fund not found");

          error.statusCode = 404;

          throw error;
        }

        const nav = round(scheme.currentNav, 2);

        if (!Number.isFinite(nav) || nav <= 0) {
          const error = new Error("Current NAV unavailable");

          error.statusCode = 400;

          throw error;
        }

        /*
         * Find the user's holding.
         */
        const holding = await holdings.findOne(
          {
            userId: String(userId),

            schemeCode: scheme.schemeCode,
          },
          {
            session,
          },
        );

        if (!holding) {
          const error = new Error("No mutual fund holding found");

          error.statusCode = 400;

          throw error;
        }

        const availableUnits = Number(holding.units || 0);

        if (sellUnits > availableUnits + 0.00000001) {
          const error = new Error("Insufficient mutual fund units");

          error.statusCode = 400;

          error.availableUnits = availableUnits;

          throw error;
        }

        const amount = round(sellUnits * nav, 2);

        const oldInvested = Number(holding.investedAmount || 0);

        const remainingUnits = availableUnits - sellUnits;

        let remainingInvested = 0;

        if (availableUnits > 0) {
          remainingInvested = oldInvested * (remainingUnits / availableUnits);
        }

        const orderId = uuidv4();

        const now = new Date();

        /*
         * Create SELL order.
         */
        await orders.insertOne(
          {
            mysqlId: null,

            orderId,

            userId: String(userId),

            schemeId: scheme.mysqlId ?? scheme._id,

            schemeCode: scheme.schemeCode,

            schemeName: scheme.schemeName,

            orderType: "SELL",

            units: sellUnits,

            nav,

            amount,

            navDate: scheme.navDate,

            status: "COMPLETED",

            createdAt: now,

            completedAt: now,
          },
          {
            session,
          },
        );

        /*
         * Remove holding when all units
         * have been sold.
         */
        if (remainingUnits <= 0.00000001) {
          await holdings.deleteOne(
            {
              _id: holding._id,
            },
            {
              session,
            },
          );
        } else {
          await holdings.updateOne(
            {
              _id: holding._id,
            },
            {
              $set: {
                units: remainingUnits,

                investedAmount: Number(remainingInvested.toFixed(2)),

                updatedAt: now,
              },
            },
            {
              session,
            },
          );
        }

        responseData = {
          orderId,

          orderType: "SELL",

          schemeCode: scheme.schemeCode,

          schemeName: scheme.schemeName,

          units: Number(sellUnits.toFixed(8)),

          nav,

          amount,

          navDate: scheme.navDate,

          status: "COMPLETED",
        };
      });

      return res.status(201).json({
        success: true,
        message: "Mutual fund SELL order completed",
        data: responseData,
      });
    } catch (error) {
      console.error("sellMutualFund transaction error:", error);

      const status = Number(error.statusCode) || 500;

      return res.status(status).json({
        success: false,
        message: status === 500 ? "Unable to place SELL order" : error.message,

        ...(error.availableUnits !== undefined
          ? {
              availableUnits: error.availableUnits,
            }
          : {}),
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    console.error("sellMutualFund error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to place SELL order",
    });
  }
}

/*
|--------------------------------------------------------------------------
| GET USER HOLDINGS
|--------------------------------------------------------------------------
*/

async function getMutualFundHoldings(req, res) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const db = await getDB();

    const holdingsCollection = db.collection("mfHoldings");

    const schemesCollection = db.collection("mfSchemes");

    const holdings = await holdingsCollection
      .find({
        userId: String(userId),

        units: {
          $gt: 0,
        },
      })
      .sort({
        schemeName: 1,
      })
      .toArray();

    let investedAmount = 0;
    let currentValue = 0;
    let todaysPnL = 0;
    let totalReturn = 0;

    const data = [];

    for (const holding of holdings) {
      const scheme = await schemesCollection.findOne({
        schemeCode: holding.schemeCode,
        isActive: true,
      });

      if (!scheme) {
        continue;
      }

      const units = Number(holding.units || 0);

      const invested = Number(holding.investedAmount || 0);

      const currentNav = Number(scheme.currentNav || 0);

      const previousNav = Number(scheme.previousNav || 0);

      const value = units * currentNav;

      const previousValue = previousNav > 0 ? units * previousNav : value;

      const dayPnL = value - previousValue;

      const dayPercent = previousValue > 0 ? (dayPnL / previousValue) * 100 : 0;

      const totalPnL = value - invested;

      const totalPercent = invested > 0 ? (totalPnL / invested) * 100 : 0;

      investedAmount += invested;

      currentValue += value;

      todaysPnL += dayPnL;

      totalReturn += totalPnL;

      data.push({
        id: holding.mysqlId ?? holding._id?.toString(),

        userId: holding.userId,

        schemeId: holding.schemeId,

        schemeCode: holding.schemeCode,

        schemeName: scheme.schemeName,

        fundHouse: scheme.fundHouse,

        schemeType: scheme.schemeType,

        schemeCategory: scheme.schemeCategory,

        fundSubCategory: scheme.fundSubCategory,

        units,

        investedAmount: invested,

        currentNav,

        navDate: scheme.navDate,

        previousNav,

        previousNavDate: scheme.previousNavDate,

        currentValue: value,

        previousValue,

        todaysPnL: dayPnL,

        todaysReturnPercent: dayPercent,

        totalReturn: totalPnL,

        totalReturnPercent: totalPercent,

        return1D: Number(scheme.return1d ?? 0),

        return1Y: scheme.return1y,

        return3Y: scheme.return3y,

        return5Y: scheme.return5y,

        rating: scheme.rating,

        risk: scheme.risk,

        createdAt: holding.createdAt,

        updatedAt: holding.updatedAt,
      });
    }

    const xirr = await calculatePortfolioXirr(db, userId, currentValue);

    const totalReturnPercent =
      investedAmount > 0 ? (totalReturn / investedAmount) * 100 : 0;

    const todaysReturnPercent =
      currentValue - todaysPnL > 0
        ? (todaysPnL / (currentValue - todaysPnL)) * 100
        : 0;

    return res.json({
      success: true,

      summary: {
        investedAmount,
        currentValue,

        todaysPnL,
        todaysReturnPercent,

        totalReturn,
        totalReturnPercent,

        xirr,
      },

      data,

      holdings: data,
    });
  } catch (error) {
    console.error("[MF HOLDINGS]", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch mutual fund holdings",
    });
  }
}

/*
|--------------------------------------------------------------------------
| XIRR
|--------------------------------------------------------------------------
*/

function calculateXirrFromCashFlows(cashFlows) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) {
    return null;
  }

  const sorted = [...cashFlows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const firstDate = sorted[0].date;

  const yearFraction = (date) =>
    (date.getTime() - firstDate.getTime()) / (365 * 24 * 60 * 60 * 1000);

  const npv = (rate) =>
    sorted.reduce((sum, flow) => {
      const years = yearFraction(flow.date);

      return sum + flow.amount / Math.pow(1 + rate, years);
    }, 0);

  let low = -0.9999;
  let high = 10;

  let lowValue = npv(low);

  let highValue = npv(high);

  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) {
    return null;
  }

  if (lowValue * highValue > 0) {
    return null;
  }

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;

    const value = npv(mid);

    if (!Number.isFinite(value)) {
      return null;
    }

    if (Math.abs(value) < 0.000001) {
      return mid * 100;
    }

    if (lowValue * value <= 0) {
      high = mid;
      highValue = value;
    } else {
      low = mid;
      lowValue = value;
    }
  }

  return ((low + high) / 2) * 100;
}

async function calculatePortfolioXirr(db, userId, currentValue) {
  try {
    const orders = await db
      .collection("mfOrders")
      .find({
        userId: String(userId),

        status: "COMPLETED",
      })
      .sort({
        createdAt: 1,
      })
      .toArray();

    if (!orders.length) {
      return null;
    }

    const cashFlows = [];

    for (const order of orders) {
      const amount = Number(order.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const date = normalizeDate(order.completedAt || order.createdAt);

      if (!date) {
        continue;
      }

      if (order.orderType === "BUY") {
        cashFlows.push({
          amount: -amount,
          date,
        });
      }

      if (order.orderType === "SELL") {
        cashFlows.push({
          amount,
          date,
        });
      }
    }

    if (Number.isFinite(Number(currentValue)) && Number(currentValue) > 0) {
      cashFlows.push({
        amount: Number(currentValue),
        date: new Date(),
      });
    }

    const hasNegative = cashFlows.some((flow) => flow.amount < 0);

    const hasPositive = cashFlows.some((flow) => flow.amount > 0);

    if (!hasNegative || !hasPositive) {
      return null;
    }

    return calculateXirrFromCashFlows(cashFlows);
  } catch (error) {
    console.error("[MF XIRR]", error);

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| GET USER ORDERS
|--------------------------------------------------------------------------
*/

async function getMutualFundOrders(req, res) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const db = await getDB();

    const orders = await db
      .collection("mfOrders")
      .find({
        userId: String(userId),
      })
      .sort({
        createdAt: -1,
      })
      .toArray();

    const schemes = db.collection("mfSchemes");

    const result = [];

    for (const order of orders) {
      let scheme = null;

      if (order.schemeCode !== undefined) {
        scheme = await schemes.findOne({
          schemeCode: order.schemeCode,
        });
      }

      result.push({
        id: order.mysqlId ?? order._id?.toString(),

        orderId: order.orderId,

        userId: order.userId,

        orderType: order.orderType,

        units: Number(order.units),

        nav: Number(order.nav),

        amount: Number(order.amount),

        navDate: order.navDate,

        status: order.status,

        createdAt: order.createdAt,

        completedAt: order.completedAt,

        schemeCode: order.schemeCode ?? scheme?.schemeCode,

        schemeName: order.schemeName ?? scheme?.schemeName,

        fundHouse: scheme?.fundHouse,
      });
    }

    return res.json({
      success: true,
      data: result,
      orders: result,
    });
  } catch (error) {
    console.error("getMutualFundOrders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load mutual fund orders",
    });
  }
}

/*
|--------------------------------------------------------------------------
| SYNC LATEST NAV
|--------------------------------------------------------------------------
*/

async function syncLatestNAVController(req, res) {
  try {
    const result = await syncLatestNAV();

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[MF CONTROLLER] NAV sync failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to synchronize latest NAV",
    });
  }
}

/*
|--------------------------------------------------------------------------
| SYNC RETURNS
|--------------------------------------------------------------------------
*/

async function syncReturnsController(req, res) {
  try {
    const result = await syncAllReturns();

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[MF CONTROLLER] Return sync failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to calculate mutual fund returns",
    });
  }
}

/*
|--------------------------------------------------------------------------
| LEGACY RETURNS SYNC
|--------------------------------------------------------------------------
*/

async function syncReturns(req, res) {
  try {
    const result = await syncAllReturns();

    return res.json({
      success: true,
      message: "Mutual fund returns refresh completed",
      data: result,
    });
  } catch (error) {
    console.error("syncReturns error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to refresh mutual fund returns",
      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| SYNC STATUS
|--------------------------------------------------------------------------
*/

async function getMFSyncStatus(req, res) {
  try {
    const statuses = await getAllSyncStatuses();

    return res.json({
      success: true,

      data: {
        statuses,

        daily:
          statuses.find((item) => item.sync_name === "mf_daily_sync") || null,

        nav: statuses.find((item) => item.sync_name === "mf_nav_sync") || null,

        returns:
          statuses.find((item) => item.sync_name === "mf_returns_sync") || null,

        rating:
          statuses.find((item) => item.sync_name === "mf_rating_sync") || null,
      },
    });
  } catch (error) {
    console.error("[MF CONTROLLER] getMFSyncStatus:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load sync status",
      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| MANUAL SYNC
|--------------------------------------------------------------------------
*/

async function triggerSyncNow(req, res) {
  try {
    const result = await runDailySyncIfNeeded("manual");

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[MF CONTROLLER] triggerSyncNow:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to run sync",
      error: error.message,
    });
  }
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

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
  getTopReturns,
};
