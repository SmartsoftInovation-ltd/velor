const express = require("express");
const { platformGuard } = require("../../middleware/platformGuard.middleware");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { SECTIONS } = require("../../settings/definitions");
const { hasTester } = require("../../settings/testers");

// Settings section definitions for generic forms in the platform console
const describeField = (name, field) => ({
  name,
  type: field.type,
  required: Boolean(field.required),
  ...(field.type !== "secret" && field.default !== undefined ? { default: field.default } : {}),
  ...(field.values ? { values: field.values } : {}),
  ...(field.min !== undefined ? { min: field.min } : {}),
  ...(field.max !== undefined ? { max: field.max } : {}),
  ...(field.pattern ? { pattern: field.pattern.source } : {}),
});

const schema = Object.entries(SECTIONS).map(([key, section]) => ({
  key,
  path: section.path,
  testable: hasTester(key),
  fields: Object.entries(section.fields).map(([name, field]) => describeField(name, field)),
}));

const _ = express.Router();
_.get("/schema", platformGuard, (req, res) => apiResponse.sendSuccess(res, statusCodes.OK, "Settings schema", schema));

module.exports = _;
