const mongoose = require("mongoose");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const service = require("../../src/settings/settings.service");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");

const Product = require("../../src/models/product.model");
const Sales = require("../../src/models/sales.model");
const Purchase = require("../../src/models/purchase.model");
const { customerModel: Customer } = require("../../src/models/customer.model");
const { SupplierModel: Supplier } = require("../../src/models/supplier.model");

/**
 * Every reporting endpoint, swept.
 *
 * The report and dashboard controllers are roughly a hundred aggregations, each
 * with its own `$lookup` pipelines. The tenant plugin scopes them, but a typo in
 * a `from:` string or a stage the plugin cannot reach would drop the scope
 * silently — the response still has the right shape, it just counts another
 * store's rows. Nothing else in the suite would notice.
 *
 * So rather than asserting on each report's numbers, this gives two stores
 * data that differs only in amount, calls every route the routers expose, and
 * fails if one store's response ever mentions the other's figures or names.
 * New endpoints are covered the moment they are mounted.
 */

// Values that appear nowhere else, so finding one in the wrong response is proof
const PIZZA = { amount: 11111, customer: "PizzaOnlyCustomer", product: "PizzaOnlyProduct", supplier: "PizzaOnlySupplier" };
const BURGER = { amount: 99999, customer: "BurgerOnlyCustomer", product: "BurgerOnlyProduct", supplier: "BurgerOnlySupplier" };

const routesOf = (router) =>
  router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ method: Object.keys(layer.route.methods)[0], path: layer.route.path }));

