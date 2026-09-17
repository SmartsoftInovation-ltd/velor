const Tenant = require("../../models/platform/tenant.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const settings = require("../../settings/settings.service");
const { recordPlatformAudit } = require("../../service/platformAudit.service");

const findTenant = async (tenantId) => {
  if (!/^[a-f0-9]{24}$/i.test(tenantId)) throw new customError("Invalid tenantId", statusCodes.BAD_REQUEST);
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new customError("Tenant not found", statusCodes.NOT_FOUND);
  return tenant;
};

exports.getSettings = asynchandeler(async (req, res) => {
  const tenant = await findTenant(req.params.tenantId);
  const [masked, features, version] = await Promise.all([
    settings.getMaskedSettings(tenant._id),
    settings.getFeatures(tenant._id),
    settings.getSettingsVersion(tenant._id),
  ]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Tenant settings", { settings: masked, features, version });
});

exports.updateSection = (sectionKey) =>
  asynchandeler(async (req, res) => {
    const tenant = await findTenant(req.params.tenantId);
    const result = await settings.updateSection(tenant._id, sectionKey, req.body, {
      updatedBy: req.platformUser._id,
    });

    if (result.changes.length) {
      await recordPlatformAudit({
        req,
        actor: req.platformUser,
        action: "TENANT_SETTINGS_UPDATED",
        tenantId: tenant._id,
        changes: result.changes,
      });
    }

    return apiResponse.sendSuccess(res, statusCodes.OK, "Settings updated", result);
  });

exports.getWebhooks = asynchandeler(async (req, res) => {
  const tenant = await findTenant(req.params.tenantId);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Webhook URLs", settings.getWebhookUrls(tenant));
});
