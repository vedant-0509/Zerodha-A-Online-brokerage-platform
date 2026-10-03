require("dotenv").config();

const {
  connectMongoDB,
  getMongoDB,
  closeMongoDB,
} = require("../config/mongodb");

async function main() {
  try {
    await connectMongoDB();

    const db = getMongoDB();

    const result = await db.command({ ping: 1 });

    console.log("MongoDB ping:", result.ok === 1 ? "PASS" : "FAIL");

    const collections = await db.listCollections().toArray();

    console.log("Database:", db.databaseName);
    console.log(
      "Collections:",
      collections.map((collection) => collection.name)
    );

    console.log("MongoDB Atlas connection test PASSED");
  } catch (error) {
    console.error("MongoDB Atlas connection test FAILED");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await closeMongoDB();
  }
}

main();