const Tenant = require("../models/platform/tenant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");
const settings = require("../settings/settings.service");
const { SECTIONS } = require("../settings/definitions");

// Store settings as seen from the tenant dashboard. Integrations are assigned
// by the platform; owners may only change fields marked ownerEditable.

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

exports.getSettings = asynchandeler(async (req, res) => {
  const tenant = await currentTenant();
  const [masked, features] = await Promise.all([
    settings.getMaskedSettings(tenant._id, { ownerView: true }),
    settings.getFeatures(tenant._id),
  ]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store settings", {
    settings: masked,
    features,
    ownerEditable: { general: OWNER_EDITABLE_GENERAL },
  });
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
  return apiResponse.sendSuccess(res, statusCodes.OK, "Webhook URLs", settings.getWebhookUrls(tenant));
});
