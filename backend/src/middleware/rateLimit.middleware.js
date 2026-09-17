const rateLimit = require("express-rate-limit");
const { statusCodes } = require("../constant/constant");

// Brute-force protection for the authentication endpoints.
//
// Passwords here have a 4-character minimum, so an unthrottled login endpoint
// is guessable in a very small number of attempts. These limiters are the only
// thing standing between that policy and an online brute-force, so they are
// deliberately tighter than the global app limiter.
//
// Counting is per IP + per account identifier, so one attacker hammering many
// accounts from a single IP is stopped, and a shared-NAT office does not lock
// itself out because one colleague mistyped a password.

const clientIp = (req) => req.ip || req.socket?.remoteAddress || "unknown";

// The account being targeted, normalized the same way login does before it
// queries. Falls back to a constant so a body-less request still gets counted.
const accountKey = (req) => {
  const email = req.body?.email?.trim?.().toLowerCase();
  const phone = req.body?.phone?.trim?.();
  return email || phone || "no-identifier";
};

const tooMany = (message) => (req, res, next, options) => {
  res.status(options.statusCode).json({
    statusCode: options.statusCode,
    message,
  });
};

// Failed sign-ins only. `skipSuccessfulRequests` means a legitimate user who
// signs in correctly never burns quota, so the limit is only ever reached by a
// run of wrong passwords.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `login:${clientIp(req)}:${req.body?.workspace || "-"}:${accountKey(req)}`,
  handler: tooMany(
    "Too many failed sign-in attempts. Please try again in 15 minutes.",
  ),
});

// Password reset (SMS code) and email verification both send a message and mint
// a token, so they are rate limited on success too — otherwise the endpoint is
// an SMS/email bomb and a token-generation oracle.
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `reset:${clientIp(req)}:${accountKey(req)}`,
  handler: tooMany(
    "Too many password reset requests. Please try again in an hour.",
  ),
});

// Submitting a reset code. Each code also burns after a few wrong guesses
// (user.controller), this caps guessing across codes and accounts per IP.
const resetSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `reset-submit:${clientIp(req)}`,
  handler: tooMany("Too many attempts. Please try again in 15 minutes."),
});

// Self-serve registration, per IP. Stops automated account creation without
// getting in the way of a real person signing up.
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `register:${clientIp(req)}`,
  handler: tooMany(
    "Too many accounts created from this address. Please try again later.",
  ),
});

// Changing a password requires the old one, so this is a brute-force surface
// for an attacker holding a stolen access token.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `change-password:${req.user?._id || clientIp(req)}`,
  handler: tooMany(
    "Too many password change attempts. Please try again in 15 minutes.",
  ),
});

// Platform operator sign-in: same policy as tenant login, separate counter
const platformLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `platform-login:${clientIp(req)}:${accountKey(req)}`,
  handler: tooMany(
    "Too many failed sign-in attempts. Please try again in 15 minutes.",
  ),
});

module.exports = {
  platformLoginLimiter,
  loginLimiter,
  passwordResetLimiter,
  resetSubmitLimiter,
  registerLimiter,
  changePasswordLimiter,
};
