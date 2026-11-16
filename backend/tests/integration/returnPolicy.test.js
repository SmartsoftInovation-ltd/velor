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

/**
 * The return policy is written in the dashboard and printed as HTML on the
 * storefront, so what is stored must be clean, and each store has its own.
 */
describe("return policy", () => {
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
  const save = async (store, slug, content) =>
    request(app.server).put("/api/v1/siteinformation/return-policy").set(await staffOf(store, slug)).send({ content });
  const shown = (headers) => request(app.server).get("/api/v1/shop/return-policy").set(headers);

  it("is empty until the store writes one", async () => {
    const res = await shown(VELOR).expect(200);
    expect(res.body.data.content).toBe("");
  });

  it("shows on the storefront what the dashboard saved, and updates in place", async () => {
    expect((await save(velor, "velor", "<h2>Returns</h2><p>Within <strong>7 days</strong>.</p>")).status).toBe(200);
    expect((await shown(VELOR).expect(200)).body.data.content).toBe("<h2>Returns</h2><p>Within <strong>7 days</strong>.</p>");

    await save(velor, "velor", "<p>Within 3 days.</p>");
    expect((await shown(VELOR).expect(200)).body.data.content).toBe("<p>Within 3 days.</p>");

    const read = await request(app.server).get("/api/v1/siteinformation/return-policy").set(await staffOf(velor, "velor")).expect(200);
    expect(read.body.data.content).toBe("<p>Within 3 days.</p>");
  });

  it("strips scripts, handlers, styles and unsafe links", async () => {
    await save(
      velor,
      "velor",
      '<p onclick="x()" style="color:red">Hi<script>alert(1)</script><img src=x onerror=alert(1)></p><a href="javascript:alert(1)">bad</a><a href="https://velor.com/help">ok</a><iframe src="https://evil.test"></iframe>',
    );
    const { content } = (await shown(VELOR).expect(200)).body.data;
    expect(content).not.toMatch(/script|onclick|onerror|style=|javascript:|iframe|<img/i);
    expect(content).toContain('<a href="https://velor.com/help" target="_blank" rel="noopener noreferrer">ok</a>');
  });

  it("treats the editor's empty document as no policy", async () => {
    await save(velor, "velor", "<p>Something</p>");
    await save(velor, "velor", "<p><br></p>");
    expect((await shown(VELOR).expect(200)).body.data.content).toBe("");
  });

  it("keeps each store's policy to itself", async () => {
    await save(velor, "velor", "<p>Velor policy</p>");
    await save(pizza, "pizzashop", "<p>Pizza policy</p>");
    expect((await shown(VELOR).expect(200)).body.data.content).toBe("<p>Velor policy</p>");
    expect((await shown(PIZZA).expect(200)).body.data.content).toBe("<p>Pizza policy</p>");
  });

  it("refuses a save with no content, or without signing in", async () => {
    expect((await save(velor, "velor", undefined)).status).toBe(400);
    await request(app.server).put("/api/v1/siteinformation/return-policy").set({ "x-tenant": "velor" }).send({ content: "<p>x</p>" }).expect(401);
  });
});
