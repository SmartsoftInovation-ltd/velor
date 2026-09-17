const { MongoMemoryReplSet } = require("mongodb-memory-server");

// A single-node replica set, so code paths using transactions behave as in production
module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();
};
