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
const otp = require("../../service/platformOtp.service");
const { isProduction } = require("../../config/nodeEnv");

const REFRESH_COOKIE = "platformRefreshToken";
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProduction(),
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

  // The password is only the first factor: no session is issued here. A one-time
  // code goes to the operator phone and /verify-otp exchanges it for the session.
  let challenge;
  try {
    challenge = await otp.startChallenge(user);
  } catch (error) {
    console.error("Platform OTP could not be sent:", error.message);
    throw new customError(
      "Could not send the sign-in code. Please try again or contact support.",
      statusCodes.SERVICE_UNAVAILABLE,
      "OTP_SEND_FAILED",
    );
  }

  await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGIN_OTP_SENT" });

  return apiResponse.sendSuccess(res, statusCodes.OK, "A sign-in code has been sent", challenge);
});

// Second factor: the code from the SMS is what actually opens the session
exports.verifyOtp = asynchandeler(async (req, res) => {
  getPlatformAuthConfig();
  const { challengeId, code } = req.body;

  const result = await otp.verifyChallenge(challengeId, code);
  if (!result.ok) {
    await recordPlatformAudit({ req, action: "PLATFORM_LOGIN_OTP_FAILED" });
    throw new customError("Invalid or expired code", statusCodes.UNAUTHORIZED, "OTP_INVALID");
  }

  const user = await PlatformUser.findById(result.sub);
  if (!user || !user.isActive) throw invalidCredentials();

  user.lastLoginAt = new Date();
  await user.save();

  res.cookie(REFRESH_COOKIE, signPlatformRefreshToken(user), { ...cookieOptions(), maxAge: REFRESH_MAX_AGE });
  await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGIN" });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Login successful", {
    accessToken: signPlatformAccessToken(user),
    user: user.toJSON(),
  });
});

// A fresh code for the same sign-in attempt, rate-limited so it cannot be used
// to flood the operator's phone
exports.resendOtp = asynchandeler(async (req, res) => {
  getPlatformAuthConfig();
  const { email, password, challengeId } = req.body;

  if (await otp.isTooSoonToResend(challengeId)) {
    throw new customError(
      `Please wait ${otp.RESEND_AFTER_SECONDS} seconds before asking for another code.`,
      statusCodes.TOO_MANY_REQUESTS,
      "OTP_RESEND_TOO_SOON",
    );
  }

  const user = await PlatformUser.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password)) || !user.isActive) throw invalidCredentials();

  await otp.discardChallenge(challengeId);

  let challenge;
  try {
    challenge = await otp.startChallenge(user);
  } catch (error) {
    console.error("Platform OTP could not be sent:", error.message);
    throw new customError(
      "Could not send the sign-in code. Please try again or contact support.",
      statusCodes.SERVICE_UNAVAILABLE,
      "OTP_SEND_FAILED",
    );
  }

  await recordPlatformAudit({ req, actor: user, action: "PLATFORM_LOGIN_OTP_SENT" });
  return apiResponse.sendSuccess(res, statusCodes.OK, "A new sign-in code has been sent", challenge);
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

// Every operator owns their own name, email, phone and password — support included,
// which is why this is not under the superadmin-only /platform/users routes.
// Role and isActive are not here: an operator cannot promote themselves.
exports.updateMe = asynchandeler(async (req, res) => {
  const { name, email, phone, currentPassword, password } = req.body;
  const user = await PlatformUser.findById(req.platformUser._id).select("+password");
  if (!user) throw new customError("Platform user not found", statusCodes.NOT_FOUND);

  // Changing the email, the phone (where the sign-in code goes) or the password
  // proves the current password first: a console left open must not be enough
  // to take the account over.
  const sensitive = password || (email && email !== user.email) || (phone && phone !== user.phone);
  if (sensitive && !(await user.comparePassword(currentPassword))) {
    throw new customError("Your current password is incorrect", statusCodes.UNAUTHORIZED);
  }

  if (email && email !== user.email) {
    const taken = await PlatformUser.exists({ email, _id: { $ne: user._id } });
    if (taken) throw new customError("That email is already in use", statusCodes.CONFLICT);
    user.email = email;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  let passwordChanged = false;
  if (password) {
    user.password = password;
    passwordChanged = true;
    // A new password ends every other session; this one is reissued below.
    user.tokenVersion += 1;
  }

  await user.save();
  await recordPlatformAudit({ req, actor: user, action: "PLATFORM_PROFILE_UPDATED" });

  // The old tokens no longer verify, so hand this device a matching pair back
  // rather than signing the operator out of the console they are working in.
  if (passwordChanged) {
    res.cookie(REFRESH_COOKIE, signPlatformRefreshToken(user), { ...cookieOptions(), maxAge: REFRESH_MAX_AGE });
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Profile updated", {
    user: user.toJSON(),
    accessToken: passwordChanged ? signPlatformAccessToken(user) : null,
  });
});
