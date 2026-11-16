const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Product = require("../../src/models/product.model");
const Category = require("../../src/models/category.model");
const SizeChart = require("../../src/models/sizeChart.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");

/**
 * The storefront reads the catalogue without signing in. Two things have to
 * hold for that to be safe: the visitor only ever sees the store whose domain
 * they arrived on, and they see the shopper's view of a product — not the
 * figures the shop keeps for itself.
 */

describe("public catalogue for storefront visitors", () => {
  let app;
  let velor;
  let pizza;
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
    // Responses are cached per tenant; a stale entry would mask a scoping bug
    await cache.flushdb(); // this worker's Redis database only (was flushall)

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });

    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });

    // Same product name in both stores, each with its own cost price
    for (const [store, purchasePrice] of [[velor, 100], [pizza, 200]]) {
      await runForTenant(store.tenant._id, async () => {
        const category = await Category.create({ name: "Drinks", slug: "drinks" });
        await Product.create({
          name: "Cola",
          slug: "cola",
          category: category._id,
          retailPrice: 500,
          purchasePrice,
          variantType: "singleVariant",
          stock: 10,
        });
      });
    }
  });

  afterEach(async () => {
    await cache.flushdb(); // this worker's Redis database only (was flushall)
    await clearTestDb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const products = (headers) => request(app.server).get("/api/v1/product/getproduct").set(headers);
  const listOf = (res) => res.body.data?.products ?? res.body.data ?? [];

  describe("scoping", () => {
    it("shows each domain only its own store's products", async () => {
      const fromVelor = await products({ "x-tenant-host": "velor.com" }).expect(200);
      const fromPizza = await products({ "x-tenant-host": "pizzashop.com" }).expect(200);

      expect(listOf(fromVelor)).toHaveLength(1);
      expect(listOf(fromPizza)).toHaveLength(1);
      expect(String(listOf(fromVelor)[0]._id)).not.toBe(String(listOf(fromPizza)[0]._id));
    });

    /**
     * Responses are cached, and the cache key is built from the tenant context.
     * If it were not, the first store to ask would populate a shared entry and
     * every other store would be served its catalogue.
     */
    it("does not serve one store's cached list to another", async () => {
      await products({ "x-tenant-host": "velor.com" }).expect(200);
      const second = await products({ "x-tenant-host": "pizzashop.com" }).expect(200);

      const ids = listOf(second).map((p) => String(p._id));
      const pizzaProduct = await runForTenant(pizza.tenant._id, () => Product.findOne({ slug: "cola" }).lean());
      expect(ids).toEqual([String(pizzaProduct._id)]);
    });
  });

  describe("requests that name no store", () => {
    // Without a store there is nothing sensible to return, and strict mode
    // would refuse at the query anyway — better to say so plainly.
    it("refuses a catalogue request with no host", async () => {
      const res = await products({});
      expect(res.status).not.toBe(200);
    });

    it("tells a guest cart request that no store was named", async () => {
      const res = await request(app.server)
        .get("/api/v1/cart")
        .set({ "x-guest-id": "guest-123" })
        .expect(400);

      expect(res.body.code ?? res.body.data?.code).toBe("TENANT_CONTEXT_REQUIRED");
    });

    it("lets a guest cart through once the store is named", async () => {
      await request(app.server)
        .get("/api/v1/cart")
        .set({ "x-tenant-host": "velor.com", "x-guest-id": "guest-123" })
        .expect(200);
    });
  });

  describe("what a shopper may see", () => {
    /**
     * `purchasePrice` is what the shop paid. Publishing it hands every visitor
     * — including a competitor — the store's margin on every line it sells.
     */
    it("never returns the cost price to an anonymous visitor", async () => {
      const res = await products({ "x-tenant-host": "velor.com" }).expect(200);

      const product = listOf(res)[0];
      expect(product).toBeDefined();
      expect(product.retailPrice).toBe(500); // the shopper-facing price is still there
      expect(product).not.toHaveProperty("purchasePrice");
    });

    /**
     * The same endpoint serves the dashboard. Stripping unconditionally would
     * hide the numbers staff rely on, so the reduction is tied to the caller
     * being anonymous, not to the route.
     */
    it("still shows the cost price to signed-in staff", async () => {
      const jwt = require("jsonwebtoken");
      const token = jwt.sign(
        { sub: String(velor.user._id), tid: String(velor.tenant._id), tv: 0 },
        STAFF_ENV.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" },
      );

      const res = await request(app.server)
        .get("/api/v1/product/getproduct")
        .set({ "x-tenant-host": "velor.com", Authorization: `Bearer ${token}` })
        .expect(200);

      expect(listOf(res)[0]).toHaveProperty("purchasePrice", 100);
    });

    it("never returns the cost price from the single-product view", async () => {
      const res = await request(app.server)
        .get("/api/v1/product/getproduct/cola")
        .set({ "x-tenant-host": "velor.com" })
        .expect(200);

      const product = res.body.data?.product ?? res.body.data;
      expect(product).not.toHaveProperty("purchasePrice");
    });
  });

  describe("storefront catalogue (/shop/products)", () => {
    const shopList = (headers) => request(app.server).get("/api/v1/shop/products").set(headers);

    it("lists only this store's active products, shaped for a shop page", async () => {
      await runForTenant(velor.tenant._id, async () => {
        const category = await Category.findOne({ slug: "drinks" });
        await Product.create({ name: "Hidden", slug: "hidden", category: category._id, retailPrice: 1, purchasePrice: 1, variantType: "singleVariant", isActive: false });
      });

      const res = await shopList({ "x-tenant-host": "velor.com" }).expect(200);
      const list = res.body.data.products;

      expect(list.map((p) => p.slug)).toEqual(["cola"]);
      expect(list[0]).toMatchObject({ name: "Cola", price: 500, stock: 10, category: { slug: "drinks" } });
      // Cost and internal stock bookkeeping never leave the API
      for (const field of ["purchasePrice", "wholesalePrice", "posSold", "salesReturn", "initialStock"]) {
        expect(list[0]).not.toHaveProperty(field);
      }
    });

    it("serves one product by slug and 404s an unknown one", async () => {
      const res = await request(app.server).get("/api/v1/shop/products/cola").set({ "x-tenant-host": "pizzashop.com" }).expect(200);
      expect(res.body.data.product).toMatchObject({ slug: "cola", price: 500 });

      await request(app.server).get("/api/v1/shop/products/nope").set({ "x-tenant-host": "velor.com" }).expect(404);
    });

    it("sends the most specific active size chart with a product", async () => {
      const chart = (name, extra) =>
        runForTenant(velor.tenant._id, () =>
          SizeChart.create({
            name,
            applicableLevel: "category",
            applicableCategories: [new Product()._id],
            columns: [{ key: "chest", label: "Chest", unit: "inch" }, { key: "len", label: "Length" }],
            rows: [{ label: "M", values: ["40", "28"] }],
            ...extra,
          }),
        );
      const detail = async () =>
        (await request(app.server).get("/api/v1/shop/products/cola").set({ "x-tenant-host": "velor.com" }).expect(200)).body.data.product;

      expect((await detail()).sizeChart).toBeNull();

      const forCategory = await chart("Drinks chart");
      const forProduct = await chart("Cola chart", { isActive: false });
      await runForTenant(velor.tenant._id, async () => {
        await Category.updateOne({ slug: "drinks" }, { sizeChart: forCategory._id });
        await Product.updateOne({ slug: "cola" }, { sizeChart: forProduct._id });
      });
      // A chart edit bumps its namespace, which the detail cache key carries
      await runForTenant(velor.tenant._id, () => require("../../src/utils/cache.util").bumpNsVersion("sizechart"));

      // The product's own chart is inactive, so the category's shows
      expect((await detail()).sizeChart).toEqual({
        name: "Drinks chart",
        description: "",
        columns: [{ label: "Chest", unit: "inch" }, { label: "Length", unit: "" }],
        rows: [{ label: "M", values: ["40", "28"] }],
        videoUrl: "",
      });

      await runForTenant(velor.tenant._id, () => SizeChart.updateOne({ _id: forProduct._id }, { isActive: true }));
      await runForTenant(velor.tenant._id, () => require("../../src/utils/cache.util").bumpNsVersion("sizechart"));
      expect((await detail()).sizeChart.name).toBe("Cola chart");
    });
  });
});
