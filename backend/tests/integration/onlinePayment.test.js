jest.mock("../../src/integrations/sslcommerz", () => ({
  ...jest.requireActual("../../src/integrations/sslcommerz"),
  createPaymentSession: jest.fn(),
  validatePayment: jest.fn(),
  querySession: jest.fn(),
  queryTransaction: jest.fn(),
}));

const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const Tenant = require("../../src/models/platform/tenant.model");
const Product = require("../../src/models/product.model");
const Category = require("../../src/models/category.model");
const Brand = require("../../src/models/brand.model");
const Coupon = require("../../src/models/coupon.model");
const Delivery = require("../../src/models/delivery.model");
const Order = require("../../src/models/order.model");
const Invoice = require("../../src/models/invoice.model");
const service = require("../../src/settings/settings.service");
const { cache } = require("../../src/config/redis.config");
const sslcommerz = require("../../src/integrations/sslcommerz");
const { reconcilePayments } = require("../../src/jobs/reconcilePayments.job");

/**
 * Online payment is where a forged request costs the shop money or stock. The
 * properties under test: an order is paid only on the gateway's own word, for
 * the right amount; the browser's success/fail/cancel POSTs change nothing on
 * their own; and stock and coupon uses move exactly once however many
 * callbacks arrive.
 */

