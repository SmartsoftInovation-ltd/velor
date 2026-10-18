const express = require("express");
const request = require("supertest");
const Joi = require("joi");
const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { tokenFor } = require("../helpers/auth");
const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
const validate = require("../../src/middleware/validate");
const { asynchandeler } = require("../../src/lib/asyncHandeler");
const { customError } = require("../../src/lib/CustomError");
const { apiResponse } = require("../../src/utils/apiResponse");
const { legacyRoute } = require("../../src/middleware/legacyRoute.middleware");
const { resolveRequestTenant, workspaceTenant } = require("../../src/middleware/requestTenant.middleware");
const { guestOrAuth } = require("../../src/middleware/guestOrAuth");
const { getTenantId, runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const Tenant = require("../../src/models/platform/tenant.model");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const User = require("../../src/models/user.model");

// Small apps wiring one middleware in front of a probe handler, so each piece
// of the request pipeline is tested on its own against a real database.
describe("request pipeline middleware", () => {
  const envBackup = { ...process.env };
  beforeAll(async () => {
    await connectTestDb();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  beforeEach(() => {
    process.env = { ...envBackup };
    invalidateTenantCache();
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = envBackup;
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const appWith = (...middleware) => {
    const app = express();
    app.use(express.json());
    app.all("/probe", ...middleware, (req, res) =>
      res.json({ tenant: getTenantId()?.toString() || null, body: req.body, guestId: req.guestId || null, user: req.user?._id?.toString() || null }),
    );
    app.use(globalErrorHandeler);
    return app;
  };

  describe("validate(schema)", () => {
    const schema = Joi.object({ name: Joi.string().trim().required(), qty: Joi.number().default(1) });

    it("replaces the body with the validated value (defaults applied, strings trimmed)", async () => {
      const res = await request(appWith(validate(schema))).post("/probe").send({ name: "  Tea " }).expect(200);
      expect(res.body.body).toEqual({ name: "Tea", qty: 1 });
    });

    it("answers 400 with Joi's message and never reaches the handler", async () => {
      let reached = false;
      const app = express();
      app.use(express.json());
      app.post("/probe", validate(schema), () => {
        reached = true;
      });
      app.use(globalErrorHandeler);
      const res = await request(app).post("/probe").send({ qty: "x" }).expect(400);
      expect(res.body.message).toMatch(/name/);
      expect(reached).toBe(false);
    });

    // BUG-005: after next(error) it falls through and calls next() again; the
    // controller is not re-run (Express has moved on) but the double call is a
    // defect that surfaces as "headers already sent" with other routers
    test.failing("calls next exactly once when validation fails [BUG-005]", () => {
      const next = jest.fn();
      validate(schema)({ body: {} }, {}, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("asynchandeler / customError / apiResponse", () => {
    it("forwards a thrown error to the error handler", async () => {
      const app = appWith(asynchandeler(async () => {
        throw new customError("Gone", 410, "GONE");
      }));
      const res = await request(app).get("/probe").expect(410);
      expect(res.body).toEqual({ statusCode: 410, message: "Gone", code: "GONE" });
    });

    it("customError classifies 4xx as client errors and the rest as server errors", () => {
      expect(new customError("x", 404).status).toMatch(/client/i);
      expect(new customError("x", 500).status).toMatch(/server/i);
      expect(new customError("x", 400).isOperationalError).toBe(true);
    });

    it("apiResponse builds the success and error envelopes", () => {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      apiResponse.sendSuccess(res, 201, "Made", { id: 1 });
      expect(res.body).toEqual({ status: "OK", statusCode: 201, message: "Made", data: { id: 1 } });
      apiResponse.sendError(res, 404, "Missing");
      expect(res.body).toEqual({ status: "error", statusCode: 404, message: "Missing", data: null });
    });
  });

  describe("legacyRoute", () => {
    it("410 LEGACY_ROUTE_REMOVED in strict mode, passes through otherwise", async () => {
      process.env.TENANCY_MODE = "strict";
      const res = await request(appWith(legacyRoute)).post("/probe").expect(410);
      expect(res.body.code).toBe("LEGACY_ROUTE_REMOVED");
      delete process.env.TENANCY_MODE;
      await request(appWith(legacyRoute)).post("/probe").expect(200);
    });
  });

  describe("resolveRequestTenant", () => {
    let shop;
    beforeEach(async () => {
      shop = await Tenant.create({ name: "Shop", slug: "pipeshop", status: "active" });
    });

    it("opens the context named by x-tenant; none when no header", async () => {
      const app = appWith(resolveRequestTenant);
      expect((await request(app).get("/probe").set("x-tenant", "PipeShop ").expect(200)).body.tenant).toBe(shop._id.toString());
      expect((await request(app).get("/probe").expect(200)).body.tenant).toBeNull();
    });

    it("404 TENANT_NOT_FOUND for an unknown slug; 403 TENANT_SUSPENDED for a suspended store", async () => {
      const app = appWith(resolveRequestTenant);
      expect((await request(app).get("/probe").set("x-tenant", "nope").expect(404)).body.code).toBe("TENANT_NOT_FOUND");
      await Tenant.updateOne({ _id: shop._id }, { status: "suspended" });
      invalidateTenantCache();
      expect((await request(app).get("/probe").set("x-tenant", "pipeshop").expect(403)).body.code).toBe("TENANT_SUSPENDED");
    });

    it("ignores x-tenant-host unless the proxy is trusted; then only verified (active) domains resolve", async () => {
      await runForTenant(shop._id, () => TenantDomain.create({ tenantId: shop._id, host: "pipe.example.com", status: "active" }));
      await runForTenant(shop._id, () => TenantDomain.create({ tenantId: shop._id, host: "pending.example.com", status: "pending" }));
      const app = appWith(resolveRequestTenant);
      expect((await request(app).get("/probe").set("x-tenant-host", "pipe.example.com").expect(200)).body.tenant).toBeNull();

      process.env.TRUST_TENANT_HOST_HEADER = "true";
      expect((await request(app).get("/probe").set("x-tenant-host", "PIPE.example.com").expect(200)).body.tenant).toBe(shop._id.toString());
      expect((await request(app).get("/probe").set("x-tenant-host", "pending.example.com").expect(404)).body.code).toBe("DOMAIN_NOT_FOUND");
      expect((await request(app).get("/probe").set("x-tenant-host", "unknown.example.com").expect(404)).body.code).toBe("DOMAIN_NOT_FOUND");
    });
  });

  describe("workspaceTenant", () => {
    beforeEach(() => Tenant.create({ name: "WS", slug: "workspace1", status: "active" }));

    it("takes the store from body.workspace and removes the field", async () => {
      const res = await request(appWith(workspaceTenant)).post("/probe").send({ workspace: "workspace1", email: "a@b.c" }).expect(200);
      expect(res.body.tenant).toBeTruthy();
      expect(res.body.body).toEqual({ email: "a@b.c" });
    });

    it("an unknown workspace answers like bad credentials; a mismatch with x-tenant is refused", async () => {
      const unknown = await request(appWith(workspaceTenant)).post("/probe").send({ workspace: "nope" }).expect(400);
      expect(unknown.body.message).toBe("Invalid credentials");
      await Tenant.create({ name: "Other", slug: "workspace2", status: "active" });
      const res = await request(appWith(resolveRequestTenant, workspaceTenant)).post("/probe").set("x-tenant", "workspace2").send({ workspace: "workspace1" }).expect(400);
      expect(res.body.message).toMatch(/does not match/);
    });
  });

  describe("guestOrAuth", () => {
    let shop;
    beforeEach(async () => {
      process.env.ACCESS_TOKEN_SECRET = "staff-access-secret-staff-access-secret-0001";
      shop = await Tenant.create({ name: "G", slug: "guestshop", status: "active" });
    });

    it("a guest id is accepted only when a store is named", async () => {
      const app = appWith(resolveRequestTenant, guestOrAuth);
      const ok = await request(app).get("/probe").set("x-tenant", "guestshop").set("x-guest-id", "g-1").expect(200);
      expect(ok.body.guestId).toBe("g-1");
      const noStore = await request(app).get("/probe").set("x-guest-id", "g-1").expect(400);
      expect(noStore.body.code).toBe("TENANT_CONTEXT_REQUIRED");
      await request(app).get("/probe").set("x-tenant", "guestshop").expect(401);
    });

    it("a bad token is a 401 even when a guest id is also sent (no silent downgrade)", async () => {
      const app = appWith(resolveRequestTenant, guestOrAuth);
      await request(app).get("/probe").set("x-tenant", "guestshop").set("x-guest-id", "g-1").set("Authorization", "Bearer garbage").expect(401);
    });

    it("a valid shopper token identifies the user inside their store", async () => {
      const shopper = await runForTenant(shop._id, () => User.create({ name: "S", email: "s@x.com", password: "Passw0rd!", phone: "01700000001", roles: [] }));
      const app = appWith(resolveRequestTenant, guestOrAuth);
      const res = await request(app).get("/probe").set("x-tenant", "guestshop").set("Authorization", `Bearer ${tokenFor(shopper)}`).expect(200);
      expect(res.body.user).toBe(shopper._id.toString());
      expect(res.body.tenant).toBe(shop._id.toString());
    });
  });
});

describe("rate limiters", () => {
  const { loginLimiter, resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
  afterEach(() => resetRateLimitCounters());

  const loginApp = () => {
    const app = express();
    app.use(express.json());
    app.post("/login", loginLimiter, (req, res) => res.status(req.body.ok ? 200 : 400).json({}));
    return app;
  };

  it("counts failed sign-ins per account: 10 failures lock that account, others stay open", async () => {
    const app = loginApp();
    for (let i = 0; i < 10; i += 1) await request(app).post("/login").send({ email: "Victim@x.com " }).expect(400);
    const locked = await request(app).post("/login").send({ email: "victim@x.com", ok: true }).expect(429);
    expect(locked.body.message).toMatch(/too many/i);
    expect(locked.headers["ratelimit-limit"]).toBe("10");
    await request(app).post("/login").send({ email: "other@x.com", ok: true }).expect(200);
  });

  it("resets when the counters are cleared (window expiry)", async () => {
    const app = loginApp();
    for (let i = 0; i < 10; i += 1) await request(app).post("/login").send({ phone: "01700000000" }).expect(400);
    await request(app).post("/login").send({ phone: "01700000000", ok: true }).expect(429);
    resetRateLimitCounters();
    await request(app).post("/login").send({ phone: "01700000000", ok: true }).expect(200);
  });

  it("the global API limiter answers 429 after RATE_LIMIT_MAX requests per IP", async () => {
    // A fresh module registry so app.js builds its limiter with a low limit
    await jest.isolateModulesAsync(async () => {
      process.env.RATE_LIMIT_MAX = "3";
      // The isolated registry has its own mongoose: connect it, or its model
      // init timers keep the worker alive
      const isolatedMongoose = require("mongoose");
      await isolatedMongoose.connect(process.env.MONGO_TEST_URI, { dbName: `ratelimit_${process.env.JEST_WORKER_ID}` });
      const { server, io } = require("../../src/app");
      try {
        for (let i = 0; i < 3; i += 1) await request(server).get("/api/v1/no-such-route").expect(404);
        const limited = await request(server).get("/api/v1/no-such-route").expect(429);
        expect(limited.text).toMatch(/too many requests/i);
        // health checks sit before the limiter and keep answering
        expect([200, 503]).toContain((await request(server).get("/healthz")).status);
      } finally {
        io.close();
        const { connection, cache } = require("../../src/config/redis.config");
        await Promise.allSettled([connection.quit(), cache.quit()]);
        await isolatedMongoose.connection.dropDatabase();
        await isolatedMongoose.disconnect();
        process.env.RATE_LIMIT_MAX = "1000000";
      }
    });
  });
});

module.exports = { mongoose };
