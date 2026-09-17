const Tenant = require("../models/platform/tenant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");
const settings = require("../settings/settings.service");
const { SECTIONS } = require("../settings/definitions");
const { describeSections, INTEGRATION_SECTIONS } = require("../settings/schema");
const { runSettingsTest } = require("../settings/testers");
const { isOwner } = require("../tenancy/rbac");
const { logAudit } = require("../service/audit.service");

// Store settings as seen from the tenant dashboard. The store owner connects the
// store's own integration accounts; other staff with store-settings access see
// status only. General fields are limited to those marked ownerEditable.

const OWNER_EDITABLE_GENERAL = Object.entries(SECTIONS.general.fields)
  .filter(([, field]) => field.ownerEditable)
  .map(([name]) => name);

const currentTenant = async () => {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new customError("No tenant context for this request", statusCodes.BAD_REQUEST, "TENANT_CONTEXT_REQUIRED");
  }
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new customError("Tenant not found", statusCodes.NOT_FOUND);
  return tenant;
};

const requireOwner = (req) => {
  if (!isOwner(req.user)) {
    throw new customError("Only the store owner can manage integrations", statusCodes.FORBIDDEN);
  }
};

exports.getSettings = asynchandeler(async (req, res) => {
  const tenant = await currentTenant();
  const canManageIntegrations = isOwner(req.user);
  const [masked, features] = await Promise.all([
    // Staff other than the owner only learn whether a secret is set
    settings.getMaskedSettings(tenant._id, { ownerView: !canManageIntegrations }),
    settings.getFeatures(tenant._id),
  ]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store settings", {
    settings: masked,
    features,
    canManageIntegrations,
    ownerEditable: { general: OWNER_EDITABLE_GENERAL },
  });
});

exports.getSchema = asynchandeler(async (req, res) =>
  apiResponse.sendSuccess(res, statusCodes.OK, "Integration settings schema", describeSections(INTEGRATION_SECTIONS)),
);

exports.updateIntegration = (sectionKey) =>
  asynchandeler(async (req, res) => {
    requireOwner(req);
    const tenant = await currentTenant();
    const result = await settings.updateSection(tenant._id, sectionKey, req.body, { updatedBy: req.user._id });

    if (result.changes.length) {
      // Field names only: values may be credentials
      logAudit({
        req,
        action: "UPDATE",
        entityType: "store-settings",
        entityId: tenant._id,
        entityLabel: sectionKey,
        after: { changes: result.changes },
      });
    }

    return apiResponse.sendSuccess(res, statusCodes.OK, "Integration saved", result);
  });

exports.testIntegration = (sectionKey) =>
  asynchandeler(async (req, res) => {
    requireOwner(req);
    const tenant = await currentTenant();
    const values = (await settings.getSettings(tenant._id))[sectionKey];
    const result = await runSettingsTest(sectionKey, values);
    return apiResponse.sendSuccess(res, statusCodes.OK, result.ok ? "Connection OK" : "Connection failed", result);
  });

exports.updateGeneral = asynchandeler(async (req, res) => {
  const tenant = await currentTenant();
  const result = await settings.updateSection(tenant._id, "general", req.body, {
    allowedFields: OWNER_EDITABLE_GENERAL,
    updatedBy: req.user?._id || null,
  });
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store settings updated", result);
});

exports.getWebhooks = asynchandeler(async (req, res) => {
  const tenant = await currentTenant();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Webhook URLs", settings.getWebhookUrls(tenant, `${req.protocol}://${req.get("host")}`));
});
