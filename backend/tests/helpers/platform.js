const express = require("express");
const cookieParser = require("cookie-parser");
const PlatformUser = require("../../src/models/platform/platformUser.model");

const PLATFORM_ENV = {
  ACCESS_TOKEN_SECRET: "staff-access-secret-staff-access-secret-0001",
  REFRESH_TOKEN_SCCERET: "staff-refresh-secret-staff-refresh-secret-01",
  PLATFORM_ACCESS_TOKEN_SECRET: "platform-access-secret-platform-access-0001",
  PLATFORM_REFRESH_TOKEN_SECRET: "platform-refresh-secret-platform-refresh-01",
  PLATFORM_ADMIN_PHONE: "01999878862",
};

const setPlatformEnv = () => Object.assign(process.env, PLATFORM_ENV);

const PASSWORD = "Platform-Passw0rd!";

const createPlatformUser = (overrides = {}) =>
  PlatformUser.create({
    name: "Platform Admin",
    email: `admin${Math.random().toString(36).slice(2, 8)}@platform.test`,
    password: PASSWORD,
    role: "superadmin",
    ...overrides,
  });

// Minimal app: platform routes + the real error handler, no Redis/sockets
const buildPlatformApp = (mount) => {
  const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  if (mount) mount(app);
  else app.use("/api/v1/platform", require("../../src/routes/platform"));
  app.use(globalErrorHandeler);
  return app;
};

module.exports = { PLATFORM_ENV, PASSWORD, setPlatformEnv, createPlatformUser, buildPlatformApp };
