const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp } = require("../helpers/platform");
const { setSettingsEnv } = require("../helpers/settings");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");
const service = require("../../src/settings/settings.service");

describe("platform tenant settings API", () => {
  let app;
  let tenant;
  let adminAuth;
  let supportAuth;

  beforeAll(async () => {
    setPlatformEnv();
    setSettingsEnv();
    await connectTestDb();
    app = buildPlatformApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    service.clearSettingsCache();
    tenant = await Tenant.create({ name: "Pizza Shop", slug: "pizzashop", status: "active" });
    adminAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };
    supportAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "support" }))}` };
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const url = (suffix = "") => `/api/v1/platform/tenants/${tenant._id}/settings${suffix}`;

  it.each([
    ["general", { invoicePrefix: "PZS", orderHotline: "01711000000" }],
    ["sms", { enabled: true, apiUrl: "http://bulksmsbd.net/api/smsapi", apiKey: "sms-key-123456", senderId: "8809617" }],
    ["email", { mode: "smtp", smtpHost: "smtp.gmail.com", smtpUser: "shop@example.com", smtpPassword: "smtp-pass-123" }],
    ["payment/sslcommerz", { enabled: true, storeId: "pizza66f0test", storePassword: "pizza66f0test@ssl" }],
    ["couriers/pathao", { enabled: true, baseUrl: "https://api-hermes.pathao.com", clientId: "cid", clientSecret: "csecret-123", username: "u@example.com", password: "pathao-pass", storeId: "123" }],
    ["couriers/steadfast", { enabled: true, baseUrl: "https://portal.packzy.com/api/v1", apiKey: "sf-key", secretKey: "sf-secret-1" }],
    ["cloudinary", { enabled: true, cloudName: "pizza-cdn", apiKey: "123456789012345", apiSecret: "cloud-secret-1" }],
    ["ai/groq", { enabled: true, apiKey: "gsk_testkey12345" }],
  ])("PATCH %s assigns the section and never echoes secrets", async (path, body) => {
    const res = await request(app).patch(url(`/${path}`)).set(adminAuth).send(body).expect(200);

    for (const value of Object.values(body)) {
      if (typeof value === "string" && /pass|secret|key|gsk_/i.test(value)) {
        expect(JSON.stringify(res.body)).not.toContain(value);
      }
    }
    expect(res.body.data.version).toBe(1);
  });

  it("GET returns every section masked", async () => {
    await request(app).patch(url("/sms")).set(adminAuth)
      .send({ enabled: true, apiUrl: "http://bulksmsbd.net/api/smsapi", apiKey: "sms-key-123456", senderId: "8809617" });

    const res = await request(app).get(url()).set(supportAuth).expect(200);

    expect(res.body.data.settings.sms.apiKey).toMatchObject({ isSet: true, last4: "3456" });
    expect(res.body.data.features.sms).toBe(true);
    expect(res.body.data.version).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain("sms-key-123456");
  });

  it("audits changed field names only", async () => {
    await request(app).patch(url("/sms")).set(adminAuth)
      .send({ enabled: true, apiUrl: "http://bulksmsbd.net/api/smsapi", apiKey: "sms-key-123456", senderId: "8809617" });

    const audit = await PlatformAuditLog.findOne({ action: "TENANT_SETTINGS_UPDATED" }).lean();
    expect(audit.tenantId.toString()).toBe(tenant._id.toString());
    expect(audit.changes.sort()).toEqual(["sms.apiKey", "sms.apiUrl", "sms.enabled", "sms.senderId"]);
    expect(JSON.stringify(audit)).not.toContain("sms-key-123456");
  });

  it("validates input, rejects support users and unknown tenants", async () => {
    await request(app).patch(url("/sms")).set(adminAuth).send({ enabled: true }).expect(400);
    await request(app).patch(url("/general")).set(supportAuth).send({ invoicePrefix: "PZS" }).expect(403);
    await request(app).patch(`/api/v1/platform/tenants/${"a".repeat(24)}/settings/general`).set(adminAuth).send({ invoicePrefix: "PZS" }).expect(404);
    await request(app).patch(url("/unknown")).set(adminAuth).send({}).expect(404);
  });

  it("GET /webhooks returns the tenant's callback URLs", async () => {
    const res = await request(app).get(url("/webhooks")).set(supportAuth).expect(200);
    expect(res.body.data.pathao).toBe(`https://api.example.test/api/v1/hooks/pathao/${tenant.webhookKey}`);
  });
});
