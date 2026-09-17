const express = require("express");
const controller = require("../../controller/settings.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

const _ = express.Router();

_.get("/", authGuard, authorize("store-settings", "view"), controller.getSettings);
_.patch("/general", authGuard, authorize("store-settings", "edit"), controller.updateGeneral);
_.get("/webhooks", authGuard, authorize("store-settings", "view"), controller.getWebhooks);

module.exports = _;
