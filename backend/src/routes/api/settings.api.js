const express = require("express");
const controller = require("../../controller/settings.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");
const { SECTIONS } = require("../../settings/definitions");
const { INTEGRATION_SECTIONS } = require("../../settings/schema");

const _ = express.Router();

_.get("/", authGuard, authorize("store-settings", "view"), controller.getSettings);
_.patch("/general", authGuard, authorize("store-settings", "edit"), controller.updateGeneral);
_.get("/webhooks", authGuard, authorize("store-settings", "view"), controller.getWebhooks);
_.get("/schema", authGuard, authorize("store-settings", "view"), controller.getSchema);

// Integrations: the controller restricts writes and tests to the store owner
for (const key of INTEGRATION_SECTIONS) {
  const { path } = SECTIONS[key];
  _.patch(`/${path}`, authGuard, controller.updateIntegration(key));
  _.post(`/${path}/test`, authGuard, controller.testIntegration(key));
}

module.exports = _;
