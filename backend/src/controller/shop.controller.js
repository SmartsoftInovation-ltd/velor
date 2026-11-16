const jwt = require("jsonwebtoken");
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
const { SHOPPER, isShopper } = require("../utils/accountType.util");
const { getSettings, getFeatures } = require("../settings/settings.service");
const { imageQueue } = require("../queues/image.queue");
const { RESET_CODE_TTL_SECONDS, findByEmailOrPhone, sendResetCode, checkResetCode } = require("../service/passwordReset.service");

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
  // The photo's URL once the image worker has uploaded it
  image: user.image?.url || null,
  // True while a new photo is still on its way to image storage
  // (an empty image also carries the schema's default status, so a file must be waiting)
  imagePending: Boolean(user.image?.localPath) && ["pending", "processing"].includes(user.image?.status),
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
// The look a seller picked in the Platform Console; the storefront reads it here
const STOREFRONT_DESIGN_FIELDS = [
  "bannerLayout",
  "cardLayout",
  "gridColumns",
  "categoryLayout",
  "galleryPosition",
  "thumbnailPosition",
  "filterLayout",
  "footerLayout",
  "buttonStyle",
  "menuColor",
  "menuAlign",
  "announcementEnabled",
  "announcementText",
];

/**
 * Store Information fields the storefront shows, as it names them. Public by
 * nature: the seller enters them to be found (footer, contact page, chat).
 */
const CONTACT_FIELDS = {
  slogan: "propiterSlogan",
  businessType: "businessType",
  address: "adress",
  phone: "phone",
  secondaryPhone: "secondaryPhone",
  email: "email",
  businessHours: "businessHours",
  googleMapLink: "googleMapLink",
  facebookLink: "facebookLink",
  instagramLink: "instagramLink",
  whatsappLink: "whatsappLink",
  messengerLink: "messengerLink",
  youtubeLink: "youtubeLink",
  twitterLink: "twitterLink",
  linkedinLink: "linkedinLink",
};

