const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

let client = null;
let db = null;

async function connectMongoDB() {
  if (db) {
    return db;
  }

  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  client = new MongoClient(uri);

  await client.connect();

  db = client.db(process.env.MONGODB_DB || "zerodha");

  console.log("[MongoDB] Connected successfully");

  return db;
}

function getMongoDB() {
  if (!db) {
    throw new Error("MongoDB is not connected");
  }

  return db;
}

function getMongoClient() {
  if (!client) {
    throw new Error("MongoDB client is not connected");
  }

  return client;
}

async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connectMongoDB,
  getMongoDB,
  getMongoClient,
  closeMongoDB,
};