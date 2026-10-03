const {
  connectMongoDB,
  getMongoDB,
  getMongoClient,
} = require("../config/mongodb");

let connected = false;

async function initDb() {
  if (!connected) {
    await connectMongoDB();
    connected = true;
  }

  return getMongoDB();
}

function getDb() {
  return getMongoDB();
}

function getClient() {
  return getMongoClient();
}

async function closeDb() {
  connected = false;
}

module.exports = {
  initDb,
  getDb,
  getClient,
  closeDb,
};