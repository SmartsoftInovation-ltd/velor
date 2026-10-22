const User = require("../models/user.model");
const StoreInformation = require("../models/storeInformation.model");
const Banner = require("../models/banner.model");
const DiscountBanner = require("../models/discountbanner.model");
const { buildCacheKey, getCache, setCache } = require("../utils/cache.util");
const Order = require("../models/order.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { signInIdentifier } = require("../utils/signInIdentifier.util");
const { statusCodes, PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE } = require("../constant/constant");
const { getTenantId } = require("../tenancy/context");

/**
 * Storefront accounts, as distinct from dashboard staff.
 *
 * The store is never named in the body here. It comes from the hostname the
 * visitor arrived on, resolved upstream into the tenant context, so a shopper
 * cannot address another store by editing a request. That is also why these
 * endpoints are separate from `/auth/*`, which takes an explicit `workspace`
 * field because dashboard staff choose their store at sign-in.
 *
 * Accounts created here hold no roles, which is what makes their tokens carry
 * `aud: "shopper"` and keeps them out of the dashboard API.
 */

const requireStore = () => {
  const tenantId = getTenantId();
  if (!tenantId) {
    throw new customError(
      "No store named for this request",
      statusCodes.BAD_REQUEST,
      "TENANT_CONTEXT_REQUIRED",
    );
  }
  return tenantId;
};

// What a shopper may see about themselves — never the password or the roles
// machinery, which has no meaning for a storefront account.
const shopperSummary = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  image: user.image ?? null,
});

const issueSession = (user) => ({
  accessToken: user.generateJwtAccessToken(),
  refreshToken: user.generateJwtRefreshToken(),
});

/**
 * Who this storefront belongs to: the store resolved from the hostname, with
 * the name and logo the seller set in Store Information. Public, because the
 * shop header needs it before anyone signs in, and limited to branding.
 */
exports.store = asynchandeler(async (req, res) => {
  requireStore();
  const info = await StoreInformation.findOne().select("storeName image").lean();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store", {
    name: info?.storeName || req.tenant?.name || "",
    logo: info?.image?.url || "",
  });
});

/**
 * The home page slider: this store's active banners with an uploaded image,
 * priority 1 first. Shares the dashboard's "banner" cache namespace, so adding
 * or editing a banner there refreshes this list too.
 */
exports.banners = asynchandeler(async (req, res) => {
  requireStore();
  const cacheKey = await buildCacheKey("banner", "storefront");
  let banners = await getCache(cacheKey);

  if (!banners) {
    const rows = await Banner.find({ isActive: true, "image.url": { $nin: ["", null] } })
      .sort({ priority: 1, createdAt: -1 })
      .select("title slug headLine description link image.url")
      .lean();
    banners = rows.map((b) => ({
      _id: b._id,
      slug: b.slug,
      title: b.title,
      headLine: b.headLine || "",
      description: b.description || "",
      link: b.link || "",
      image: b.image.url,
    }));
    await setCache(cacheKey, banners, 60 * 60);
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Banners", { banners });
});

/**
 * The home page promo banner: the store's first active "Promo Banner"
 * (dashboard: Website Management → Promo Banner, stored as DiscountBanner)
 * with an uploaded image, priority 1 first. null when there is none. Shares
 * the dashboard's cache namespace, so an edit there shows on the next visit.
 */
exports.promoBanner = asynchandeler(async (req, res) => {
  requireStore();
  const cacheKey = await buildCacheKey("discountBanner", "storefront");
  let banner = await getCache(cacheKey);

  if (banner === null || banner === undefined) {
    const row = await DiscountBanner.findOne({ isActive: true, "image.url": { $nin: ["", null] } })
      .sort({ priority: 1, createdAt: -1 })
      .select("title headLine description link image.url")
      .lean();
    // Cached as false for "none", so an empty store does not query every visit
    banner = row
      ? { _id: row._id, title: row.title, headLine: row.headLine || "", description: row.description || "", link: row.link || "", image: row.image.url }
      : false;
    await setCache(cacheKey, banner, 60 * 60);
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Promo banner", { banner: banner || null });
});

exports.register = asynchandeler(async (req, res) => {
  requireStore();

  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const phone = req.body.phone?.trim();
  const { password } = req.body;

  if (!name || !password || (!email && !phone)) {
    throw new customError("Name, password and an email or phone are required", statusCodes.BAD_REQUEST);
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
  }

  // Scoped by the plugin, so the same address may hold an account in another
  // store without collision.
  const existing = await User.findOne({ $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] })
    .select("_id")
    .lean();
  if (existing) {
    throw new customError("An account with these details already exists", statusCodes.CONFLICT);
  }

  // roles is left empty: that is what makes this a shopper rather than staff
  const user = await User.create({ name, email, phone, password, roles: [] });

  return apiResponse.sendSuccess(res, statusCodes.CREATED, "Account created", {
    user: shopperSummary(user),
    ...issueSession(user),
  });
});

exports.login = asynchandeler(async (req, res) => {
  requireStore();

  const identifier = signInIdentifier(req.body);
  const { password } = req.body;

  if (!identifier || typeof password !== "string" || !password) {
    throw new customError("Email or phone and password are required", statusCodes.BAD_REQUEST);
  }

  const user = await User.findOne(identifier)
    .populate("roles")
    .select("+password");

  // An unknown account and a wrong password answer alike, so this endpoint
  // cannot be used to discover who shops here.
  const invalid = new customError("Invalid credentials", statusCodes.BAD_REQUEST);
  if (!user) throw invalid;
  if (!(await user.comparePassword(password))) throw invalid;

  if (user.isBlocked || !user.isActive) {
    throw new customError("Your account is no longer active", statusCodes.FORBIDDEN);
  }

  /**
   * Staff accounts are refused here even with the right password. Their tokens
   * would carry `aud: "staff"`, so signing in on the storefront would hand a
   * dashboard session to whatever page the shopper is on.
   */
  if (user.roles?.length) {
    throw invalid;
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Signed in", {
    user: shopperSummary(user),
    ...issueSession(user),
  });
});

exports.me = asynchandeler(async (req, res) =>
  apiResponse.sendSuccess(res, statusCodes.OK, "Profile", { user: shopperSummary(req.user) }),
);

/**
 * The shopper's own orders. Filtered by `user` as well as being tenant-scoped
 * by the plugin, so one customer cannot read another's history in the same shop.
 */
exports.myOrders = asynchandeler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Orders", { orders });
});

exports.myOrder = asynchandeler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  // Someone else's order is reported as missing rather than forbidden: a 403
  // would confirm that the id exists.
  if (!order) throw new customError("Order not found", statusCodes.NOT_FOUND);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Order", { order });
});
