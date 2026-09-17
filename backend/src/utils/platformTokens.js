const jwt = require("jsonwebtoken");
const { getPlatformAuthConfig } = require("../config/platformAuth.config");

const ACCESS_AUDIENCE = "platform";
const REFRESH_AUDIENCE = "platform-refresh";

const signPlatformAccessToken = (user) => {
  const { accessSecret, accessExpiresIn } = getPlatformAuthConfig();
  return jwt.sign({ tv: user.tokenVersion }, accessSecret, {
    subject: user._id.toString(),
    audience: ACCESS_AUDIENCE,
    expiresIn: accessExpiresIn,
  });
};

const signPlatformRefreshToken = (user) => {
  const { refreshSecret, refreshExpiresIn } = getPlatformAuthConfig();
  return jwt.sign({ tv: user.tokenVersion }, refreshSecret, {
    subject: user._id.toString(),
    audience: REFRESH_AUDIENCE,
    expiresIn: refreshExpiresIn,
  });
};

const verifyPlatformAccessToken = (token) =>
  jwt.verify(token, getPlatformAuthConfig().accessSecret, { audience: ACCESS_AUDIENCE });

const verifyPlatformRefreshToken = (token) =>
  jwt.verify(token, getPlatformAuthConfig().refreshSecret, { audience: REFRESH_AUDIENCE });

module.exports = {
  signPlatformAccessToken,
  signPlatformRefreshToken,
  verifyPlatformAccessToken,
  verifyPlatformRefreshToken,
};
