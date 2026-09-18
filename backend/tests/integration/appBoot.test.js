const request = require("supertest");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");

describe("app boot with tenancy plugin in shadow mode", () => {
  let server;
  let io;

  beforeAll(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    await connectTestDb();
    ({ server, io } = require("../../src/app"));
  });

  afterAll(async () => {
    io.close();
    const { connection, cache } = require("../../src/config/redis.config");
    await Promise.allSettled([connection.quit(), cache.quit()]);
    await disconnectTestDb();
  });

  it("loads every route, controller and model", async () => {
    const res = await request(server).get("/api/v1/definitely-not-a-route");
    expect(res.status).toBe(404);
  });

  it("mounts the platform API behind the platform guard", async () => {
    await request(server).get("/api/v1/platform/tenants").expect(401);
    await request(server).post("/api/v1/platform/auth/refresh").expect(401);
  });

  // The platform console has no store to name, so `platformApi` in the dashboard
  // sends no x-tenant header. That only works while the platform routes stay
  // ABOVE the tenant middleware: moved below it, every console request would be
  // answered 400 TENANT_CONTEXT_REQUIRED instead of 401.
  it("mounts the platform API above the tenant middleware", async () => {
    const saved = process.env.TENANCY_MODE;
    process.env.TENANCY_MODE = "strict";
    try {
      for (const path of ["/api/v1/platform/tenants", "/api/v1/platform/users", "/api/v1/platform/settings/schema"]) {
        const res = await request(server).get(path);
        // Guarded (401) or absent (404) — never "name your store", which is what
        // the tenant middleware would answer if it ran first.
        expect([401, 404]).toContain(res.status);
        expect(res.body.code).not.toBe("TENANT_CONTEXT_REQUIRED");
      }
      // The same request under a tenant route does demand a store, which is what
      // makes the assertion above meaningful rather than vacuous.
      const tenantRoute = await request(server).get("/api/v1/categories-active");
      expect(tenantRoute.body.code).toBe("TENANT_CONTEXT_REQUIRED");
    } finally {
      process.env.TENANCY_MODE = saved;
    }
  });

  it("retires the single-tenant payment callbacks in strict mode", async () => {
    const saved = process.env.TENANCY_MODE;
    process.env.TENANCY_MODE = "strict";
    try {
      const res = await request(server).post("/api/v1/payment/ipn").send({});
      expect(res.status).toBe(410);
      expect(res.body.code).toBe("LEGACY_ROUTE_REMOVED");
    } finally {
      process.env.TENANCY_MODE = saved;
    }
  });

  // Removed outright, not gated: they picked a Merchant without a tenant filter
  // and accepted a global courier key. Stores use /api/v1/hooks/:provider/:key.
  it("no longer serves the single-tenant courier webhooks", async () => {
    for (const path of ["/api/v1/courier/pathao-webhook", "/api/v1/courier/steadfast-webhook"]) {
      await request(server).post(path).send({}).expect(404);
    }
  });

  // Public does not mean store-less: a storefront request still names its store
  // with x-tenant, and an unnamed one is answered, not crashed.
  it("answers a public endpoint without a tenant context with 400, not 500", async () => {
    const res = await request(server).get("/api/v1/categories-active");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("TENANT_CONTEXT_REQUIRED");
  });
});
