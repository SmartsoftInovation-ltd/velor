const { cache } = require("@/config/redis.config");
const { getTenantId, isPlatform } = require("@/tenancy/context");

// Every key lives under its tenant: t:<tenantId>:<key>. Platform code caches
// under p:<key>. An unprefixed key would be shared by every store — two tenants
// asking for "product:list" would read each other's rows — so there is no such key.
const scoped = (key) => {
  const tenantId = getTenantId();
  if (tenantId) return `t:${tenantId}:${key}`;
  if (isPlatform()) return `p:${key}`;
  // Same name the tenant plugin raises, so the error handler answers 400
  // TENANT_CONTEXT_REQUIRED instead of a 500.
  const error = new Error(`Cache key "${key}" has no tenant context`);
  error.name = "TenancyError";
  throw error;
};

const safeJsonParse = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const getCache = async (key) => {
  const data = await cache.get(scoped(key));
  return data ? safeJsonParse(data) : null;
};

const setCache = async (key, value, ttl = 60) => {
  await cache.set(scoped(key), JSON.stringify(value), "EX", ttl);
};

const deleteCache = async (key) => {
  await cache.del(scoped(key));
};

// ---- namespace versioning helpers ----

const getNsVersion = async (ns) => {
  const v = await cache.get(scoped(`${ns}:v`));
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
  "supplier",
]);

const bumpOne = async (ns) => {
  // atomic increment — all old versioned keys become unreachable
  const v = await cache.incr(scoped(`${ns}:v`));
  // An unset version reads as 1, so a first bump that lands on 1 has to move
  // once more. A second INCR, not a SET to 2: a SET racing other bumps
  // dragged the version back down and made old cached entries live again.
  if (v === 1) return cache.incr(scoped(`${ns}:v`));
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
