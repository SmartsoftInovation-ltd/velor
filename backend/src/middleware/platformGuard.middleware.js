const PlatformUser = require("../models/platform/platformUser.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { verifyPlatformAccessToken } = require("../utils/platformTokens");
const { runAsPlatform } = require("../tenancy/context");

const unauthorized = () => new customError("Unauthorized", statusCodes.UNAUTHORIZED);

// Authenticates a platform operator and runs the rest of the request in
// platform scope (tenant scoping deliberately bypassed).
const platformGuard = asynchandeler(async (req, res, next) => {
  const token = req.headers?.authorization?.replace(/^Bearer /, "");
  if (!token) throw unauthorized();

  const payload = verifyPlatformAccessToken(token);
  const user = await PlatformUser.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw unauthorized();
  }

  req.platformUser = user;
  runAsPlatform(() => next());
});

const requirePlatformRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.platformUser?.role)) {
    return next(new customError("Forbidden", statusCodes.FORBIDDEN));
  }
  next();
};

module.exports = { platformGuard, requirePlatformRole };
