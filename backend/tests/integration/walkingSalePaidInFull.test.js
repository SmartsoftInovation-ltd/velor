const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, ensurePermission, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant } = require("../../src/tenancy/context");
const Product = require("../../src/models/product.model");
const salesModel = require("../../src/models/sales.model");
const service = require("../../src/settings/settings.service");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");

// A walking customer has no account to bill later, so a sale to one has to be
// settled in full at the counter. Leaving a due behind creates a receivable
// nobody can collect — which is also why the dashboard counts listed customers
// only. The frontend blocks it, but the API is what has to enforce it.
describe("a walking sale cannot be saved with a due", () => {
  let app;
  let shop;
  let product;
  const envBackup = { ...process.env };

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
    delete process.env.TENANCY_MODE;
    service.clearSettingsCache();
    resetRateLimitCounters();
    invalidateTenantCache();

    const permission = await ensurePermission("Retail Sales");
    shop = await createTenantWithStaff({
      slug: "cashshop",
      password: "Cash-Pass1",
      permissions: [{ permission: permission._id, actions: ["view", "add", "edit"] }],
    });

    await runForTenant(shop.tenant._id, async () => {
      // Inserted raw: the Product schema demands a full catalogue shape
      // (category, variantType, …) that has nothing to do with this rule.
      const { insertedId } = await Product.collection.insertOne({
        tenantId: shop.tenant._id,
        name: "Test Item",
        slug: "test-item",
        stock: 50,
        salesRate: 1000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      product = { _id: insertedId };
    });
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const token = async () => {
    const res = await request(app.server)
      .post("/api/v1/auth/login")
      .send({ workspace: "cashshop", email: "staff@shop.test", password: "Cash-Pass1" });
    if (!res.body?.data?.accessToken) {
      throw new Error(`login failed ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return res.body.data.accessToken;
  };

  // `invoiceStatus: "pending"` keeps the test off the stock-deduction path —
  // this is about the payment rule, not stock.
  const sale = (overrides) => ({
    customerType: {
      type: "walking",
      walking: { customerName: "Walk-in", mobileNumber: "01700000000" },
    },
    salesMen: shop.user._id.toString(),
    searchItem: [
      { productId: product._id.toString(), quantity: 1, salesRate: 1000, salesStatus: "sale" },
    ],
    payable: 1000,
    salesType: "retailsale",
    invoiceStatus: "pending",
    ...overrides,
  });

  const post = async (body, status) => {
    const res = await request(app.server)
      .post("/api/v1/sales/create-sales")
      .set({ Authorization: `Bearer ${await token()}` })
      .send(body);
    if (res.status !== status) {
      throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return res;
  };

  it("rejects a walking sale that leaves money owing", async () => {
    const res = await post(sale({ paid: 400 }), 400);
    expect(res.body.message).toMatch(/must pay in full/i);

    const saved = await runForTenant(shop.tenant._id, () => salesModel.countDocuments({}));
    expect(saved).toBe(0);
  });

  it("saves a walking sale paid exactly in full", async () => {
    const res = await post(sale({ paid: 1000 }), 201);
    expect(res.body.data.presentDue ?? 0).toBe(0);
  });

  // Overpaying is not a due — the excess is handed back as change.
  it("saves a walking sale that overpays, returning the excess as change", async () => {
    const res = await post(sale({ paid: 1200 }), 201);
    expect(res.body.data.changes).toBe(200);
    expect(res.body.data.presentDue ?? 0).toBe(0);
  });

  // Even one paisa short is still a due.
  it("rejects a walking sale that is a paisa short", async () => {
    await post(sale({ paid: 999.99 }), 400);
  });

  // The rule is walking-only: a listed customer has an account to bill.
  it("still allows a listed customer to carry a due", async () => {
    const res = await post(
      sale({
        customerType: { type: "listed", customerId: shop.user._id.toString() },
        paid: 400,
      }),
      201,
    );
    // Saved without complaint — the guard never looked at it. `presentDue` is
    // whatever the client sent; the point is that the request was accepted.
    expect(res.body.data.customerType.type).toBe("listed");
    expect(res.body.data.paid).toBe(400);
  });
});
