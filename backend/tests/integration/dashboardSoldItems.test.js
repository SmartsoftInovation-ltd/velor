const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const productModel = require("../../src/models/product.model");
const { getSoldItemsSummary } = require("../../src/controller/dashboard.controller");

// Dashboard "Sold Items" card: net sales split retail vs wholesale, from the
// shared sale formula (salesRate × qty less discounts), never the stored subtotal.
describe("dashboard sold items summary", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(async () => {
    await clearTestDb();
    require("../mocks/redisCache").__reset();
  });
  afterAll(disconnectTestDb);

  const insert = (model, doc) =>
    runForTenant(tenantId, () =>
      model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }),
    );

  const sale = (doc) =>
    insert(salesModel, {
      date: new Date(),
      customerType: { type: "walking" },
      discountPercent: 0,
      lessTaka: 0,
      ...doc,
    });

  const summary = () =>
    runForTenant(tenantId, async () => {
      let body;
      let error;
      const res = { status: () => res, json: (b) => (body = b) };
      await getSoldItemsSummary({ query: { range: "all" } }, res, (err) => (error = err));
      if (error) throw error;
      return body.data.soldItems;
    });

  beforeEach(() => insert(productModel, { _id: productId, name: "Shirt", purchasePrice: 100 }));

  it("splits net sales into retail and wholesale", async () => {
    // Retail: 2 × 500 = 1000, less 10% = 900. The stored subtotal is wrong on purpose.
    await sale({
      salesType: "retailsale",
      discountPercent: 10,
      searchItem: [{ productId, quantity: 2, salesRate: 500, subtotal: 99999, salesStatus: "sale" }],
    });
    // Wholesale: 10 × 300 = 3000, line discount 20 taka a unit = 200, less 100 = 2700
    await sale({
      salesType: "wholesale",
      lessTaka: 100,
      searchItem: [{ productId, quantity: 10, salesRate: 300, discount: 20, discountType: "amount", salesStatus: "sale" }],
    });
    // Wholesale order: 1 × 250
    await sale({
      salesType: "wholesaleorder",
      searchItem: [{ productId, quantity: 1, salesRate: 250, salesStatus: "sale" }],
    });

    const s = await summary();
    expect(s.retailAmount).toBe(900);
    expect(s.wholesaleAmount).toBe(2950);
    expect(s.totalAmount).toBe(3850);
    expect(s.quantity).toBe(13);
    expect(s.invoiceCount).toBe(3);
  });

  it("leaves exchange lines out", async () => {
    await sale({
      salesType: "retailsale",
      searchItem: [
        { productId, quantity: 1, salesRate: 400, salesStatus: "sale" },
        { productId, quantity: 1, salesRate: 400, salesStatus: "exchange" },
      ],
    });
    const s = await summary();
    expect(s.retailAmount).toBe(400);
    expect(s.wholesaleAmount).toBe(0);
    expect(s.quantity).toBe(1);
  });
});
