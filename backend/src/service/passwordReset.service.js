const crypto = require("crypto");
const User = require("../models/user.model");
const { sendSMS } = require("../helpers/sms");
const { cache: redis } = require("../config/redis.config");

/**
 * Password reset by a one-time code sent by SMS, shared by dashboard staff
 * (`/auth/forgot-password`) and storefront shoppers (`/shop/auth/forgot-password`).
 *
 * Codes go out through the store's own SMS settings (set by the platform on the
 * seller's page). The code lives in Redis with a TTL, so it is gone the moment
 * it expires; only a keyed hash of it is stored, and nothing is written to the
 * user document.
 */
const RESET_CODE_TTL_SECONDS = 3 * 60;
const RESET_CODE_MAX_ATTEMPTS = 5;

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

/**
 * Makes a new code for `user` (replacing any earlier one, with a fresh 3
 * minutes and a fresh set of tries) and sends it to the account's phone. On a
 * failed send the code is discarded and the error is thrown. `tag` prefixes the
 * terminal status lines; the code itself is never logged.
 */
const sendResetCode = async (user, { storeName, tag }) => {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await redis.set(resetCodeKey(user), hashResetCode(user, code), "EX", RESET_CODE_TTL_SECONDS);
  await redis.set(resetTriesKey(user), "0", "EX", RESET_CODE_TTL_SECONDS);

  const store = storeName ? `${storeName} ` : "";
  const line = `${tag} user=${user._id} phone=${maskPhone(user.phone)}`;
  console.log(`${line} sending reset code by SMS (expires in ${RESET_CODE_TTL_SECONDS}s)`);
  try {
    const data = await sendSMS(
      user.phone,
      `Your ${store}password reset code is ${code}. It expires in 3 minutes. Do not share this code with anyone.`,
    );
    assertSmsAccepted(data);
    console.log(`${line} SMS accepted by provider:`, data);
  } catch (error) {
    await clearResetCode(user);
    console.error(`${line} SMS failed, code discarded:`, error.response?.data || error.message);
    throw error;
  }
};

/**
 * Whether `code` is the live reset code for `user`. A wrong guess counts
 * against the code, and after a few it is burned so a new one must be asked
 * for. A right code stays usable unless `consume` is set, so a "check the
 * code" step can come before the step that changes the password.
 */
const checkResetCode = async (user, code, { consume = false } = {}) => {
  const stored = user && (await redis.get(resetCodeKey(user)));
  if (!stored) return false;

  const given = String(code ?? "").trim();
  const expected = Buffer.from(stored, "hex");
  const actual = Buffer.from(hashResetCode(user, given), "hex");
  if (!/^\d{6}$/.test(given) || !crypto.timingSafeEqual(expected, actual)) {
    if ((await redis.incr(resetTriesKey(user))) >= RESET_CODE_MAX_ATTEMPTS) await clearResetCode(user);
    return false;
  }

  if (consume) await clearResetCode(user);
  return true;
};

module.exports = {
  RESET_CODE_TTL_SECONDS,
  RESET_CODE_MAX_ATTEMPTS,
  phoneForms,
  findByEmailOrPhone,
  maskPhone,
  sendResetCode,
  checkResetCode,
  clearResetCode,
};
