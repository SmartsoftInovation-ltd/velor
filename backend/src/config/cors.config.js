const { isDevelopment } = require("./nodeEnv");
// Origins allowed to make credentialed cross-origin requests (HTTP + socket).
// Set FRONTEND_URL / DASHBOARD_URL / PLATFORM_URL, plus any extras in CORS_ORIGINS (comma separated).
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    process.env.DASHBOARD_URL,
    process.env.PLATFORM_URL,
    ...(process.env.CORS_ORIGINS || "").split(","),
  ]
    .map((o) => o?.trim().replace(/\/+$/, ""))
    .filter(Boolean),
);

const isLocalhost = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const isOriginAllowed = (origin) => {
  // No Origin header: same-origin, curl, server-to-server, mobile apps
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return isDevelopment() && isLocalhost(origin);
};

// Disallowed origins get no CORS headers (browser blocks) instead of a 500
const corsOrigin = (origin, callback) => callback(null, isOriginAllowed(origin));

module.exports = { corsOrigin, isOriginAllowed };
