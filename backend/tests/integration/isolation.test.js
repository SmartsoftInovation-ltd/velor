const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Category = require("../../src/models/category.model");
const service = require("../../src/settings/settings.service");

// Two stores with identical data (same supplier mobile, same names, same staff email)
// must never see, change or aggregate each other's records. Runs in strict mode.
describe("cross-tenant isolation (strict mode)", () => {
  let app;
  let stores;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV, { TENANCY_MODE: "strict" });
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    invalidateTenantCache();
    service.clearSettingsCache();
    const platformAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };

    stores = {};
    for (const slug of ["pizzashop", "burgerhub"]) {
      const { body } = await request(app.server).post("/api/v1/platform/tenants").set(platformAuth).send({
        name: slug,
        slug,
        owner: { name: "Owner", email: "owner@shop.com", phone: "01711000000", password: `${slug}-Owner-Pass1` },
      });
      const login = await request(app.server).post("/api/v1/auth/login")
        .send({ workspace: slug, email: "owner@shop.com", password: `${slug}-Owner-Pass1` });
      stores[slug] = { tenant: body.data.tenant, auth: { Authorization: `Bearer ${login.body.data.accessToken}`, "x-tenant": slug } };
    }
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const as = (slug) => stores[slug].auth;
  const api = () => request(app.server);

  it("suppliers: same mobile allowed per store; lists, updates, deletes and summaries stay in the store", async () => {
    await api().post("/api/v1/supplier/addsupplier").set(as("pizzashop")).send({ supplierName: "Rahim Traders", mobile: "01711111111", openingDues: 100 }).expect(201);
    await api().post("/api/v1/supplier/addsupplier").set(as("burgerhub")).send({ supplierName: "Rahim Traders", mobile: "01711111111", openingDues: 900 }).expect(201);

    const pizzaList = (await api().get("/api/v1/supplier/getsuppliers").set(as("pizzashop")).expect(200)).body.data;
    expect(pizzaList).toHaveLength(1);
    expect(pizzaList[0].totalPurchaseDue).toBe(100);

    const pizzaSupplierId = pizzaList[0]._id;
    await api().delete(`/api/v1/supplier/delete-supplier/${pizzaSupplierId}`).set(as("burgerhub")).expect(404);
    expect((await api().get("/api/v1/supplier/getsuppliers").set(as("pizzashop"))).body.data).toHaveLength(1);

    const summary = (store) => api().get("/api/v1/dashboard/supplier-summary").set(as(store)).expect(200);
    expect((await summary("pizzashop")).body.data.supplier).toEqual({ totalSupplier: 1, totalDue: 100 });
    // Cached for pizzashop; burgerhub must not get that cache entry
    expect((await summary("burgerhub")).body.data.supplier).toEqual({ totalSupplier: 1, totalDue: 900 });
  });

  it("delivery charges: another store's id is not found", async () => {
    const created = await api().post("/api/v1/delivery-charge/create-delivery-charge").set(as("pizzashop"))
      .send({ name: "inside_dhaka", deliveryCharge: 60 });
    expect(created.status).toBeLessThan(300);
    const id = created.body.data._id;

    await api().get(`/api/v1/delivery-charge/get-single-delivery-charge/${id}`).set(as("burgerhub")).expect(404);
    await api().put(`/api/v1/delivery-charge/update-delivery-charge/${id}`).set(as("burgerhub")).send({ deliveryCharge: 1 }).expect(404);
    const own = await api().get(`/api/v1/delivery-charge/get-single-delivery-charge/${id}`).set(as("pizzashop")).expect(200);
    expect(own.body.data.deliveryCharge).toBe(60);
  });

  it("users and roles lists only contain the store's own records", async () => {
    for (const slug of ["pizzashop", "burgerhub"]) {
      const users = (await api().get("/api/v1/auth/getallusers").set(as(slug)).expect(200)).body.data;
      expect(users).toHaveLength(1);
      const roles = (await api().get("/api/v1/all-role").set(as(slug)).expect(200)).body.data;
      expect(roles.every((r) => r.tenantId === stores[slug].tenant._id)).toBe(true);
    }
  });

  it("public endpoints are scoped by the x-tenant header", async () => {
    await runForTenant(stores.pizzashop.tenant._id, () => Category.create({ name: "Pizza", isActive: true }));
    await runForTenant(stores.burgerhub.tenant._id, () => Category.create({ name: "Burger", isActive: true }));

    const names = async (slug) =>
      (await api().get("/api/v1/categories-active").set("x-tenant", slug).expect(200)).body.data.categories.map((c) => c.name);

    expect(await names("pizzashop")).toEqual(["Pizza"]);
    // second read of each is served from cache: still per store
    expect(await names("burgerhub")).toEqual(["Burger"]);
    expect(await names("pizzashop")).toEqual(["Pizza"]);
  });

  it("settings stay per store", async () => {
    await api().patch("/api/v1/settings/general").set(as("pizzashop")).send({ orderHotline: "01711000000" }).expect(200);
    const burger = await api().get("/api/v1/settings").set(as("burgerhub")).expect(200);
    expect(burger.body.data.settings.general.orderHotline).toBe("");
  });

  it("a token cannot be used against another store, and requests without a store fail cleanly", async () => {
    await api().get("/api/v1/auth/getme").set({ ...as("pizzashop"), "x-tenant": "burgerhub" }).expect(401);
    const res = await api().get("/api/v1/categories-active").expect(400);
    expect(res.body.code).toBe("TENANT_CONTEXT_REQUIRED");
  });
});
