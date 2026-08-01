const cors = require("cors");
const express = require("express");
const app = express();

app.use(cors());

const port = 3006;

require("dotenv").config();

const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "zerodha",
});

app.get("/holdings/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const [rows] = await db.execute(`
            SELECT
                h.holding_id,
                h.instrument_key,
                h.quantity,
                h.invested_value,
                h.purchase_date,

                s.symbol,
                s.name,
                s.price AS current_price,
                s.change_percent,
                s.change_value

            FROM holdings h
            INNER JOIN market_stocks_data s
                ON h.instrument_key = s.instrument_key

            WHERE h.user_id = ?
            ORDER BY s.name
        `, [userId]);

        let totalInvestment = 0;
        let currentValue = 0;
        let todaysPnL = 0;
        let totalPreviousValue = 0;

        const holdings = rows.map(stock => {

            const quantity = Number(stock.quantity);
            const investment = Number(stock.invested_value);
            const currentPrice = Number(stock.current_price);
            const dayChange = Number(stock.change_value);

            const currentHoldingValue = currentPrice * quantity;

            const previousClose = currentPrice - dayChange;
            const previousHoldingValue = previousClose * quantity;

            const dayPnL = dayChange * quantity;

            const totalReturn = currentHoldingValue - investment;

            const totalReturnPercent =
                investment > 0
                    ? (totalReturn / investment) * 100
                    : 0;

            const averagePrice = investment / quantity;

            totalInvestment += investment;
            currentValue += currentHoldingValue;
            todaysPnL += dayPnL;
            totalPreviousValue += previousHoldingValue;

            return {
                holding_id: stock.holding_id,
                instrument_key: stock.instrument_key,

                symbol: stock.symbol,
                name: stock.name,

                quantity,

                invested_value: investment,

                average_price: averagePrice,

                purchase_date: stock.purchase_date,

                current_price: currentPrice,
                current_value: currentHoldingValue,

                total_return: totalReturn,
                total_return_percent: totalReturnPercent,

                day_change_value: dayChange,
                day_change_percent: Number(stock.change_percent),

                day_pnl: dayPnL,
            };
        });

        // Portfolio summary calculations
        const totalReturn = currentValue - totalInvestment;

        const totalReturnPercent =
            totalInvestment > 0
                ? (totalReturn / totalInvestment) * 100
                : 0;

        const todaysReturnPercent =
            totalPreviousValue > 0
                ? (todaysPnL / totalPreviousValue) * 100
                : 0;

        res.json({
            summary: {
                totalInvestment,
                currentValue,

                totalReturn,
                totalReturnPercent,

                todaysPnL,
                todaysReturnPercent,
            },

            holdings,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Internal Server Error",
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});