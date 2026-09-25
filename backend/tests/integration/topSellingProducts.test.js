const request = require("supertest");
const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const service = require("../../src/settings/settings.service");
const productModel = require("../../src/models/product.model");
const salesModel = require("../../src/models/sales.model");
const variantModel = require("../../src/models/variant.model");

// The Top Selling Products box has its own 1/2/3 month window (rolling 30-day
// months) and shows each variant as its own row.
describe("dashboard top selling products", () => {
  let app;
  let store;
  const envBackup = { ...process.env };
  const DAY = 24 * 60 * 60 * 1000;

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
    const platformAuth = {
      Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}`,
    };
    const slug = "topshop";
    const password = "topshop-Owner-Pass1";
    const { body } = await request(app.server).post("/api/v1/platform/tenants").set(platformAuth).send({
      name: slug,
      slug,
      owner: { name: "Owner", email: "owner@shop.com", phone: "01711000000", password },
    });
    const login = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ workspace: slug, email: "owner@shop.com", password });
    store = {
      tenantId: new mongoose.Types.ObjectId(body.data.tenant._id),
      auth: { Authorization: `Bearer ${login.body.data.accessToken}`, "x-tenant": slug },
    };
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const product = (name) =>
    runForTenant(store.tenantId, async () => {
      const { insertedId } = await productModel.collection.insertOne({
        tenantId: store.tenantId,
        name,
        variantType: "multipleVariant",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return insertedId;
    });

  const variant = (productId, variantName) =>
    runForTenant(store.tenantId, async () => {
      const { insertedId } = await variantModel.collection.insertOne({
        tenantId: store.tenantId,
        product: productId,
        variantName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return insertedId;
    });

  // One sale, `daysAgo` days back, with [productId, variantId, description, quantity] lines.
  const sale = (daysAgo, lines) =>
    runForTenant(store.tenantId, () =>
      salesModel.collection.insertOne({
        tenantId: store.tenantId,
        searchItem: lines.map(([productId, variantId, productDescription, quantity]) => ({
          productId,
          variantId,
          productDescription,
          quantity,
          subtotal: quantity * 100,
        })),
        createdAt: new Date(Date.now() - daysAgo * DAY),
        updatedAt: new Date(),
      }),
    );

  const top = async (months) =>
    (
      await request(app.server)
        .get(`/api/v1/dashboard/top-selling-products?months=${months}`)
        .set(store.auth)
        .expect(200)
    ).body.data;

  it("shows each variant and each single product as its own row", async () => {
    const panjabi = await product("Panjabi");
    const red = await variant(panjabi, "M Red");
    const blue = await variant(panjabi, "L Blue");
    const shirt = await product("Shirt");
    await sale(1, [
      [panjabi, red, "Panjabi", 2],
      [panjabi, blue, "Panjabi", 3],
      [panjabi, blue, "Panjabi", 1],
      [shirt, null, "Shirt", 3],
    ]);

    const data = await top(1);
    expect(data.months).toBe(1);
    expect(data.topProducts).toEqual([
      { name: "Panjabi · L Blue", quantity: 4, revenue: 400 },
      { name: "Shirt", quantity: 3, revenue: 300 },
      { name: "Panjabi · M Red", quantity: 2, revenue: 200 },
    ]);
  });

  it("widens the window with 2 and 3 months", async () => {
    const panjabi = await product("Panjabi");
    await sale(10, [[panjabi, null, "Panjabi", 1]]);
    await sale(45, [[panjabi, null, "Panjabi", 2]]);
    await sale(75, [[panjabi, null, "Panjabi", 4]]);
    await sale(100, [[panjabi, null, "Panjabi", 8]]);

    expect((await top(1)).topProducts[0].quantity).toBe(1);
    expect((await top(2)).topProducts[0].quantity).toBe(3);
    expect((await top(3)).topProducts[0].quantity).toBe(7);
  });

  it("falls back to 1 month for an unsupported value", async () => {
    expect((await top(12)).months).toBe(1);
  });
});
