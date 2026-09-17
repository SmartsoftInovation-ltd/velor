const PlatformUser = require("../../models/platform/platformUser.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { getPlatformAuthConfig } = require("../../config/platformAuth.config");
const {
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformRefreshToken,
} = require("../../utils/platformTokens");
const { recordPlatformAudit } = require("../../service/platformAudit.service");

const REFRESH_COOKIE = "platformRefreshToken";
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: `${process.env.BASE_URL || "/api/v1"}/platform/auth`,
});

const invalidCredentials = () => new customError("Invalid credentials", statusCodes.UNAUTHORIZED);

exports.login = asynchandeler(async (req, res) => {
  // Fail closed before touching credentials when secrets are misconfigured
  getPlatformAuthConfig();
  const { email, password } = req.body;

  const user = await PlatformUser.findOne({ email }).select("+password");
  if (!user) {
    await recordPlatformAudit({ req, actorEmail: email, action: "PLATFORM_LOGIN_FAILED" });
    throw invalidCredentials();
  }

  if (!(await user.comparePassword(password))) {
    await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGIN_FAILED" });
    throw invalidCredentials();
  }

  if (!user.isActive) {
    throw new customError("Account is deactivated", statusCodes.FORBIDDEN);
  }

  user.lastLoginAt = new Date();
  await user.save();

  res.cookie(REFRESH_COOKIE, signPlatformRefreshToken(user), { ...cookieOptions(), maxAge: REFRESH_MAX_AGE });
  await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGIN" });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Login successful", {
    accessToken: signPlatformAccessToken(user),
    user: user.toJSON(),
  });
});

exports.refresh = asynchandeler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new customError("Unauthorized", statusCodes.UNAUTHORIZED);

  const payload = verifyPlatformRefreshToken(token);
  const user = await PlatformUser.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw new customError("Unauthorized", statusCodes.UNAUTHORIZED);
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Token refreshed", {
    accessToken: signPlatformAccessToken(user),
  });
});

// Revokes every token issued to the user (all devices) by bumping tokenVersion
exports.logout = asynchandeler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = verifyPlatformRefreshToken(token);
      const user = await PlatformUser.findOneAndUpdate(
        { _id: payload.sub, tokenVersion: payload.tv },
        { $inc: { tokenVersion: 1 } },
        { new: true },
      );
      if (user) await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGOUT" });
    } catch {
      // An invalid or expired cookie has nothing left to revoke
    }
  }

  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  return apiResponse.sendSuccess(res, statusCodes.OK, "Logged out");
});

exports.me = asynchandeler(async (req, res) =>
  apiResponse.sendSuccess(res, statusCodes.OK, "Current platform user", req.platformUser.toJSON()),
);
