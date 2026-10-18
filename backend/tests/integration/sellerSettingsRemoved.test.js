const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const service = require("../../src/settings/settings.service");

// A store's settings are managed only by the platform, on the seller's page in
// the Platform Console (/platform/tenants/:tenantId/settings). The store
// session has no settings API of its own, not even for the store owner.
describe("store settings are platform-only", () => {
  let app;
  let ownerAuth;
  const envBackup = { ...process.env };

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
    await createTenantWithStaff({ slug: "pizzashop", roleSlug: "owner", email: "owner@pizza.com", password: "Owner-Pass1" });
    const login = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ workspace: "pizzashop", email: "owner@pizza.com", password: "Owner-Pass1" });
    ownerAuth = { Authorization: `Bearer ${login.body.data.accessToken}` };
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  it.each([
    ["get", "/api/v1/settings"],
    ["get", "/api/v1/settings/schema"],
    ["get", "/api/v1/settings/webhooks"],
    ["patch", "/api/v1/settings/general"],
    ["patch", "/api/v1/settings/sms"],
    ["post", "/api/v1/settings/sms/test"],
  ])("the store owner gets 404 for %s %s", async (method, path) => {
    await request(app.server)[method](path).set(ownerAuth).send({ senderId: "HACK" }).expect(404);
  });
});
