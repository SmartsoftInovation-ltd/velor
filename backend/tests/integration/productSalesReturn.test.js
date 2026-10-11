const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const salesReturnModel = require("../../src/models/salesReturn.model");
const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { getProductSalesReturnReport } = require("../../src/controller/report.controller");

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// One row per product on a sales return, read from the return as it was saved.
describe("product sales return report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const shirtId = new mongoose.Types.ObjectId();
  const parentId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

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

  const runReport = (extra = {}) =>
    runForTenant(tenantId, async () => {
      const today = localToday();
      let body;
      let error;
      const req = { body: { startDate: today, endDate: today, ...extra }, query: {} };
      const res = { status: () => res, json: (b) => (body = b) };
      await getProductSalesReturnReport(req, res, (err) => (error = err));
      if (error) throw error;
      return body.data;
    });

  const sale = async (invoiceNumber, searchItem) =>
    (await insert(salesModel, { date: new Date(), invoiceNumber, customerType: { type: "walking", walking: {} }, searchItem })).insertedId;

  beforeEach(async () => {
    await insert(productModel, { _id: shirtId, name: "Casual Full Shirt", barCode: "688", color: "Black", size: "S", purchasePrice: 800, wholesalePrice: 1250, retailPrice: 1650 });
    await insert(productModel, { _id: parentId, name: "Jeans Pant" });
    await insert(variantModel, { _id: variantId, product: parentId, barCode: "690", color: "Blue", size: "32", purchasePrice: 900, wholesalePrice: 1300, retailPrice: 1750 });
  });

  it("lists a returned product with its prices, unit discount and refund", async () => {
    // Sold at 1650 with 250 off each; 2 came back at the net 1400
    const saleId = await sale("INV-1", [{ productId: shirtId, quantity: 3, salesRate: 1650, discount: 250, discountType: "amount", barcode: "688", color: "Black", size: "S" }]);
    await insert(salesReturnModel, {
      returnId: "SRET-1",
      date: new Date(),
      invoiceNumber: saleId,
      allproduct: [{ product: shirtId, variant: null, quantity: 2, unitPrice: 1400, subtotal: 2800 }],
      totalReturnAmount: 2800,
    });

    const { rows, totals } = await runReport();
    expect(rows[0]).toMatchObject({
      returnId: "SRET-1",
      invoiceNumber: "INV-1",
      productName: "Casual Full Shirt",
      barcode: "688",
      color: "Black",
      size: "S",
      qty: 2,
      buyPrice: 800,
      wsPrice: 1250,
      rsPrice: 1650,
      discount: 250,
      total: 2800,
    });
    expect(totals).toMatchObject({ count: 1, totalQty: 2, totalBuyPrice: 800, totalWsPrice: 1250, totalRsPrice: 1650, totalDiscount: 250, totalAmount: 2800 });
  });

  it("splits a return's invoice discount and less-taka share over its rows, adding up to the refund", async () => {
    const saleId = await sale("INV-2", [
      { productId: shirtId, quantity: 1, salesRate: 1000, purchasePrice: 700 },
      { productId: null, variantId, quantity: 1, salesRate: 2000 },
    ]);
    // 3000 gross, 10% off = 300, less-taka share 100 → 2600 refunded
    await insert(salesReturnModel, {
      returnId: "SRET-2",
      date: new Date(),
      invoiceNumber: saleId,
      allproduct: [
        { product: shirtId, variant: null, quantity: 1, unitPrice: 1000, subtotal: 1000 },
        { product: null, variant: variantId, quantity: 1, unitPrice: 2000, subtotal: 2000 },
      ],
      discountPercent: 10,
      discountAmount: 300,
      lessTakaShare: 100,
      totalReturnAmount: 2600,
    });

    const { rows, totals } = await runReport();
    // 1000 − 100 − 50; the cost stamped on the sale line wins over the catalogue
    expect(rows[0]).toMatchObject({ productName: "Casual Full Shirt", buyPrice: 700, discount: 150, total: 850 });
    // 2000 − 200 − 50; a variant takes its product's name and its own prices
    expect(rows[1]).toMatchObject({ productName: "Jeans Pant", barcode: "690", buyPrice: 900, wsPrice: 1300, rsPrice: 1750, discount: 250, total: 1750 });
    expect(totals.totalAmount).toBe(2600);
  });

  it("leaves details empty when the product is gone, and filters by search", async () => {
    const saleId = await sale("INV-3", []);
    await insert(salesReturnModel, {
      returnId: "SRET-3",
      date: new Date(),
      invoiceNumber: saleId,
      allproduct: [{ product: new mongoose.Types.ObjectId(), variant: null, quantity: 1, unitPrice: 500, subtotal: 500 }],
      totalReturnAmount: 500,
    });

    const { rows } = await runReport();
    expect(rows[0]).toMatchObject({ productName: null, barcode: null, color: null, size: null, buyPrice: 0, discount: 0, total: 500 });

    require("../mocks/redisCache").__reset();
    expect((await runReport({ search: "INV-3" })).rows).toHaveLength(1);
    require("../mocks/redisCache").__reset();
    expect((await runReport({ search: "nothing" })).rows).toHaveLength(0);
  });
});
