const PlatformUser = require("../../models/platform/platformUser.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { recordPlatformAudit } = require("../../service/platformAudit.service");

const findTarget = async (id) => {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new customError("Invalid user id", statusCodes.BAD_REQUEST);
  const user = await PlatformUser.findById(id);
  if (!user) throw new customError("Platform user not found", statusCodes.NOT_FOUND);
  return user;
};

exports.list = asynchandeler(async (req, res) => {
  const users = await PlatformUser.find().sort({ createdAt: 1 });
  apiResponse.sendSuccess(res, statusCodes.OK, "Platform users", users);
});

exports.create = asynchandeler(async (req, res) => {
  const user = await PlatformUser.create(req.body);
  apiResponse.sendSuccess(res, statusCodes.CREATED, "Platform user created", user.toJSON());
});

exports.update = asynchandeler(async (req, res) => {
  const user = await findTarget(req.params.id);

  const { role, isActive, password, name, phone } = req.body;
  const self = user._id.equals(req.platformUser._id);
  if (self && (isActive === false || (role && role !== user.role))) {
    throw new customError("You cannot deactivate or demote yourself", statusCodes.BAD_REQUEST);
  }
  // Your own sign-in phone moves on your profile, which asks for your password
  if (self && phone !== undefined && phone !== user.phone) {
    throw new customError("Change your own phone on your profile", statusCodes.BAD_REQUEST);
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (password !== undefined) user.password = password;
  if (isActive !== undefined) user.isActive = isActive;
  // Deactivation and password resets end every session of that operator
  if (isActive === false || password !== undefined) user.tokenVersion += 1;

  await user.save();
  apiResponse.sendSuccess(res, statusCodes.OK, "Platform user updated", user.toJSON());
});

// The guard loads the operator on every request, so their open sessions end
// with the account. Audit entries keep the email, not just the dangling id.
exports.remove = asynchandeler(async (req, res) => {
  const user = await findTarget(req.params.id);
  // You always keep the superadmin who is doing the deleting, so the console
  // can never be left without one
  if (user._id.equals(req.platformUser._id)) {
    throw new customError("You cannot delete yourself", statusCodes.BAD_REQUEST);
  }

  await user.deleteOne();
  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "PLATFORM_USER_DELETED",
    metadata: { userId: user._id.toString(), email: user.email, role: user.role },
  });
  apiResponse.sendSuccess(res, statusCodes.OK, "Platform user deleted", { _id: user._id });
});
