const User = require("../models/user.model");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../helpers/nodemailer");
const { getGeneralConfig } = require("../integrations/config");
const { getTenantId, runAsPlatform } = require("../tenancy/context");
const { sendSMS } = require("../helpers/sms");
const { getTenantById, assertTenantActive } = require("../tenancy/tenantResolver");
const { getFeatures } = require("../settings/settings.service");
const rbac = require("../tenancy/rbac");
const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { validateUser } = require("../validation/user.validation");
const { asynchandeler } = require("../lib/asyncHandeler");
const { isProduction } = require("../config/nodeEnv");
const { signInIdentifier } = require("../utils/signInIdentifier.util");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const {
  statusCodes,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
} = require("../constant/constant");
const { imageQueue } = require("@/queues/image.queue");
const { cache: redis } = require("@/config/redis.config");
const { logAudit } = require("@/service/audit.service");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/utils/cache.util");

const CACHE_TTL = 60 * 60; // 1 hour

const NS = "user";

// Excluded from every user list and lookup: credentials, tokens, reset state
const SECRET_FIELDS_SELECT =
  "-password -refreshToken -resetPasswordToken -resetPasswordExpires -resetPasswordAttempts -emailVerificationToken -emailVerificationExpires -tokenVersion";

// A user document as it may leave the API: no password hash, tokens or reset state
const withoutSecrets = (user) => {
  const {
    password,
    refreshToken,
    resetPasswordToken,
    resetPasswordExpires,
    resetPasswordAttempts,
    emailVerificationToken,
    emailVerificationExpires,
    tokenVersion,
    ...rest
  } = user.toObject();
  return rest;
};
// user registraion/ or add user
exports.registerUser = asynchandeler(async (req, res) => {
  // Validate input
  const value = await validateUser(req);
  const { name, email, password, phone, image } = value;

  // Check if user already exists
  const existingUser = await User.findOne({ $or: [{ email }, ...(phone ? [{ phone }] : [])] });
  if (existingUser) {
    throw new customError(
      "Email or phone already in use",
      statusCodes.BAD_REQUEST,
    );
  }

  // Create user
  const user = new User({
    name,
    email,
    password,
    phone,
    image: image || null,
    roles: [],
    permissions: [],
  });

  await user.save();

  // again find user
  const userObj = await User.findById(user._id)
    .populate({
      path: "roles",
      select: "-__v -createdAt -updatedAt",
    })
    .populate("permissions")
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -updatedAt -wishList -cart -newsLetterSubscribe -lastlogin -lastLogout -createdAt -refreshToken -twoFactorEnabled -newsLetterSubscribe -isEmailVerified -isPhoneVerified",
    );
  userObj.isEmailVerified = false;
  userObj.isPhoneVerified = false;
  await userObj.save();
  return apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Registration successful",
    userObj,
  );
});

// Refresh cookie policy. Production defaults to SameSite=none, because the
// dashboard and the API are usually different origins and "lax" would stop the
// browser sending the cookie at all — staff would be signed out at every expiry.
// AUTH_COOKIE_SAMESITE overrides it for a same-site deployment.
const cookieSameSite = () =>
  process.env.AUTH_COOKIE_SAMESITE || (isProduction() ? "none" : "lax");

// Browsers reject SameSite=none without Secure, so the pair is decided together
// rather than at each call site.
const refreshCookieOptions = () => {
  const sameSite = cookieSameSite();
  return {
    httpOnly: true,
    secure: isProduction() || sameSite === "none",
    sameSite,
    path: "/",
  };
};

const tenantSummary = (tenant) =>
  tenant ? { _id: tenant._id, name: tenant.name, slug: tenant.slug, status: tenant.status } : null;

