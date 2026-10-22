const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Category = require("../../src/models/category.model");
const Cart = require("../../src/models/cart.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");

/**
 * The storefront keeps the cart in the browser and replaces the server copy
 * with it just before checkout. These tests hold the three things that matter:
 * the cart lands in the store whose domain was used, prices are the shop's
 * own, and lines that cannot be bought are reported rather than saved.
 */

describe("PUT /shop/cart", () => {
  let app;
  let velor;
  let pizza;
  let cola;
  let shirt;
  let blue;
  const envBackup = { ...process.env };

  const VELOR = { "x-tenant-host": "velor.com" };
  const PIZZA = { "x-tenant-host": "pizzashop.com" };
  const GUEST = { "x-guest-id": "guest-abc" };

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
    await cache.flushdb();

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });

    await runForTenant(velor.tenant._id, async () => {
      const category = await Category.create({ name: "Drinks", slug: "drinks" });
      cola = await Product.create({ name: "Cola", slug: "cola", category: category._id, retailPrice: 500, purchasePrice: 100, variantType: "singleVariant", stock: 3 });
      shirt = await Product.create({ name: "Shirt", slug: "shirt", category: category._id, retailPrice: 1000, variantType: "multipleVariant" });
      blue = await Variant.create({ product: shirt._id, variantName: "Shirt Blue", slug: "shirt-blue", color: "Blue", retailPrice: 900, stockVariant: 4 });
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

  const put = (headers, items) => request(app.server).put("/api/v1/shop/cart").set(headers).send({ items });
  const guestCart = (tenantId) => runForTenant(tenantId, () => Cart.findOne({ guestId: "guest-abc" }).lean());

  it("saves the lines in the store whose domain was used, at the shop's prices", async () => {
    const res = await put({ ...VELOR, ...GUEST }, [
      { productId: String(cola._id), quantity: 2, price: 1 },
      { productId: String(shirt._id), variantId: String(blue._id), quantity: 1 },
    ]).expect(200);

    expect(res.body.data.rejected).toEqual([]);
    expect(res.body.data.cart.subTotal).toBe(500 * 2 + 900);

    const saved = await guestCart(velor.tenant._id);
    expect(String(saved.tenantId)).toBe(String(velor.tenant._id));
    expect(saved.items).toHaveLength(2);
    expect(await guestCart(pizza.tenant._id)).toBeNull();
  });

  it("replaces the cart instead of adding to it", async () => {
    await put({ ...VELOR, ...GUEST }, [{ productId: String(cola._id), quantity: 2 }]).expect(200);
    await put({ ...VELOR, ...GUEST }, [{ productId: String(shirt._id), variantId: String(blue._id), quantity: 1 }]).expect(200);

    const saved = await guestCart(velor.tenant._id);
    expect(saved.items).toHaveLength(1);
    expect(String(saved.items[0].variant)).toBe(String(blue._id));
  });

  it("adds repeated lines together and trims a quantity to the stock", async () => {
    const res = await put({ ...VELOR, ...GUEST }, [
      { productId: String(cola._id), quantity: 2 },
      { productId: String(cola._id), quantity: 2 },
    ]).expect(200);

    expect(res.body.data.cart.items).toEqual([expect.objectContaining({ quantity: 3 })]);
    expect(res.body.data.rejected).toEqual([expect.objectContaining({ reason: "quantity_reduced", quantity: 3 })]);
  });

  it("reports lines that cannot be bought instead of saving them", async () => {
    await runForTenant(velor.tenant._id, () => Product.updateOne({ _id: cola._id }, { stock: 0 }));

    const res = await put({ ...VELOR, ...GUEST }, [
      { productId: String(cola._id), quantity: 1 },
      // A variant named under the wrong product
      { productId: String(cola._id), variantId: String(blue._id), quantity: 1 },
    ]).expect(200);

    expect(res.body.data.cart.items).toEqual([]);
    expect(res.body.data.rejected.map((line) => line.reason)).toEqual(["out_of_stock", "unavailable"]);
  });

  it("does not find another store's product", async () => {
    const res = await put({ ...PIZZA, ...GUEST }, [{ productId: String(cola._id), quantity: 1 }]).expect(200);
    expect(res.body.data.rejected).toEqual([expect.objectContaining({ reason: "unavailable" })]);
  });

  it("refuses a malformed body", async () => {
    await put({ ...VELOR, ...GUEST }, [{ productId: "nope", quantity: 1 }]).expect(400);
    await put({ ...VELOR, ...GUEST }, [{ productId: String(cola._id), quantity: 0 }]).expect(400);
    await request(app.server).put("/api/v1/shop/cart").set({ ...VELOR, ...GUEST }).send({}).expect(400);
  });

  it("needs a guest id or a signed-in shopper", async () => {
    await put(VELOR, [{ productId: String(cola._id), quantity: 1 }]).expect(401);
  });
});
