const { cache } = require("@/config/redis.config");

const safeJsonParse = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const getCache = async (key) => {
  const data = await cache.get(key);
  return data ? safeJsonParse(data) : null;
};

const setCache = async (key, value, ttl = 60) => {
  await cache.set(key, JSON.stringify(value), "EX", ttl);
};

const deleteCache = async (key) => {
  await cache.del(key);
};

// ---- namespace versioning helpers ----

const getNsVersion = async (ns) => {
  const v = await cache.get(`${ns}:v`);
  return v ? Number(v) : 1;
};

// Namespaces whose data the dashboard aggregates. The dashboard reads across
// many collections, so a write to any of these makes its cached widgets stale
// — but the writing controller has no reason to know the dashboard exists.
// Bumping is handled here so every existing call site stays correct and a new
// one cannot forget.
const DASHBOARD_SOURCE_NAMESPACES = new Set([
  "sales",
  "salesReturn",
  "purchase",
  "purchase-return",
  "product",
  "variant",
  "stock",
  "customer",
  "customerPayment",
  "customerAdvance",
  "employee",
  "account",
]);

const bumpOne = async (ns) => {
  // atomic increment — all old versioned keys become unreachable
  const v = await cache.incr(`${ns}:v`);
  if (v === 1) {
    await cache.set(`${ns}:v`, 2);
    return 2;
  }
  return v;
};

const bumpNsVersion = async (ns) => {
  const v = await bumpOne(ns);

  // Cascade to the dashboard so its widgets reflect the write immediately.
  // Without this the dashboard served figures up to its own TTL old — a sale
  // could be created or deleted and the totals would not move.
  if (DASHBOARD_SOURCE_NAMESPACES.has(ns)) {
    await bumpOne("dashboard");
  }

  return v;
};

const buildCacheKey = async (ns, suffix) => {
  const v = await getNsVersion(ns);
  return `${ns}:v${v}:${suffix}`;
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  getNsVersion,
  bumpNsVersion,
  buildCacheKey,
  DASHBOARD_SOURCE_NAMESPACES,
};
