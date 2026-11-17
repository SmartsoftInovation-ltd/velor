const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { STAFF_ENV, loadApp, createTenantWithStaff } = require("../helpers/tenantApp");
const { setSettingsEnv } = require("../helpers/settings");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const service = require("../../src/settings/settings.service");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const User = require("../../src/models/user.model");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const ContactMessage = require("../../src/models/contactMessage.model");

/**
 * Shoppers write to a store from its Contact page; that store's staff read the
 * messages in the dashboard. Public input, so it is validated and capped, and a
 * message never crosses to another store.
 */
describe("contact messages", () => {
  let app;
  let velor;
  let pizza;
  const envBackup = { ...process.env };
  const VELOR = { "x-tenant-host": "velor.com" };
  const PIZZA = { "x-tenant-host": "pizzashop.com" };

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
    resetRateLimitCounters();

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test", password: "Velor-Pass1" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test", password: "Pizza-Pass1" });
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });
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

  const staffOf = async (store, slug) => {
    const user = await runForTenant(store.tenant._id, () => User.findById(store.user._id).populate("roles"));
    return { Authorization: `Bearer ${user.generateJwtAccessToken()}`, "x-tenant": slug };
  };
  const send = (headers, body) => request(app.server).post("/api/v1/shop/contact").set(headers).send(body);
  const MESSAGE = { name: "Rahim", email: "Rahim@Example.com", subject: "Delivery", message: "When will my order arrive?" };

  it("saves a message for the store whose domain it was sent on", async () => {
    await send(VELOR, { ...MESSAGE, isRead: true, tenantId: String(pizza.tenant._id) }).expect(201);

    const saved = await runForTenant(velor.tenant._id, () => ContactMessage.find().lean());
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: "Rahim", email: "rahim@example.com", subject: "Delivery", isRead: false });
    expect(await runForTenant(pizza.tenant._id, () => ContactMessage.countDocuments())).toBe(0);
  });

  it("refuses a missing field, a bad email or an over-long message", async () => {
    await send(VELOR, { ...MESSAGE, name: " " }).expect(400);
    await send(VELOR, { ...MESSAGE, email: "not-an-email" }).expect(400);
    await send(VELOR, { ...MESSAGE, message: "x".repeat(501) }).expect(400);
    await send(VELOR, { ...MESSAGE, subject: "" }).expect(201);
  });

  it("caps messages per sender email", async () => {
    for (let i = 0; i < 5; i += 1) await send(VELOR, MESSAGE).expect(201);
    await send(VELOR, MESSAGE).expect(429);
    await send(VELOR, { ...MESSAGE, email: "karim@example.com" }).expect(201);
  });

  it("lets staff list, mark read and delete only their own store's messages", async () => {
    await send(VELOR, MESSAGE).expect(201);
    await send(VELOR, { ...MESSAGE, email: "second@example.com" }).expect(201);
    await send(PIZZA, MESSAGE).expect(201);
    const staff = await staffOf(velor, "velor");

    const list = await request(app.server).get("/api/v1/contact-messages").set(staff).expect(200);
    expect(list.body.data).toMatchObject({ total: 2, unread: 2 });
    const [newest] = list.body.data.items;
    expect(newest.email).toBe("second@example.com");

    await request(app.server).patch(`/api/v1/contact-messages/${newest._id}/read`).set(staff).send({ isRead: true }).expect(200);
    const unread = await request(app.server).get("/api/v1/contact-messages?status=unread").set(staff).expect(200);
    expect(unread.body.data).toMatchObject({ total: 1, unread: 1 });

    const pizzaMessage = await runForTenant(pizza.tenant._id, () => ContactMessage.findOne().lean());
    await request(app.server).delete(`/api/v1/contact-messages/${pizzaMessage._id}`).set(staff).expect(404);
    await request(app.server).delete(`/api/v1/contact-messages/${newest._id}`).set(staff).expect(200);
    expect((await request(app.server).get("/api/v1/contact-messages").set(staff).expect(200)).body.data.total).toBe(1);
  });

  it("needs a signed-in staff member", async () => {
    await request(app.server).get("/api/v1/contact-messages").set({ "x-tenant": "velor" }).expect(401);
  });
});
