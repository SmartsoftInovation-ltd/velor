const Tenant = require("../../models/platform/tenant.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { recordPlatformAudit } = require("../../service/platformAudit.service");
const { invalidateTenantCache } = require("../../tenancy/tenantResolver");
const { provisionTenant } = require("../../tenancy/provisioning");
const PlatformAuditLog = require("../../models/platform/platformAuditLog.model");

const OBJECT_ID = /^[a-f0-9]{24}$/i;

// Which statuses each transition may start from
const TRANSITIONS = {
  suspend: { to: "suspended", from: ["active", "provisioning"], audit: "TENANT_SUSPENDED" },
  activate: { to: "active", from: ["provisioning", "suspended"], audit: "TENANT_ACTIVATED" },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tenantIdParam = (req) => {
  const { tenantId } = req.params;
  if (!OBJECT_ID.test(tenantId)) throw new customError("Invalid tenantId", statusCodes.BAD_REQUEST);
  return tenantId;
};

const findTenantOr404 = async (tenantId) => {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new customError("Tenant not found", statusCodes.NOT_FOUND);
  return tenant;
};

// Flattens nested update input into dot paths: { limits: { maxStaff } } -> ["limits.maxStaff"]
const updatePaths = (input, prefix = "") =>
  Object.entries(input).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? updatePaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

exports.createTenant = asynchandeler(async (req, res) => {
  const audit = (tenantId) =>
    recordPlatformAudit({
      req,
      actor: req.platformUser,
      action: "TENANT_CREATED",
      tenantId,
      changes: Object.keys(req.body),
    });

  // With an owner: a ready-to-use store (roles, owner account, settings)
  if (req.body.owner) {
    const result = await provisionTenant(req.body, { createdBy: req.platformUser._id });
    await audit(result.tenant._id);
    return apiResponse.sendSuccess(res, statusCodes.CREATED, "Store provisioned", result);
  }

  const tenant = await Tenant.create({ ...req.body, createdBy: req.platformUser._id });
  await audit(tenant._id);
  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Tenant created", tenant);
});

exports.listTenants = asynchandeler(async (req, res) => {
  const { status, search, page, limit } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { slug: pattern }];
  }

  const [items, total] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Tenant.countDocuments(filter),
  ]);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenants fetched", { items, total, page, limit });
});

exports.getTenant = asynchandeler(async (req, res) => {
  const tenant = await findTenantOr404(tenantIdParam(req));
  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant fetched", tenant);
});

exports.updateTenant = asynchandeler(async (req, res) => {
  const tenant = await findTenantOr404(tenantIdParam(req));

  const changed = updatePaths(req.body).filter((path) => {
    const next = path.split(".").reduce((obj, key) => obj?.[key], req.body);
    return tenant.get(path) !== next;
  });

  changed.forEach((path) => tenant.set(path, path.split(".").reduce((obj, key) => obj?.[key], req.body)));
  await tenant.save();

  if (changed.length) {
    await recordPlatformAudit({
      req,
      actor: req.platformUser,
      action: "TENANT_UPDATED",
      tenantId: tenant._id,
      changes: changed,
    });
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant updated", tenant);
});

const changeStatus = (action) =>
  asynchandeler(async (req, res) => {
    const tenantId = tenantIdParam(req);
    const { to, from, audit } = TRANSITIONS[action];

    // Atomic: the status check and the write cannot race another request
    const tenant = await Tenant.findOneAndUpdate(
      { _id: tenantId, status: { $in: from } },
      { $set: { status: to, statusReason: req.body?.reason || "", statusChangedAt: new Date() } },
      { new: true },
    );

    if (!tenant) {
      const existing = await findTenantOr404(tenantId);
      throw new customError(`Cannot ${action} a tenant that is ${existing.status}`, statusCodes.CONFLICT);
    }

    invalidateTenantCache(tenant._id);
    await recordPlatformAudit({ req, actor: req.platformUser, action: audit, tenantId: tenant._id });

    return apiResponse.sendSuccess(res, statusCodes.OK, `Tenant ${to}`, tenant);
  });

exports.suspendTenant = changeStatus("suspend");
exports.activateTenant = changeStatus("activate");

exports.listTenantAudit = asynchandeler(async (req, res) => {
  const tenantId = tenantIdParam(req);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = { tenantId };

  const [items, total] = await Promise.all([
    PlatformAuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PlatformAuditLog.countDocuments(filter),
  ]);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant audit log", { items, total, page, limit });
});
