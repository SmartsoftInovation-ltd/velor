const express = require("express");
const controller = require("../../controller/platform/tenant.controller");
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

module.exports = _;
