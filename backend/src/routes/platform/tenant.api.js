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
  listTenantsQuerySchema,
} = require("../../validation/platform/tenant.validation");

const _ = express.Router();
const superadmin = requirePlatformRole("superadmin");

_.use(platformGuard);

_.get("/", validateQuery(listTenantsQuerySchema), controller.listTenants);
_.post("/", superadmin, validateBody(createTenantSchema), controller.createTenant);
_.get("/:tenantId", controller.getTenant);
_.patch("/:tenantId", superadmin, validateBody(updateTenantSchema), controller.updateTenant);
_.post("/:tenantId/suspend", superadmin, validateBody(statusChangeSchema), controller.suspendTenant);
_.post("/:tenantId/activate", superadmin, validateBody(statusChangeSchema), controller.activateTenant);

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
