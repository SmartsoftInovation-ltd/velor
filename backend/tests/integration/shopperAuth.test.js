const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const TenantDomain = require("../../src/models/platform/tenantDomain.model");
const User = require("../../src/models/user.model");
const Order = require("../../src/models/order.model");
const Banner = require("../../src/models/banner.model");
const DiscountBanner = require("../../src/models/discountbanner.model");
const service = require("../../src/settings/settings.service");

/**
 * Shoppers and staff are rows in the same `User` collection, in the same store.
 * What separates them is the audience claim on their tokens. These tests hold
 * that line from both sides: a shopper's token must not open the dashboard, and
 * a staff token must not pass as a customer.
 */

describe("storefront shopper accounts", () => {
  let app;
  let velor;
  let pizza;
  const envBackup = { ...process.env };

  const VELOR = { "x-tenant-host": "velor.com" };
  const PIZZA = { "x-tenant-host": "pizzashop.com" };

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

    velor = await createTenantWithStaff({ slug: "velor", email: "staff@velor.test", password: "Velor-Pass1" });
    pizza = await createTenantWithStaff({ slug: "pizzashop", email: "staff@pizza.test", password: "Pizza-Pass1" });

    await TenantDomain.create({ tenantId: velor.tenant._id, host: "velor.com", status: "active" });
    await TenantDomain.create({ tenantId: pizza.tenant._id, host: "pizzashop.com", status: "active" });
  });

  afterEach(async () => {
    await clearTestDb();
    invalidateTenantCache();
  });

  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const register = (headers, body) => request(app.server).post("/api/v1/shop/auth/register").set(headers).send(body);
  const login = (headers, body) => request(app.server).post("/api/v1/shop/auth/login").set(headers).send(body);
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  const SHOPPER = { name: "Rahim", email: "rahim@example.com", password: "Shopper-Pass1" };

  describe("store identity", () => {
    it("gives each store its own brand color, and none until one is set", async () => {
      await service.updateSection(velor.tenant._id, "general", { primaryColor: "#0F9D63" });

      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      const fromPizza = await request(app.server).get("/api/v1/shop/store").set(PIZZA).expect(200);

      expect(fromVelor.body.data.primaryColor).toBe("#0F9D63");
      expect(fromPizza.body.data.primaryColor).toBe("");
    });

    it("gives each store its own layout, and the defaults until one is set", async () => {
      await service.updateSection(velor.tenant._id, "general", { bannerLayout: "full", cardLayout: "overlay", gridColumns: "5" });

      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      const fromPizza = await request(app.server).get("/api/v1/shop/store").set(PIZZA).expect(200);

      expect(fromVelor.body.data).toMatchObject({ bannerLayout: "full", cardLayout: "overlay", gridColumns: "5" });
      expect(fromPizza.body.data).toMatchObject({ bannerLayout: "split", cardLayout: "buy", gridColumns: "4" });
    });

    it("accepts the Buy Now product card and sends it to the storefront", async () => {
      await service.updateSection(velor.tenant._id, "general", { cardLayout: "buy" });

      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      expect(fromVelor.body.data.cardLayout).toBe("buy");
    });

    it("accepts the round card category layout and sends it to the storefront", async () => {
      await service.updateSection(velor.tenant._id, "general", { categoryLayout: "card" });

      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      expect(fromVelor.body.data.categoryLayout).toBe("card");
    });

    it("sends the rest of the design, and refuses an over-long announcement", async () => {
      await service.updateSection(velor.tenant._id, "general", {
        categoryLayout: "round",
        filterLayout: "popup",
        menuColor: "brand",
        announcementEnabled: "on",
        announcementText: "Free delivery this week",
      });

      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      expect(fromVelor.body.data).toMatchObject({
        categoryLayout: "round",
        filterLayout: "popup",
        menuColor: "brand",
        menuAlign: "left",
        announcementEnabled: "on",
        announcementText: "Free delivery this week",
      });

      await expect(
        service.updateSection(velor.tenant._id, "general", { announcementText: "x".repeat(121) }),
      ).rejects.toThrow();
    });

    it("refuses a layout the storefront does not have", async () => {
      await expect(service.updateSection(velor.tenant._id, "general", { cardLayout: "fancy" })).rejects.toThrow();
    });

    it("refuses a brand color that is not a plain hex value", async () => {
      await expect(
        service.updateSection(velor.tenant._id, "general", { primaryColor: "red}body{display:none" }),
      ).rejects.toThrow();
    });

    it("names the store whose domain the visitor arrived on", async () => {
      const fromVelor = await request(app.server).get("/api/v1/shop/store").set(VELOR).expect(200);
      const fromPizza = await request(app.server).get("/api/v1/shop/store").set(PIZZA).expect(200);

      expect(fromVelor.body.data.name).toBe(velor.tenant.name);
      expect(fromPizza.body.data.name).toBe(pizza.tenant.name);
      // The browser keys its cart and wishlist by this
      expect(fromVelor.body.data.id).toBe(String(velor.tenant._id));
      expect(fromPizza.body.data.id).toBe(String(pizza.tenant._id));
    });

    it("lists only this store's active banners that have an image, priority first", async () => {
      await runForTenant(velor.tenant._id, () =>
        Banner.create([
          { title: "Second", priority: 2, image: { url: "https://img/2.jpg" } },
          { title: "First", priority: 1, image: { url: "https://img/1.jpg" } },
          { title: "Hidden", priority: 0, isActive: false, image: { url: "https://img/0.jpg" } },
          { title: "No image yet", priority: 0 },
        ]),
      );
      await runForTenant(pizza.tenant._id, () => Banner.create({ title: "Pizza", image: { url: "https://img/p.jpg" } }));

      const res = await request(app.server).get("/api/v1/shop/banners").set(VELOR).expect(200);
      expect(res.body.data.banners.map((b) => b.title)).toEqual(["First", "Second"]);
      expect(res.body.data.banners[0]).toMatchObject({ image: "https://img/1.jpg", link: "" });
    });

    it("serves the store's first active promo banner, and null when it has none", async () => {
      const none = await request(app.server).get("/api/v1/shop/promo-banner").set(PIZZA).expect(200);
      expect(none.body.data.banner).toBeNull();

      await runForTenant(velor.tenant._id, () =>
        DiscountBanner.create([
          { title: "Later", priority: 2, image: { url: "https://img/2.jpg" } },
          { title: "Winter", priority: 1, link: "/shop", image: { url: "https://img/1.jpg" } },
          { title: "Off", priority: 0, isActive: false, image: { url: "https://img/0.jpg" } },
        ]),
      );
      const res = await request(app.server).get("/api/v1/shop/promo-banner").set(VELOR).expect(200);
      expect(res.body.data.banner).toMatchObject({ title: "Winter", image: "https://img/1.jpg", link: "/shop" });
    });

    it("answers 404 for a domain no store owns", async () => {
      await request(app.server).get("/api/v1/shop/store").set({ "x-tenant-host": "unknown.com" }).expect(404);
    });
  });

  describe("registration", () => {
    it("creates an account in the store whose domain was used", async () => {
      const res = await register(VELOR, SHOPPER).expect(201);
      expect(res.body.data.user).toMatchObject({ name: "Rahim", email: "rahim@example.com" });

      const created = await runForTenant(velor.tenant._id, () =>
        User.findOne({ email: "rahim@example.com" }).lean(),
      );
      expect(String(created.tenantId)).toBe(String(velor.tenant._id));
      // No roles is what makes this a shopper rather than staff
      expect(created.roles ?? []).toHaveLength(0);
    });

    /**
     * The same person may shop at two stores on this platform. Those are two
     * unrelated accounts, and one store's customer list must not reveal the
     * other's.
     */
    it("lets the same email register separately in two stores", async () => {
      await register(VELOR, SHOPPER).expect(201);
      await register(PIZZA, SHOPPER).expect(201);

      const inVelor = await runForTenant(velor.tenant._id, () => User.findOne({ email: SHOPPER.email }).lean());
      const inPizza = await runForTenant(pizza.tenant._id, () => User.findOne({ email: SHOPPER.email }).lean());

      expect(String(inVelor._id)).not.toBe(String(inPizza._id));
    });

    it("refuses a second account with the same email in one store", async () => {
      await register(VELOR, SHOPPER).expect(201);
      await register(VELOR, SHOPPER).expect(409);
    });

    it("refuses to register when no store was named", async () => {
      await register({}, SHOPPER).expect(400);
    });
  });

  describe("sign-in", () => {
    beforeEach(async () => {
      await register(VELOR, SHOPPER).expect(201);
    });

    it("signs a shopper in and marks the token as a storefront session", async () => {
      const res = await login(VELOR, { email: SHOPPER.email, password: SHOPPER.password }).expect(200);

      const claims = jwt.verify(res.body.data.accessToken, STAFF_ENV.ACCESS_TOKEN_SECRET);
      expect(claims).toMatchObject({ tid: String(velor.tenant._id), aud: "shopper" });
    });

    // The account exists in velor, not here; answering "invalid" rather than
    // "not found" keeps the two stores' customer lists private.
    it("does not recognise the account on another store's domain", async () => {
      await login(PIZZA, { email: SHOPPER.email, password: SHOPPER.password }).expect(400);
    });

    /**
     * Staff share the collection and may well know their own password. Letting
     * them in here would mint them a storefront session, and — worse, if the
     * audience claim were ever dropped — a dashboard one.
     */
    it("refuses a staff account even with the correct password", async () => {
      await login(VELOR, { email: "staff@velor.test", password: "Velor-Pass1" }).expect(400);
    });
  });

  describe("the two session types cannot be swapped", () => {
    let shopperToken;
    let staffToken;

    beforeEach(async () => {
      await register(VELOR, SHOPPER).expect(201);
      const res = await login(VELOR, { email: SHOPPER.email, password: SHOPPER.password }).expect(200);
      shopperToken = res.body.data.accessToken;

      staffToken = jwt.sign(
        { sub: String(velor.user._id), tid: String(velor.tenant._id), tv: 0, aud: "staff" },
        STAFF_ENV.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" },
      );
    });

    // The whole point of the audience claim: without it this request succeeds
    // and a customer reads every order in the shop.
    it("refuses a shopper token on a dashboard endpoint", async () => {
      await request(app.server)
        .get("/api/v1/order/allorders")
        .set({ ...VELOR, ...bearer(shopperToken) })
        .expect(401);
    });

    it("refuses a staff token on a storefront endpoint", async () => {
      await request(app.server)
        .get("/api/v1/shop/me")
        .set({ ...VELOR, ...bearer(staffToken) })
        .expect(401);
    });

    it("refuses a shopper token used against another store's domain", async () => {
      await request(app.server)
        .get("/api/v1/shop/me")
        .set({ ...PIZZA, ...bearer(shopperToken) })
        .expect(401);
    });

    it("lets the shopper read their own profile", async () => {
      const res = await request(app.server)
        .get("/api/v1/shop/me")
        .set({ ...VELOR, ...bearer(shopperToken) })
        .expect(200);

      expect(res.body.data.user.email).toBe(SHOPPER.email);
      expect(res.body.data.user).not.toHaveProperty("password");
    });
  });

  describe("order history", () => {
    it("shows the shopper only their own orders", async () => {
      await register(VELOR, SHOPPER).expect(201);
      const res = await login(VELOR, { email: SHOPPER.email, password: SHOPPER.password }).expect(200);
      const token = res.body.data.accessToken;
      const shopperId = res.body.data.user._id;

      // One order for this shopper, one for somebody else in the same store
      await runForTenant(velor.tenant._id, async () => {
        const other = await User.create({ name: "Karim", email: "karim@example.com", password: "Other-Pass1", roles: [] });
        await Order.create({ user: shopperId, invoiceId: "INV-1", totalAmount: 100, finalAmount: 100, paymentMethod: "cod" });
        await Order.create({ user: other._id, invoiceId: "INV-2", totalAmount: 200, finalAmount: 200, paymentMethod: "cod" });
      });

      const list = await request(app.server)
        .get("/api/v1/shop/orders")
        .set({ ...VELOR, ...bearer(token) })
        .expect(200);

      expect(list.body.data.orders).toHaveLength(1);
      expect(list.body.data.orders[0].invoiceId).toBe("INV-1");
    });
  });

  describe("session refresh", () => {
    const refresh = (headers, refreshToken) =>
      request(app.server).post("/api/v1/shop/auth/refresh").set(headers).send({ refreshToken });

    const signIn = async () => {
      await register(VELOR, SHOPPER).expect(201);
      return (await login(VELOR, { email: SHOPPER.email, password: SHOPPER.password }).expect(200)).body.data;
    };

    it("swaps a shopper's refresh token for a working session", async () => {
      const session = await signIn();
      const res = await refresh(VELOR, session.refreshToken).expect(200);

      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.refreshToken).toEqual(expect.any(String));
      await request(app.server).get("/api/v1/shop/me").set({ ...VELOR, ...bearer(res.body.data.accessToken) }).expect(200);
    });

    it("refuses a missing, forged or access token", async () => {
      const session = await signIn();
      await refresh(VELOR, undefined).expect(401);
      await refresh(VELOR, "not-a-token").expect(401);
      await refresh(VELOR, session.accessToken).expect(401);
      const forged = jwt.sign(jwt.decode(session.refreshToken), "some-other-secret");
      await refresh(VELOR, forged).expect(401);
    });

    it("refuses the token in another store", async () => {
      const session = await signIn();
      await refresh(PIZZA, session.refreshToken).expect(401);
    });

    it("refuses an expired token", async () => {
      const session = await signIn();
      const { exp, iat, ...claims } = jwt.decode(session.refreshToken);
      const expired = jwt.sign(claims, STAFF_ENV.REFRESH_TOKEN_SCCERET, { expiresIn: -10 });
      await refresh(VELOR, expired).expect(401);
    });

    it("refuses once the account's tokens are revoked or it is blocked", async () => {
      const session = await signIn();
      await runForTenant(velor.tenant._id, () => User.updateOne({ email: SHOPPER.email }, { $inc: { tokenVersion: 1 } }));
      await refresh(VELOR, session.refreshToken).expect(401);

      const again = (await login(VELOR, { email: SHOPPER.email, password: SHOPPER.password }).expect(200)).body.data;
      await runForTenant(velor.tenant._id, () => User.updateOne({ email: SHOPPER.email }, { isBlocked: true }));
      await refresh(VELOR, again.refreshToken).expect(401);
    });

    it("never renews a staff session", async () => {
      const staff = await runForTenant(velor.tenant._id, () => User.findById(velor.user._id).populate("roles"));
      await refresh(VELOR, staff.generateJwtRefreshToken()).expect(401);
    });
  });

  describe("sign-up by mobile number alone", () => {
    it("creates accounts with no email, and signs them in by phone", async () => {
      const first = await register(VELOR, { name: "Rahim", phone: "01711000001", password: "Shopper-Pass1" }).expect(201);
      // A second phone-only shopper must not collide on the missing email
      await register(VELOR, { name: "Karim", phone: "01711000002", password: "Shopper-Pass1", email: "  " }).expect(201);
      expect(first.body.data.user.email).toBeUndefined();

      const stored = await runForTenant(velor.tenant._id, () => User.find({ phone: /^0171100000/ }).lean());
      expect(stored.every((user) => !("email" in user))).toBe(true);

      await login(VELOR, { phone: "01711000001", password: "Shopper-Pass1" }).expect(200);
    });

    it("still keeps emails and phones unique within a store", async () => {
      await register(VELOR, { name: "Rahim", phone: "01711000001", password: "Shopper-Pass1" }).expect(201);
      await register(VELOR, { name: "Again", phone: "01711000001", password: "Shopper-Pass1" }).expect(409);
      await register(VELOR, SHOPPER).expect(201);
      await register(VELOR, { ...SHOPPER, name: "Copy" }).expect(409);
      // The same number is a separate account at another store
      await register(PIZZA, { name: "Rahim", phone: "01711000001", password: "Shopper-Pass1" }).expect(201);
    });
  });
});
