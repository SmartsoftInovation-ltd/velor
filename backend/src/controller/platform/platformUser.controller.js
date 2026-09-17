const PlatformUser = require("../../models/platform/platformUser.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");

exports.list = asynchandeler(async (req, res) => {
  const users = await PlatformUser.find().sort({ createdAt: 1 });
  apiResponse.sendSuccess(res, statusCodes.OK, "Platform users", users);
});

exports.create = asynchandeler(async (req, res) => {
  const user = await PlatformUser.create(req.body);
  apiResponse.sendSuccess(res, statusCodes.CREATED, "Platform user created", user.toJSON());
});

exports.update = asynchandeler(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw new customError("Invalid user id", statusCodes.BAD_REQUEST);
  const user = await PlatformUser.findById(req.params.id);
  if (!user) throw new customError("Platform user not found", statusCodes.NOT_FOUND);

  const { role, isActive, password, name } = req.body;
  const self = user._id.equals(req.platformUser._id);
  if (self && (isActive === false || (role && role !== user.role))) {
    throw new customError("You cannot deactivate or demote yourself", statusCodes.BAD_REQUEST);
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (password !== undefined) user.password = password;
  if (isActive !== undefined) user.isActive = isActive;
  // Deactivation and password resets end every session of that operator
  if (isActive === false || password !== undefined) user.tokenVersion += 1;

  await user.save();
  apiResponse.sendSuccess(res, statusCodes.OK, "Platform user updated", user.toJSON());
});
