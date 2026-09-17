const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const MIN_SECRET_LENGTH = 32;

const configError = (message) =>
  new customError(`Platform auth is not configured: ${message}`, statusCodes.SERVER_ERROR);

// Platform tokens use their own secrets so a staff token can never verify as a
// platform token (and vice versa), even if one secret leaks.
const getPlatformAuthConfig = () => {
  const accessSecret = process.env.PLATFORM_ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.PLATFORM_REFRESH_TOKEN_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw configError("set PLATFORM_ACCESS_TOKEN_SECRET and PLATFORM_REFRESH_TOKEN_SECRET");
  }
  if (accessSecret.length < MIN_SECRET_LENGTH || refreshSecret.length < MIN_SECRET_LENGTH) {
    throw configError(`platform secrets must be at least ${MIN_SECRET_LENGTH} characters`);
  }

  const staffSecrets = [
    process.env.ACCESS_TOKEN_SECRET,
    process.env.REFRESH_TOKEN_SECRET,
    process.env.REFRESH_TOKEN_SCCERET,
  ].filter(Boolean);
  if (accessSecret === refreshSecret || staffSecrets.some((s) => s === accessSecret || s === refreshSecret)) {
    throw configError("platform secrets must differ from each other and from staff token secrets");
  }

  return {
    accessSecret,
    refreshSecret,
    accessExpiresIn: process.env.PLATFORM_ACCESS_TOKEN_EXPIRY || "1h",
    refreshExpiresIn: process.env.PLATFORM_REFRESH_TOKEN_EXPIRY || "7d",
  };
};

module.exports = { getPlatformAuthConfig };
