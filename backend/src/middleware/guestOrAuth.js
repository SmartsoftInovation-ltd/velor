const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
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

  // If no valid token, check for guestId
  if (guestId) {
    req.guestId = guestId;
    return next();
  }

  // If neither exists
  throw new customError("Authentication required or x-guest-id header missing", 401);
});
