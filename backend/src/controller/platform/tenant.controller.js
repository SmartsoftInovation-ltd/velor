const Tenant = require("../../models/platform/tenant.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { recordPlatformAudit } = require("../../service/platformAudit.service");
const { invalidateTenantCache } = require("../../tenancy/tenantResolver");
const { provisionTenant } = require("../../tenancy/provisioning");
const PlatformAuditLog = require("../../models/platform/platformAuditLog.model");
const User = require("../../models/user.model");
const { runForTenant } = require("../../tenancy/context");
const { sendOwnerCredentials } = require("../../service/ownerCredentials.service");

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

// Adds each seller's owner (name, email, phone) for the console's lists and
// detail page. Owners live in their own store; this runs in platform scope.
const withOwners = async (tenants) => {
  const ids = tenants.map((t) => t.ownerUserId).filter(Boolean);
  const owners = ids.length ? await User.find({ _id: { $in: ids } }).select("name email phone").lean() : [];
  const byId = Object.fromEntries(owners.map((o) => [String(o._id), { name: o.name, email: o.email, phone: o.phone }]));
  return tenants.map((t) => ({ ...t.toObject(), owner: byId[String(t.ownerUserId)] || null }));
};

// Flattens nested update input into dot paths: { limits: { maxStaff } } -> ["limits.maxStaff"].
// A Date (billing dates, after validation) is a value, not a branch.
const updatePaths = (input, prefix = "") =>
  Object.entries(input).flatMap(([key, value]) =>
    value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
      ? updatePaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const sameValue = (a, b) =>
  a instanceof Date || b instanceof Date ? a?.getTime?.() === b?.getTime?.() : a === b;

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

  // Counts per status for the filter pills: follow the search, ignore the status filter
  const { status: _status, ...searchFilter } = filter;
  const [items, total, grouped] = await Promise.all([
    Tenant.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Tenant.countDocuments(filter),
    Tenant.aggregate([{ $match: searchFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const counts = { all: 0, active: 0, provisioning: 0, suspended: 0, cancelled: 0 };
  for (const { _id, count } of grouped) {
    counts[_id] = count;
    counts.all += count;
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenants fetched", {
    items: await withOwners(items),
    total,
    page,
    limit,
    counts,
  });
});

exports.getTenant = asynchandeler(async (req, res) => {
  const tenant = await findTenantOr404(tenantIdParam(req));
  const [withOwner] = await withOwners([tenant]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant fetched", withOwner);
});

exports.updateTenant = asynchandeler(async (req, res) => {
  const tenant = await findTenantOr404(tenantIdParam(req));

  const changed = updatePaths(req.body).filter((path) => {
    const next = path.split(".").reduce((obj, key) => obj?.[key], req.body);
    return !sameValue(tenant.get(path), next);
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

  const [withOwner] = await withOwners([tenant]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant updated", withOwner);
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

    const [withOwner] = await withOwners([tenant]);
    return apiResponse.sendSuccess(res, statusCodes.OK, `Tenant ${to}`, withOwner);
  });

exports.suspendTenant = changeStatus("suspend");
exports.activateTenant = changeStatus("activate");

// Support sets a new password for the store owner (e.g. the owner forgot it).
// Every open session of the owner is signed out.
exports.setOwnerPassword = asynchandeler(async (req, res) => {
  const tenant = await findTenantOr404(tenantIdParam(req));
  if (!tenant.ownerUserId) throw new customError("This store has no owner account", statusCodes.CONFLICT);

  const { password, notify } = req.body;
  const owner = await runForTenant(tenant._id, async () => {
    const user = await User.findById(tenant.ownerUserId);
    if (!user) return null;
    user.password = password;
    user.refreshToken = null;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return user;
  });
  if (!owner) throw new customError("Owner account not found", statusCodes.NOT_FOUND);

  const notification = notify
    ? await sendOwnerCredentials({ tenant, owner, password, reason: "password" })
    : { channel: null, sent: false };

  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "TENANT_OWNER_PASSWORD_SET",
    tenantId: tenant._id,
    metadata: { notifiedVia: notification.sent ? notification.channel : null },
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Owner password updated", {
    owner: { _id: owner._id, name: owner.name, email: owner.email, phone: owner.phone },
    notification,
  });
});

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
