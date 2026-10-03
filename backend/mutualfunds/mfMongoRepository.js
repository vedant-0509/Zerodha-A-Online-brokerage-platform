const {
  connectMongoDB,
  getMongoDB,
  getMongoClient,
} = require("../config/mongodb");

async function getDb() {
  await connectMongoDB();
  return getMongoDB();
}

function getClient() {
  return getMongoClient();
}

// ============================================================
// MF SCHEMES
// ============================================================

async function findSchemeByCode(schemeCode) {
  const db = await getDb();

  return db.collection("mfSchemes").findOne({
    schemeCode: String(schemeCode),
  });
}

async function findActiveSchemes(filter = {}) {
  const db = await getDb();

  return db
    .collection("mfSchemes")
    .find({
      isActive: true,
      ...filter,
    })
    .sort({ _id: 1 })
    .toArray();
}

async function updateSchemeByCode(schemeCode, update) {
  const db = await getDb();

  return db.collection("mfSchemes").updateOne(
    { schemeCode: String(schemeCode) },
    {
      $set: {
        ...update,
        updatedAt: new Date(),
      },
    }
  );
}

// ============================================================
// MF HOLDINGS
// ============================================================

async function findUserHoldings(userId) {
  const db = await getDb();

  return db
    .collection("mfHoldings")
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}

async function findHolding(userId, schemeCode) {
  const db = await getDb();

  return db.collection("mfHoldings").findOne({
    userId: String(userId),
    schemeCode: String(schemeCode),
  });
}

// ============================================================
// MF ORDERS
// ============================================================

async function findUserOrders(userId) {
  const db = await getDb();

  return db
    .collection("mfOrders")
    .find({ userId: String(userId) })
    .sort({ createdAt: -1 })
    .toArray();
}

// ============================================================
// MF SYNC STATUS
// ============================================================

async function getSyncStatus(syncName) {
  const db = await getDb();

  return db.collection("mfSyncStatus").findOne({
    syncName: String(syncName),
  });
}

async function getAllSyncStatuses() {
  const db = await getDb();

  return db
    .collection("mfSyncStatus")
    .find({})
    .sort({ syncName: 1 })
    .toArray();
}

async function updateSyncStatus(syncName, update) {
  const db = await getDb();

  return db.collection("mfSyncStatus").updateOne(
    { syncName: String(syncName) },
    {
      $set: {
        ...update,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        syncName: String(syncName),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

module.exports = {
  getDb,
  getClient,

  findSchemeByCode,
  findActiveSchemes,
  updateSchemeByCode,

  findUserHoldings,
  findHolding,

  findUserOrders,

  getSyncStatus,
  getAllSyncStatuses,
  updateSyncStatus,
};