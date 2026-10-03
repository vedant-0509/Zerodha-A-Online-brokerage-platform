const express = require("express");
const router = express.Router();

const { getMongoDB } = require("../config/mongodb");

function getCollection() {
    return getMongoDB().collection("marketStocks");
}

router.get("/", async (req, res) => {
    try {
        const search = (req.query.q || "").trim().toUpperCase();

        if (search.length < 2) {
            return res.json([]);
        }

        const collection = getCollection();

        const rows = await collection
            .find(
                {
                    instrumentKey: { $ne: null },
                    $or: [
                        {
                            symbol: {
                                $regex: `^${escapeRegex(search)}`,
                                $options: "i",
                            },
                        },
                        {
                            name: {
                                $regex: escapeRegex(search),
                                $options: "i",
                            },
                        },
                    ],
                },
                {
                    projection: {
                        _id: 0,
                        instrumentKey: 1,
                        symbol: 1,
                        name: 1,
                    },
                }
            )
            .limit(50)
            .toArray();

        const normalized = rows.map((stock) => ({
            instrument_key: stock.instrumentKey,
            symbol: stock.symbol,
            name: stock.name,
        }));

        normalized.sort((a, b) => {
            const aSymbol = String(a.symbol || "").split(".")[0].toUpperCase();
            const bSymbol = String(b.symbol || "").split(".")[0].toUpperCase();

            const aName = String(a.name || "").toUpperCase();
            const bName = String(b.name || "").toUpperCase();

            const aRank =
                aSymbol === search
                    ? 1
                    : aSymbol.startsWith(search)
                        ? 2
                        : aName.includes(search)
                            ? 3
                            : 4;

            const bRank =
                bSymbol === search
                    ? 1
                    : bSymbol.startsWith(search)
                        ? 2
                        : bName.includes(search)
                            ? 3
                            : 4;

            if (aRank !== bRank) {
                return aRank - bRank;
            }

            return aSymbol.localeCompare(bSymbol);
        });

        res.json(normalized.slice(0, 15));

    } catch (err) {
        console.error("Stock search error:", err);

        res.status(500).json({
            message: "Search Failed",
        });
    }
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = router;