exports.store = asynchandeler(async (req, res) => {
  requireStore();
  const [info, settings] = await Promise.all([
    StoreInformation.findOne().select(`storeName image ${Object.values(CONTACT_FIELDS).join(" ")}`).lean(),
    getSettings(getTenantId()),
  ]);
  return apiResponse.sendSuccess(res, statusCodes.OK, "Store", {
    // The storefront keys the browser's cart and wishlist by it. Safe to show:
    // no storefront endpoint accepts it, the store always comes from the domain.
    id: String(getTenantId()),
    name: info?.storeName || req.tenant?.name || "",
    logo: info?.image?.url || "",
    primaryColor: settings.general.primaryColor || "",
    ...Object.fromEntries(STOREFRONT_DESIGN_FIELDS.map((field) => [field, settings.general[field]])),
    // Contact details and social links, for the footer and the chat button
    ...Object.fromEntries(Object.entries(CONTACT_FIELDS).map(([out, field]) => [out, info?.[field] || ""])),
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
  // Blank becomes absent: the unique email index only skips accounts with no email at all
  const email = req.body.email?.trim().toLowerCase() || undefined;
  const phone = req.body.phone?.trim() || undefined;
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

  // A shopper: these credentials work on the storefront only, never the dashboard
  const user = await User.create({ name, email, phone, password, accountType: SHOPPER, roles: [] });

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
   * Dashboard accounts are refused here even with the right password, role or
   * no role: dashboard credentials do not work on the storefront. Their tokens
   * would also carry `aud: "staff"`, handing a dashboard session to whatever
   * page the shopper is on.
   */
  if (!isShopper(user)) {
    throw invalid;
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "Signed in", {
    user: shopperSummary(user),
    ...issueSession(user),
  });
});

/**
 * Swaps a shopper's refresh token for a fresh pair, so a storefront session
 * outlives the one-day access token. The storefront server sends the token in
 * the body; it lives in an httpOnly cookie on the shop's domain, which the
 * browser never sends here.
 *
 * Nothing is stored: the token is checked by signature and expiry, and is
 * revoked the same way access tokens are, by bumping `tokenVersion` (password
 * change or reset, deactivation). A token is honoured only in the store it was
 * issued for, only for a shopper, and only while the account is active. Every
 * refusal answers 401 alike, so the storefront simply asks the shopper to
 * sign in again.
 */
exports.refresh = asynchandeler(async (req, res) => {
  const tenantId = requireStore();
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken.trim() : "";
  const refused = new customError("Session expired. Please sign in again.", statusCodes.UNAUTHORIZED);
  if (!token) throw refused;

  let claims;
  try {
    claims = jwt.verify(token, process.env.REFRESH_TOKEN_SCCERET);
  } catch {
    throw refused;
  }

  // Tokens without an audience predate shopper sessions and belong to staff
  if (claims.aud !== "shopper" || !claims.sub || String(claims.tid) !== String(tenantId)) throw refused;

  // Scoped to this store by the tenancy plugin
  const user = await User.findById(claims.sub).populate("roles");
  if (!isShopper(user) || user.isBlocked || !user.isActive) throw refused;
  if ((claims.tv ?? 0) !== (user.tokenVersion ?? 0)) throw refused;

  return apiResponse.sendSuccess(res, statusCodes.OK, "Session renewed", issueSession(user));
});

/**
 * Forgotten password, by a 6-digit code sent to the account's mobile number.
 *
 * Three steps: ask for a code, check it (so the shopper learns about a typo
 * before choosing a password), then set the new password with the same code.
 * Only shopper accounts of this store are served. An unknown number, a staff
 * account or a blocked one gets the same "sent" answer as a real one and no
 * SMS, so these endpoints cannot be used to find out who shops here.
 */
const BD_MOBILE = /^01[3-9]\d{8}$/;

const resetPhoneOf = (body) => {
  const phone = typeof body?.phone === "string" ? body.phone.replace(/[\s-]/g, "").replace(/^\+?880/, "0") : "";
  if (!BD_MOBILE.test(phone)) {
    throw new customError("Enter an 11-digit mobile number, like 01712345678", statusCodes.BAD_REQUEST);
  }
  return phone;
};

// The shopper who may reset with this number, or null
const resettableShopper = async (phone) => {
  const user = await findByEmailOrPhone({ phone })?.populate("roles");
  if (!isShopper(user) || user.isBlocked || !user.isActive) return null;
  return user;
};

const wrongCode = () => new customError("That code is wrong or has expired. Check it, or ask for a new one.", statusCodes.BAD_REQUEST);

exports.forgotPassword = asynchandeler(async (req, res) => {
  const tenantId = requireStore();
  const phone = resetPhoneOf(req.body);

  if (!(await getFeatures(tenantId)).sms) {
    throw new customError(
      "This shop cannot send reset codes right now. Please contact the shop.",
      statusCodes.SERVICE_UNAVAILABLE,
      "SMS_NOT_CONFIGURED",
    );
  }

  const user = await resettableShopper(phone);
  if (user) {
    try {
      await sendResetCode(user, { storeName: req.tenant?.name, tag: `[shop-forgot-password] store=${tenantId}` });
    } catch {
      throw new customError("The code could not be sent just now. Please try again.", statusCodes.SERVICE_UNAVAILABLE, "SMS_SEND_FAILED");
    }
  }

  return apiResponse.sendSuccess(res, statusCodes.OK, "If an account uses this number, a code has been sent to it", {
    expiresIn: RESET_CODE_TTL_SECONDS,
  });
});

// Checks the code without using it up; a wrong one counts against it
exports.verifyResetCode = asynchandeler(async (req, res) => {
  requireStore();
  const phone = resetPhoneOf(req.body);
  const user = await resettableShopper(phone);
  if (!(await checkResetCode(user, req.body?.otp))) throw wrongCode();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Code accepted");
});

exports.resetPassword = asynchandeler(async (req, res) => {
  requireStore();
  const phone = resetPhoneOf(req.body);
  const { newPassword } = req.body;
  if (typeof newPassword !== "string" || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
  }

  const user = await resettableShopper(phone);
  if (!(await checkResetCode(user, req.body?.otp, { consume: true }))) throw wrongCode();

  user.password = newPassword;
  // Every session the old password left open ends here
  user.refreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Password reset. You can sign in with your new password.");
});

exports.me = asynchandeler(async (req, res) =>
  apiResponse.sendSuccess(res, statusCodes.OK, "Profile", { user: shopperSummary(req.user) }),
);

/**
 * The shopper changes their own name, email and phone. At least one of email
 * or phone must remain, since one of them is how they sign in. Both are
 * unique within the store, so a value another account holds is refused (409)
 * without saying whose it is.
 */
exports.updateMe = asynchandeler(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";

  if (name.length < 2) throw new customError("Enter your full name", statusCodes.BAD_REQUEST);
  if (!email && !phone) {
    throw new customError("Keep an email or a phone number to sign in with", statusCodes.BAD_REQUEST);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new customError("Enter a valid email address", statusCodes.BAD_REQUEST);
  }

  const taken = await User.findOne({
    _id: { $ne: req.user._id },
    $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
  })
    .select("email phone")
    .lean();
  if (taken) {
    const field = email && taken.email === email ? "email" : "phone number";
    throw new customError(`Another account here already uses this ${field}`, statusCodes.CONFLICT);
  }

  const user = await User.findById(req.user._id);
  user.name = name;
  // Blank becomes absent: the unique indexes only skip accounts with no value at all
  user.email = email || undefined;
  user.phone = phone || undefined;
  await user.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Profile updated", { user: shopperSummary(user) });
});

/**
 * Changes the password after checking the current one. Every other session
 * ends (tokenVersion is bumped, as on a reset); this device gets a fresh pair
 * so the shopper stays signed in where they made the change.
 */
exports.changePassword = asynchandeler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== "string" || !currentPassword) {
    throw new customError("Enter your current password", statusCodes.BAD_REQUEST);
  }
  if (typeof newPassword !== "string" || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    throw new customError("Your current password is not correct", statusCodes.BAD_REQUEST, "WRONG_PASSWORD");
  }
  if (await user.comparePassword(newPassword)) {
    throw new customError("Choose a password different from your current one", statusCodes.BAD_REQUEST);
  }

  user.password = newPassword;
  user.refreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Password changed", issueSession(user));
});

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The shopper's profile photo (multipart field "image"). The file goes to the
 * store's image storage in the background, as staff photos do; until then the
 * account reports `imagePending` and the storefront shows the initials.
 */