exports.login = asynchandeler(async (req, res) => {
  const { password } = req.body;

  if (!getTenantId() && process.env.TENANCY_MODE === "strict") {
    throw new customError("Workspace is required", statusCodes.BAD_REQUEST, "WORKSPACE_REQUIRED");
  }

  const identifier = signInIdentifier(req.body);
  if (!identifier || typeof password !== "string" || !password) {
    throw new customError("Email or phone and password are required", statusCodes.BAD_REQUEST);
  }

  const user = await User.findOne(identifier)
    .populate("roles")
    .populate("permissions.permission")
    .select(
      "-__v -wishList -cart -newsLetterSubscribe  -lastLogout -createdAt  -twoFactorEnabled -newsLetterSubscribe -isEmailVerified -isPhoneVerified -roles -permission",
    );
  // An unknown account and a wrong password must be indistinguishable to the
  // caller, otherwise this endpoint reports which emails/phones are registered.
  if (!user) {
    throw new customError("Invalid credentials", statusCodes.BAD_REQUEST);
  }
  //check password
  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    logAudit({
      req,
      user,
      action: "LOGIN_FAILED",
      entityType: "user",
      entityId: user._id,
      entityLabel: user.email || user.phone,
    });
    throw new customError("Invalid credentials", statusCodes.BAD_REQUEST);
  }

  // Deactivated / blocked accounts may not sign in
  if (user.isBlocked) {
    throw new customError(
      "Your account has been blocked. Please contact an administrator.",
      statusCodes.FORBIDDEN,
    );
  }
  if (!user.isActive) {
    throw new customError(
      "Your account is deactivated. Please contact an administrator.",
      statusCodes.FORBIDDEN,
    );
  }

  // Dashboard sign-in (workspace given) is for staff accounts only
  if (req.workspace && !(await User.exists({ _id: user._id, "roles.0": { $exists: true } }))) {
    throw new customError(
      "This account cannot sign in to the dashboard",
      statusCodes.FORBIDDEN,
    );
  }

  // generate access token and refresh token
  const accessToken = await user.generateJwtAccessToken();
  const refreshToken = await user.generateJwtRefreshToken();

  // save refresh Token into Database
  user.refreshToken = refreshToken;
  user.lastlogin = Date.now();
  await user.save();

  logAudit({
    req,
    user,
    action: "LOGIN",
    entityType: "user",
    entityId: user._id,
    entityLabel: user.email || user.phone,
  });

  // now remove password from response
  const {
    password: userPassword,
    refreshToken: userRefreshToken,
    ...userData
  } = user.toObject();
  delete userData.userPassword;
  delete userData.userRefreshToken;

  res.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions(),
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days — matches REFRESH_TOKEN_EXPIRY
  });

  return apiResponse.sendSuccess(res, statusCodes.OK, "Login successful", {
    accessToken,
    user: userData,
    tenant: tenantSummary(req.tenant),
  });
});

// make a refresh token using cookie data or headers data
exports.refreshToken = asynchandeler(async (req, res) => {
  const refreshToken =
    (req.cookies?.refreshToken?.trim()) ||
    (req.headers["x-refresh-token"]?.trim());
  if (!refreshToken) {
    throw new customError("Refresh token not found", statusCodes.UNAUTHORIZED);
  }

  // check refresh token in database — ensures token was not revoked on logout.
  // The token itself is the secret, so the lookup is not tenant-scoped.
  const user = await runAsPlatform(() => User.findOne({ refreshToken }));
  if (!user) {
    throw new customError("Invalid refresh token", statusCodes.UNAUTHORIZED);
  }

  // verify signature + expiry
  const decoded = jwt.verify(user.refreshToken, process.env.REFRESH_TOKEN_SCCERET);

  // A suspended store signs its staff out at the next refresh
  const tenantId = decoded.tid || user.tenantId;
  if (tenantId) assertTenantActive(await getTenantById(tenantId));

  // Checked for legacy tokens too (an absent `tv` reads as 0), the same rule
  // authGuard applies. Guarding this on `decoded.tid` would let a token issued
  // before multi-tenancy renew itself forever: the new access token is built
  // from the live document, so it carries the current tokenVersion and passes
  // authGuard — bumping tokenVersion would launder the session instead of
  // ending it, and a password reset would not evict a stolen token.
  if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
    throw new customError("Session expired. Please sign in again.", statusCodes.UNAUTHORIZED);
  }

  // Deactivated / blocked accounts may not refresh into a new session
  if (user.isBlocked || !user.isActive) {
    throw new customError(
      "Your account is no longer active. Please contact an administrator.",
      statusCodes.FORBIDDEN,
    );
  }

  const accessToken = await user.generateJwtAccessToken();

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Refresh token send successful",
    { accessToken },
  );
});

