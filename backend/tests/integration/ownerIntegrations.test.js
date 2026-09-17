jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn() }));

const axios = require("axios");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, ensurePermission, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const service = require("../../src/settings/settings.service");

// The store owner configures their own integrations from the dashboard
describe("owner-managed integrations (dashboard API)", () => {
  let app;
  let store;
  let ownerAuth;
  let managerAuth;
  const envBackup = { ...process.env };

  const sms = { enabled: true, apiUrl: "http://sms.example.test/send", apiKey: "store-sms-key-9876", senderId: "8809617" };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV);
    setSettingsEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invalidateTenantCache();
    service.clearSettingsCache();
    jest.clearAllMocks();
    store = await createTenantWithStaff({ slug: "pizzashop", roleSlug: "owner", email: "owner@pizza.com", password: "Owner-Pass1" });

    const permission = await ensurePermission("Store Settings");
    await runForTenant(store.tenant._id, async () => {
      const [manager] = await Role.insertMany([{ name: "manager", slug: "manager", permissions: [{ permission: permission._id, actions: ["view", "edit"] }] }]);
      await User.create({ name: "Manager", email: "manager@pizza.com", password: "Manager-Pass1", phone: "01811000000", roles: [manager._id] });
    });

    const login = async (email, password) =>
      (await request(app.server).post("/api/v1/auth/login").send({ workspace: "pizzashop", email, password })).body.data.accessToken;
    ownerAuth = { Authorization: `Bearer ${await login("owner@pizza.com", "Owner-Pass1")}` };
    managerAuth = { Authorization: `Bearer ${await login("manager@pizza.com", "Manager-Pass1")}` };
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  it("describes the integration sections the owner can configure", async () => {
    const res = await request(app.server).get("/api/v1/settings/schema").set(ownerAuth).expect(200);
    const keys = res.body.data.map((section) => section.key);

    expect(keys).toEqual(["sms", "email", "sslcommerz", "pathao", "steadfast", "cloudinary"]);
    expect(res.body.data.find((s) => s.key === "sslcommerz")).toMatchObject({ path: "payment/sslcommerz", testable: true });
  });

  it("the owner saves credentials; responses never contain the secret", async () => {
    const res = await request(app.server).patch("/api/v1/settings/sms").set(ownerAuth).send(sms).expect(200);

    expect(res.body.data.changes.sort()).toEqual(["sms.apiKey", "sms.apiUrl", "sms.enabled", "sms.senderId"]);
    expect(JSON.stringify(res.body)).not.toContain("store-sms-key-9876");

    const current = await request(app.server).get("/api/v1/settings").set(ownerAuth).expect(200);
    expect(current.body.data.features.sms).toBe(true);
    expect(current.body.data.settings.sms.apiKey).toMatchObject({ isSet: true, last4: "9876" });
    expect(current.body.data.canManageIntegrations).toBe(true);
  });

  it("returns validation errors for incomplete sections", async () => {
    const res = await request(app.server).patch("/api/v1/settings/payment/sslcommerz").set(ownerAuth).send({ enabled: true }).expect(400);
    expect(res.body.message).toMatch(/storeId.*storePassword/);
  });

  it("only the owner may change or test integrations; other staff see status only", async () => {
    await request(app.server).patch("/api/v1/settings/sms").set(ownerAuth).send(sms).expect(200);

    const denied = await request(app.server).patch("/api/v1/settings/sms").set(managerAuth).send({ senderId: "123" }).expect(403);
    expect(denied.body.message).toMatch(/owner/i);
    await request(app.server).post("/api/v1/settings/sms/test").set(managerAuth).expect(403);

    const view = await request(app.server).get("/api/v1/settings").set(managerAuth).expect(200);
    expect(view.body.data.settings.sms.apiKey).toEqual({ isSet: true });
    expect(view.body.data.canManageIntegrations).toBe(false);
  });

  it("the owner can test a section with the stored credentials", async () => {
    await request(app.server).patch("/api/v1/settings/sms").set(ownerAuth).send(sms).expect(200);
    axios.get.mockResolvedValue({ data: { balance: 42 } });

    const res = await request(app.server).post("/api/v1/settings/sms/test").set(ownerAuth).expect(200);

    expect(res.body.data).toEqual({ ok: true, detail: { balance: 42 } });
    expect(axios.get).toHaveBeenCalledWith(expect.any(String), { params: { api_key: "store-sms-key-9876" } });
  });

  it("the invoice prefix stays platform-managed", async () => {
    await request(app.server).patch("/api/v1/settings/general").set(ownerAuth).send({ invoicePrefix: "HACK" }).expect(403);
  });
});
