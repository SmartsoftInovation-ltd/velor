const Tenant = require("../models/platform/tenant.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Short-lived cache: tenant status is checked on every authenticated request.
const TTL_MS = 30_000;
const cache = new Map();

const cached = async (key, load) => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
};

const FIELDS = "_id name slug status limits webhookKey";

const getTenantById = (id) => cached(`id:${id}`, () => Tenant.findById(id).select(FIELDS).lean());

const getTenantBySlug = (slug) =>
  cached(`slug:${String(slug).trim().toLowerCase()}`, () =>
    Tenant.findOne({ slug: String(slug).trim().toLowerCase() }).select(FIELDS).lean(),
  );

// Call after changing a tenant's status; no id clears everything
const invalidateTenantCache = () => cache.clear();

/**
 * Throws unless the tenant exists and is active.
 * statusCode: 401 for sessions (clients sign out), 403 for sign-in / public requests.
 */
const assertTenantActive = (tenant, statusCode = statusCodes.UNAUTHORIZED) => {
  if (tenant?.status === "active") return tenant;
  if (tenant?.status === "suspended") {
    throw new customError("This store is suspended. Please contact support.", statusCode, "TENANT_SUSPENDED");
  }
  throw new customError("This store is not available", statusCode, "TENANT_INACTIVE");
};

module.exports = { getTenantById, getTenantBySlug, invalidateTenantCache, assertTenantActive };
