const express = require("express");
const controller = require("../../controller/platform/platformAuth.controller");
const { platformGuard } = require("../../middleware/platformGuard.middleware");
const { authGuard } = require("../../middleware/authMiddleware");
const { platformLoginLimiter } = require("../../middleware/rateLimit.middleware");
const { validateBody } = require("../../validation/platform/validateBody");
const { platformLoginSchema } = require("../../validation/platform/auth.validation");

const _ = express.Router();

_.post("/login", platformLoginLimiter, validateBody(platformLoginSchema), controller.login);
_.post("/refresh", controller.refresh);
_.post("/logout", controller.logout);
_.get("/me", platformGuard, controller.me);
// Dashboard session of the platform store's owner → platform session
_.post("/console-access", authGuard, controller.consoleAccess);

module.exports = _;
