const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const ReturnPolicy = require("../models/returnPolicy.model");
const { statusCodes } = require("../constant/constant");
const { cleanRichText, isBlankRichText } = require("../utils/richText.util");
const { getTenantId } = require("../tenancy/context");
const { getCache, setCache, bumpNsVersion, buildCacheKey } = require("@/utils/cache.util");

const NS = "returnPolicy";
const CACHE_TTL = 60 * 60;
// Far more than a policy needs; keeps one request from storing megabytes
const MAX_LENGTH = 50000;

// The stored policy as the API answers it; an unwritten one is empty, not a 404
const policyOf = (doc) => ({ content: doc?.content || "", updatedAt: doc?.updatedAt || null });

// @desc  The store's return policy, for the dashboard editor
exports.getReturnPolicy = asynchandeler(async (_req, res) => {
  const doc = await ReturnPolicy.findOne().select("content updatedAt").lean();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Return policy", policyOf(doc));
});

// @desc  Save the return policy (one per store); empty content clears it
exports.saveReturnPolicy = asynchandeler(async (req, res) => {
  const raw = req.body?.content;
  if (typeof raw !== "string") throw new customError("Return policy content is required", statusCodes.BAD_REQUEST);
  if (raw.length > MAX_LENGTH) throw new customError("Return policy is too long", statusCodes.BAD_REQUEST);

  const cleaned = cleanRichText(raw);
  const content = isBlankRichText(cleaned) ? "" : cleaned;

  const doc = await ReturnPolicy.findOneAndUpdate(
    {},
    { $set: { content, updatedBy: req.user?._id || null } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  await bumpNsVersion(NS);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Return policy saved", policyOf(doc));
});

// @desc  Storefront: the policy shown on /returns. Public.
exports.shopReturnPolicy = asynchandeler(async (_req, res) => {
  if (!getTenantId()) {
    throw new customError("No store named for this request", statusCodes.BAD_REQUEST, "TENANT_CONTEXT_REQUIRED");
  }
  const cacheKey = await buildCacheKey(NS, "storefront");
  let policy = await getCache(cacheKey);
  if (!policy) {
    const doc = await ReturnPolicy.findOne().select("content updatedAt").lean();
    // Cleaned again on the way out: the storefront prints this as HTML
    policy = { ...policyOf(doc), content: cleanRichText(doc?.content) };
    await setCache(cacheKey, policy, CACHE_TTL);
  }
  return apiResponse.sendSuccess(res, statusCodes.OK, "Return policy", policy);
});
