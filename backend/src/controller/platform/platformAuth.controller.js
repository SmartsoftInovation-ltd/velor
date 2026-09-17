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
const { isOwner } = require("../../tenancy/rbac");

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

// Platform workspaces: stores whose owner may open the Platform Console from their
// normal dashboard session (PLATFORM_WORKSPACES="velor,…").
const platformWorkspaces = () =>
  (process.env.PLATFORM_WORKSPACES || "")
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);

// The operator account the console session acts as
const consoleOperator = async () => {
  const email = process.env.PLATFORM_CONSOLE_OPERATOR_EMAIL?.trim().toLowerCase();
  const filter = email ? { email, isActive: true } : { role: "superadmin", isActive: true };
  return PlatformUser.findOne(filter).sort({ createdAt: 1 });
};

exports.consoleAccess = asynchandeler(async (req, res) => {
  getPlatformAuthConfig();

  const workspace = req.tenant?.slug;
  if (!workspace || !platformWorkspaces().includes(workspace) || !isOwner(req.user)) {
    throw new customError("Only the platform store owner can open the Platform Console", statusCodes.FORBIDDEN);
  }

  const operator = await consoleOperator();
  if (!operator) {
    throw new customError(
      "No platform operator account exists. Run npm run seed:platform-admin.",
      statusCodes.SERVER_ERROR,
      "PLATFORM_OPERATOR_MISSING",
    );
  }

  operator.lastLoginAt = new Date();
  await operator.save();

  res.cookie(REFRESH_COOKIE, signPlatformRefreshToken(operator), { ...cookieOptions(), maxAge: REFRESH_MAX_AGE });
  await recordPlatformAudit({
    req,
    actor: operator,
    action: "PLATFORM_LOGIN",
    metadata: { via: "console-access", staffEmail: req.user.email, workspace },
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Platform Console unlocked", {
    accessToken: signPlatformAccessToken(operator),
    user: operator.toJSON(),
  });
});
