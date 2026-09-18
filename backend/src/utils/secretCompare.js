const crypto = require("crypto");

/**
 * Constant-time comparison of two secrets (webhook tokens, signatures).
 *
 * `===` returns as soon as two bytes differ, so the time it takes leaks how much
 * of a guess was right; a caller who can retry learns the secret byte by byte.
 * Lengths are compared through a fixed-length digest so that the length itself
 * does not leak either.
 *
 * An absent or non-string value never matches — an unconfigured secret must
 * reject every caller, not accept them.
 */
const secretEquals = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const digest = (value) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
};

module.exports = { secretEquals };
