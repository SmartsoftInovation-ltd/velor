const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp } = require("../helpers/platform");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");
const { runAsPlatform } = require("../../src/tenancy/context");
const { getTenantByHost, invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { recordName, recordValue, setResolver } = require("../../src/service/domainVerification.service");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");

/**
 * Domains are added by an operator but only start routing traffic once DNS
 * proves the seller owns them. These tests cover both ends of that: the API
 * that records the claim, and the check that turns a claim into a live route.
 *
 * DNS is stubbed rather than queried — the behaviour under test is what we do
 * with the answer, not whether the resolver works.
 */

const BASE = "/api/v1/platform/tenants";

// Stands in for dns/promises; `resolveTxt` returns chunk arrays, as the real one does.
const stubResolver = (byName) => ({
  resolveTxt: async (name) => {
    const records = byName[name];
    if (!records) {
      const error = new Error(`queryTxt ENOTFOUND ${name}`);
      error.code = "ENOTFOUND";
      throw error;
    }
    return records;
  },
});

describe("platform domain API", () => {
  let app;
  let adminAuth;
  let supportAuth;
  let tenant;

  beforeAll(async () => {
    setPlatformEnv();
    await connectTestDb();
    await Promise.all([Tenant.init(), TenantDomain.init()]);
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    resetRateLimitCounters();
    invalidateTenantCache();
    const admin = await createPlatformUser({ role: "superadmin" });
    const support = await createPlatformUser({ role: "support" });
    adminAuth = { Authorization: `Bearer ${signPlatformAccessToken(admin)}` };
    supportAuth = { Authorization: `Bearer ${signPlatformAccessToken(support)}` };
    tenant = await runAsPlatform(() => Tenant.create({ name: "Velor", slug: "velor", status: "active" }));
  });

  afterEach(async () => {
    setResolver(null); // back to real DNS, so a stub cannot leak into another test
    await clearTestDb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const addDomain = (body, auth = adminAuth) =>
    request(app).post(`${BASE}/${tenant._id}/domains`).set(auth).send(body);

  const verify = (domainId, auth = adminAuth) =>
    request(app).post(`${BASE}/${tenant._id}/domains/${domainId}/verify`).set(auth).send({});

  describe("access control", () => {
    it("requires a platform token", async () => {
      await request(app).get(`${BASE}/${tenant._id}/domains`).expect(401);
    });

    // Routing a domain decides which store a visitor's data lands in, so it is
    // not a support-level action.
    it("refuses a non-superadmin operator", async () => {
      await addDomain({ host: "velor.com" }, supportAuth).expect(403);
    });
  });

  describe("adding a domain", () => {
    it("records it as pending and returns the DNS record to publish", async () => {
      const res = await addDomain({ host: "Velor.com" }).expect(201);

      expect(res.body.data).toMatchObject({ host: "velor.com", status: "pending", isPrimary: false });
      expect(res.body.data.dnsRecord).toMatchObject({ type: "TXT", name: "_velor-verify.velor.com" });
      expect(res.body.data.dnsRecord.value).toMatch(/^velor-verify=/);
    });

    // The whole point of verification: a pending row must not route anything.
    it("does not route traffic before verification", async () => {
      await addDomain({ host: "velor.com" }).expect(201);
      await expect(getTenantByHost("velor.com")).resolves.toBeNull();
    });

    it("refuses a domain another store already claimed", async () => {
      const other = await runAsPlatform(() => Tenant.create({ name: "Pizza", slug: "pizzashop", status: "active" }));
      await TenantDomain.create({ tenantId: other._id, host: "taken.com", status: "active" });

      await addDomain({ host: "taken.com" }).expect(409);
    });

    it("rejects a hostname the platform reserves", async () => {
      await addDomain({ host: "api.com" }).expect(400);
    });

    it("audits the addition", async () => {
      await addDomain({ host: "velor.com" }).expect(201);

      const log = await PlatformAuditLog.findOne({ action: "DOMAIN_ADDED" }).lean();
      expect(log).toMatchObject({ tenantId: tenant._id, metadata: { host: "velor.com" } });
    });
  });

  describe("verification", () => {
    let domain;

    beforeEach(async () => {
      const res = await addDomain({ host: "velor.com" }).expect(201);
      domain = await TenantDomain.findById(res.body.data._id);
    });

    it("activates the domain when the TXT record matches, and it then routes", async () => {
      setResolver(stubResolver({ [recordName("velor.com")]: [[recordValue(domain.verificationToken)]] }));

      const res = await verify(domain._id).expect(200);
      expect(res.body.data).toMatchObject({ host: "velor.com", status: "active" });

      invalidateTenantCache();
      const resolved = await getTenantByHost("velor.com");
      expect(String(resolved._id)).toBe(String(tenant._id));

      const log = await PlatformAuditLog.findOne({ action: "DOMAIN_VERIFIED" }).lean();
      expect(log).toMatchObject({ metadata: { host: "velor.com" } });
    });

    it("fails, and still does not route, when the record does not match", async () => {
      setResolver(stubResolver({ [recordName("velor.com")]: [["velor-verify=somebody-elses-token"]] }));

      const res = await verify(domain._id).expect(200);
      expect(res.body.data.status).toBe("failed");
      expect(res.body.data.failureReason).toMatch(/does not match/i);

      invalidateTenantCache();
      await expect(getTenantByHost("velor.com")).resolves.toBeNull();
    });

    // A seller who has just published the record often checks before it has
    // propagated; that must read as "not yet", not as a hard error.
    it("reports a missing record without failing the request", async () => {
      setResolver(stubResolver({}));

      const res = await verify(domain._id).expect(200);
      expect(res.body.data.status).toBe("failed");
      expect(res.body.data.failureReason).toMatch(/no txt record/i);
    });
  });

  describe("primary domain", () => {
    it("refuses to make an unverified domain primary", async () => {
      const res = await addDomain({ host: "velor.com" }).expect(201);
      await request(app)
        .patch(`${BASE}/${tenant._id}/domains/${res.body.data._id}`)
        .set(adminAuth)
        .send({ isPrimary: true })
        .expect(422);
    });

    it("moves primary from one verified domain to another", async () => {
      const first = await TenantDomain.create({ tenantId: tenant._id, host: "velor.com", status: "active", isPrimary: true });
      const second = await TenantDomain.create({ tenantId: tenant._id, host: "velor.shop", status: "active" });

      await request(app)
        .patch(`${BASE}/${tenant._id}/domains/${second._id}`)
        .set(adminAuth)
        .send({ isPrimary: true })
        .expect(200);

      await expect(TenantDomain.findById(first._id).lean()).resolves.toMatchObject({ isPrimary: false });
      await expect(TenantDomain.countDocuments({ tenantId: tenant._id, isPrimary: true })).resolves.toBe(1);
    });
  });

  describe("removal", () => {
    /**
     * The hostname cache is what makes resolution cheap, and it is also what
     * would keep a removed domain alive. Removing must clear it.
     */
    it("stops routing immediately, not after the cache expires", async () => {
      const domain = await TenantDomain.create({ tenantId: tenant._id, host: "velor.com", status: "active" });
      // Warm the cache so a stale entry would be there to serve
      await expect(getTenantByHost("velor.com")).resolves.toMatchObject({ slug: "velor" });

      await request(app).delete(`${BASE}/${tenant._id}/domains/${domain._id}`).set(adminAuth).expect(200);

      await expect(getTenantByHost("velor.com")).resolves.toBeNull();
      const log = await PlatformAuditLog.findOne({ action: "DOMAIN_REMOVED" }).lean();
      expect(log).toMatchObject({ metadata: { host: "velor.com" } });
    });

    it("cannot remove a domain through another tenant's url", async () => {
      const other = await runAsPlatform(() => Tenant.create({ name: "Pizza", slug: "pizzashop", status: "active" }));
      const domain = await TenantDomain.create({ tenantId: other._id, host: "pizzashop.com", status: "active" });

      await request(app).delete(`${BASE}/${tenant._id}/domains/${domain._id}`).set(adminAuth).expect(404);
      await expect(TenantDomain.countDocuments({ _id: domain._id })).resolves.toBe(1);
    });
  });

  describe("listing", () => {
    it("lists a tenant's domains, primary first", async () => {
      await TenantDomain.create({ tenantId: tenant._id, host: "velor.shop", status: "active" });
      await TenantDomain.create({ tenantId: tenant._id, host: "velor.com", status: "active", isPrimary: true });

      const res = await request(app).get(`${BASE}/${tenant._id}/domains`).set(adminAuth).expect(200);
      expect(res.body.data.map((d) => d.host)).toEqual(["velor.com", "velor.shop"]);
    });
  });
});
