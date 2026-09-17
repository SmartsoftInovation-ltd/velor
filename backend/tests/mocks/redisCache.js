// In-memory stand-in for the Redis clients in src/config/redis.config.js.
// Only the commands the app uses are implemented, with real TTL semantics so
// expiry can be tested by moving the clock.

const store = new Map();

const alive = (entry) => entry && (entry.expiresAt === null || entry.expiresAt > Date.now());

const cache = {
  async set(key, value, mode, seconds) {
    const ttlMs = mode === "EX" ? Number(seconds) * 1000 : null;
    store.set(key, { value, expiresAt: ttlMs === null ? null : Date.now() + ttlMs });
    return "OK";
  },
  async get(key) {
    const entry = store.get(key);
    if (!alive(entry)) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },
  async del(key) {
    return store.delete(key) ? 1 : 0;
  },
  async ttl(key) {
    const entry = store.get(key);
    if (!alive(entry)) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  },
  on() {
    return this;
  },
};

const reset = () => store.clear();

module.exports = { connection: cache, cache, __reset: reset };
