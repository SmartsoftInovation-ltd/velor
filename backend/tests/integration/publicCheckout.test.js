jest.mock("../../src/integrations/sslcommerz", () => ({
  ...jest.requireActual("../../src/integrations/sslcommerz"),
  createPaymentSession: jest.fn(async () => ({ gatewayUrl: "https://sandbox.sslcommerz.com/pay", sessionKey: "S1" })),
  validatePayment: jest.fn(),
  querySession: jest.fn(async () => ({ APIConnect: "DONE", status: "PENDING" })),
  queryTransaction: jest.fn(async () => ({ APIConnect: "DONE", element: [] })),
}));

const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Product = require("../../src/models/product.model");
const Category = require("../../src/models/category.model");
const Coupon = require("../../src/models/coupon.model");
const Delivery = require("../../src/models/delivery.model");
const Order = require("../../src/models/order.model");
const FlashSale = require("../../src/models/flashSale.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");
const { validatePayment, querySession } = require("../../src/integrations/sslcommerz");

/**
 * Checkout is the one storefront endpoint where getting it wrong costs money.
 * Two properties matter: the order is stamped with the store whose domain the
 * shopper was on, and every amount is the shop's figure rather than one the
 * customer supplied.
 */

describe("storefront checkout", () => {
  let app;
  let velor;
  let pizza;
  let velorProduct;
  const envBackup = { ...process.env };

  const VELOR = { "x-tenant-host": "velor.com" };
  const PIZZA = { "x-tenant-host": "pizzashop.com" };
  const GUEST = { "x-guest-id": "guest-abc" };

  const SHIPPING = { fullName: "Rahim", phone: "01711000000", address: "12 Road, Dhaka" };

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
    await cache.flushdb(); // this worker's Redis database only (was flushall)

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });

    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });

    velorProduct = await runForTenant(velor.tenant._id, async () => {
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

  const addToCart = (headers, body) =>
    request(app.server).post("/api/v1/cart/add").set(headers).send(body);

  const checkout = (headers, body) =>
    request(app.server).post("/api/v1/shop/order").set(headers).send(body);

  // A guest with one Cola in the cart, ready to check out
  const fillCart = async (quantity = 1) =>
    addToCart({ ...VELOR, ...GUEST }, { productId: String(velorProduct._id), quantity }).expect(200);

  describe("the order belongs to the store the shopper was on", () => {
    it("stamps the order with that store's tenant", async () => {
      await fillCart();
      const res = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      const order = await runForTenant(velor.tenant._id, () =>
        Order.findOne({ invoiceId: res.body.data.order.invoiceId }).lean(),
      );
      expect(String(order.tenantId)).toBe(String(velor.tenant._id));
    });

    it("lists the web order on the store's dashboard order list", async () => {
      await fillCart();
      const res = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      const staffToken = jwt.sign(
        { sub: String(velor.user._id), tid: String(velor.tenant._id), tv: 0, aud: "staff" },
        STAFF_ENV.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" },
      );

      const list = await request(app.server)
        .get("/api/v1/order/allorders")
        .set({ "x-tenant": "velor", Authorization: `Bearer ${staffToken}` })
        .expect(200);
      const order = list.body.data.find((o) => o.invoiceId === res.body.data.order.invoiceId);
      expect(order).toMatchObject({ channel: "web", orderType: "complete", orderFrom: "Website" });
    });

    it("does not show the order to the other store", async () => {
      await fillCart();
      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      const inPizza = await runForTenant(pizza.tenant._id, () => Order.countDocuments({}));
      expect(inPizza).toBe(0);
    });
  });

  describe("amounts come from the shop, not the customer", () => {
    /**
     * The obvious attack. A body carrying its own prices must change nothing:
     * the order is priced from the product document either way.
     */
    it("ignores prices and totals sent in the request", async () => {
      await fillCart();

      const res = await checkout(
        { ...VELOR, ...GUEST },
        {
          shippingInfo: SHIPPING,
          paymentMethod: "cod",
          // All of this is hostile input and none of it should be read
          finalAmount: 1,
          totalAmount: 1,
          discountAmount: 499,
          items: [{ product: String(velorProduct._id), quantity: 1, retailPrice: 1, totalPrice: 1 }],
        },
      ).expect(201);

      expect(res.body.data.order.finalAmount).toBe(500);
      expect(res.body.data.order.totalAmount).toBe(500);
      expect(res.body.data.order.discountAmount).toBe(0);
    });

    it("charges the flash sale price while the sale runs, and the full price after", async () => {
      const HOUR = 60 * 60 * 1000;
      const sale = await runForTenant(velor.tenant._id, () =>
        FlashSale.create({
          title: "Weekend",
          startsAt: new Date(Date.now() - HOUR),
          endsAt: new Date(Date.now() + HOUR),
          items: [{ product: velorProduct._id, salePrice: 400 }],
        }),
      );

      await fillCart();
      const during = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      expect(during.body.data.order.finalAmount).toBe(400);

      await runForTenant(velor.tenant._id, () => FlashSale.updateOne({ _id: sale._id }, { $set: { endsAt: new Date(Date.now() - 1000) } }));
      await fillCart();
      const after = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      expect(after.body.data.order.finalAmount).toBe(500);
    });

    it("charges the delivery fee recorded against the chosen option", async () => {
      const delivery = await runForTenant(velor.tenant._id, () =>
        Delivery.create({ name: "Inside Dhaka", deliveryCharge: 60 }),
      );
      await fillCart();

      const res = await checkout(
        { ...VELOR, ...GUEST },
        {
          shippingInfo: SHIPPING,
          paymentMethod: "cod",
          deliveryChargeId: String(delivery._id),
          deliveryCharge: 0, // ignored
        },
      ).expect(201);

      expect(res.body.data.order.finalAmount).toBe(560);
    });
  });

  describe("coupons", () => {
    const validCoupon = (overrides = {}) => ({
      name: "Launch",
      code: "SAVE10",
      discountType: "percentage",
      discountValue: 10,
      couponStartAt: new Date(Date.now() - 86400000),
      expireAt: new Date(Date.now() + 86400000),
      ...overrides,
    });

    it("applies the shop's own coupon", async () => {
      await runForTenant(velor.tenant._id, () => Coupon.create(validCoupon()));
      await fillCart();

      const res = await checkout(
        { ...VELOR, ...GUEST },
        { shippingInfo: SHIPPING, paymentMethod: "cod", couponCode: "SAVE10" },
      ).expect(201);

      expect(res.body.data.order.discountAmount).toBe(50);
      expect(res.body.data.order.finalAmount).toBe(450);
    });

    // Coupons are tenant-scoped, so another shop's promotion is simply unknown
    // here — it must not be spendable across stores.
    it("refuses a coupon belonging to another store", async () => {
      await runForTenant(pizza.tenant._id, () => Coupon.create(validCoupon({ code: "PIZZA10" })));
      await fillCart();

      await checkout(
        { ...VELOR, ...GUEST },
        { shippingInfo: SHIPPING, paymentMethod: "cod", couponCode: "PIZZA10" },
      ).expect(400);
    });

    it("refuses an expired coupon", async () => {
      await runForTenant(velor.tenant._id, () =>
        Coupon.create(validCoupon({ code: "OLD10", expireAt: new Date(Date.now() - 1000) })),
      );
      await fillCart();

      await checkout(
        { ...VELOR, ...GUEST },
        { shippingInfo: SHIPPING, paymentMethod: "cod", couponCode: "OLD10" },
      ).expect(400);
    });
  });

  describe("stock", () => {
    it("refuses an order for more than the shop holds", async () => {
      await addToCart({ ...VELOR, ...GUEST }, { productId: String(velorProduct._id), quantity: 5 }).expect(200);
      // Sell out behind the shopper's back
      await runForTenant(velor.tenant._id, () => Product.updateOne({ _id: velorProduct._id }, { $set: { stock: 2 } }));

      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(400);
    });

    it("decrements stock once the order is placed", async () => {
      await fillCart(3);
      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      const after = await runForTenant(velor.tenant._id, () => Product.findById(velorProduct._id).lean());
      expect(after.stock).toBe(7);
    });
  });

  describe("requests that cannot be served", () => {
    it("refuses a checkout that names no store", async () => {
      await fillCart();
      await checkout(GUEST, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(400);
    });

    it("refuses an empty cart", async () => {
      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(400);
    });

    it("requires an address", async () => {
      await fillCart();
      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: { fullName: "Rahim" }, paymentMethod: "cod" }).expect(400);
    });

    it("refuses an unknown payment method", async () => {
      await fillCart();
      await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "bitcoin" }).expect(400);
    });
  });

  describe("returning from the payment gateway", () => {
    /**
     * The gateway sends the customer's browser back to the API. Answering with
     * JSON would leave them staring at raw text, and answering with one
     * configured storefront URL would land every seller's customers on the same
     * shop — so the redirect target is the order's own store.
     */
    it("sends the shopper back to the store they bought from", async () => {
      await runForTenant(velor.tenant._id, async () => {
        await TenantDomain.updateOne({ host: "velor.com" }, { $set: { isPrimary: true } });
      });
      await fillCart();
      const placed = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "sslcommerz" }).expect(201);
      const { invoiceId } = placed.body.data.order;

      validatePayment.mockResolvedValueOnce({
        status: "VALID", tran_id: invoiceId, val_id: "V1", currency_type: "BDT", currency_amount: "500.00",
      });

      const tenant = await require("../../src/models/platform/tenant.model").findById(velor.tenant._id).lean();
      const res = await request(app.server)
        .post(`/api/v1/hooks/sslcommerz/${tenant.webhookKey}/success`)
        .send({ tran_id: invoiceId, val_id: "V1" })
        .expect(303);

      expect(res.headers.location).toBe(`https://velor.com/checkout/success?invoice=${invoiceId}`);
    });

    it("sends a cancelled payment back to that same store", async () => {
      await TenantDomain.updateOne({ host: "pizzashop.com" }, { $set: { isPrimary: true } });

      const pizzaProduct = await runForTenant(pizza.tenant._id, async () => {
        const category = await Category.create({ name: "Pizza", slug: "pizza" });
        return Product.create({
          name: "Margherita", slug: "margherita", category: category._id,
          retailPrice: 300, variantType: "singleVariant", stock: 5,
        });
      });

      await addToCart({ ...PIZZA, "x-guest-id": "guest-pizza" }, { productId: String(pizzaProduct._id), quantity: 1 }).expect(200);
      const placed = await checkout(
        { ...PIZZA, "x-guest-id": "guest-pizza" },
        { shippingInfo: SHIPPING, paymentMethod: "sslcommerz" },
      ).expect(201);

      querySession.mockResolvedValueOnce({
        APIConnect: "DONE", status: "CANCELLED", tran_id: placed.body.data.order.invoiceId,
      });

      const tenant = await require("../../src/models/platform/tenant.model").findById(pizza.tenant._id).lean();
      const res = await request(app.server)
        .post(`/api/v1/hooks/sslcommerz/${tenant.webhookKey}/cancel`)
        .send({ tran_id: placed.body.data.order.invoiceId })
        .expect(303);

      // pizzashop's customer must not be handed to velor
      expect(res.headers.location).toContain("https://pizzashop.com/checkout/cancelled");
    });
  });

  describe("order tracking", () => {
    it("reports status without revealing the customer's details", async () => {
      await fillCart();
      const placed = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      const { invoiceId } = placed.body.data.order;

      const res = await request(app.server).get(`/api/v1/shop/track/${invoiceId}`).set(VELOR).expect(200);

      expect(res.body.data.order).toMatchObject({ invoiceId, orderStatus: "Pending" });
      expect(res.body.data.order).not.toHaveProperty("shippingInfo");
    });

    // The invoice number is not a secret, so it must not work across stores
    it("does not find another store's order", async () => {
      await fillCart();
      const placed = await checkout({ ...VELOR, ...GUEST }, { shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);

      await request(app.server)
        .get(`/api/v1/shop/track/${placed.body.data.order.invoiceId}`)
        .set(PIZZA)
        .expect(404);
    });
  });
});
