const express = require("express");
const controller = require("../../controller/platform/tenant.controller");
const settingsController = require("../../controller/platform/tenantSettings.controller");
const { SECTIONS } = require("../../settings/definitions");
const { platformGuard, requirePlatformRole } = require("../../middleware/platformGuard.middleware");
const { validateBody, validateQuery } = require("../../validation/platform/validateBody");
const {
  createTenantSchema,
  updateTenantSchema,
  statusChangeSchema,
  ownerPasswordSchema,
  listTenantsQuerySchema,
} = require("../../validation/platform/tenant.validation");
const domainController = require("../../controller/platform/domain.controller");
const { addDomainSchema, updateDomainSchema } = require("../../validation/platform/domain.validation");
const logoController = require("../../controller/platform/tenantLogo.controller");
const { singleFileUpload } = require("../../middleware/multer.middleware");
const { domainVerifyLimiter } = require("../../middleware/rateLimit.middleware");

const _ = express.Router();
const superadmin = requirePlatformRole("superadmin");

_.use(platformGuard);

_.get("/", validateQuery(listTenantsQuerySchema), controller.listTenants);
_.post("/", superadmin, validateBody(createTenantSchema), controller.createTenant);
_.get("/:tenantId", controller.getTenant);
_.patch("/:tenantId", superadmin, validateBody(updateTenantSchema), controller.updateTenant);
_.post("/:tenantId/suspend", superadmin, validateBody(statusChangeSchema), controller.suspendTenant);
_.post("/:tenantId/activate", superadmin, validateBody(statusChangeSchema), controller.activateTenant);
_.post("/:tenantId/owner/password", superadmin, validateBody(ownerPasswordSchema), controller.setOwnerPassword);

// Storefront hostnames. Adding one routes no traffic until it is verified.
_.get("/:tenantId/domains", domainController.listDomains);
_.post("/:tenantId/domains", superadmin, validateBody(addDomainSchema), domainController.addDomain);
_.post("/:tenantId/domains/:domainId/verify", superadmin, domainVerifyLimiter, domainController.verifyDomainHandler);
_.patch("/:tenantId/domains/:domainId", superadmin, validateBody(updateDomainSchema), domainController.updateDomain);
_.delete("/:tenantId/domains/:domainId", superadmin, domainController.removeDomain);

// The seller's logo: the image on their Store Information record
_.get("/:tenantId/logo", logoController.forTenant, logoController.getLogo);
_.put("/:tenantId/logo", superadmin, logoController.forTenant, singleFileUpload("image"), logoController.updateLogo);

_.get("/:tenantId/audit", controller.listTenantAudit);
_.get("/:tenantId/settings", settingsController.getSettings);
_.get("/:tenantId/settings/webhooks", settingsController.getWebhooks);
const { hasTester } = require("../../settings/testers");
for (const [key, { path }] of Object.entries(SECTIONS)) {
  _.patch(`/:tenantId/settings/${path}`, superadmin, settingsController.updateSection(key));
  if (hasTester(key)) {
    _.post(`/:tenantId/settings/${path}/test`, superadmin, settingsController.testSection(key));
  }
}
_.patch("/:tenantId/settings/*", superadmin, (req, res, next) => {
  const { customError } = require("../../lib/CustomError");
  next(new customError("Unknown settings section", 404));
});

module.exports = _;
