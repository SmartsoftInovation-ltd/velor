const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp, PASSWORD } = require("../helpers/platform");
const { setSettingsEnv } = require("../helpers/settings");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const PlatformUser = require("../../src/models/platform/platformUser.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");

describe("platform console API", () => {
  let app;
  let admin;
  let adminAuth;
  let supportAuth;

  beforeAll(async () => {
    setPlatformEnv();
    setSettingsEnv();
    await connectTestDb();
    await PlatformUser.init();
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    admin = await createPlatformUser({ role: "superadmin" });
    adminAuth = { Authorization: `Bearer ${signPlatformAccessToken(admin)}` };
    supportAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "support" }))}` };
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  describe("GET /settings/schema", () => {
    it("describes every settings section for form rendering, without secrets", async () => {
      const res = await request(app).get("/api/v1/platform/settings/schema").set(supportAuth).expect(200);
      const sms = res.body.data.find((section) => section.key === "sms");

      expect(sms).toMatchObject({ key: "sms", path: "sms", testable: true });
      expect(sms.fields).toEqual(expect.arrayContaining([
        { name: "enabled", type: "boolean", required: false, default: false },
        { name: "apiKey", type: "secret", required: true },
        { name: "provider", type: "enum", required: false, default: "bulksmsbd", values: ["bulksmsbd"] },
      ]));
      expect(res.body.data.find((section) => section.key === "general").testable).toBe(false);
    });
  });

  describe("GET /tenants/:id/audit", () => {
    it("lists the tenant's audit entries newest first with paging", async () => {
      const tenant = await Tenant.create({ name: "Pizza", slug: "pizzashop" });
      const other = await Tenant.create({ name: "Burger", slug: "burgerhub" });
      await PlatformAuditLog.create([
        { action: "TENANT_CREATED", tenantId: tenant._id, actorEmail: "a@x.test" },
        { action: "TENANT_SETTINGS_UPDATED", tenantId: tenant._id, changes: ["sms.apiKey"] },
        { action: "TENANT_CREATED", tenantId: other._id },
      ]);

      const res = await request(app).get(`/api/v1/platform/tenants/${tenant._id}/audit?limit=10`).set(supportAuth).expect(200);
      expect(res.body.data.total).toBe(2);
      expect(res.body.data.items.map((i) => i.action)).toEqual(["TENANT_SETTINGS_UPDATED", "TENANT_CREATED"]);
    });
  });

  describe("platform users", () => {
    it("superadmin lists, creates and updates operators", async () => {
      const created = await request(app).post("/api/v1/platform/users").set(adminAuth)
        .send({ name: "Support One", email: "support1@platform.test", password: "Support-Pass-123", role: "support" }).expect(201);
      expect(created.body.data.password).toBeUndefined();

      const list = await request(app).get("/api/v1/platform/users").set(adminAuth).expect(200);
      expect(list.body.data.map((u) => u.email)).toContain("support1@platform.test");

      const id = created.body.data._id;
      const updated = await request(app).patch(`/api/v1/platform/users/${id}`).set(adminAuth).send({ role: "superadmin", isActive: false }).expect(200);
      expect(updated.body.data).toMatchObject({ role: "superadmin", isActive: false, tokenVersion: 1 });
    });

    it("rejects weak passwords, duplicates, self-deactivation and support users", async () => {
      await request(app).post("/api/v1/platform/users").set(adminAuth).send({ name: "X Y", email: "x@platform.test", password: "short", role: "support" }).expect(400);
      await request(app).post("/api/v1/platform/users").set(adminAuth).send({ name: "Dup", email: admin.email, password: PASSWORD, role: "support" }).expect(400);
      await request(app).patch(`/api/v1/platform/users/${admin._id}`).set(adminAuth).send({ isActive: false }).expect(400);
      await request(app).get("/api/v1/platform/users").set(supportAuth).expect(403);
    });

    it("a password reset revokes the operator's sessions", async () => {
      const target = await createPlatformUser({ role: "support" });
      const res = await request(app).patch(`/api/v1/platform/users/${target._id}`).set(adminAuth).send({ password: "New-Support-Pass-1" }).expect(200);
      expect(res.body.data.tokenVersion).toBe(1);
      const stored = await PlatformUser.findById(target._id).select("+password");
      await expect(stored.comparePassword("New-Support-Pass-1")).resolves.toBe(true);
    });
  });
});
