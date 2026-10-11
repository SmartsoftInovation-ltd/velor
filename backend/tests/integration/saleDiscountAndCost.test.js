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
const { computeReturnAmounts } = require("../../src/controller/salesReturn.controller");

// The sale-side rules profit depends on (.claude/rules/profit-calculation.md):
// one discount per invoice, and each line keeping the cost it was sold at.
describe("sale discount and cost rules", () => {
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
      slug: "ruleshop",
      password: "Rule-Pass1",
      permissions: [{ permission: permission._id, actions: ["view", "add", "edit"] }],
    });

    await runForTenant(shop.tenant._id, async () => {
      // Inserted raw: the Product schema demands a full catalogue shape that
      // has nothing to do with these rules.
      const { insertedId } = await Product.collection.insertOne({
        tenantId: shop.tenant._id,
        name: "Test Item",
        slug: "test-item",
        stock: 50,
        purchasePrice: 400,
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
      .send({ workspace: "ruleshop", email: "staff@shop.test", password: "Rule-Pass1" });
    if (!res.body?.data?.accessToken) {
      throw new Error(`login failed ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return res.body.data.accessToken;
  };

  const line = (overrides = {}) => ({
    productId: product._id.toString(),
    quantity: 1,
    salesRate: 1000,
    salesStatus: "sale",
    ...overrides,
  });

  // "pending" keeps these off the stock-deduction path.
  const sale = (overrides) => ({
    customerType: { type: "walking", walking: { customerName: "Walk-in", mobileNumber: "01700000000" } },
    salesMen: shop.user._id.toString(),
    searchItem: [line()],
    payable: 1000,
    paid: 1000,
    salesType: "retailsale",
    invoiceStatus: "pending",
    ...overrides,
  });

  const send = async (method, url, body, status) => {
    const res = await request(app.server)[method](url)
      .set({ Authorization: `Bearer ${await token()}` })
      .send(body);
    if (res.status !== status) {
      throw new Error(`expected ${status}, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    return res;
  };
  const create = (body, status) => send("post", "/api/v1/sales/create-sales", body, status);
  const update = (id, body, status) => send("put", `/api/v1/sales/update-sales/${id}`, body, status);

  const stored = (id) => runForTenant(shop.tenant._id, () => salesModel.findById(id).lean());

  describe("one discount per invoice", () => {
    it.each([
      ["an item discount", { searchItem: [{ discount: 100, discountType: "amount" }] }],
      ["an invoice discount", { discountPercent: 5 }],
      ["less taka", { lessTaka: 50 }],
    ])("saves a sale with only %s", async (_name, { searchItem, ...rest }) => {
      await create(sale({ ...rest, ...(searchItem && { searchItem: searchItem.map(line) }) }), 201);
    });

    it.each([
      ["item discount + invoice discount", { searchItem: [{ discount: 10, discountType: "percent" }], discountPercent: 5 }],
      ["item discount + less taka", { searchItem: [{ discount: 100, discountType: "amount" }], lessTaka: 50 }],
      ["invoice discount + less taka", { discountPercent: 5, lessTaka: 50 }],
    ])("rejects %s", async (_name, { searchItem, ...rest }) => {
      const res = await create(sale({ ...rest, ...(searchItem && { searchItem: searchItem.map(line) }) }), 400);
      expect(res.body.message).toMatch(/only one discount/i);

      const saved = await runForTenant(shop.tenant._id, () => salesModel.countDocuments({}));
      expect(saved).toBe(0);
    });

    it("rejects an edit that adds a second discount to a saved sale", async () => {
      const res = await create(sale({ discountPercent: 5 }), 201);

      const rejected = await update(res.body.data._id, { lessTaka: 50 }, 400);
      expect(rejected.body.message).toMatch(/only one discount/i);
    });
  });

  describe("line cost", () => {
    const setCataloguePrice = (purchasePrice) =>
      runForTenant(shop.tenant._id, () =>
        Product.collection.updateOne({ _id: product._id }, { $set: { purchasePrice } }),
      );

    it("stamps the catalogue's purchase price on the line, ignoring the request", async () => {
      const res = await create(sale({ searchItem: [line({ purchasePrice: 1 })] }), 201);

      const saved = await stored(res.body.data._id);
      expect(saved.searchItem[0].purchasePrice).toBe(400);
    });

    it("keeps a line's cost through an edit after the catalogue price changed", async () => {
      const res = await create(sale(), 201);
      await setCataloguePrice(900);

      await update(res.body.data._id, { searchItem: [line({ quantity: 1 })], remark: "edited" }, 200);

      const saved = await stored(res.body.data._id);
      expect(saved.searchItem[0].purchasePrice).toBe(400);
    });
  });
});

// A refund hands back what the customer paid for the returned units.
describe("sales return amounts", () => {
  const productId = "64b000000000000000000001";
  const items = (quantity) => [{ product: productId, variant: null, quantity }];

  it("refunds a discounted line at its net price, per unit or percent", () => {
    const amount = { searchItem: [{ productId, quantity: 2, salesRate: 1000, discount: 100, discountType: "amount" }] };
    const percent = { searchItem: [{ productId, quantity: 2, salesRate: 1000, discount: 10, discountType: "percent" }] };

    expect(computeReturnAmounts(amount, items(1))).toMatchObject({ grossReturnAmount: 900, totalReturnAmount: 900 });
    expect(computeReturnAmounts(percent, items(2))).toMatchObject({ grossReturnAmount: 1800, totalReturnAmount: 1800 });
  });

  it("still takes the invoice discount and the less-taka share off an undiscounted line", () => {
    const withPercent = { discountPercent: 5, searchItem: [{ productId, quantity: 2, salesRate: 1000 }] };
    const withLess = { lessTaka: 400, searchItem: [{ productId, quantity: 2, salesRate: 1000 }] };

    expect(computeReturnAmounts(withPercent, items(1))).toMatchObject({ discountAmount: 50, totalReturnAmount: 950 });
    expect(computeReturnAmounts(withLess, items(1))).toMatchObject({ lessTakaShare: 200, totalReturnAmount: 800 });
  });
});
