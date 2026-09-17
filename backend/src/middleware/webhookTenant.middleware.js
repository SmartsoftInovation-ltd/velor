const Tenant = require("../models/platform/tenant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { runForTenant } = require("../tenancy/context");

// Opens the tenant context for provider callbacks from the :webhookKey path param
const resolveWebhookTenant = asynchandeler(async (req, res, next) => {
  const tenant = await Tenant.findOne({ webhookKey: req.params.webhookKey }).select("_id status").lean();
  if (!tenant || tenant.status === "cancelled") {
    throw new customError("Not found", statusCodes.NOT_FOUND);
  }
  req.tenant = tenant;
  runForTenant(tenant._id, () => next());
});

module.exports = { resolveWebhookTenant };
