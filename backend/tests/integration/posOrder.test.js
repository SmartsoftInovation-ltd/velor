const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const Product = require("../../src/models/product.model");
const Category = require("../../src/models/category.model");
const Coupon = require("../../src/models/coupon.model");
const Variant = require("../../src/models/variant.model");
const Order = require("../../src/models/order.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");

/**
 * Counter orders entered by staff.
 *
 * They share the `Order` collection with storefront orders, so the two must
 * agree on totals and be distinguishable afterwards — otherwise reports either
 * disagree with invoices or cannot tell the two kinds of sale apart.
 */

describe("counter (POS) orders", () => {
  let app;
  let velor;
  let pizza;
  let product;
  let staffToken;
  const envBackup = { ...process.env };

  const SHIPPING = { fullName: "Walk-in Customer", phone: "01711000000", address: "Counter" };

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
    invalidateTenantCache();
    service.clearSettingsCache();
    await cache.flushdb(); // this worker's Redis database only (was flushall)

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });

    // Minted by the model so the claims match what authGuard expects exactly
    staffToken = velor.user.generateJwtAccessToken();

    product = await runForTenant(velor.tenant._id, async () => {
      const category = await Category.create({ name: "Drinks", slug: "drinks" });
      return Product.create({
        name: "Cola",
        slug: "cola",
        category: category._id,
        retailPrice: 500,
        purchasePrice: 100,
        variantType: "singleVariant",
        stock: 10,
      });
    });
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

  // Built per call: the token is minted in beforeEach, after this block runs
  const auth = () => ({ Authorization: `Bearer ${staffToken}`, "x-tenant": "velor" });
  const place = (body) => request(app.server).post("/api/v1/order/pos").set(auth()).send(body);
  const quote = (body) => request(app.server).post("/api/v1/order/pos/quote").set(auth()).send(body);

  const oneLine = (quantity = 1) => [{ productId: String(product._id), quantity }];

  describe("placing an order at the counter", () => {
    it("prices it from the catalogue and records who took it", async () => {
      const res = await place({
        items: oneLine(2),
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      }).expect(201);

      expect(res.body.data.order).toMatchObject({
        totalAmount: 1000,
        finalAmount: 1000,
        channel: "pos",
      });

      const saved = await runForTenant(velor.tenant._id, () =>
        Order.findOne({ invoiceId: res.body.data.order.invoiceId }).lean(),
      );
      expect(String(saved.placedBy)).toBe(String(velor.user._id));
      expect(String(saved.tenantId)).toBe(String(velor.tenant._id));
    });

    /**
     * The counter screen is staff-facing, but it is still a browser sending
     * JSON. A price in the request must be ignored exactly as on the storefront,
     * or the shop's own till becomes the easiest way to undercharge.
     */
    it("ignores prices sent in the request", async () => {
      const res = await place({
        items: [{ productId: String(product._id), quantity: 1, retailPrice: 1, totalPrice: 1 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
        finalAmount: 1,
        totalAmount: 1,
      }).expect(201);

      expect(res.body.data.order.finalAmount).toBe(500);
      expect(res.body.data.order.totalAmount).toBe(500);
    });

    it("takes stock down", async () => {
      await place({ items: oneLine(3), shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      const after = await runForTenant(velor.tenant._id, () => Product.findById(product._id).lean());
      expect(after.stock).toBe(7);
    });

    it("refuses more than the shop holds", async () => {
      await place({ items: oneLine(50), shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(400);
    });

    it("applies the shop's coupon", async () => {
      await runForTenant(velor.tenant._id, () =>
        Coupon.create({
          name: "Launch",
          code: "SAVE10",
          discountType: "percentage",
          discountValue: 10,
          couponStartAt: new Date(Date.now() - 86400000),
          expireAt: new Date(Date.now() + 86400000),
        }),
      );

      const res = await place({
        items: oneLine(1),
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
        couponCode: "SAVE10",
      }).expect(201);

      expect(res.body.data.order.discountAmount).toBe(50);
      expect(res.body.data.order.finalAmount).toBe(450);
    });

    it("needs a customer name and phone", async () => {
      await place({ items: oneLine(), shippingInfo: { fullName: "X" }, paymentMethod: "cod" }).expect(400);
    });

    it("needs at least one line", async () => {
      await place({ items: [], shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(400);
    });
  });

  describe("selling a variant (what a barcode scan resolves to)", () => {
    /**
     * Barcodes live on the variant, so scanning one at the counter produces a
     * variant id rather than a product id. Both have to be sellable, and the
     * variant's own price and stock are the ones that count — its parent's
     * figures would be wrong.
     */
    it("prices and stocks the variant, not its parent product", async () => {
      const variant = await runForTenant(velor.tenant._id, () =>
        Variant.create({
          product: product._id,
          variantName: "Cola 1L",
          retailPrice: 750,
          purchasePrice: 200,
          stockVariant: 4,
          barCode: "8901234567890",
        }),
      );

      const res = await place({
        items: [{ variantId: String(variant._id), quantity: 2 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      }).expect(201);

      // 2 x 750 (the variant's price), not the product's 500
      expect(res.body.data.order.finalAmount).toBe(1500);

      const after = await runForTenant(velor.tenant._id, () => Variant.findById(variant._id).lean());
      expect(after.stockVariant).toBe(2);

      // The parent product's own stock is untouched
      const parent = await runForTenant(velor.tenant._id, () => Product.findById(product._id).lean());
      expect(parent.stock).toBe(10);
    });

    it("refuses more than the variant holds", async () => {
      const variant = await runForTenant(velor.tenant._id, () =>
        Variant.create({ product: product._id, variantName: "Cola 2L", retailPrice: 900, stockVariant: 1 }),
      );

      await place({
        items: [{ variantId: String(variant._id), quantity: 5 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      }).expect(400);
    });
  });

  describe("isolation", () => {
    // The product lookup is tenant-scoped, so another store's catalogue is
    // simply not reachable from this counter.
    it("cannot sell another store's product", async () => {
      const theirs = await runForTenant(pizza.tenant._id, async () => {
        const category = await Category.create({ name: "Pizza", slug: "pizza" });
        return Product.create({
          name: "Margherita",
          slug: "margherita",
          category: category._id,
          retailPrice: 300,
          variantType: "singleVariant",
          stock: 5,
        });
      });

      await place({
        items: [{ productId: String(theirs._id), quantity: 1 }],
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
      }).expect(404);
    });

    it("refuses a request with no staff token", async () => {
      await request(app.server)
        .post("/api/v1/order/pos")
        .set({ "x-tenant": "velor" })
        .send({ items: oneLine(), shippingInfo: SHIPPING, paymentMethod: "cod" })
        .expect(401);
    });
  });

  describe("quote", () => {
    /**
     * The screen shows a running total while the operator types. It asks the
     * server rather than adding up locally, so what is shown is what will be
     * charged.
     */
    it("returns the same totals the order would use", async () => {
      const res = await quote({ items: oneLine(2) }).expect(200);

      expect(res.body.data).toMatchObject({ subtotal: 1000, finalAmount: 1000, totalQuantity: 2 });
      expect(res.body.data.lines[0]).toMatchObject({ name: "Cola", quantity: 2, retailPrice: 500 });
    });

    // The operator is still building the order, so a not-yet-valid coupon
    // reports its reason instead of failing the whole quote.
    it("reports a coupon problem without failing", async () => {
      const res = await quote({ items: oneLine(1), couponCode: "NOPE" }).expect(200);

      expect(res.body.data.couponError).toMatch(/not valid/i);
      expect(res.body.data.finalAmount).toBe(500);
    });
  });

  describe("reporting across both channels", () => {
    /**
     * The reason for one collection: a report answers "what did we sell today"
     * with a single query, and can still split by channel when asked.
     */
    it("counts counter and web orders together, and can tell them apart", async () => {
      await place({ items: oneLine(1), shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      await runForTenant(velor.tenant._id, () =>
        Order.create({
          guestId: "guest-1",
          items: [],
          shippingInfo: SHIPPING,
          totalAmount: 200,
          finalAmount: 200,
          paymentMethod: "cod",
          invoiceId: "INV-WEB-1",
          channel: "web",
        }),
      );

      const all = await runForTenant(velor.tenant._id, () => Order.countDocuments({}));
      const pos = await runForTenant(velor.tenant._id, () => Order.countDocuments({ channel: "pos" }));
      const web = await runForTenant(velor.tenant._id, () => Order.countDocuments({ channel: "web" }));

      expect(all).toBe(2);
      expect(pos).toBe(1);
      expect(web).toBe(1);
    });
  });

  /**
   * Where the customer reached the shop — Messenger, WhatsApp, over the phone.
   * The shop owns the list, so it is data rather than an enum, and the name is
   * copied onto the order so renaming a source never rewrites history.
   */
  describe("order source", () => {
    const listSources = () => request(app.server).get("/api/v1/order-source").set(auth());
    const addSource = (body) => request(app.server).post("/api/v1/order-source").set(auth()).send(body);

    it("starts every shop with a usable list", async () => {
      const res = await listSources().expect(200);
      const names = res.body.data.map((source) => source.name);
      expect(names).toEqual(expect.arrayContaining(["Website", "Messenger", "WhatsApp"]));
    });

    it("records the source the staff member chose", async () => {
      await listSources().expect(200);

      const res = await place({
        items: oneLine(1),
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
        orderFrom: "Messenger",
      }).expect(201);

      expect(res.body.data.order.orderFrom).toBe("Messenger");
      const saved = await runForTenant(velor.tenant._id, () => Order.findById(res.body.data.order._id));
      expect(saved.orderFrom).toBe("Messenger");
    });

    it("refuses a source the shop does not keep", async () => {
      await listSources().expect(200);

      await place({
        items: oneLine(1),
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
        orderFrom: "Telepathy",
      }).expect(400);
    });

    it("takes an order with no source recorded", async () => {
      const res = await place({ items: oneLine(1), shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      expect(res.body.data.order.orderFrom).toBe("");
    });

    it("adds one from the order screen, and refuses a duplicate", async () => {
      await listSources().expect(200);

      const created = await addSource({ name: "TikTok" }).expect(201);
      expect(created.body.data.name).toBe("TikTok");

      // Case-insensitive: "tiktok" would split one channel across two report lines
      await addSource({ name: "tiktok" }).expect(400);

      await place({
        items: oneLine(1),
        shippingInfo: SHIPPING,
        paymentMethod: "cod",
        orderFrom: "TikTok",
      }).expect(201);
    });

    it("keeps one shop's list out of another's", async () => {
      await listSources().expect(200);
      await addSource({ name: "TikTok" }).expect(201);

      const pizzaAuth = {
        Authorization: `Bearer ${pizza.user.generateJwtAccessToken()}`,
        "x-tenant": "pizzashop",
      };
      const res = await request(app.server).get("/api/v1/order-source").set(pizzaAuth).expect(200);

      expect(res.body.data.map((source) => source.name)).not.toContain("TikTok");
    });
  });
});
