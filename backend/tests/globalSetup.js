const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { startTestRedis } = require("./setup/redisServer");

// A single-node replica set, so code paths using transactions behave as in production.
// A private redis-server on a free port, so tests never touch a developer's
// (or a live) Redis and can FLUSHDB freely. Each Jest worker uses its own
// Redis database index (see tests/setupEnv.js).
module.exports = async () => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  globalThis.__MONGO_REPLSET__ = replSet;
  process.env.MONGO_TEST_URI = replSet.getUri();

  const redis = await startTestRedis();
  globalThis.__TEST_REDIS__ = redis;
  process.env.REDIS_TEST_URL = redis.url;
};
