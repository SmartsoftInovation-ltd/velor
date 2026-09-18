const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache, getTenantByHost } = require("../../src/tenancy/tenantResolver");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Category = require("../../src/models/category.model");
const service = require("../../src/settings/settings.service");

/**
 * A storefront request names its store with a hostname, not a header the
 * visitor chose. These tests pin down the two halves of that:
 *
 *   - the mapping itself (which host reaches which tenant, and which hosts
 *     reach none), and
 *   - that the mapping cannot be talked around — an unverified domain, a
 *     spoofed header, or a token from another store all fail closed.
 */

describe("storefront tenant resolution by hostname", () => {
  let app;
  let velor;
  let pizza;
  const envBackup = { ...process.env };

  const addDomain = (tenantId, host, overrides = {}) =>
    TenantDomain.create({ tenantId, host, status: "active", ...overrides });

  // Any public, tenant-scoped endpoint would do; categories are the simplest.
  const getCategories = (headers) => request(app.server).get("/api/v1/categories").set(headers);

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    process.env = { ...envBackup, ...STAFF_ENV };
    setSettingsEnv();
    process.env.TENANCY_MODE = "strict";
    process.env.TRUST_TENANT_HOST_HEADER = "true";
    invalidateTenantCache();
    service.clearSettingsCache();

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });

    // Same category name in both stores: a leak shows up as the wrong _id,
    // which a name-only assertion would miss.
    await runForTenant(velor.tenant._id, () => Category.create({ name: "Drinks", slug: "drinks" }));
    await runForTenant(pizza.tenant._id, () => Category.create({ name: "Drinks", slug: "drinks" }));
  });

  afterEach(async () => {
    await clearTestDb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  describe("the hostname selects the store", () => {
    it("serves each domain its own store's data", async () => {
      await addDomain(velor.tenant._id, "velor.com");
      await addDomain(pizza.tenant._id, "pizzashop.com");

      const fromVelor = await getCategories({ "x-tenant-host": "velor.com" }).expect(200);
      const fromPizza = await getCategories({ "x-tenant-host": "pizzashop.com" }).expect(200);

      const idsOf = (res) => (res.body.data?.categories ?? res.body.data ?? []).map((c) => String(c._id));
      expect(idsOf(fromVelor)).toHaveLength(1);
      expect(idsOf(fromPizza)).toHaveLength(1);
      // Same name, different documents — so this is real scoping, not a coincidence
      expect(idsOf(fromVelor)[0]).not.toBe(idsOf(fromPizza)[0]);
    });

    it("treats www and the apex as the same store", async () => {
      await addDomain(velor.tenant._id, "velor.com", { isPrimary: true });
      await addDomain(velor.tenant._id, "www.velor.com");

      const apex = await getTenantByHost("velor.com");
      const www = await getTenantByHost("www.velor.com");

      expect(String(apex._id)).toBe(String(velor.tenant._id));
      expect(String(www._id)).toBe(String(velor.tenant._id));
    });

    it("normalizes the host before matching it", async () => {
      await addDomain(velor.tenant._id, "velor.com");

      // What a proxy or a pasted value can realistically carry
      for (const variant of ["VELOR.com", "velor.com:443", "velor.com."]) {
        const tenant = await getTenantByHost(variant);
        expect(String(tenant?._id)).toBe(String(velor.tenant._id));
      }
    });
  });

  describe("hosts that must not resolve", () => {
    it("answers 404 for a domain nobody registered", async () => {
      const res = await getCategories({ "x-tenant-host": "not-a-store.com" }).expect(404);
      expect(res.body.code ?? res.body.data?.code).toBe("DOMAIN_NOT_FOUND");
    });

    /**
     * The point of verification: entering a hostname is not the same as owning
     * it. Until the DNS check passes, the row exists but must not route traffic.
     */
    it("ignores a domain that has not been verified", async () => {
      await addDomain(velor.tenant._id, "unverified.com", { status: "pending" });

      await expect(getTenantByHost("unverified.com")).resolves.toBeNull();
      await getCategories({ "x-tenant-host": "unverified.com" }).expect(404);
    });

    it("refuses a suspended store rather than serving it", async () => {
      await addDomain(pizza.tenant._id, "pizzashop.com");
      await require("../../src/models/platform/tenant.model").updateOne(
        { _id: pizza.tenant._id },
        { $set: { status: "suspended" } },
      );
      invalidateTenantCache();

      const res = await getCategories({ "x-tenant-host": "pizzashop.com" }).expect(403);
      expect(res.body.code ?? res.body.data?.code).toBe("TENANT_SUSPENDED");
    });

    it("cannot point one hostname at two stores", async () => {
      await addDomain(velor.tenant._id, "shared.com");
      await expect(addDomain(pizza.tenant._id, "shared.com")).rejects.toMatchObject({ code: 11000 });
    });

    it("refuses a hostname the platform reserves for itself", async () => {
      await expect(addDomain(velor.tenant._id, "api.com")).rejects.toThrow(/reserved/i);
    });
  });

  describe("the header cannot be used to impersonate a store", () => {
    /**
     * `x-tenant-host` is only meaningful because a proxy overwrites it. Where
     * that is not configured, believing it would let any visitor read any
     * store's data by typing a header, so it is ignored outright.
     */
    it("ignores the host header when the proxy is not trusted", async () => {
      await addDomain(velor.tenant._id, "velor.com");
      delete process.env.TRUST_TENANT_HOST_HEADER;

      // Falls through to "no store named" — strict mode then refuses the query
      // rather than quietly serving velor's data.
      const res = await getCategories({ "x-tenant-host": "velor.com" });
      expect(res.status).not.toBe(200);
    });

    it("refuses a staff token used against another store's domain", async () => {
      await addDomain(pizza.tenant._id, "pizzashop.com");
      const velorToken = jwt.sign(
        { sub: String(velor.user._id), tid: String(velor.tenant._id), tv: 0 },
        STAFF_ENV.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" },
      );

      await request(app.server)
        .get("/api/v1/auth/getme")
        .set({ "x-tenant-host": "pizzashop.com", Authorization: `Bearer ${velorToken}` })
        .expect(401);
    });
  });

  describe("primary domain", () => {
    // Payment redirects need one unambiguous answer to "where is this store?"
    it("keeps exactly one primary per store", async () => {
      const first = await addDomain(velor.tenant._id, "velor.com", { isPrimary: true });
      await addDomain(velor.tenant._id, "velor.shop", { isPrimary: true });

      const reloaded = await TenantDomain.findById(first._id).lean();
      expect(reloaded.isPrimary).toBe(false);
      await expect(TenantDomain.countDocuments({ tenantId: velor.tenant._id, isPrimary: true })).resolves.toBe(1);
    });
  });
});
