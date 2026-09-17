const express = require("express");
const joi = require("joi");
const controller = require("../../controller/platform/permission.controller");
const { platformGuard, requirePlatformRole } = require("../../middleware/platformGuard.middleware");
const { validateBody } = require("../../validation/platform/validateBody");

const _ = express.Router();
const superadmin = requirePlatformRole("superadmin");

const createSchema = joi.object({ permissionName: joi.string().trim().min(2).max(80).required() });
const updateSchema = joi.object({
  permissionName: joi.string().trim().min(2).max(80),
  isActive: joi.boolean(),
}).min(1);

_.use(platformGuard);
_.get("/", controller.list);
_.post("/", superadmin, validateBody(createSchema), controller.create);
_.patch("/:id", superadmin, validateBody(updateSchema), controller.update);
_.delete("/:id", superadmin, controller.remove);

module.exports = _;
