const express = require("express");
const controller = require("../../controller/platform/platformAuth.controller");
const { platformGuard } = require("../../middleware/platformGuard.middleware");
const { platformLoginLimiter } = require("../../middleware/rateLimit.middleware");
const { validateBody } = require("../../validation/platform/validateBody");
const { platformLoginSchema } = require("../../validation/platform/auth.validation");

const _ = express.Router();

_.post("/login", platformLoginLimiter, validateBody(platformLoginSchema), controller.login);
_.post("/refresh", controller.refresh);
_.post("/logout", controller.logout);
_.get("/me", platformGuard, controller.me);

module.exports = _;
