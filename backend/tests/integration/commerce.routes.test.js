const nock = require("nock");
const { useIntegrationApp } = require("../setup/integration");
const { api, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Product = require("../../src/models/product.model");
const Coupon = require("../../src/models/coupon.model");
const Cart = require("../../src/models/cart.model");
const Order = require("../../src/models/order.model");
const DeliveryCharge = require("../../src/models/delivery.model");
const settings = require("../../src/settings/settings.service");

// Coupons, carts, storefront checkout, staff orders and the payment callbacks:
// the paths where a shopper's money and the shop's stock meet.
describe("commerce: coupons, cart, checkout, orders, payments", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let product;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "webshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    product = await f.product.create({ stock: 10, retailPrice: 500 });
  });
  afterEach(() => nock.cleanAll());

  const staff = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "webshop" });
  const guest = (guestId) => api(ctx.server, { tenant: "webshop", headers: { "x-guest-id": guestId } });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const productNow = () => inTenant(() => Product.findById(product._id).lean());

  // ------------------------------------------------------------------ coupons (admin)
  describe("coupon administration (/coupon)", () => {
    const couponBody = (overrides = {}) => ({
      code: "save10",
      discountType: "percentage",
      discountValue: 10,
      couponStartAt: new Date(Date.now() - 864e5).toISOString(),
      expireAt: new Date(Date.now() + 864e5).toISOString(),
      ...overrides,
    });

    it("creates (code upper-cased, slug derived), reads, updates, (de)activates and deletes", async () => {
      const created = await staff().post("/coupon/create").send(couponBody()).expect(201);
      expect(created.body.data.coupon).toMatchObject({ code: "SAVE10", slug: "save10", usedCount: 0, isActive: true });

      await staff().get("/coupon/serach-coupon/save10").expect(200);
      await staff().get("/coupon/serach-coupon/nope").expect(404);
      await staff().put("/coupon/update-coupon/save10").send(couponBody({ discountValue: 20 })).expect(200);
      expect((await inTenant(() => Coupon.findOne({ slug: "save10" }).lean())).discountValue).toBe(20);

      await staff().put("/coupon/save10/deactivate").expect(200);
      expect((await inTenant(() => Coupon.findOne({ slug: "save10" }).lean())).isActive).toBe(false);
      await staff().put("/coupon/save10/activate").expect(200);
      await staff().put("/coupon/nope/activate").expect(404);

      const all = await staff().get("/coupon/getallcoupon").expect(200);
      expect(all.body.data.coupons).toHaveLength(1);
      await staff().delete("/coupon/delete-coupon/save10").expect(200);
      await staff().delete("/coupon/delete-coupon/save10").expect(404);
      await staff().get("/coupon/getallcoupon").expect(404);
    });

    it.each([
      ["no code", { code: undefined }],
      ["an unknown discount type", { discountType: "bogo" }],
      ["a negative value", { discountValue: -5 }],
      ["an expiry before the start", { expireAt: new Date(Date.now() - 3 * 864e5).toISOString() }],
      ["a usage limit of 0", { usageLimit: 0 }],
    ])("400 for %s", async (_name, overrides) => {
      const res = await staff().post("/coupon/create").send(couponBody(overrides)).expect(400);
      expectErrorEnvelope(res.body, 400);
      expect(await inTenant(() => Coupon.countDocuments())).toBe(0);
    });

    it("400 for a percentage above 100 and for a duplicate code (any case)", async () => {
      await staff().post("/coupon/create").send(couponBody({ discountValue: 150 })).expect(400);
      await staff().post("/coupon/create").send(couponBody()).expect(201);
      await staff().post("/coupon/create").send(couponBody({ code: "SAVE10" })).expect(400);
    });

    // BUG-040: allowUnknown lets the client write usedCount (reset a used-up coupon, or pre-burn one)
    test.failing("ignores usedCount sent on create [BUG-040]", async () => {
      await staff().post("/coupon/create").send(couponBody({ usageLimit: 5, usedCount: 5 })).expect(201);
      expect((await inTenant(() => Coupon.findOne({ slug: "save10" }).lean())).usedCount).toBe(0);
    });

    it("keeps one store's coupons away from another", async () => {
      await staff().post("/coupon/create").send(couponBody()).expect(201);
      const other = await tenantFactory.create({ slug: "othercoupons" });
      const rival = await createUserIn(other, { owner: true });
      await api(ctx.server, { token: tokenFor(rival), tenant: "othercoupons" }).get("/coupon/serach-coupon/save10").expect(404);
      await api(ctx.server, { token: tokenFor(rival), tenant: "othercoupons" }).delete("/coupon/delete-coupon/save10").expect(404);
      await api(ctx.server, { tenant: "othercoupons" }).get("/coupon/check-validity").query({ code: "SAVE10", amount: 1000 }).expect(404);
    });
  });

  describe("GET /coupon/check-validity (public)", () => {
    const check = (query) => api(ctx.server, { tenant: "webshop" }).get("/coupon/check-validity").query(query);

    it("works out a percentage discount, capped by maxDiscountAmount", async () => {
      await f.coupon.create({ code: "PCT20", discountValue: 20, maxDiscountAmount: 150 });
      const res = await check({ code: "pct20", amount: 1000 }).expect(200);
      expect(res.body.data.coupon).toMatchObject({ discountAmount: 150, finalAmount: 850 });
    });

    it("works out a fixed discount and never a negative total", async () => {
      await f.coupon.factory.fixed(300).create({ code: "FLAT300" });
      const res = await check({ code: "FLAT300", amount: 200 }).expect(200);
      expect(res.body.data.coupon.finalAmount).toBe(0);
    });

    it.each([
      ["expired", (c) => c.expired()],
      ["not started", (c) => c.notStarted()],
      ["used up", (c) => c.limited(2, 2)],
    ])("400 for a coupon that is %s", async (_name, trait) => {
      await trait(f.coupon.factory).create({ code: "BADONE" });
      await check({ code: "BADONE", amount: 1000 }).expect(400);
    });

    it("404 for an unknown or inactive code; 400 without code/amount or below the minimum", async () => {
      await check({ code: "NOPE", amount: 10 }).expect(404);
      await f.coupon.create({ code: "OFF", isActive: false });
      await check({ code: "OFF", amount: 10 }).expect(404);
      await check({ amount: 10 }).expect(400);
      await f.coupon.create({ code: "MIN500", minOrderAmount: 500 });
      await check({ code: "MIN500", amount: 499 }).expect(400);
      await check({ code: "MIN500", amount: 500 }).expect(200);
    });

    it("checks a product-scoped coupon against the cart's items", async () => {
      await f.coupon.create({ code: "ONLYTHIS", applicableProducts: [product._id] });
      const other = await f.product.create();
      await check({ code: "ONLYTHIS", amount: 1000, items: JSON.stringify([{ productId: other._id.toString() }]) }).expect(400);
      await check({ code: "ONLYTHIS", amount: 1000, items: JSON.stringify([{ productId: product._id.toString() }]) }).expect(200);
      await check({ code: "ONLYTHIS", amount: 1000, items: "{not json" }).expect(400);
    });
  });

  // ------------------------------------------------------------------ cart
  describe("cart (/cart)", () => {
    it("a guest adds, merges the same item, updates, removes and clears", async () => {
      const g = guest("guest-1");
      await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 2 }).expect(200);
      const merged = await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 1 }).expect(200);
      expect(merged.body.data.items).toHaveLength(1);
      expect(merged.body.data.items[0]).toMatchObject({ quantity: 3, snapshotPrice: 500, itemTotal: 1500 });

      const itemId = merged.body.data.items[0]._id;
      const updated = await g.patch(`/cart/update/${itemId}`).send({ quantity: 5 }).expect(200);
      expect(updated.body.data.items[0].quantity).toBe(5);
      await g.patch(`/cart/update/${itemId}`).send({ quantity: 50 }).expect(400);
      await g.patch(`/cart/update/${itemId}`).send({ quantity: 0 }).expect(400);
      await g.patch("/cart/update/0123456789abcdef01234567").send({ quantity: 1 }).expect(404);

      const read = await g.get("/cart").expect(200);
      expect(read.body.data.items).toHaveLength(1);
      await g.delete(`/cart/remove/${itemId}`).expect(200);
      expect((await g.get("/cart").expect(200)).body.data.items).toHaveLength(0);
      await g.delete("/cart/clear").expect(200);
    });

    it("400 for more than in stock or a quantity below 1; 404 for an unknown or inactive product", async () => {
      const g = guest("guest-2");
      await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 11 }).expect(400);
      await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 0 }).expect(400);
      await g.post("/cart/add").send({ productId: "0123456789abcdef01234567", quantity: 1 }).expect(404);
      const hidden = await f.product.create({ isActive: false });
      await g.post("/cart/add").send({ productId: hidden._id.toString(), quantity: 1 }).expect(404);
    });

    it("drops items whose product was deactivated when the cart is read", async () => {
      const g = guest("guest-3");
      await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 1 }).expect(200);
      await inTenant(() => Product.updateOne({ _id: product._id }, { isActive: false }));
      const res = await g.get("/cart").expect(200);
      expect(res.body.data.items).toEqual([]);
    });

    it("needs a guest id or a session; a guest id without a store is a 400", async () => {
      await api(ctx.server, { tenant: "webshop" }).get("/cart").expect(401);
      await api(ctx.server, { headers: { "x-guest-id": "g" } }).get("/cart").expect(400);
    });

    it("keeps guests' carts apart", async () => {
      await guest("alice").post("/cart/add").send({ productId: product._id.toString(), quantity: 2 }).expect(200);
      const bob = await guest("bob").get("/cart").expect(200);
      expect(bob.body.data.items).toEqual([]);
    });

    // BUG-041: a quantity sent as a string is concatenated onto the existing one
    test.failing("adds a numeric-string quantity arithmetically [BUG-041]", async () => {
      const g = guest("guest-4");
      await g.post("/cart/add").send({ productId: product._id.toString(), quantity: 1 }).expect(200);
      const res = await g.post("/cart/add").send({ productId: product._id.toString(), quantity: "2" });
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].quantity).toBe(3);
    });

    // BUG-042: /cart/merge (and the wishlist) sit behind the staff authGuard, so a
    // signed-in shopper — the only person who needs them — is refused
    test.failing("a signed-in shopper can merge their guest cart into their account [BUG-042]", async () => {
      const shopper = await createUserIn(tenant, { shopper: true });
      await guest("guest-5").post("/cart/add").send({ productId: product._id.toString(), quantity: 1 }).expect(200);
      await api(ctx.server, { token: tokenFor(shopper), tenant: "webshop" }).post("/cart/merge").send({ guestId: "guest-5" }).expect(200);
    });

    test.failing("a signed-in shopper can use the wishlist [BUG-042]", async () => {
      const shopper = await createUserIn(tenant, { shopper: true });
      await api(ctx.server, { token: tokenFor(shopper), tenant: "webshop" }).get("/wishList/get-wishtlist").expect(200);
    });
  });

  // ------------------------------------------------------------------ storefront checkout
  describe("POST /shop/order (storefront checkout)", () => {
    const address = { fullName: "Rahim", phone: "01712345678", address: "Dhaka" };
    const checkout = (guestId, body = {}) => guest(guestId).post("/shop/order").send({ shippingInfo: address, paymentMethod: "cod", ...body });
    const putInCart = (guestId, items) =>
      inTenant(() => Cart.create({ guestId, items: items.map((i) => ({ product: i.product, variant: i.variant || null, quantity: i.quantity, snapshotPrice: 1, itemTotal: 1 })) }));

    it("places the order at the shop's prices, takes stock, burns the coupon use and empties the cart", async () => {
      await f.coupon.factory.limited(5).create({ code: "WEB10" });
      await guest("buyer").post("/cart/add").send({ productId: product._id.toString(), quantity: 2 }).expect(200);
      const res = await checkout("buyer", { couponCode: "web10" }).expect(201);
      expect(res.body.data.order).toMatchObject({ totalAmount: 1000, discountAmount: 100, finalAmount: 900 });
      expect((await productNow()).stock).toBe(8);
      expect((await inTenant(() => Coupon.findOne({ code: "WEB10" }).lean())).usedCount).toBe(1);
      expect(await inTenant(() => Cart.countDocuments())).toBe(0);
    });

    it("409 when stock runs out between pricing and decrement — and nothing else moved", async () => {
      // Two lines for the same product each pass the per-line check (3 ≤ 5)
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 5 }));
      await putInCart("split", [{ product: product._id, quantity: 3 }, { product: product._id, quantity: 3 }]);
      const res = await checkout("split");
      expect(res.status).toBe(409);
      expect(await inTenant(() => Order.countDocuments())).toBe(0);
    });

    // BUG-043: on a sold-out line the order is deleted but the lines already
    // decremented are not put back — the stock is lost
    test.failing("gives back the stock of lines already taken when a later line sells out [BUG-043]", async () => {
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 5 }));
      await putInCart("split2", [{ product: product._id, quantity: 3 }, { product: product._id, quantity: 3 }]);
      await checkout("split2");
      expect((await productNow()).stock).toBe(5);
    });

    // BUG-044: the usage limit is checked, the order is written, and only then
    // is usedCount incremented — parallel checkouts all pass the check
    test.failing("a coupon limited to 1 use is used at most once under parallel checkouts [BUG-044]", async () => {
      await f.coupon.factory.limited(1).create({ code: "ONCE" });
      for (let i = 0; i < 10; i += 1) await putInCart(`p${i}`, [{ product: product._id, quantity: 1 }]);
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => checkout(`p${i}`, { couponCode: "ONCE" })));
      const withCoupon = await inTenant(() => Order.countDocuments({ coupon: { $ne: null } }));
      expect(withCoupon).toBeLessThanOrEqual(1);
      expect((await inTenant(() => Coupon.findOne({ code: "ONCE" }).lean())).usedCount).toBeLessThanOrEqual(1);
      expect(results.filter((r) => r.status === 201).length).toBeGreaterThanOrEqual(1);
    });

    it("parallel checkouts of the last units never oversell", async () => {
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 3 }));
      for (let i = 0; i < 10; i += 1) await putInCart(`last${i}`, [{ product: product._id, quantity: 1 }]);
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => checkout(`last${i}`)));
      const placed = results.filter((r) => r.status === 201).length;
      expect(placed).toBe(3);
      expect((await productNow()).stock).toBe(0);
      expect(await inTenant(() => Order.countDocuments())).toBe(3);
    });

    it("a shopper reads only their own orders", async () => {
      const shopper = await createUserIn(tenant, { shopper: true });
      const other = await createUserIn(tenant, { shopper: true });
      const asShopper = api(ctx.server, { token: tokenFor(shopper), tenant: "webshop" });
      await asShopper.post("/cart/add").send({ productId: product._id.toString(), quantity: 1 }).expect(200);
      const placed = await asShopper.post("/shop/order").send({ shippingInfo: address, paymentMethod: "cod" }).expect(201);
      const mine = await asShopper.get("/shop/orders").expect(200);
      expect(mine.body.data.orders).toHaveLength(1);
      const otherClient = api(ctx.server, { token: tokenFor(other), tenant: "webshop" });
      expect((await otherClient.get("/shop/orders").expect(200)).body.data.orders).toEqual([]);
      await otherClient.get(`/shop/orders/${placed.body.data.order._id}`).expect(404);
      await asShopper.get(`/shop/orders/${placed.body.data.order._id}`).expect(200);
    });

    // BUG-011 (storefront too): a query operator in the sign-in identifier crashes it
    test.failing("POST /shop/auth/login answers 400 to an operator object as the email [BUG-011]", async () => {
      const res = await api(ctx.server, { tenant: "webshop" }).post("/shop/auth/login").send({ email: { $gt: "" }, password: "x" });
      expect(res.status).toBe(400);
    });
  });

  // ------------------------------------------------------------------ staff orders
  describe("staff orders (/order)", () => {
    let delivery;
    beforeEach(async () => {
      delivery = await inTenant(() => DeliveryCharge.create({ name: "Inside Dhaka", deliveryCharge: 60 }));
    });

    const seedOrder = async (overrides = {}) =>
      inTenant(() =>
        Order.create({
          items: [{ product: product._id, quantity: 2, retailPrice: 500, totalPrice: 1000 }],
          shippingInfo: { fullName: "Karim", phone: "01712345678", address: "Dhaka" },
          totalAmount: 1000,
          finalAmount: 1060,
          paymentMethod: "cod",
          invoiceId: `INV-${Math.random().toString(36).slice(2, 8)}`,
          ...overrides,
        }),
      );

    // BUG-045: the staff checkout sums `item.totalPrice`, a field the cart does
    // not have (it stores `itemTotal`), so every order total is NaN and fails
    test.failing("POST /order/createorder places an order from the staff member's cart [BUG-045]", async () => {
      await staff().post("/cart/add").send({ productId: product._id.toString(), quantity: 2 }).expect(200);
      const res = await staff().post("/order/createorder").send({ shippingInfo: { fullName: "K", phone: "", address: "D" }, paymentMethod: "cod", deliveryCharge: delivery._id.toString() });
      expect(res.status).toBe(201);
      expect((await productNow()).stock).toBe(8);
    });

    it("PUT /order/order-update/:id moves an order through its statuses", async () => {
      const order = await seedOrder();
      for (const status of ["Confirmed", "Packaging", "CourierPending", "Shipped"]) {
        await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: status }).expect(200);
        expect((await inTenant(() => Order.findById(order._id).lean())).orderStatus).toBe(status);
      }
      await staff().put("/order/order-update/0123456789abcdef01234567").send({ orderStatus: "Confirmed" }).expect(404);
    });

    it("cancelling an order puts its stock back", async () => {
      const order = await seedOrder();
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Cancelled" }).expect(200);
      expect((await productNow()).stock).toBe(12);
    });

    // BUG-046: "Delivered" runs the same stock rollback as "Cancelled", so every
    // delivered order puts its goods back on the shelf
    test.failing("marking an order Delivered does not put its stock back [BUG-046]", async () => {
      const order = await seedOrder();
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Delivered" }).expect(200);
      expect((await productNow()).stock).toBe(10);
    });

    // BUG-047: there is no transition guard: re-sending a status repeats its side effect
    test.failing("cancelling an already-cancelled order does not restock a second time [BUG-047]", async () => {
      const order = await seedOrder();
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Cancelled" }).expect(200);
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Cancelled" });
      expect((await productNow()).stock).toBe(12);
    });

    test.failing("deleting a cancelled order does not restock again [BUG-047]", async () => {
      const order = await seedOrder();
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Cancelled" }).expect(200);
      await staff().delete(`/order/order-delete/${order._id}`).expect(200);
      expect((await productNow()).stock).toBe(12);
    });

    it("400 for an unknown status, nothing changes", async () => {
      const order = await seedOrder();
      await staff().put(`/order/order-update/${order._id}`).send({ orderStatus: "Teleported" }).expect(400);
      expect((await inTenant(() => Order.findById(order._id).lean())).orderStatus).toBe("Pending");
      expect((await productNow()).stock).toBe(10);
    });

    it("lists, reads, tracks, counts and searches orders of this store only", async () => {
      const order = await seedOrder({ invoiceId: "INV-TRACK1" });
      const other = await tenantFactory.create({ slug: "otherorders" });
      await runForTenant(other._id, () => Order.create({ items: [], totalAmount: 1, finalAmount: 1, paymentMethod: "cod", invoiceId: "INV-FOREIGN" }));

      const all = await staff().get("/order/allorders").expect(200);
      expect(JSON.stringify(all.body.data)).toContain("INV-TRACK1");
      expect(JSON.stringify(all.body.data)).not.toContain("INV-FOREIGN");
      await staff().get(`/order/single-order/${order._id}`).expect(200);
      await staff().get("/order/track-order/INV-TRACK1").expect(200);
      await staff().get("/order/track-order/INV-FOREIGN").expect(404);
      const counts = await staff().get("/order/getorderstatus").expect(200);
      expect(JSON.stringify(counts.body.data)).toContain("Pending");
    });

    it("the public tracking endpoint shows status only, never the customer's details", async () => {
      await seedOrder({ invoiceId: "INV-PUBLIC" });
      const res = await api(ctx.server, { tenant: "webshop" }).get("/shop/track/INV-PUBLIC").expect(200);
      expect(res.body.data.order).toMatchObject({ invoiceId: "INV-PUBLIC", orderStatus: "Pending" });
      expect(JSON.stringify(res.body)).not.toMatch(/Karim|01712345678|Dhaka/);
      await api(ctx.server, { tenant: "webshop" }).get("/shop/track/NOPE").expect(404);
    });
  });

  // ------------------------------------------------------------------ payment callbacks
  describe("SSLCommerz callbacks (/hooks/sslcommerz/:webhookKey)", () => {
    beforeEach(async () => {
      await settings.updateSection(tenant._id, "sslcommerz", { enabled: true, isLive: false, storeId: "teststore", storePassword: "test-store-pass" });
      settings.clearSettingsCache();
    });
    const hook = (path) => api(ctx.server).post(`/hooks/sslcommerz/${tenant.webhookKey}/${path}`);
    const seedWebOrder = (invoiceId, overrides = {}) =>
      inTenant(() => Order.create({ items: [], totalAmount: 900, finalAmount: 900, paymentMethod: "sslcommerz", invoiceId, ...overrides }));
    const validator = (body) =>
      nock("https://sandbox.sslcommerz.com").post(/\/validator\/api\/validationserverAPI\.php/).query(true).reply(200, body);

    it("IPN: validates val_id with the gateway and marks the order paid", async () => {
      await seedWebOrder("INV-PAY1");
      const scope = validator({ status: "VALID", tran_id: "INV-PAY1", val_id: "VAL1", amount: "900.00" });
      await hook("ipn").send({ val_id: "VAL1" }).expect(200);
      expect(scope.isDone()).toBe(true);
      const order = await inTenant(() => Order.findOne({ invoiceId: "INV-PAY1" }).lean());
      expect(order).toMatchObject({ paymentStatus: "success", valId: "VAL1", transactionId: "INV-PAY1" });
    });

    // BUG-074: ipnPayment calls sendSuccess(res, 200, updatedOrder, "Payment
    // validated…") — message and data swapped, so `message` is the order object
    test.failing("IPN answers in the standard success envelope (message is text, the order is data) [BUG-074]", async () => {
      await seedWebOrder("INV-ENV1");
      validator({ status: "VALID", tran_id: "INV-ENV1", val_id: "VALE", amount: "900.00" });
      const res = await hook("ipn").send({ val_id: "VALE" }).expect(200);
      expect(typeof res.body.message).toBe("string");
      expect(res.body.data).toMatchObject({ invoiceId: "INV-ENV1" });
    });

    it("IPN: 400 when the gateway says INVALID, and nothing changes", async () => {
      await seedWebOrder("INV-PAY2");
      validator({ status: "INVALID_TRANSACTION" });
      await hook("ipn").send({ val_id: "FORGED" }).expect(400);
      expect((await inTenant(() => Order.findOne({ invoiceId: "INV-PAY2" }).lean())).paymentStatus).toBe("Pending");
      await hook("ipn").send({}).expect(400);
    });

    // BUG-048: the validated amount is never compared with the order total, so a
    // real (cheap) payment can be replayed against an expensive order's tran_id
    test.failing("IPN: refuses a validated payment whose amount does not match the order [BUG-048]", async () => {
      await seedWebOrder("INV-PAY3");
      validator({ status: "VALID", tran_id: "INV-PAY3", val_id: "VAL3", amount: "1.00" });
      const res = await hook("ipn").send({ val_id: "VAL3" });
      expect(res.status).toBe(400);
      expect((await inTenant(() => Order.findOne({ invoiceId: "INV-PAY3" }).lean())).paymentStatus).toBe("Pending");
    });

    // BUG-049: fail/cancel are unverified and overwrite any order, paid ones
    // included, with statuses outside the schema enum ("failed", "confirmed")
    test.failing("fail callback cannot un-pay an order the IPN already confirmed [BUG-049]", async () => {
      await seedWebOrder("INV-PAY4", { paymentStatus: "success", orderStatus: "Confirmed" });
      await hook("fail").send({ tran_id: "INV-PAY4" });
      const order = await inTenant(() => Order.findOne({ invoiceId: "INV-PAY4" }).lean());
      expect(order.paymentStatus).toBe("success");
    });

    test.failing("payment callbacks only write order statuses the schema allows [BUG-049]", async () => {
      await seedWebOrder("INV-PAY5");
      validator({ status: "VALID", tran_id: "INV-PAY5", val_id: "VAL5", amount: "900.00" });
      await hook("ipn").send({ val_id: "VAL5" }).expect(200);
      const order = await inTenant(() => Order.findOne({ invoiceId: "INV-PAY5" }).lean());
      expect(Order.schema.path("orderStatus").enumValues).toContain(order.orderStatus);
    });

    it("404 for an unknown webhook key; 400 without tran_id", async () => {
      await api(ctx.server).post("/hooks/sslcommerz/not-a-key/fail").send({ tran_id: "x" }).expect(404);
      await hook("fail").send({}).expect(400);
      await hook("cancel").send({ tran_id: "NOPE" }).expect(404);
    });
  });
});