describe("report and dashboard isolation (strict mode)", () => {
  let app;
  let stores;
  let endpoints;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, STAFF_ENV, { TENANCY_MODE: "strict" });
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    endpoints = [
      ...routesOf(require("../../src/routes/api/dashboard.api")).map((r) => ({ ...r, base: "/api/v1/dashboard" })),
      ...routesOf(require("../../src/routes/api/report.api")).map((r) => ({ ...r, base: "/api/v1/report" })),
    ];
  });

  // Seeds one store with data whose every figure and name is unique to it.
  //
  // Written straight to the collections rather than through the models: the
  // schemas require a dozen related documents each (variant type, category,
  // salesman, customer type) that this test does not care about. What it needs
  // is rows carrying the right tenantId, which is exactly what the aggregations
  // read — and an over-full fixture would only hide which field a leak came from.
  const seed = async (tenantId, data) => {
    const id = new mongoose.Types.ObjectId();
    const tid = new mongoose.Types.ObjectId(tenantId);
    const stamp = { tenantId: tid, createdAt: new Date(), updatedAt: new Date() };

    await Product.collection.insertOne({
      _id: id, ...stamp,
      name: data.product, productName: data.product,
      sellingPrice: data.amount, purchasePrice: data.amount, stock: 7, isActive: true,
    });

    await Customer.collection.insertOne({
      ...stamp, customerName: data.customer, fullName: data.customer, mobile: "01711111111", isActive: true,
    });

    await Supplier.collection.insertOne({
      ...stamp, supplierName: data.supplier, mobile: "01722222222", isActive: true,
    });

    const line = {
      productId: id, productName: data.product, quantity: 1,
      salesRate: data.amount, purchaseRate: data.amount, subtotal: data.amount,
    };

    await Sales.collection.insertOne({
      ...stamp,
      customer: { customerName: data.customer, mobileNumber: "01711111111" },
      items: [line], totalAmount: data.amount, grandTotal: data.amount, paidAmount: data.amount,
      status: "completed", paymentStatus: "paid",
    });

    await Purchase.collection.insertOne({
      ...stamp,
      supplierName: data.supplier,
      items: [line], grandTotal: data.amount, totalAmount: data.amount, paidAmount: data.amount,
      status: "completed", paymentStatus: "paid",
    });
  };

  beforeEach(async () => {
    invalidateTenantCache();
    service.clearSettingsCache();
    // This sweep calls every report route twice over; without a reset it would
    // trip the per-user report limiter rather than test the aggregations.
    resetRateLimitCounters();
    const platformAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };

    stores = {};
    for (const slug of ["pizzashop", "burgerhub"]) {
      const { body } = await request(app.server).post("/api/v1/platform/tenants").set(platformAuth).send({
        name: slug,
        slug,
        owner: { name: "Owner", email: "owner@shop.com", phone: "01711000000", password: `${slug}-Owner-Pass1` },
      });
      const login = await request(app.server).post("/api/v1/auth/login")
        .send({ workspace: slug, email: "owner@shop.com", password: `${slug}-Owner-Pass1` });
      stores[slug] = {
        tenant: body.data.tenant,
        auth: { Authorization: `Bearer ${login.body.data.accessToken}`, "x-tenant": slug },
      };
    }

    await seed(stores.pizzashop.tenant._id, PIZZA);
    await seed(stores.burgerhub.tenant._id, BURGER);
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const call = (store, endpoint) => {
    const url = `${endpoint.base}${endpoint.path}`;
    const req = request(app.server)[endpoint.method](url).set(stores[store].auth);
    // Reports take their filters in the body; a wide date range keeps every row
    return endpoint.method === "post"
      ? req.send({ startDate: "2000-01-01", endDate: "2100-01-01", page: 1, limit: 100 })
      : req.query({ startDate: "2000-01-01", endDate: "2100-01-01" });
  };

  it("exposes the endpoints this test sweeps", () => {
    // A routing refactor that empties this list would make every assertion vacuous
    expect(endpoints.length).toBeGreaterThan(40);
    expect(endpoints.every((e) => ["get", "post"].includes(e.method))).toBe(true);
  });

  it.each([
    ["pizzashop", PIZZA, BURGER],
    ["burgerhub", BURGER, PIZZA],
  ])("no endpoint leaks another store's figures into %s", async (store, own, other) => {
    const leaked = [];

    for (const endpoint of endpoints) {
      const res = await call(store, endpoint);

      // 4xx is fine (a report may demand filters this sweep does not know); a
      // 500 would mean the sweep never reached the aggregation it is testing.
      if (res.status >= 500) {
        leaked.push(`${endpoint.method.toUpperCase()} ${endpoint.base}${endpoint.path} -> ${res.status}`);
        continue;
      }

      const body = JSON.stringify(res.body);
      for (const needle of [other.customer, other.product, other.supplier, String(other.amount)]) {
        if (body.includes(needle)) {
          leaked.push(`${endpoint.method.toUpperCase()} ${endpoint.base}${endpoint.path} contains "${needle}"`);
        }
      }
      // The store's own tenant id may appear; another store's never may
      if (body.includes(stores[store === "pizzashop" ? "burgerhub" : "pizzashop"].tenant._id)) {
        leaked.push(`${endpoint.method.toUpperCase()} ${endpoint.base}${endpoint.path} contains the other tenant id`);
      }
    }

    expect(leaked).toEqual([]);
    expect(own.amount).not.toBe(other.amount);
  }, 120000);

  // Report endpoints cost a batch of aggregations each, so they carry a tighter
  // per-user limit than the global one — and it is per user, so one store
  // hammering reports cannot lock another store out from the same office IP.
  it("rate limits reports per signed-in user, not per address", async () => {
    const saved = process.env.REPORT_RATE_LIMIT_MAX;
    process.env.REPORT_RATE_LIMIT_MAX = "60"; // the limiter read it at import
    const overview = (store) => call(store, { method: "get", base: "/api/v1/dashboard", path: "/overview" });

    try {
      let limited = null;
      for (let i = 0; i < 70 && !limited; i += 1) {
        const res = await overview("pizzashop");
        if (res.status === 429) limited = res;
      }

      expect(limited).not.toBeNull();
      expect(limited.body.message).toMatch(/too many report requests/i);

      // burgerhub's own budget is untouched
      expect((await overview("burgerhub")).status).toBe(200);
    } finally {
      if (saved) process.env.REPORT_RATE_LIMIT_MAX = saved;
      else delete process.env.REPORT_RATE_LIMIT_MAX;
      resetRateLimitCounters();
    }
  }, 60000);

  // Reports are cached per namespace; the first store to ask must not fill a
  // cache entry the second one then reads.
  it("does not serve one store's cached report to the other", async () => {
    const summary = (store) => call(store, { method: "get", base: "/api/v1/dashboard", path: "/sales-summary" });

    const pizza = await summary("pizzashop");
    const burger = await summary("burgerhub");
    const pizzaAgain = await summary("pizzashop");

    expect(JSON.stringify(burger.body)).not.toContain(String(PIZZA.amount));
    expect(JSON.stringify(pizzaAgain.body)).not.toContain(String(BURGER.amount));

    // The repeat read is served from cache — and it is pizzashop's own entry,
    // holding the same figures, not whatever burgerhub cached in between.
    expect(pizzaAgain.body.data.fromCache).toBe(true);
    expect(pizzaAgain.body.data.sales).toEqual(pizza.body.data.sales);
  });
});
