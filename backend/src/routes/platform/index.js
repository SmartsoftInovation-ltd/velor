const express = require("express");

// Platform (SaaS operator) API — mounted at /api/v1/platform
const _ = express.Router();

_.use("/auth", require("./auth.api"));
_.use("/dashboard", require("./dashboard.api"));
_.use("/tenants", require("./tenant.api"));
_.use("/permissions", require("./permission.api"));
_.use("/users", require("./user.api"));
_.use("/settings", require("./settingsSchema.api"));

module.exports = _;
