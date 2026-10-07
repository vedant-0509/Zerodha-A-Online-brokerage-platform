const express = require("express");
const router = express.Router();

const { getMongoDB } = require("../config/mongodb");

function getCollection() {
    return getMongoDB().collection("marketStocks");
}

router.get("/", async (req, res) => {
    try {
        const search = String(req.query.q || "").trim();

        if (search.length < 2) {
            return res.json([]);
        }

        const escaped = escapeRegex(search);
        const upperSearch = search.toUpperCase();

        const rows = await getCollection()
            .find(
                {
                    instrumentKey: { $ne: null },
                    $or: [
                        {
                            symbol: {
                                $regex: `^${escaped}`,
                                $options: "i",
                            },
                        },
                        {
                            name: {
                                $regex: escaped,
                                $options: "i",
                            },
                        },
                        {
                            instrumentKey: {
                                $regex: escaped,
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
                        companyName: 1,
                        price: 1,
                        closePrice: 1,
                        changeValue: 1,
                        changePercent: 1,
                        openPrice: 1,
                        previousClose: 1,
                        dayHigh: 1,
                        dayLow: 1,
                        volume: 1,
                        sector: 1,
                        exchange: 1,
                    },
                },
            )
            .limit(50)
            .toArray();

        const normalized = rows
            .map((stock) => ({
                instrument_key: stock.instrumentKey,
                symbol: stock.symbol || "",
                name: stock.name || stock.companyName || stock.symbol || "",
                price: Number(stock.price ?? stock.closePrice ?? 0),
                change_value: Number(stock.changeValue || 0),
                change_percent: Number(stock.changePercent || 0),
                open_price: Number(stock.openPrice || 0),
                previous_close: Number(stock.previousClose || 0),
                day_high: Number(stock.dayHigh || 0),
                day_low: Number(stock.dayLow || 0),
                volume: Number(stock.volume || 0),
                sector: stock.sector || null,
                exchange: stock.exchange || null,
            }))
            .sort((a, b) => {
                const aSymbol = String(a.symbol || "").split(".")[0].toUpperCase();
                const bSymbol = String(b.symbol || "").split(".")[0].toUpperCase();

                const aName = String(a.name || "").toUpperCase();
                const bName = String(b.name || "").toUpperCase();

                const rank = (symbol, name) => {
                    if (symbol === upperSearch) return 1;
                    if (symbol.startsWith(upperSearch)) return 2;
                    if (name.startsWith(upperSearch)) return 3;
                    if (name.includes(upperSearch)) return 4;
                    return 5;
                };

                const aRank = rank(aSymbol, aName);
                const bRank = rank(bSymbol, bName);

                if (aRank !== bRank) return aRank - bRank;
                return aSymbol.localeCompare(bSymbol);
            });

        return res.json(normalized.slice(0, 15));
    } catch (err) {
        console.error("Stock search error:", err);

        return res.status(500).json({
            success: false,
            message: "Search failed",
        });
    }
});

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

module.exports = router;
