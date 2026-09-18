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
const resolveTokenSession = async (token, loadUser) => {
  const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  const userId = decoded.sub || decoded.id;
  if (!userId) throw unauthorized("Invalid token");

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

  const { user, tenant } = await resolveTokenSession(token, (id) =>
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

exports.continueInTenant = continueInTenant;
exports.readToken = readToken;
