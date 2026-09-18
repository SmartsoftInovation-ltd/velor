const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { runForTenant, getTenantId } = require("../tenancy/context");
const { getTenantBySlug, assertTenantActive } = require("../tenancy/tenantResolver");

/**
 * Opens the tenant context for requests that name their store in the `x-tenant`
 * header (dashboard / storefront). There is no default store: a request that
 * names none runs without a context, which strict mode rejects at query time.
 * Authenticated requests are bound to the token's tenant later by authGuard,
 * which rejects a mismatch.
 */
const resolveRequestTenant = asynchandeler(async (req, res, next) => {
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