describe("online payment (SSLCommerz)", () => {
  let app;
  let velor;
  let product;
  let webhookKey;
  const envBackup = { ...process.env };

  const HOST = { "x-tenant-host": "velor.com" };
  const GUEST = { "x-guest-id": "guest-pay" };
  const SHIPPING = { fullName: "Rahim", phone: "01711000000", address: "12 Road", city: "Dhaka", postalCode: "1207" };

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
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
    jest.clearAllMocks();

    sslcommerz.createPaymentSession.mockResolvedValue({ gatewayUrl: "https://sandbox.sslcommerz.com/pay/1", sessionKey: "S1" });
    // By default the gateway has nothing to report yet
    sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "PENDING" });
    sslcommerz.queryTransaction.mockResolvedValue({ APIConnect: "DONE", element: [] });

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test" });
    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active", isPrimary: true });
    webhookKey = (await Tenant.findById(velor.tenant._id).lean()).webhookKey;

    product = await runForTenant(velor.tenant._id, async () => {
      const category = await Category.create({ name: "Drinks", slug: "drinks" });
      return Product.create({
        name: "Cola", slug: "cola", category: category._id, retailPrice: 500,
        purchasePrice: 100, variantType: "singleVariant", stock: 10,
      });
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

  const inStore = (fn) => runForTenant(velor.tenant._id, fn);
  const stock = async () => (await inStore(() => Product.findById(product._id).lean())).stock;
  const orderOf = (invoiceId) => inStore(() => Order.findOne({ invoiceId }).lean());
  const hook = (result, body) => request(app.server).post(`/api/v1/hooks/sslcommerz/${webhookKey}/${result}`).send(body);

  const placeOnline = async (body = {}) => {
    await request(app.server).post("/api/v1/cart/add").set({ ...HOST, ...GUEST })
      .send({ productId: String(product._id), quantity: 2 }).expect(200);
    const res = await request(app.server).post("/api/v1/shop/order").set({ ...HOST, ...GUEST })
      .send({ shippingInfo: SHIPPING, paymentMethod: "sslcommerz", ...body }).expect(201);
    return res.body.data;
  };

  const paid = (invoiceId, amount = "1000.00", extra = {}) => ({
    status: "VALID", tran_id: invoiceId, val_id: "VAL1", bank_tran_id: "BANK1",
    currency_type: "BDT", currency_amount: amount, amount, risk_level: "0", ...extra,
  });

  describe("placing the order", () => {
    it("opens a gateway session for the server's total and keeps its session key", async () => {
      const { order, gatewayUrl } = await placeOnline();

      expect(gatewayUrl).toBe("https://sandbox.sslcommerz.com/pay/1");
      expect(sslcommerz.createPaymentSession).toHaveBeenCalledWith(
        expect.objectContaining({ total_amount: 1000, tran_id: order.invoiceId, cus_phone: SHIPPING.phone }),
      );
      const saved = await orderOf(order.invoiceId);
      expect(saved).toMatchObject({ sessionKey: "S1", paymentStatus: "Pending", channel: "web" });
      expect(await stock()).toBe(8);
    });

    it("writes one invoice for every order, online or cash", async () => {
      const { order } = await placeOnline();
      const invoice = await inStore(() => Invoice.findOne({ invoiceId: order.invoiceId }).lean());
      expect(invoice).toMatchObject({ finalAmount: 1000, totalAmount: 1000, deliveryChargeAmount: 0 });

      await request(app.server).post("/api/v1/cart/add").set({ ...HOST, ...GUEST })
        .send({ productId: String(product._id), quantity: 1 }).expect(200);
      const cod = await request(app.server).post("/api/v1/shop/order").set({ ...HOST, ...GUEST })
        .send({ shippingInfo: SHIPPING, paymentMethod: "cod" }).expect(201);
      expect(cod.body.data.gatewayUrl).toBeNull();
      expect(await inStore(() => Invoice.countDocuments({ invoiceId: cod.body.data.order.invoiceId }))).toBe(1);
    });

    it("keeps nothing when the gateway refuses the session", async () => {
      sslcommerz.createPaymentSession.mockRejectedValueOnce(new Error("SSLCommerz session failed: bad store"));
      await request(app.server).post("/api/v1/cart/add").set({ ...HOST, ...GUEST })
        .send({ productId: String(product._id), quantity: 2 }).expect(200);
      await request(app.server).post("/api/v1/shop/order").set({ ...HOST, ...GUEST })
        .send({ shippingInfo: SHIPPING, paymentMethod: "sslcommerz" }).expect(502);

      expect(await stock()).toBe(10);
      expect(await inStore(() => Order.countDocuments({}))).toBe(0);
      expect(await inStore(() => Invoice.countDocuments({}))).toBe(0);
    });
  });

  describe("recording a payment", () => {
    it("marks the order paid once the Validation API confirms the val_id", async () => {
      const { order } = await placeOnline();
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId));

      const res = await hook("success", { tran_id: order.invoiceId, val_id: "VAL1" }).expect(303);

      expect(res.headers.location).toBe(`https://velor.com/checkout/success?invoice=${order.invoiceId}`);
      expect(sslcommerz.validatePayment).toHaveBeenCalledWith("VAL1");
      expect(await orderOf(order.invoiceId)).toMatchObject({
        paymentStatus: "success", orderStatus: "Confirmed", valId: "VAL1", transactionId: "BANK1",
      });
    });

    it("sends the shopper back to the domain they checked out on, not just the primary", async () => {
      await TenantDomain.create({ tenantId: velor.tenant._id, host: "shop2.velor.com", status: "active" });
      const SECOND = { "x-tenant-host": "shop2.velor.com" };
      await request(app.server).post("/api/v1/cart/add").set({ ...SECOND, ...GUEST })
        .send({ productId: String(product._id), quantity: 1 }).expect(200);
      const placed = await request(app.server).post("/api/v1/shop/order").set({ ...SECOND, ...GUEST })
        .send({ shippingInfo: SHIPPING, paymentMethod: "sslcommerz" }).expect(201);
      const { invoiceId } = placed.body.data.order;
      sslcommerz.validatePayment.mockResolvedValue(paid(invoiceId, "500.00"));

      const res = await hook("success", { tran_id: invoiceId, val_id: "VAL1" }).expect(303);

      expect((await orderOf(invoiceId)).storefrontHost).toBe("shop2.velor.com");
      expect(res.headers.location).toBe(`https://shop2.velor.com/checkout/success?invoice=${invoiceId}`);
    });

    it("falls back to the primary domain once the checkout domain is removed", async () => {
      const { order } = await placeOnline();
      await inStore(() => Order.updateOne({ invoiceId: order.invoiceId }, { $set: { storefrontHost: "gone.example.com" } }));
      sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "FAILED", tran_id: order.invoiceId });

      const res = await hook("fail", { tran_id: order.invoiceId }).expect(303);
      expect(res.headers.location).toBe(`https://velor.com/checkout/failed?invoice=${order.invoiceId}`);
    });

    it("does not mark a forged success paid", async () => {
      const { order } = await placeOnline();
      sslcommerz.validatePayment.mockResolvedValue({ status: "INVALID_TRANSACTION" });

      const res = await hook("success", { tran_id: order.invoiceId, val_id: "made-up", status: "VALID" }).expect(303);

      expect(res.headers.location).toContain("/checkout/pending");
      expect((await orderOf(order.invoiceId)).paymentStatus).toBe("Pending");
    });

    it("holds an order paid with the wrong amount instead of marking it paid", async () => {
      const { order } = await placeOnline();
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId, "10.00"));

      await hook("ipn", { val_id: "VAL1", tran_id: order.invoiceId }).expect(200);

      const saved = await orderOf(order.invoiceId);
      expect(saved.paymentStatus).toBe("Pending");
      expect(saved.orderStatus).toBe("Hold");
    });

    it("holds a payment the gateway marks as risky", async () => {
      const { order } = await placeOnline();
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId, "1000.00", { risk_level: "1" }));

      await hook("ipn", { val_id: "VAL1", tran_id: order.invoiceId }).expect(200);
      expect(await orderOf(order.invoiceId)).toMatchObject({ paymentStatus: "success", orderStatus: "Hold" });
    });

    it("cannot settle another store's order with a validated payment", async () => {
      const { order } = await placeOnline();
      const other = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test" });
      const otherKey = (await Tenant.findById(other.tenant._id).lean()).webhookKey;
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId));

      await request(app.server).post(`/api/v1/hooks/sslcommerz/${otherKey}/ipn`).send({ val_id: "VAL1" }).expect(400);
      expect((await orderOf(order.invoiceId)).paymentStatus).toBe("Pending");
    });
  });

  describe("failed and cancelled payments", () => {
    it("ignores a fail POST the gateway does not confirm", async () => {
      const { order } = await placeOnline();

      await hook("fail", { tran_id: order.invoiceId, status: "FAILED" }).expect(303);

      expect(await orderOf(order.invoiceId)).toMatchObject({ paymentStatus: "Pending", orderStatus: "Pending" });
      expect(await stock()).toBe(8);
    });

    it("gives the stock and coupon use back once the gateway confirms the failure", async () => {
      await inStore(() => Coupon.create({
        code: "SAVE10", discountType: "percentage", discountValue: 10, usageLimit: 5,
        couponStartAt: new Date(Date.now() - 86400000), expireAt: new Date(Date.now() + 86400000),
      }));
      const { order } = await placeOnline({ couponCode: "SAVE10" });
      sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "FAILED", tran_id: order.invoiceId });

      const res = await hook("fail", { tran_id: order.invoiceId }).expect(303);
      await hook("fail", { tran_id: order.invoiceId }).expect(303); // repeated: nothing moves twice

      expect(res.headers.location).toContain("/checkout/failed");
      expect(await orderOf(order.invoiceId)).toMatchObject({ paymentStatus: "failed", orderStatus: "Cancelled" });
      expect(await stock()).toBe(10);
      expect((await inStore(() => Coupon.findOne({ code: "SAVE10" }).lean())).usedCount).toBe(0);
    });

    it("settles instead of cancelling when the gateway says it was paid", async () => {
      const { order } = await placeOnline();
      sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "VALID", val_id: "VAL1", tran_id: order.invoiceId });
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId));

      const res = await hook("cancel", { tran_id: order.invoiceId }).expect(303);

      expect(res.headers.location).toContain("/checkout/success");
      expect((await orderOf(order.invoiceId)).paymentStatus).toBe("success");
      expect(await stock()).toBe(8);
    });

    it("takes the stock again for a payment that lands after the order was given up", async () => {
      const { order } = await placeOnline();
      sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "FAILED", tran_id: order.invoiceId });
      await hook("fail", { tran_id: order.invoiceId }).expect(303);
      expect(await stock()).toBe(10);

      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId));
      await hook("ipn", { val_id: "VAL1" }).expect(200);
      await hook("success", { val_id: "VAL1", tran_id: order.invoiceId }).expect(303);

      expect(await orderOf(order.invoiceId)).toMatchObject({ paymentStatus: "success", orderStatus: "Confirmed" });
      expect(await stock()).toBe(8);
    });
  });

  describe("orders abandoned on the gateway page", () => {
    const HOUR = 60 * 60 * 1000;

    it("settles a paid order whose shopper and IPN never came back", async () => {
      const { order } = await placeOnline();
      sslcommerz.querySession.mockResolvedValue({ APIConnect: "DONE", status: "VALID", val_id: "VAL1", tran_id: order.invoiceId });
      sslcommerz.validatePayment.mockResolvedValue(paid(order.invoiceId));

      await reconcilePayments(new Date(Date.now() + HOUR));
      expect((await orderOf(order.invoiceId)).paymentStatus).toBe("success");
    });

    it("leaves a recent order alone, and gives up one the gateway never answers for", async () => {
      const { order } = await placeOnline();

      await reconcilePayments(new Date(Date.now() + HOUR));
      expect((await orderOf(order.invoiceId)).paymentStatus).toBe("Pending");
      expect(await stock()).toBe(8);

      await reconcilePayments(new Date(Date.now() + 25 * HOUR));
      expect(await orderOf(order.invoiceId)).toMatchObject({ paymentStatus: "cancelled", orderStatus: "Cancelled" });
      expect(await stock()).toBe(10);
    });
  });

  describe("checkout helpers", () => {
    const preview = (body) =>
      request(app.server).post("/api/v1/shop/coupon/preview").set({ ...HOST, ...GUEST }).send(body);

    beforeEach(async () => {
      await request(app.server).post("/api/v1/cart/add").set({ ...HOST, ...GUEST })
        .send({ productId: String(product._id), quantity: 2 }).expect(200);
    });

    it("previews a coupon on the saved cart without claiming it", async () => {
      await inStore(() => Coupon.create({
        code: "FLAT100", discountType: "fixed", discountValue: 100,
        couponStartAt: new Date(Date.now() - 86400000), expireAt: new Date(Date.now() + 86400000),
      }));
      const delivery = await inStore(() => Delivery.create({ name: "Inside Dhaka", deliveryCharge: 60 }));

      const res = await preview({ couponCode: "flat100", deliveryChargeId: String(delivery._id) }).expect(200);

      expect(res.body.data).toMatchObject({ code: "FLAT100", subtotal: 1000, discountAmount: 100, deliveryCharge: 60, finalAmount: 960 });
      expect((await inStore(() => Coupon.findOne({ code: "FLAT100" }).lean())).usedCount).toBe(0);
    });

    it("refuses a coupon limited to products that are not in the cart", async () => {
      const brand = await inStore(() => Brand.create({ name: "Other", slug: "other" }));
      await inStore(() => Coupon.create({
        code: "BRAND", discountType: "percentage", discountValue: 10, applicableBrands: [brand._id],
        couponStartAt: new Date(Date.now() - 86400000), expireAt: new Date(Date.now() + 86400000),
      }));

      await preview({ couponCode: "BRAND" }).expect(400);
    });

    it("lists the store's delivery options", async () => {
      await inStore(() => Delivery.create({ name: "Outside Dhaka", deliveryCharge: 120 }));
      const res = await request(app.server).get("/api/v1/shop/delivery-options").set(HOST).expect(200);
      expect(res.body.data.options).toEqual([expect.objectContaining({ name: "Outside Dhaka", charge: 120 })]);
    });
  });
});
