// backend/indexMarket/db.js

const {
    connectMongoDB,
    getMongoDB,
} = require("../config/mongodb");

async function initDb() {
    await connectMongoDB();
    return getMongoDB();
}

function requireDb() {
    const db = getMongoDB();

    if (!db) {
        throw new Error("MongoDB has not been initialized");
    }

    return db;
}

async function close() {
    // MongoDB connection is shared globally.
    // Do not close it from this module.
}

module.exports = {
    initDb,
    requireDb,
    close,
};