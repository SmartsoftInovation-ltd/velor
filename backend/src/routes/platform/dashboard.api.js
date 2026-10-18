const express = require("express");
const controller = require("../../controller/platform/platformDashboard.controller");
const { platformGuard } = require("../../middleware/platformGuard.middleware");

const _ = express.Router();

_.get("/", platformGuard, controller.getPlatformDashboard);

module.exports = _;
