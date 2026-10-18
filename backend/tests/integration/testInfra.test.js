const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { sessionFor, tokenFor } = require("../helpers/auth");
const { testRedis } = require("../helpers/redis");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Product = require("../../src/models/product.model");

// Guards the Phase 1 harness itself: if this file fails, every other
// integration test's result is meaningless.
describe("test infrastructure", () => {
  const ctx = useIntegrationApp();

  it("runs against a private Redis database, never the default local one", async () => {
    expect(process.env.REDIS_URL).toMatch(/^redis:\/\/127\.0\.0\.1:\d+\/\d+$/);
    expect(process.env.REDIS_URL).not.toMatch(/:6379\//);
    await testRedis().set("probe", "1");
    expect(await testRedis().get("probe")).toBe("1");
  });

  it("starts each test with an empty Redis database", async () => {
    expect(await testRedis().dbsize()).toBe(0);
  });

  it("reports healthy with real Mongo and Redis", async () => {
    const res = await api(ctx.server).get("/healthz").expect(200);
    expect(res.body).toEqual({ status: "ok", database: "up", redis: "up" });
  });

  it("creates tenant-scoped documents through the factories", async () => {
    const tenant = await tenantFactory.create();
    const other = await tenantFactory.create();
    const product = await forTenant(tenant).product.create({ stock: 7 });
    expect(product.tenantId.equals(tenant._id)).toBe(true);
    expect(await runForTenant(other._id, () => Product.countDocuments())).toBe(0);
    expect(await runForTenant(tenant._id, () => Product.countDocuments())).toBe(1);
  });

  it("signs tokens the auth guard accepts", async () => {
    const tenant = await tenantFactory.create();
    const { user } = await sessionFor(tenant, { owner: true });
    const res = await api(ctx.server, { token: tokenFor(user) }).get("/auth/getme").expect(200);
    expect(res.body.data.email).toBe(user.email);
  });
});
