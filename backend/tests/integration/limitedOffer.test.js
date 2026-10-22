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

/**
 * Website Management → Limited Offer: staff pick products or single variants,
 * and the storefront shows exactly those, in their order, for that store only.
 */
describe("limited offer", () => {
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
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active", isPrimary: true });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });

    await runForTenant(velor.tenant._id, async () => {
      const category = await Category.create({ name: "Shirts", slug: "shirts" });
      shirt = await Product.create({ name: "Shirt", slug: "shirt", category: category._id, variantType: "multipleVariant", purchasePrice: 0 });
      blue = await Variant.create({ product: shirt._id, variantName: "Shirt Blue", slug: "shirt-blue", color: "Blue", retailPrice: 900, stockVariant: 4 });
      await Variant.create({ product: shirt._id, variantName: "Shirt Red", slug: "shirt-red", color: "Red", retailPrice: 800, stockVariant: 2 });
      shirt.variant = await Variant.find({ product: shirt._id }).distinct("_id");
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
  const shop = (host) => request(app.server).get("/api/v1/shop/limited-offers").set({ "x-tenant-host": host });

  it("shows a picked variant on the storefront with its own price and a link to it", async () => {
    const res = await request(app.server)
      .post("/api/v1/limited-offer")
      .set(staff(velor))
      .send({ items: [{ product: String(shirt._id), variant: String(blue._id) }], priority: 1 })
      .expect(201);
    expect(res.body.data.items[0]).toMatchObject({
      variant: { name: "Shirt Blue" },
      price: 900,
      storefrontUrl: `https://velor.com/product/shirt?variant=${blue._id}`,
    });

    const fromShop = await shop("velor.com").expect(200);
    expect(fromShop.body.data.products).toHaveLength(1);
    expect(fromShop.body.data.products[0]).toMatchObject({ slug: "shirt", price: 900, stock: 4, variantId: String(blue._id) });

    // Another store's storefront never sees it
    const other = await shop("pizzashop.com").expect(200);
    expect(other.body.data.products).toEqual([]);
  });

  it("adds many at once, skipping ones already there, and refuses a variant of another product", async () => {
    const add = (items) => request(app.server).post("/api/v1/limited-offer").set(staff(velor)).send({ items });

    const first = await add([{ product: String(shirt._id) }]).expect(201);
    expect(first.body.data).toMatchObject({ added: 1, skipped: 0 });

    // The whole product again (already there), the blue variant, and a repeat of it
    const batch = await add([
      { product: String(shirt._id) },
      { product: String(shirt._id), variant: String(blue._id) },
      { product: String(shirt._id), variant: String(blue._id) },
    ]).expect(201);
    expect(batch.body.data).toMatchObject({ added: 1, skipped: 2 });
    expect(batch.body.data.items).toHaveLength(2);

    const stray = await runForTenant(velor.tenant._id, () =>
      Variant.create({ product: velor.tenant._id, variantName: "Stray", slug: "stray", retailPrice: 1 }),
    );
    await add([{ product: String(shirt._id), variant: String(stray._id) }]).expect(400);
  });

  it("hides an entry from the storefront once it is turned off", async () => {
    const added = await request(app.server).post("/api/v1/limited-offer").set(staff(velor)).send({ items: [{ product: String(shirt._id) }] }).expect(201);
    const id = added.body.data.items[0]._id;

    await request(app.server).patch(`/api/v1/limited-offer/${id}`).set(staff(velor)).send({ isActive: false }).expect(200);
    const res = await shop("velor.com").expect(200);
    expect(res.body.data.products).toEqual([]);
  });
});
