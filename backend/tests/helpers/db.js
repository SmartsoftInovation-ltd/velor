const mongoose = require("mongoose");
const crypto = require("crypto");

// Each test file gets its own database so files can run in parallel
const connectTestDb = async () => {
  const dbName = `test_${process.env.JEST_WORKER_ID}_${crypto.randomBytes(4).toString("hex")}`;
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
  return mongoose.connection;
};

const clearTestDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

const disconnectTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

module.exports = { connectTestDb, clearTestDb, disconnectTestDb };
