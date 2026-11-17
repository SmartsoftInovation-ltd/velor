const Tenant = require("../../models/platform/tenant.model");
const SiteInformation = require("../../models/siteInformation.model");
const { customError } = require("../../lib/CustomError");
const { asynchandeler } = require("../../lib/asyncHandeler");
const { apiResponse } = require("../../utils/apiResponse");
const { statusCodes } = require("../../constant/constant");
const { runForTenant, getTenantId } = require("../../tenancy/context");
const { recordPlatformAudit } = require("../../service/platformAudit.service");
const { bumpNsVersion } = require("../../utils/cache.util");
const { imageQueue } = require("../../queues/image.queue");

/**
 * A seller's logo is the image on their Site Information record, the same one
 * the seller uploads from Settings → Site Information. The storefront reads it
 * from there, so the Platform Console writes the same field instead of keeping
 * a copy of its own.
 */

const OBJECT_ID = /^[a-f0-9]{24}$/i;
// Site Information caches under this namespace (see siteinformation.controller)
const SITE_INFO_NS = "siteinformation";

const logoOf = (store) => ({
  url: store?.image?.url || "",
  status: store?.image?.status || "",
  lastError: store?.image?.lastError || "",
  hasSiteInformation: Boolean(store),
});

/**
 * Runs the rest of the request inside the seller's tenant scope, so the upload
 * middleware checks that seller's Cloudinary account and the queued job carries
 * their tenantId. Also rejects an unknown seller before any file is written.
 */
exports.forTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    if (!OBJECT_ID.test(tenantId)) throw new customError("Invalid tenantId", statusCodes.BAD_REQUEST);
    const tenant = await Tenant.findById(tenantId).select("_id").lean();
    if (!tenant) throw new customError("Tenant not found", statusCodes.NOT_FOUND);
    runForTenant(tenant._id, () => next());
  } catch (error) {
    next(error);
  }
};

exports.getLogo = asynchandeler(async (req, res) => {
  const store = await SiteInformation.findOne().select("image").lean();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store logo", logoOf(store));
});

exports.updateLogo = asynchandeler(async (req, res) => {
  if (!req.file) throw new customError("Please choose a logo image", statusCodes.BAD_REQUEST);

  const store = await SiteInformation.findOne();
  if (!store) {
    throw new customError(
      "This seller has no Site Information yet. Create it from the seller's dashboard first.",
      statusCodes.CONFLICT,
    );
  }

  const oldPublicId = store.image?.publicId || null;
  const oldCloudName = store.image?.cloudName || null;
  store.image.status = "pending";
  store.image.localPath = req.file.path;
  store.image.tries = 0;
  store.image.lastError = "";
  await store.save();

  await imageQueue.add("update-siteinformation-image", {
    modelName: "siteinformation",
    documentId: store._id,
    localPath: req.file.path,
    oldPublicId,
    oldCloudName,
  });
  await bumpNsVersion(SITE_INFO_NS);

  await recordPlatformAudit({
    req,
    actor: req.platformUser,
    action: "TENANT_LOGO_UPDATED",
    tenantId: getTenantId(),
    metadata: { fileName: req.file.originalname },
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Logo uploaded. It goes live once processing finishes.", logoOf(store));
});
