const { customError } = require("../lib/CustomError");

// Single-tenant callback URLs (replaced by /api/v1/hooks/<provider>/:webhookKey).
// Kept working while stores migrate; gone once the platform runs in strict mode.
const legacyRoute = (req, res, next) => {
  if (process.env.TENANCY_MODE !== "strict") return next();
  next(new customError("This URL was replaced by the store's own webhook URL", 410, "LEGACY_ROUTE_REMOVED"));
};

module.exports = { legacyRoute };
