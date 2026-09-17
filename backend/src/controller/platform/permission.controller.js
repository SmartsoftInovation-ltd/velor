const Permission = require("../../models/permisson.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");

const findOr404 = async (id) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new customError("Invalid permission id", statusCodes.BAD_REQUEST);
  const permission = await Permission.findById(id);
  if (!permission) throw new customError("Permission not found", statusCodes.NOT_FOUND);
  return permission;
};

exports.list = asynchandeler(async (req, res) => {
  const permissions = await Permission.find().sort({ permissionName: 1 });
  apiResponse.sendSuccess(res, statusCodes.OK, "Permissions", permissions);
});

exports.create = asynchandeler(async (req, res) => {
  const permission = await new Permission({ permissionName: req.body.permissionName }).save();
  apiResponse.sendSuccess(res, statusCodes.CREATED, "Permission created", permission);
});

exports.update = asynchandeler(async (req, res) => {
  const permission = await findOr404(req.params.id);
  if (req.body.permissionName !== undefined) permission.permissionName = req.body.permissionName;
  if (req.body.isActive !== undefined) permission.isActive = req.body.isActive;
  await permission.save();
  apiResponse.sendSuccess(res, statusCodes.OK, "Permission updated", permission);
});

exports.remove = asynchandeler(async (req, res) => {
  const permission = await findOr404(req.params.id);
  await permission.deleteOne();
  apiResponse.sendSuccess(res, statusCodes.OK, "Permission deleted", permission);
});
