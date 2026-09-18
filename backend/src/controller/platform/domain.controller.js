const Tenant = require("../../models/platform/tenant.model");
const TenantDomain = require("../../models/platform/tenantDomain.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { recordPlatformAudit } = require("../../service/platformAudit.service");
const { invalidateTenantCache } = require("../../tenancy/tenantResolver");
const { verifyDomain, dnsInstructions } = require("../../service/domainVerification.service");

/**
 * Platform-side management of the hostnames that map to a store.
 *
 * Adding a domain here does not route any traffic: it starts at "pending" and
 * only serves requests once the DNS check proves the seller owns it. That
 * ordering is the whole safety property — an operator typo cannot hand one
 * seller's visitors to another.
 *
 * Every mutation clears the tenant cache, which is keyed by hostname. Skipping
 * that would leave a removed domain resolving, or a freshly verified one
 * invisible, for up to the cache TTL.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;

const idParam = (value, label) => {
  if (!OBJECT_ID.test(value)) throw new customError(`Invalid ${label}`, statusCodes.BAD_REQUEST);
  return value;
};

const findTenantOr404 = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId).select("_id").lean();
  if (!tenant) throw new customError("Tenant not found", statusCodes.NOT_FOUND);
  return tenant;
};

// Scoped by tenantId as well as id, so one tenant's domain cannot be acted on
// through another tenant's URL.
const findDomainOr404 = async (tenantId, domainId) => {
  const domain = await TenantDomain.findOne({ _id: domainId, tenantId });
  if (!domain) throw new customError("Domain not found", statusCodes.NOT_FOUND);
  return domain;
};

// The verification token is not secret, but it has no use outside the DNS
// record, so it is shown as instructions rather than as a bare field.
const present = (domain) => ({
  _id: domain._id,
  host: domain.host,
  status: domain.status,
  isPrimary: domain.isPrimary,
  verifiedAt: domain.verifiedAt,
  lastCheckedAt: domain.lastCheckedAt,
  failureReason: domain.failureReason,
  createdAt: domain.createdAt,
  dnsRecord: dnsInstructions(domain),
});

exports.listDomains = asynchandeler(async (req, res) => {
  const tenantId = idParam(req.params.tenantId, "tenantId");
  await findTenantOr404(tenantId);

  const domains = await TenantDomain.find({ tenantId }).sort({ isPrimary: -1, createdAt: 1 });
  return apiResponse.sendSuccess(res, statusCodes.OK, "Domains", domains.map(present));
});

exports.addDomain = asynchandeler(async (req, res) => {
  const tenantId = idParam(req.params.tenantId, "tenantId");
  await findTenantOr404(tenantId);

  const { host, isPrimary } = req.body;

  // Answered before insert so the operator gets "already in use" rather than a
  // raw duplicate-key error; the unique index is still the real guarantee.
  const taken = await TenantDomain.findOne({ host }).select("_id").lean();
  if (taken) throw new customError("This domain is already registered", statusCodes.CONFLICT);

  let domain;
  try {
    domain = await TenantDomain.create({ tenantId, host, isPrimary, createdBy: req.platformUser?._id ?? null });
  } catch (error) {
    // Lost the race between the check above and the insert
    if (error.code === 11000) throw new customError("This domain is already registered", statusCodes.CONFLICT);
    throw error;
  }

  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "DOMAIN_ADDED",
    tenantId,
    metadata: { host: domain.host },
  });
  invalidateTenantCache();

  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Domain added", present(domain));
});

/**
 * Runs the DNS check. Safe to call repeatedly: a seller who has just published
 * the record will often fail once while it propagates.
 */
exports.verifyDomainHandler = asynchandeler(async (req, res) => {
  const tenantId = idParam(req.params.tenantId, "tenantId");
  const domainId = idParam(req.params.domainId, "domainId");
  await findTenantOr404(tenantId);

  const domain = await findDomainOr404(tenantId, domainId);
  await verifyDomain(domain);

  if (domain.status === "active") {
    await recordPlatformAudit({
      req,
      actor: req.platformUser,
      action: "DOMAIN_VERIFIED",
      tenantId,
      metadata: { host: domain.host },
    });
  }
  // Cleared either way: a domain that just failed must stop resolving too.
  invalidateTenantCache();

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    domain.status === "active" ? "Domain verified" : "Verification failed",
    present(domain),
  );
});

exports.updateDomain = asynchandeler(async (req, res) => {
  const tenantId = idParam(req.params.tenantId, "tenantId");
  const domainId = idParam(req.params.domainId, "domainId");
  await findTenantOr404(tenantId);

  const domain = await findDomainOr404(tenantId, domainId);

  // A hostname that does not resolve cannot be the store's canonical address:
  // it would send payment redirects and email links somewhere that 404s.
  if (domain.status !== "active") {
    throw new customError("Verify this domain before making it primary", statusCodes.UNPROCESSABLE);
  }

  domain.isPrimary = true;
  await domain.save(); // the model's pre-save hook demotes the previous primary

  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "DOMAIN_PRIMARY_CHANGED",
    tenantId,
    metadata: { host: domain.host },
  });
  invalidateTenantCache();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Primary domain updated", present(domain));
});

exports.removeDomain = asynchandeler(async (req, res) => {
  const tenantId = idParam(req.params.tenantId, "tenantId");
  const domainId = idParam(req.params.domainId, "domainId");
  await findTenantOr404(tenantId);

  const domain = await findDomainOr404(tenantId, domainId);
  await domain.deleteOne();

  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "DOMAIN_REMOVED",
    tenantId,
    metadata: { host: domain.host },
  });
  // Without this the removed hostname keeps resolving until the cache expires
  invalidateTenantCache();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Domain removed", { _id: domain._id, host: domain.host });
});