//logout user
exports.logout = asynchandeler(async (req, res) => {
  const refreshToken =
    (req.cookies?.refreshToken?.trim()) ||
    (req.headers["x-refresh-token"]?.trim());

  if (refreshToken) {
    // Revoke the token in DB so it cannot be used for refresh
    await runAsPlatform(() => User.updateOne({ refreshToken }, { $set: { refreshToken: null } }));
  }

  // remove refresh token from cookie — same options, or the browser keeps it
  res.clearCookie("refreshToken", refreshCookieOptions());

  apiResponse.sendSuccess(res, statusCodes.OK, "Logout successful");
});

// send email verification
exports.sendEmailVerification = asynchandeler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const user = await User.findOne({ email });

  // Always answer the same way so this endpoint cannot be used to discover
  // which addresses have accounts.
  if (!user) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "If that email has an account, a verification link has been sent",
    );
  }

  // Generate token — kept separate from the password-reset token so the two
  // flows cannot invalidate or substitute for one another.
  const token = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = token;
  user.emailVerificationExpires = Date.now() + 1000 * 60 * 60; // 1 hour
  await user.save();

  const { storefrontUrl } = await getGeneralConfig();
  const verifyUrl = `${storefrontUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  await sendEmail(
    user.email,
    "Verify your email",
    `<a href="${verifyUrl}">Click to verify your email</a>`,
    { throwOnError: true },
  );

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "If that email has an account, a verification link has been sent",
  );
});

// verify email
exports.verifyEmail = asynchandeler(async (req, res) => {
  // Accept either shape: the route is POST, but the emailed link lands on a
  // frontend page that may forward the values as a query string.
  const token = req.body?.token || req.query?.token;
  const email = (req.body?.email || req.query?.email)?.trim().toLowerCase();

  if (!token || !email) {
    throw new customError(
      "Verification token and email are required",
      statusCodes.BAD_REQUEST,
    );
  }

  const user = await User.findOne({
    email,
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() },
  });
  if (!user)
    throw new customError("Invalid or expired token", statusCodes.BAD_REQUEST);

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  apiResponse.sendSuccess(res, statusCodes.OK, "Email verified successfully");
});

//forgot password: a one-time code by SMS, sent with the store's own SMS settings
// (set by the platform on the seller's page). The platform SMS account is only for messages to a store
// owner who has no store yet, such as the sign-in details for a new store.
// The code lives in Redis with a TTL, so it is gone from the backend the moment
// it expires; nothing is written to the user document.
const RESET_CODE_TTL_SECONDS = 3 * 60;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_SENT_MESSAGE = "If that account has a phone number, a reset code has been sent by SMS";

// Only a keyed hash of the code is stored, bound to the account
const hashResetCode = (user, code) =>
  crypto.createHmac("sha256", process.env.ACCESS_TOKEN_SECRET || "reset-code").update(`${user._id}:${code}`).digest("hex");

const resetCodeKey = (user) => `pwreset:${user.tenantId}:${user._id}`;
const resetTriesKey = (user) => `${resetCodeKey(user)}:tries`;

const clearResetCode = (user) => Promise.all([redis.del(resetCodeKey(user)), redis.del(resetTriesKey(user))]);

// Bangladeshi numbers are saved as 01XXXXXXXXX, but older accounts may carry
// the 880 / +880 prefix, so look the account up under every form
const phoneForms = (phone) => {
  const local = phone.replace(/[\s-]/g, "").replace(/^\+?880/, "0");
  return [...new Set([phone, local, `880${local.slice(1)}`, `+880${local.slice(1)}`])];
};

const findByEmailOrPhone = (body) => {
  const email = body.email?.trim().toLowerCase();
  const phone = body.phone?.trim();
  if (email) return User.findOne({ email });
  return phone ? User.findOne({ phone: { $in: phoneForms(phone) } }) : null;
};

const maskPhone = (phone) => String(phone).replace(/^(.*)(\d{3})$/, (_, head, tail) => `${head.slice(0, 3)}${"*".repeat(Math.max(0, head.length - 3))}${tail}`);

// BulkSMSBD answers HTTP 200 even when it rejects a message (unlisted IP, no
// balance, bad sender ID); its own response_code 202 is the only "accepted"
const assertSmsAccepted = (data) => {
  if (data?.response_code !== undefined && Number(data.response_code) !== 202) {
    throw new Error(data.error_message || `SMS provider responded with ${data.response_code}`);
  }
};

exports.forgotPassword = asynchandeler(async (req, res) => {
  const tenantId = getTenantId();
  if (!tenantId || !(await getFeatures(tenantId)).sms) {
    throw new customError(
      "This store has not set up SMS, so reset codes cannot be sent. Ask the platform team to set it up for this store.",
      statusCodes.SERVICE_UNAVAILABLE,
      "SMS_NOT_CONFIGURED",
    );
  }

  const user = await findByEmailOrPhone(req.body);

  // Same response whether or not the account exists — otherwise this endpoint
  // reports which accounts are registered.
  const sent = { expiresIn: RESET_CODE_TTL_SECONDS };
  if (!user?.phone) {
    console.warn(
      `[forgot-password] store=${req.workspace} no SMS sent: ${user ? `user ${user._id} has no phone` : "no account matches that email or phone"}`,
    );
    return apiResponse.sendSuccess(res, statusCodes.OK, RESET_CODE_SENT_MESSAGE, sent);
  }

  // A new code replaces the previous one, and its 3 minutes start again
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await redis.set(resetCodeKey(user), hashResetCode(user, code), "EX", RESET_CODE_TTL_SECONDS);
  await redis.set(resetTriesKey(user), "0", "EX", RESET_CODE_TTL_SECONDS);

  const store = req.tenant?.name ? `${req.tenant.name} ` : "";
  // Status lines for the terminal; the code itself is never logged
  const tag = `[forgot-password] store=${req.workspace || user.tenantId} user=${user._id} phone=${maskPhone(user.phone)}`;
  console.log(`${tag} sending reset code by SMS (expires in ${RESET_CODE_TTL_SECONDS}s)`);
  try {
    const data = await sendSMS(
      user.phone,
      `Your ${store}password reset code is ${code}. It expires in 3 minutes. Do not share this code with anyone.`,
    );
    assertSmsAccepted(data);
    console.log(`${tag} SMS accepted by provider:`, data);
  } catch (error) {
    await clearResetCode(user);
    console.error(`${tag} SMS failed, code discarded:`, error.response?.data || error.message);
    throw new customError(
      "The reset code could not be sent by SMS. Please try again, or ask the platform team to check this store's SMS account.",
      statusCodes.SERVICE_UNAVAILABLE,
      "SMS_SEND_FAILED",
    );
  }

  apiResponse.sendSuccess(res, statusCodes.OK, RESET_CODE_SENT_MESSAGE, sent);
});

// reset password with the SMS code
exports.resetPassword = asynchandeler(async (req, res) => {
  const { newPassword } = req.body;
  const code = String(req.body.otp ?? "").trim();

  // Same minimum as every other password entry point
  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
  }

  const invalid = () => new customError("Invalid or expired code", statusCodes.BAD_REQUEST);
  const user = await findByEmailOrPhone(req.body);
  const stored = user && (await redis.get(resetCodeKey(user)));
  if (!stored) throw invalid();

  const expected = Buffer.from(stored, "hex");
  const given = Buffer.from(hashResetCode(user, code), "hex");
  if (!/^\d{6}$/.test(code) || !crypto.timingSafeEqual(expected, given)) {
    // A few guesses only: after that the code is burned and a new one is needed
    if ((await redis.incr(resetTriesKey(user))) >= RESET_CODE_MAX_ATTEMPTS) await clearResetCode(user);
    throw invalid();
  }

  await clearResetCode(user);
  user.password = newPassword;
  // A reset is how an account is recovered after a compromise, so end every
  // session the previous password left open.
  user.refreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  apiResponse.sendSuccess(res, statusCodes.OK, "Password reset successful");
});

//change paassword
exports.changePassword = asynchandeler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new customError("User not found", statusCodes.NOT_FOUND);

  const { oldPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
  }

  if (!(await user.comparePassword(oldPassword))) {
    throw new customError("Old password is incorrect", statusCodes.BAD_REQUEST);
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  // Sessions opened with the old password are no longer valid: the refresh
  // token goes, and the version bump revokes every access token already issued.
  user.refreshToken = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Password changed successfully",
  );
});

// get all user
exports.getAllUser = asynchandeler(async (_, res) => {
  const users = await User.find()
    .select(
      `-__v ${SECRET_FIELDS_SELECT} -createdAt -twoFactorEnabled -newsLetterSubscribe`,
    )
    .populate([{ path: "roles" }])
    .populate("wishList")
    .populate("permissions")
    .lean()
    .sort({ createdAt: -1 });
  if (!users || users.length === 0)
    throw new customError("User not found", statusCodes.NOT_FOUND);
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User fetched successfully",
    users,
  );
});

// get single user using email or phone
exports.getUserbyEmailOrPhone = asynchandeler(async (req, res) => {
  const identifier = signInIdentifier(req.query);
  if (!identifier) throw new customError("Email or phone is required", statusCodes.BAD_REQUEST);
  const user = await User.findOne(identifier)
    .select(
      `-__v ${SECRET_FIELDS_SELECT} -createdAt -twoFactorEnabled -newsLetterSubscribe`,
    )
    .populate([
      { path: "roles" },
      // { path: "permission" },
      { path: "wishList" },
      { path: "cart" },
    ]);
  if (!user) throw new customError("User not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User fetched successfully",
    user,
  );
});

//get me routes
exports.getMe = asynchandeler(async (req, res) => {
  if (!req.user) throw new customError("User not found", statusCodes.NOT_FOUND);

  // Re-fetch with deep populate so roles → permissions → permission doc
  // and user.permissions → permission doc are both fully resolved.
  const user = await User.findById(req.user._id)
    .populate({
      path: "roles",
      select: "-__v -createdAt -updatedAt",
      populate: {
        path: "permissions.permission",
        model: "Permission",
        select: "permissionName slug isActive",
      },
    })
    .populate({
      path: "permissions.permission",
      model: "Permission",
      select: "permissionName slug isActive",
    })
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -refreshToken -twoFactorEnabled",
    );

  if (!user) throw new customError("User not found", statusCodes.NOT_FOUND);

  // Effective permissions = active roles ∪ direct grants (same rule as authorize())
  const effectivePermissions = {};
  const grant = (entry) => {
    const slug = entry.permission?.slug;
    if (!slug || entry.permission.isActive === false) return;
    effectivePermissions[slug] = [...new Set([...(effectivePermissions[slug] || []), ...(entry.actions || [])])];
  };
  (user.roles || []).filter((role) => role.isActive !== false).forEach((role) => (role.permissions || []).forEach(grant));
  (user.permissions || []).forEach(grant);

  const tenant = req.tenant || null;

  apiResponse.sendSuccess(res, statusCodes.OK, "User fetched successfully", {
    ...user.toObject(),
    tenant: tenant ? { ...tenantSummary(tenant), limits: tenant.limits } : null,
    effectivePermissions,
    features: tenant ? await getFeatures(tenant._id) : null,
    isOwner: (user.roles || []).some((role) => ["owner", "superadmin"].includes(role.slug)),
  });
});

// search a user andd add permissin in  permission array
exports.addPermissionToUser = asynchandeler(async (req, res) => {
  const { userId, permissionId, actions } = req.body;

  await rbac.assertCanManageUser(req.user, userId);

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", statusCodes.NOT_FOUND);

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);

  // `permissions` entries are { permission, actions } subdocuments. Pushing a
  // bare ObjectId produced an entry whose `permission` was undefined, so
  // authorize() could never match it and the grant did nothing.
  const requestedActions = Array.isArray(actions)
    ? actions
    : actions
      ? [actions]
      : [];
  if (requestedActions.length === 0) {
    throw new customError(
      "At least one action is required (e.g. view, add, edit, delete)",
      statusCodes.BAD_REQUEST,
    );
  }

  await rbac.assertCanGrantPermissions(req.user, [
    { permission, actions: requestedActions },
  ]);

  const existing = user.permissions.find(
    (p) => p.permission?.toString() === permission._id.toString(),
  );

  if (existing) {
    // Merge, so re-granting does not drop actions already held.
    existing.actions = [...new Set([...existing.actions, ...requestedActions])];
  } else {
    user.permissions.push({
      permission: permission._id,
      actions: [...new Set(requestedActions)],
    });
  }

  await user.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission added successfully",
    {
      user: withoutSecrets(user),
      permission,
    },
  );
});
// remove permission from user
exports.removePermissionFromUser = asynchandeler(async (req, res) => {
  const { userId, permissionId } = req.body;

  await rbac.assertCanManageUser(req.user, userId);

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) throw new customError("User not found", statusCodes.NOT_FOUND);

  // Check if permission exists
  const permission = await Permission.findById(permissionId);
  if (!permission)
    throw new customError("Permission not found", statusCodes.NOT_FOUND);

  // Entries are { permission, actions } subdocuments — compare the inner
  // `permission` reference, not the subdocument itself.
  user.permissions = user.permissions.filter(
    (perm) => perm.permission?.toString() !== permission._id.toString(),
  );
  await user.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Permission removed successfully",
    {
      user: withoutSecrets(user),
      permission,
    },
  );
});

// is SuperAdmin
exports.isSuperAdmin = asynchandeler(async (req, res) => {
  const identifier = signInIdentifier(req.body);
  if (!identifier) {
    throw new customError(
      "Email or phone is required",
      statusCodes.BAD_REQUEST,
    );
  }
  // roles must be populated — `role.slug` on raw ObjectIds is always undefined,
  // which made this endpoint report false for every account.
  const user = await User.findOne(identifier)
    .populate("roles")
    .select("roles");
  if (!user) {
    throw new customError("User not found", statusCodes.NOT_FOUND);
  }

  const isSuperAdmin =
    user?.roles?.some((role) => rbac.OWNER_ROLE_SLUGS.includes(role?.slug)) || false;
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User fetched successfully",
    {
      isSuperAdmin,
    },
  );
});

// add user
exports.addUser = asynchandeler(async (req, res) => {
  const value = await validateUser(req);
  const imageFile = value.image;
  // Only the form's own fields. The schema allows unknown keys, and spreading
  // them into create let a user manager set `permissions`, `tokenVersion` or
  // `isEmailVerified` on the new account, bypassing the grant rules.
  const { name, email, password, phone, discountLimit } = value;
  const rest = { name, email, password, phone, discountLimit };
  if (req.body.isActive !== undefined) rest.isActive = String(req.body.isActive) !== "false";

  if (value.role) {
    await rbac.assertStaffCapacity(req.tenant);
    await rbac.assertCanAssignRole(req.user, value.role);
  }

  // Create user first with pending image status if image provided
  const user = await User.create({
    ...rest,
    image: imageFile
      ? {
          status: "pending",
          localPath: imageFile.path,
        }
      : undefined,
    roles: value.role ? [value.role] : [],
    createdBy: req.user?._id || null,
  });

  if (!user) {
    throw new customError("User creation failed", statusCodes.SERVER_ERROR);
  }

  // Enqueue image upload if provided
  if (imageFile && imageFile.path) {
    await imageQueue.add("create-user-image", {
      modelName: NS,
      documentId: user._id,
      localPath: imageFile.path,
    });
  }

  // Invalidate cache
  await bumpNsVersion(NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "User created successfully (image uploading in background)",
    {
      _id: user._id,
      name: user.name,
      email: user.email,
    },
  );
});

// get user added by admin
exports.getUserAddedByAdmin = asynchandeler(async (req, res) => {
  // New key: entries cached before the secret fields were excluded carry
  // reset and verification tokens and must never be served again
  const cacheKey = await buildCacheKey(NS, "added-by-admin:no-secrets");
  const cached = await getCache(cacheKey);

  if (cached) {
    return apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      "Users fetched successfully (from cache)",
      cached,
    );
  }

  const users = await User.find({ "roles.0": { $exists: true } })
    .select(
      `-__v ${SECRET_FIELDS_SELECT} -createdAt -twoFactorEnabled -newsLetterSubscribe`,
    )
    .populate("roles");

  if (users.length > 0) {
    await setCache(cacheKey, users, CACHE_TTL);
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Users fetched successfully",
    users,
  );
});

// user update
exports.updateUser = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const target = await rbac.assertCanManageUser(req.user, id);
  const currentRole = target.roles?.[0]?._id?.toString();
  const roleChanged = Boolean(data.role) && String(data.role) !== currentRole;
  if (roleChanged) await rbac.assertCanAssignRole(req.user, data.role);

  //  Manual basic field validation
  const requiredFields = ["name", "email", "phone"];
  for (const field of requiredFields) {
    if (!data[field] || data[field].toString().trim() === "") {
      throw new customError(`${field} is required`, statusCodes.BAD_REQUEST);
    }
  }

  if (data.discountLimit !== undefined) {
    const limit = Number(data.discountLimit);
    if (isNaN(limit) || limit < 0 || limit > 100) {
      throw new customError(
        "Discount limit must be a number between 0 and 100",
        statusCodes.BAD_REQUEST,
      );
    }
  }

  //  Prepare update object
  const updateData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    discountLimit: data.discountLimit,
  };

  //  Add password only if given
  if (data.password && data.password.trim() !== "") {
    // Same minimum as every other password entry point
    if (data.password.length < PASSWORD_MIN_LENGTH) {
      throw new customError(PASSWORD_MIN_MESSAGE, statusCodes.BAD_REQUEST);
    }
    updateData.password = data.password;
  }

  //  Replace roles array if new role given
  if (data.role) {
    updateData.roles = [data.role];
  }

  //  Handle image upload & old image deletion (handled by queue after findByIdAndUpdate)

  // A new role or password ends the user's existing sessions
  if (roleChanged || updateData.password) {
    updateData.$inc = { tokenVersion: 1 };
  }

  //  Update user in DB
  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("roles")
    .populate("permissions")
    .select(
      "-password -__v -resetPasswordToken -resetPasswordExpires -updatedAt -wishList -cart -newsLetterSubscribe -lastlogin -lastLogout -createdAt -refreshToken -twoFactorEnabled -isEmailVerified -isPhoneVerified",
    );

  if (!updatedUser) {
    throw new customError("User not found", statusCodes.NOT_FOUND);
  }

  // Handle image update via queue if file present
  if (req.file) {
    const oldPublicId = updatedUser.image?.publicId || null;
    const oldCloudName = updatedUser.image?.cloudName || null;

    // Update status to pending
    updatedUser.image.status = "pending";
    updatedUser.image.localPath = req.file.path;
    updatedUser.image.tries = 0;
    updatedUser.image.lastError = "";
    await updatedUser.save();

    await imageQueue.add("update-user-image", {
      modelName: NS,
      documentId: updatedUser._id,
      localPath: req.file.path,
      oldPublicId,
      oldCloudName,
    });
  }

  // Invalidate cache
  await bumpNsVersion(NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User updated successfully",
    updatedUser,
  );
});

// activate / deactivate user
const setUserActiveStatus = (isActive) =>
  asynchandeler(async (req, res) => {
    const { id } = req.params;

    await rbac.assertCanManageUser(req.user, id);

    const user = await User.findById(id);
    if (!user) {
      throw new customError("User not found", statusCodes.NOT_FOUND);
    }

    // Prevent an admin from locking themselves out
    if (!isActive && req.user._id.toString() === id) {
      throw new customError(
        "You cannot deactivate your own account",
        statusCodes.BAD_REQUEST,
      );
    }

    const before = { isActive: user.isActive };

    if (isActive && !user.isActive && user.roles?.length) {
      await rbac.assertStaffCapacity(req.tenant);
    }

    user.isActive = isActive;
    // Deactivation ends every live session at once
    if (!isActive) user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    logAudit({
      req,
      action: "STATUS_CHANGE",
      entityType: "user",
      entityId: user._id,
      entityLabel: user.email || user.phone,
      before,
      after: { isActive: user.isActive },
    });

    // Invalidate cache
    await bumpNsVersion(NS);

    apiResponse.sendSuccess(
      res,
      statusCodes.OK,
      `User ${isActive ? "activated" : "deactivated"} successfully`,
      { _id: user._id, isActive: user.isActive },
    );
  });

exports.activateUser = setUserActiveStatus(true);
exports.deactivateUser = setUserActiveStatus(false);

// delte user
exports.deleteUser = asynchandeler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.toString() === id) {
    throw new customError("You cannot delete your own account", statusCodes.BAD_REQUEST);
  }
  await rbac.assertCanManageUser(req.user, id);

  // Find user first
  const user = await User.findById(id);
  if (!user) {
    throw new customError("User not found", statusCodes.NOT_FOUND);
  }

  // Delete image from Cloudinary via queue
  const publicId = user.image?.publicId;
  if (publicId) {
    await imageQueue.add("delete-cloudinary-image", {
      publicId,
      cloudName: user.image?.cloudName,
    });
  }

  // Delete user from DB
  await User.findByIdAndDelete(id);

  // Invalidate cache
  await bumpNsVersion(NS);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "User deleted successfully",
    withoutSecrets(user),
  );
});
