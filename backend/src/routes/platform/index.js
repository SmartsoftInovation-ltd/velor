const express = require("express");

// Platform (SaaS operator) API — mounted at /api/v1/platform
const _ = express.Router();

_.use("/auth", require("./auth.api"));
_.use("/tenants", require("./tenant.api"));

module.exports = _;
