require("dotenv").config();

const { staffSecretProblems, MIN_SECRET_LENGTH } = require("./staffAuth.config");

/**
 * Environment values with their defaults.
 *
 * The token secrets are read here too, but reading is not the same as trusting:
 * `staffSecretProblems()` is what says whether they are usable, and
 * `assertStaffSecrets()` (called from index.js) stops the process in production
 * when they are not. This object only carries the values.
 */
const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  DATABASE_URL: process.env.DATABASE_URL,
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SCCERET,
  INVOICE_PREFIX: process.env.INVOICE_PREFIX || "INV",
};

module.exports = { env, staffSecretProblems, MIN_SECRET_LENGTH };