exports.updatePhoto = asynchandeler(async (req, res) => {
  if (!req.file) throw new customError("Choose a photo to upload", statusCodes.BAD_REQUEST);
  if (req.file.size > PHOTO_MAX_BYTES) {
    throw new customError("The photo must be 2 MB or smaller", statusCodes.BAD_REQUEST);
  }

  const user = await User.findById(req.user._id);
  const oldPublicId = user.image?.publicId || null;
  const oldCloudName = user.image?.cloudName || null;
  user.image = { ...(user.image?.toObject?.() ?? {}), status: "pending", localPath: req.file.path, tries: 0, lastError: "" };
  await user.save();

  await imageQueue.add("update-user-image", {
    modelName: "user",
    documentId: user._id,
    localPath: req.file.path,
    oldPublicId,
    oldCloudName,
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Photo uploading", { user: shopperSummary(user) });
});

// Removes the photo; the account shows initials again
exports.removePhoto = asynchandeler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const publicId = user.image?.publicId;
  if (publicId) {
    await imageQueue.add("delete-cloudinary-image", { publicId, cloudName: user.image?.cloudName });
  }
  user.image = {};
  await user.save();
  return apiResponse.sendSuccess(res, statusCodes.OK, "Photo removed", { user: shopperSummary(user) });
});

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
