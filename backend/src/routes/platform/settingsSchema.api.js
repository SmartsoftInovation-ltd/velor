const express = require("express");
const { platformGuard } = require("../../middleware/platformGuard.middleware");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { describeSections } = require("../../settings/schema");

const _ = express.Router();
_.get("/schema", platformGuard, (req, res) =>
  apiResponse.sendSuccess(res, statusCodes.OK, "Settings schema", describeSections()),
);

module.exports = _;
