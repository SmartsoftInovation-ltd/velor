const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");
const { resolveTokenSession, continueInTenant, readToken } = require("./authMiddleware");

exports.guestOrAuth = asynchandeler(async (req, res, next) => {
  const token = readToken(req);
  const guestId = req.headers["x-guest-id"] || req.body?.guestId;

  if (token) {
    let session;
    try {
      session = await resolveTokenSession(token, (id) => User.findById(id).select("_id tokenVersion"));
    } catch (error) {
      throw new customError(error.code ? error.message : "Invalid or expired token", 401, error.code);
    }
    req.user = session.user;
    if (session.tenant) req.tenant = session.tenant;
    return continueInTenant(session.tenant, next);
  }

  /**
   * A guest carries no token, so nothing here names their store — the tenant
   * context must already have been opened upstream, from the storefront's
   * hostname or the `x-tenant` header.
   *
   * Checking for it means a missing store is reported as exactly that. Left
   * unchecked, the request would run on to the first query and fail inside the
   * tenancy plugin, which reads as an internal error and tells the caller
   * nothing about what was actually missing.
   */
  if (guestId) {
    if (!getTenantId()) {
      throw new customError(
        "No store named for this request",
        statusCodes.BAD_REQUEST,
        "TENANT_CONTEXT_REQUIRED",
      );
    }
    req.guestId = guestId;
    return next();
  }

  // If neither exists
  throw new customError("Authentication required or x-guest-id header missing", 401);
});
