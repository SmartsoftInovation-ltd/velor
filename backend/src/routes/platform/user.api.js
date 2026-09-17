const express = require("express");
const joi = require("joi");
const controller = require("../../controller/platform/platformUser.controller");
const { platformGuard, requirePlatformRole } = require("../../middleware/platformGuard.middleware");
const { validateBody } = require("../../validation/platform/validateBody");

const createSchema = joi.object({
  name: joi.string().trim().min(2).max(100).required(),
  email: joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: joi.string().min(12).required(),
  role: joi.string().valid("superadmin", "support").required(),
});

const updateSchema = joi.object({
  name: joi.string().trim().min(2).max(100),
  password: joi.string().min(12),
  role: joi.string().valid("superadmin", "support"),
  isActive: joi.boolean(),
}).min(1);

const _ = express.Router();
_.use(platformGuard, requirePlatformRole("superadmin"));
_.get("/", controller.list);
_.post("/", validateBody(createSchema), controller.create);
_.patch("/:id", validateBody(updateSchema), controller.update);

module.exports = _;
