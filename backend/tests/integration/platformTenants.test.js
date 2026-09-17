const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp } = require("../helpers/platform");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");
const { runAsPlatform } = require("../../src/tenancy/context");

const BASE = "/api/v1/platform/tenants";

describe("platform tenants API", () => {
  let app;
  let admin;
  let adminAuth;
  let supportAuth;

  beforeAll(async () => {
    setPlatformEnv();
    await connectTestDb();
    await Tenant.init();
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    admin = await createPlatformUser({ role: "superadmin" });
    const support = await createPlatformUser({ role: "support" });
    adminAuth = { Authorization: `Bearer ${signPlatformAccessToken(admin)}` };
    supportAuth = { Authorization: `Bearer ${signPlatformAccessToken(support)}` };
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const createTenant = (body) => request(app).post(BASE).set(adminAuth).send(body);
  const seed = (overrides = {}) =>
    runAsPlatform(() => Tenant.create({ name: "Pizza Shop", slug: "pizzashop", ...overrides }));

  it("requires a platform token", async () => {
    await request(app).get(BASE).expect(401);
  });

  describe("POST /", () => {
    it("creates a tenant in provisioning status and audits it", async () => {
      const res = await createTenant({ name: "Pizza Shop", slug: "PizzaShop", plan: "pro", limits: { maxStaff: 10 } }).expect(201);

      expect(res.body.data).toMatchObject({
        name: "Pizza Shop",
        slug: "pizzashop",
        plan: "pro",
        status: "provisioning",
        limits: { maxStaff: 10 },
        createdBy: admin._id.toString(),
      });
      expect(res.body.data.webhookKey).toBeDefined();

      const audit = await PlatformAuditLog.findOne({ action: "TENANT_CREATED" });
      expect(audit.actor.toString()).toBe(admin._id.toString());
      expect(audit.tenantId.toString()).toBe(res.body.data._id);
      expect(audit.changes.sort()).toEqual(["limits", "name", "plan", "slug"]);
    });

    it("rejects invalid, reserved and duplicate slugs", async () => {
      const invalid = await createTenant({ name: "X Shop", slug: "a_b" }).expect(400);
      expect(invalid.body.message).toMatch(/Slug must be/);
      const reserved = await createTenant({ name: "X Shop", slug: "api" }).expect(400);
      expect(reserved.body.message).toMatch(/reserved/);

      await createTenant({ name: "Pizza", slug: "pizzashop" }).expect(201);
      const duplicate = await createTenant({ name: "Pizza 2", slug: "pizzashop" }).expect(400);
      expect(duplicate.body.message).toMatch(/already exists/);
    });

    it("rejects fields that must not be client-controlled", async () => {
      const status = await createTenant({ name: "X Shop", slug: "xshop", status: "active" }).expect(400);
      expect(status.body.message).toMatch(/"status" is not allowed/);
      const key = await createTenant({ name: "X Shop", slug: "xshop", webhookKey: "mine" }).expect(400);
      expect(key.body.message).toMatch(/"webhookKey" is not allowed/);
      await createTenant({ slug: "xshop" }).expect(400);
    });

    it("is not allowed for support users", async () => {
      await request(app).post(BASE).set(supportAuth).send({ name: "X Shop", slug: "xshop" }).expect(403);
    });
  });

  describe("GET /", () => {
    beforeEach(async () => {
      await seed({ name: "Pizza Shop", slug: "pizzashop", status: "active" });
      await seed({ name: "Burger Hub", slug: "burgerhub", status: "suspended" });
      await seed({ name: "Cake House", slug: "cakehouse", status: "active" });
    });

    it("lists tenants with pagination, newest first", async () => {
      const res = await request(app).get(`${BASE}?limit=2&page=1`).set(supportAuth).expect(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.items.map((t) => t.slug)).toEqual(["cakehouse", "burgerhub"]);
      expect(res.body.data).toMatchObject({ page: 1, limit: 2 });
    });

    it("filters by status and searches name or slug case-insensitively", async () => {
      const byStatus = await request(app).get(`${BASE}?status=active`).set(supportAuth).expect(200);
      expect(byStatus.body.data.items.map((t) => t.slug).sort()).toEqual(["cakehouse", "pizzashop"]);

      const bySearch = await request(app).get(`${BASE}?search=BURGER`).set(supportAuth).expect(200);
      expect(bySearch.body.data.items.map((t) => t.slug)).toEqual(["burgerhub"]);
    });

    it("returns per-status counts for the current search, regardless of the status filter", async () => {
      const res = await request(app).get(`${BASE}?status=suspended`).set(supportAuth).expect(200);
      expect(res.body.data.counts).toEqual({ all: 3, active: 2, provisioning: 0, suspended: 1, cancelled: 0 });

      const searched = await request(app).get(`${BASE}?search=pizza`).set(supportAuth).expect(200);
      expect(searched.body.data.counts).toMatchObject({ all: 1, active: 1 });
    });

    it("treats search text literally", async () => {
      const res = await request(app).get(`${BASE}?search=.*`).set(supportAuth).expect(200);
      expect(res.body.data.total).toBe(0);
    });

    it("validates query parameters", async () => {
      await request(app).get(`${BASE}?status=deleted`).set(supportAuth).expect(400);
      await request(app).get(`${BASE}?limit=500`).set(supportAuth).expect(400);
    });
  });

  describe("GET /:tenantId", () => {
    it("returns a tenant, 400 for a malformed id and 404 for an unknown id", async () => {
      const tenant = await seed();
      const res = await request(app).get(`${BASE}/${tenant._id}`).set(supportAuth).expect(200);
      expect(res.body.data.slug).toBe("pizzashop");

      await request(app).get(`${BASE}/not-an-id`).set(supportAuth).expect(400);
      await request(app).get(`${BASE}/${"a".repeat(24)}`).set(supportAuth).expect(404);
    });
  });

  describe("PATCH /:tenantId", () => {
    it("updates name, plan and limits and audits only changed fields", async () => {
      const tenant = await seed({ plan: "standard" });

      const res = await request(app)
        .patch(`${BASE}/${tenant._id}`)
        .set(adminAuth)
        .send({ name: "Pizza Shop BD", plan: "standard", limits: { maxStaff: 3 } })
        .expect(200);

      expect(res.body.data).toMatchObject({ name: "Pizza Shop BD", limits: { maxStaff: 3 } });
      const audit = await PlatformAuditLog.findOne({ action: "TENANT_UPDATED" });
      expect(audit.changes.sort()).toEqual(["limits.maxStaff", "name"]);
    });

    it("does not allow changing slug, status or webhookKey, or an empty body", async () => {
      const tenant = await seed();
      await request(app).patch(`${BASE}/${tenant._id}`).set(adminAuth).send({ slug: "other" }).expect(400);
      await request(app).patch(`${BASE}/${tenant._id}`).set(adminAuth).send({ status: "active" }).expect(400);
      await request(app).patch(`${BASE}/${tenant._id}`).set(adminAuth).send({}).expect(400);
    });

    it("is not allowed for support users", async () => {
      const tenant = await seed();
      await request(app).patch(`${BASE}/${tenant._id}`).set(supportAuth).send({ name: "X" }).expect(403);
    });
  });

  describe("status transitions", () => {
    const post = (tenant, action, body = {}) =>
      request(app).post(`${BASE}/${tenant._id}/${action}`).set(adminAuth).send(body);

    it("suspends an active tenant with a reason and audits it", async () => {
      const tenant = await seed({ status: "active" });

      const res = await post(tenant, "suspend", { reason: "Unpaid invoice" }).expect(200);

      expect(res.body.data).toMatchObject({ status: "suspended", statusReason: "Unpaid invoice" });
      expect(res.body.data.statusChangedAt).toBeDefined();
      expect(await PlatformAuditLog.countDocuments({ action: "TENANT_SUSPENDED", tenantId: tenant._id })).toBe(1);
    });

    it("activates a provisioning or suspended tenant", async () => {
      const provisioning = await seed();
      await post(provisioning, "activate").expect(200);

      const suspended = await seed({ slug: "burgerhub", status: "suspended", statusReason: "late" });
      const res = await post(suspended, "activate").expect(200);
      expect(res.body.data).toMatchObject({ status: "active", statusReason: "" });
      expect(await PlatformAuditLog.countDocuments({ action: "TENANT_ACTIVATED" })).toBe(2);
    });

    it("returns 409 for transitions that are not allowed", async () => {
      const active = await seed({ status: "active" });
      await post(active, "activate").expect(409);

      const suspended = await seed({ slug: "burgerhub", status: "suspended" });
      await post(suspended, "suspend").expect(409);

      const cancelled = await seed({ slug: "cakehouse", status: "cancelled" });
      await post(cancelled, "activate").expect(409);
      await post(cancelled, "suspend").expect(409);
    });

    it("returns 404 for an unknown tenant and 403 for support users", async () => {
      await request(app).post(`${BASE}/${"a".repeat(24)}/suspend`).set(adminAuth).expect(404);
      const tenant = await seed({ status: "active" });
      await request(app).post(`${BASE}/${tenant._id}/suspend`).set(supportAuth).expect(403);
    });
  });
});
