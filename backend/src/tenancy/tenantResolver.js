const Tenant = require("../models/platform/tenant.model");
const TenantDomain = require("../models/platform/tenantDomain.model");
const { normalizeHost } = require("../models/platform/tenantDomain.model");
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

/**
 * Resolves the tenant that owns a storefront hostname.
 *
 * Only an "active" domain resolves. A domain sitting at "pending" has been
 * entered by an operator but not yet proven to belong to the seller, and
 * honouring it would let a typo — or a deliberately claimed hostname — serve
 * one tenant's catalogue under another's name.
 *
 * Returns null for an unknown host so the caller can answer 404 rather than
 * leaking whether a given domain is registered on the platform.
 */
const getTenantByHost = (host) => {
  const normalized = normalizeHost(host);
  if (!normalized) return Promise.resolve(null);

  return cached(`host:${normalized}`, async () => {
    const domain = await TenantDomain.findOne({ host: normalized, status: "active" })
      .select("tenantId")
      .lean();
    if (!domain) return null;
    return Tenant.findById(domain.tenantId).select(FIELDS).lean();
  });
};

// Call after changing a tenant's status or its domains; no id clears everything
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

module.exports = { getTenantById, getTenantBySlug, getTenantByHost, invalidateTenantCache, assertTenantActive };
