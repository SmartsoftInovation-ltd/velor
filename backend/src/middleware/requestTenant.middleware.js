const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { runForTenant, getTenantId } = require("../tenancy/context");
const { getTenantBySlug, getTenantByHost, assertTenantActive } = require("../tenancy/tenantResolver");
const { normalizeHost } = require("../models/platform/tenantDomain.model");

/**
 * Whether `x-tenant-host` may be believed.
 *
 * That header decides which store a storefront request belongs to, so a client
 * able to set it could read and write another tenant's data. It is only
 * trustworthy when a reverse proxy overwrites it on every request:
 *
 *     proxy_set_header x-tenant-host $host;
 *
 * Until that is in place the header is ignored entirely. Defaulting to "off"
 * means a deployment that forgets the proxy line fails closed — storefront
 * requests stop resolving — instead of silently accepting spoofed hosts.
 */
const trustsHostHeader = () => process.env.TRUST_TENANT_HOST_HEADER === "true";

/**
 * Opens the tenant context for requests that name their store.
 *
 * Two ways in, in order of precedence:
 *
 *   1. `x-tenant-host` — the storefront. Set by the proxy from the real Host, so
 *      a visitor cannot choose it. This is how a seller's own domain maps to
 *      their tenant.
 *   2. `x-tenant` — the dashboard, naming its store by slug. Staff requests are
 *      re-bound to the token's tenant later by authGuard, which rejects a
 *      mismatch, so a wrong slug here cannot reach another store's data.
 *
 * There is no default store: a request that names none runs without a context,
 * which strict mode rejects at query time.
 */
const resolveRequestTenant = asynchandeler(async (req, res, next) => {
  const host = trustsHostHeader() ? req.headers["x-tenant-host"] : undefined;

  if (host) {
    const tenant = await getTenantByHost(host);
    // Unknown and unverified hosts answer alike: whether a domain is registered
    // here is not something an anonymous caller needs to learn.
    if (!tenant) throw new customError("Store not found", statusCodes.NOT_FOUND, "DOMAIN_NOT_FOUND");
    assertTenantActive(tenant, statusCodes.FORBIDDEN);

    req.tenant = tenant;
    // The storefront domain this request came through; an order keeps it so
    // the shopper is sent back to the same site after paying
    req.tenantHost = normalizeHost(host);
    return runForTenant(tenant._id, () => next());
  }

  const slug = req.headers["x-tenant"];
  if (!slug) return next();

  const tenant = await getTenantBySlug(slug);
  if (!tenant) throw new customError("Store not found", statusCodes.NOT_FOUND, "TENANT_NOT_FOUND");
  assertTenantActive(tenant, statusCodes.FORBIDDEN);

  req.tenant = tenant;
  runForTenant(tenant._id, () => next());
});

/**
 * Dashboard sign-in and account flows send `workspace` (the store slug) in the body.
 * An unknown workspace answers like wrong credentials, so it cannot be used to
 * discover which stores exist.
 */
const workspaceTenant = asynchandeler(async (req, res, next) => {
  const workspace = req.body?.workspace;
  if (workspace === undefined) return next();
  delete req.body.workspace;

  const tenant = workspace ? await getTenantBySlug(workspace) : null;
  if (!tenant) throw new customError("Invalid credentials", statusCodes.BAD_REQUEST);
  assertTenantActive(tenant, statusCodes.FORBIDDEN);

  const current = getTenantId();
  if (current && !current.equals(tenant._id)) {
    throw new customError("Workspace does not match this store", statusCodes.BAD_REQUEST);
  }

  req.tenant = tenant;
  req.workspace = tenant.slug;
  runForTenant(tenant._id, () => next());
});

module.exports = { resolveRequestTenant, workspaceTenant };
