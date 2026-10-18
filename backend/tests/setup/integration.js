const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { flushRedis, closeRedis } = require("../helpers/redis");

/**
 * Per-file lifecycle for an integration test against the real app.
 *
 *   const ctx = useIntegrationApp();
 *   it("...", () => request(ctx.server).get(...));
 *
 * - beforeAll: own Mongo database (replica set, transactions work), the real
 *   Express app wired to the private test Redis.
 * - beforeEach: clean env, every in-process cache and rate-limit counter reset,
 *   FLUSHDB on this worker's Redis database.
 * - afterEach: every collection emptied.
 * - afterAll: app, Redis clients and database closed.
 *
 * Options:
 *   strict: run with TENANCY_MODE=strict (production setting) — default true
 *   quiet:  silence console.log / console.error noise from controllers
 *   clearAfterEach: false keeps documents created in beforeAll (read-only matrices)
 */
const useIntegrationApp = ({ strict = true, quiet = true, clearAfterEach = true } = {}) => {
  const ctx = {};
  const envBackup = { ...process.env };

  const resetEnv = () => {
    process.env = { ...envBackup, ...STAFF_ENV };
    setSettingsEnv();
    if (strict) process.env.TENANCY_MODE = "strict";
    else delete process.env.TENANCY_MODE;
  };

  beforeAll(async () => {
    resetEnv();
    await connectTestDb();
    const app = loadApp();
    // Listen once, up front. Given a server that is not listening, supertest
    // calls listen() itself for every request — parallel requests (the
    // concurrency tests) then race on the same server and get ECONNRESET.
    if (!app.server.listening) await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    ctx.server = app.server;
    ctx.close = app.close;
    const settings = require("../../src/settings/settings.service");
    settings.setSettingsPublisher(async () => {});
    if (quiet) {
      jest.spyOn(console, "log").mockImplementation(() => {});
      jest.spyOn(console, "error").mockImplementation(() => {});
      jest.spyOn(console, "warn").mockImplementation(() => {});
    }
    // Indexes (unique constraints) must exist before concurrency tests run
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init().catch(() => {})));
  });

  beforeEach(async () => {
    resetEnv();
    require("../../src/settings/settings.service").clearSettingsCache();
    require("../../src/middleware/rateLimit.middleware").resetRateLimitCounters();
    require("../../src/tenancy/tenantResolver").invalidateTenantCache();
    await flushRedis();
  });

  afterEach(async () => {
    if (clearAfterEach) await clearTestDb();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await ctx.close?.();
    await closeRedis();
    await disconnectTestDb();
  });

  return ctx;
};

module.exports = { useIntegrationApp };
