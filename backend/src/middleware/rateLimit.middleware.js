const rateLimit = require("express-rate-limit");
const { MemoryStore } = rateLimit;
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

// Each limiter gets its own store, kept here so tests can clear them all
const stores = [];
const newStore = () => {
  const store = new MemoryStore();
  stores.push(store);
  return store;
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
  store: newStore(),
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
  store: newStore(),
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
  store: newStore(),
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
  store: newStore(),
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
  store: newStore(),
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
  store: newStore(),
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

// Submitting or resending the operator's SMS code. Counted per challenge rather
// than per IP: the OTP body carries no account identifier, so an IP-only counter
// would let one operator's wrong codes lock out every other operator behind the
// same address — and lock out the password step with them.
const platformOtpLimiter = rateLimit({
  store: newStore(),
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `platform-otp:${clientIp(req)}:${req.body?.challengeId || "-"}`,
  handler: tooMany("Too many attempts. Please sign in again."),
});

// Reports and dashboard widgets each run a batch of aggregations over the whole
// store, so they cost far more than an ordinary read. The global limiter (1000
// per IP per 15 minutes) is generous enough that one script could keep the
// database busy without ever tripping it. Counted per user, not per IP, so a
// shared office address is not one shared budget.
const reportLimiter = rateLimit({
  store: newStore(),
  windowMs: 60 * 1000,
  limit: Number(process.env.REPORT_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `report:${req.user?._id || clientIp(req)}`,
  handler: tooMany("Too many report requests. Please wait a moment and try again."),
});

// The dashboard fires about 20 summary requests per load, and again each
// time the period changes, so the report limit (60 a minute) ran out after
// three clicks on the period selector. Its own, roomier budget per user.
const dashboardLimiter = rateLimit({
  store: newStore(),
  windowMs: 60 * 1000,
  limit: Number(process.env.DASHBOARD_RATE_LIMIT_MAX) || 300,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `dashboard:${req.user?._id || clientIp(req)}`,
  handler: tooMany("Too many dashboard requests. Please wait a moment and try again."),
});

// Test hook: forget every counter so one suite's attempts cannot spill into the next
/**
 * Domain verification performs a live DNS lookup, so an operator clicking
 * "verify" repeatedly while waiting for propagation would aim a burst of
 * outbound queries at the seller's nameservers. Keyed per domain so checking
 * one store's domain never blocks another's.
 */
const domainVerifyLimiter = rateLimit({
  store: newStore(),
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `domain-verify:${req.params?.domainId || clientIp(req)}`,
  handler: tooMany("Too many verification attempts. DNS changes take a few minutes to propagate."),
});

const resetRateLimitCounters = () => stores.forEach((store) => store.resetAll());

// Product search is public (the storefront calls it without a token), so it
// is capped per caller: generous for search-as-you-type, too low to keep the
// catalogue busy on purpose. Signed-in staff are counted per account.
const searchLimiter = rateLimit({
  store: newStore(),
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `search:${req.user?._id || clientIp(req)}`,
  handler: tooMany("Too many searches. Please wait a moment and try again."),
});

// Coupon codes are guessable, so wrong codes are capped per shopper. Storefront
// calls arrive from the shop's server, which shares one IP for every shopper,
// so the shopper's own id (account or guest) is the key, the IP the fallback.
const couponLimiter = rateLimit({
  store: newStore(),
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  statusCode: statusCodes.TOO_MANY_REQUESTS,
  keyGenerator: (req) => `coupon:${req.user?._id || req.guestId || clientIp(req)}`,
  handler: tooMany("Too many coupon attempts. Please try again in 15 minutes."),
});

module.exports = {
  couponLimiter,
  searchLimiter,
  reportLimiter,
  dashboardLimiter,
  domainVerifyLimiter,
  platformLoginLimiter,
  platformOtpLimiter,
  resetRateLimitCounters,
  loginLimiter,
  passwordResetLimiter,
  resetSubmitLimiter,
  registerLimiter,
  changePasswordLimiter,
};
