const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
require("../models/permisson.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { runForTenant, runAsPlatform, getTenantId } = require("../tenancy/context");
const { getTenantById, assertTenantActive } = require("../tenancy/tenantResolver");

const unauthorized = (message = "Unauthorized") => new customError(message, statusCodes.UNAUTHORIZED);

const readToken = (req) => {
  const token = req.headers?.authorization?.replace("Bearer ", "") || req.body?.token;
  return token && token !== "null" && token !== "undefined" ? token : null;
};

const legacyGraceActive = () => {
  const until = Date.parse(process.env.LEGACY_TOKEN_GRACE_UNTIL || "");
  return Number.isFinite(until) && Date.now() <= until;
};

/**
 * Verifies an access token and resolves its tenant.
 * Tokens carry { sub, tid, tv }. Tokens issued before multi-tenancy carry only
 * { id, email, ... }: they are accepted until LEGACY_TOKEN_GRACE_UNTIL for users
 * already moved into a tenant, and never for users without one — a session with
 * no tenant would read and write across every store.
 */
const resolveTokenSession = async (token, loadUser, { audience } = {}) => {
  // `audience` is checked by hand rather than through jwt.verify's own option,
  // because tokens issued before the claim existed carry no `aud` at all and
  // must keep working for the length of the grace period.
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  const userId = decoded.sub || decoded.id;
  if (!userId) throw unauthorized("Invalid token");

  /**
   * A shopper and a staff member are both `User` rows in the same store, so the
   * token alone decides which API a session may reach. Treating a token with no
   * audience as "staff" preserves existing dashboard sessions; a shopper token
   * is always minted with `aud: "shopper"`, so it can never pass a staff check.
   */
  if (audience && (decoded.aud ?? "staff") !== audience) {
    throw unauthorized("This session cannot be used here");
  }

  let tenantId = decoded.tid;
  if (!tenantId) {
    const legacy = await runAsPlatform(() => User.findById(userId).select("tenantId").lean());
    if (!legacy) throw unauthorized("User not found");
    if (!legacy.tenantId || !legacyGraceActive()) {
      throw unauthorized("Session expired. Please sign in again.");
    }
    tenantId = legacy.tenantId;
  }

  const tenant = assertTenantActive(await getTenantById(tenantId));

  const requestTenant = getTenantId();
  if (requestTenant && !requestTenant.equals(tenant._id)) {
    throw unauthorized("This session belongs to a different store");
  }

  const user = await runForTenant(tenant._id, () => loadUser(userId));
  if (!user) throw unauthorized("User not found");
  // Checked for legacy tokens too (tv absent reads as 0), so bumping tokenVersion
  // revokes every live session, not only the ones carrying a tenant claim.
  if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw unauthorized("Session expired. Please sign in again.");
  }

  return { user, tenant };
};

// Continues the request inside the session's tenant
const continueInTenant = (tenant, next) => (tenant ? runForTenant(tenant._id, () => next()) : next());

exports.resolveTokenSession = resolveTokenSession;

exports.authGuard = asynchandeler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    throw new customError("Token not found or Invalid / Token Required", 401);
  }

  const { user, tenant } = await resolveTokenSession(
    token,
    (id) =>
      User.findById(id)
        .populate({
          path: "roles",
          populate: { path: "permissions.permission" },
        })
        .populate("permissions.permission")
        .populate("createdBy")
        .select(
          "-__v -wishList -cart -newsLetterSubscribe -refreshToken -password -twoFactorEnabled",
        ),
    // Everything behind this guard is dashboard surface; a storefront session
    // must not reach it even though it belongs to the same store.
    { audience: "staff" },
  );

  // Revoke live sessions the moment an account is deactivated or blocked.
  // 401 (not 403) so the client's interceptor treats it as an auth failure:
  // its refresh attempt is rejected too, which signs the user out.
  if (user.isBlocked || !user.isActive) {
    throw new customError("Your account is no longer active", 401);
  }

  req.user = user;
  if (tenant) req.tenant = tenant;
  continueInTenant(tenant, next);
});

/**
 * Identifies the caller when they present a token, and lets them through when
 * they do not.
 *
 * Some routes serve the storefront and the dashboard at once: a shopper browses
 * the catalogue anonymously, while staff open the same endpoint from the
 * dashboard. Those handlers need to know which one they are answering — staff
 * see cost prices, shoppers must not — but cannot demand a token, because most
 * callers legitimately have none.
 *
 * An invalid or expired token is treated as "no token" rather than an error:
 * the route is public, so a stale session should still show the shop, just
 * without the staff-only figures.
 */
const optionalAuth = asynchandeler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();

  let session;
  try {
    session = await resolveTokenSession(token, (id) =>
      User.findById(id).select("_id tokenVersion isActive isBlocked"),
    );
  } catch {
    return next(); // anonymous, not rejected
  }

  const { user, tenant } = session;
  if (!user || user.isActive === false || user.isBlocked) return next();

  req.user = user;
  if (tenant) req.tenant = tenant;
  return continueInTenant(tenant, next);
});

/**
 * Requires a signed-in shopper: a storefront customer, never dashboard staff.
 *
 * The mirror of `authGuard`'s staff check. A staff token presented here is
 * refused as well, so the two sessions stay strictly separate in both
 * directions rather than only blocking the more obvious escalation.
 */
const shopperGuard = asynchandeler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw unauthorized("Sign in to continue");

  const { user, tenant } = await resolveTokenSession(
    token,
    (id) => User.findById(id).select("-__v -refreshToken -password"),
    { audience: "shopper" },
  );

  if (user.isBlocked || !user.isActive) {
    throw new customError("Your account is no longer active", 401);
  }

  req.user = user;
  if (tenant) req.tenant = tenant;
  return continueInTenant(tenant, next);
});

exports.shopperGuard = shopperGuard;
exports.optionalAuth = optionalAuth;
exports.continueInTenant = continueInTenant;
exports.readToken = readToken;
