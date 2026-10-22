const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Category = require("../../src/models/category.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");

const HOUR = 60 * 60 * 1000;

/**
 * Website Management → Flash Sale: staff set sale prices for a time window,
 * and only while it runs the storefront shows them, for that store only.
 */
describe("flash sale", () => {
  let app;
  let velor;
  let pizza;
  let shirt;
  let blue;
  const envBackup = { ...process.env };

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
    await cache.flushdb();

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });

    await runForTenant(velor.tenant._id, async () => {
      const category = await Category.create({ name: "Shirts", slug: "shirts" });
      shirt = await Product.create({ name: "Shirt", slug: "shirt", category: category._id, variantType: "multipleVariant", purchasePrice: 0 });
      blue = await Variant.create({ product: shirt._id, variantName: "Shirt Blue", slug: "shirt-blue", color: "Blue", retailPrice: 900, stockVariant: 4 });
      const red = await Variant.create({ product: shirt._id, variantName: "Shirt Red", slug: "shirt-red", color: "Red", retailPrice: 800, stockVariant: 2 });
      shirt.variant = [blue._id, red._id];
      await shirt.save();
    });
  });

  afterEach(async () => {
    await cache.flushdb();
    await clearTestDb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const staff = (store) => ({
    "x-tenant": store.tenant.slug,
    Authorization: `Bearer ${jwt.sign({ sub: String(store.user._id), tid: String(store.tenant._id), tv: 0 }, STAFF_ENV.ACCESS_TOKEN_SECRET, { expiresIn: "1d" })}`,
  });
  const create = (body) => request(app.server).post("/api/v1/flash-sale").set(staff(velor)).send(body);
  const window = (fromHours, toHours) => ({
    startsAt: new Date(Date.now() + fromHours * HOUR).toISOString(),
    endsAt: new Date(Date.now() + toHours * HOUR).toISOString(),
  });
  const blueAt = (salePrice) => [{ product: String(shirt._id), variant: String(blue._id), salePrice }];

  it("shows a running sale's price on the storefront, struck through against retail", async () => {
    await create({ title: "Weekend", ...window(-1, 2), items: blueAt(600) }).expect(201);

    const sale = await request(app.server).get("/api/v1/shop/flash-sale").set({ "x-tenant-host": "velor.com" }).expect(200);
    expect(sale.body.data.sale.title).toBe("Weekend");
    expect(sale.body.data.products[0]).toMatchObject({ price: 600, compareAtPrice: 900, variantId: String(blue._id) });

    const product = await request(app.server).get("/api/v1/shop/products/shirt").set({ "x-tenant-host": "velor.com" }).expect(200);
    const variants = product.body.data.product.variants;
    expect(variants.find((v) => v.color === "Blue")).toMatchObject({ price: 600, compareAtPrice: 900 });
    expect(variants.find((v) => v.color === "Red")).toMatchObject({ price: 800, compareAtPrice: null });

    const other = await request(app.server).get("/api/v1/shop/flash-sale").set({ "x-tenant-host": "pizzashop.com" }).expect(200);
    expect(other.body.data.sale).toBeNull();
  });

  it("keeps a scheduled sale off the storefront until it starts", async () => {
    await create({ title: "Later", ...window(2, 5), items: blueAt(600) }).expect(201);

    const res = await request(app.server).get("/api/v1/shop/flash-sale").set({ "x-tenant-host": "velor.com" }).expect(200);
    expect(res.body.data.sale).toBeNull();
    const list = await request(app.server).get("/api/v1/flash-sale").set(staff(velor)).expect(200);
    expect(list.body.data.sales[0]).toMatchObject({ title: "Later", status: "scheduled", itemCount: 1 });
  });

  it("refuses a sale price at or above retail, and overlapping sales", async () => {
    await create({ title: "Bad", ...window(-1, 2), items: blueAt(900) }).expect(400);
    // One price for every variant could undercut some of them
    await create({ title: "Whole", ...window(-1, 2), items: [{ product: String(shirt._id), salePrice: 100 }] }).expect(400);

    await create({ title: "First", ...window(1, 3), items: blueAt(600) }).expect(201);
    const clash = await create({ title: "Second", ...window(2, 4), items: blueAt(500) }).expect(409);
    expect(clash.body.message).toMatch(/First/);
  });
});
