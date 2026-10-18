const IORedis = require("ioredis");

// A client of our own on the worker's database, for assertions and cleanup.
// The app's clients (src/config/redis.config.js) point at the same database.
let client = null;

const testRedis = () => {
  if (!client) client = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false });
  return client;
};

// Wipes this worker's Redis database. Other workers use other database indexes.
const flushRedis = () => testRedis().flushdb();

// Keys under a tenant's cache prefix (src/utils/cache.util.js: t:<tenantId>:<key>)
const tenantKeys = async (tenantId, pattern = "*") => testRedis().keys(`t:${tenantId}:${pattern}`);

const closeRedis = async () => {
  if (!client) return;
  await client.quit().catch(() => {});
  client = null;
};

// Quits the app's own clients (src/config/redis.config.js) when a test file
// required a controller or queue without booting the app; otherwise the open
// sockets keep the Jest worker alive.
const closeAppRedis = async () => {
  const { connection, cache } = require("../../src/config/redis.config");
  await Promise.allSettled([connection.quit(), cache.quit()]);
};

module.exports = { testRedis, flushRedis, tenantKeys, closeRedis, closeAppRedis };
