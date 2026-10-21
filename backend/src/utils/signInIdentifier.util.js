const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

/**
 * The account a sign-in names, as a query on exactly one field.
 *
 * Only strings are accepted: an object such as `{ $ne: null }` would reach
 * Mongo as an operator and match an account the caller never named. And only
 * the identifier that was given is queried — `{ phone: undefined }` matches
 * every account without a phone.
 */
const signInIdentifier = (body = {}) => {
  const { email, phone } = body;
  if ((email != null && typeof email !== "string") || (phone != null && typeof phone !== "string")) {
    throw new customError("Email or phone must be text", statusCodes.BAD_REQUEST);
  }
  const normalisedEmail = email?.trim().toLowerCase();
  const normalisedPhone = phone?.trim();
  if (normalisedEmail) return { email: normalisedEmail };
  if (normalisedPhone) return { phone: normalisedPhone };
  return null;
};

module.exports = { signInIdentifier };
