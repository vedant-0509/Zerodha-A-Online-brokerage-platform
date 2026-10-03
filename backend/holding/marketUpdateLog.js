const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "../.env"),
});

const {
    getMongoDB,
} = require("../config/mongodb");

function getCollection() {
    return getMongoDB().collection("marketUpdateLog");
}


/* =========================================================
   CHECK WHETHER TODAY'S UPDATE ALREADY HAPPENED
========================================================= */

async function alreadyUpdatedToday() {

    const collection = getCollection();

    const today = new Date();

    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const record = await collection.findOne({
        lastRunDate: {
            $gte: startOfDay,
            $lte: endOfDay,
        },
    });

    return !!record;
}


/* =========================================================
   SAVE UPDATE LOG
========================================================= */

async function saveUpdateLog() {

    const collection = getCollection();

    const now = new Date();

    await collection.updateOne(
        {
            logType: "market-close",
        },
        {
            $set: {
                lastRunDate: now,
                updatedAt: now,
            },
            $setOnInsert: {
                logType: "market-close",
                createdAt: now,
            },
        },
        {
            upsert: true,
        }
    );

    console.log("Market update log saved.");
}


module.exports = {
    alreadyUpdatedToday,
    saveUpdateLog,
};