const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const orderModel = require("../../src/models/order.model");
const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { getPushSalesProductReport } = require("../../src/controller/report.controller");

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Items with stock that sold nothing, or next to nothing, in the period.
describe("push sales product report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const shirtId = new mongoose.Types.ObjectId();
  const kotyId = new mongoose.Types.ObjectId();
  const jeansId = new mongoose.Types.ObjectId();
  const jeans32 = new mongoose.Types.ObjectId();
  const jeans34 = new mongoose.Types.ObjectId();

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
      await getPushSalesProductReport(req, res, (err) => (error = err));
      if (error) throw error;
      return body.data;
    });

  const sell = (searchItem, doc = {}) =>
    insert(salesModel, { date: new Date(), customerType: { type: "walking", walking: {} }, searchItem, ...doc });

  beforeEach(async () => {
    await insert(productModel, { _id: shirtId, name: "Casual Full Shirt", variantType: "singleVariant", barCode: "688", color: "Black", size: "M", purchasePrice: 800, retailPrice: 1650, stock: 3, isActive: true });
    await insert(productModel, { _id: kotyId, name: "Koty", variantType: "singleVariant", barCode: "692", purchasePrice: 800, retailPrice: 1650, stock: 2, isActive: true });
    await insert(productModel, { _id: jeansId, name: "Jeans Pant", variantType: "multipleVariant", purchasePrice: 1, retailPrice: 1, stock: 0, isActive: true });
    await insert(variantModel, { _id: jeans32, product: jeansId, barCode: "690", color: "Light Wash", size: "32", purchasePrice: 900, retailPrice: 1700, stockVariant: 6, isActive: true });
    await insert(variantModel, { _id: jeans34, product: jeansId, barCode: "691", color: "Light Wash", size: "34", purchasePrice: 900, retailPrice: 1700, stockVariant: 0, isActive: true });
  });

  it("lists in-stock items that sold nothing, with their stock values", async () => {
    const { rows, totals } = await runReport();
    // jeans 34 has no stock; the rest are unsold. Most money tied up first.
    expect(rows.map((r) => `${r.productName} ${r.size ?? ""}`.trim())).toEqual(["Jeans Pant 32", "Casual Full Shirt M", "Koty"]);
    expect(rows[1]).toMatchObject({
      productName: "Casual Full Shirt",
      barcode: "688",
      color: "Black",
      size: "M",
      soldQty: 0,
      buyPrice: 800,
      salesPrice: 1650,
      stockQty: 3,
      buyStockValue: 2400,
      salesStockValue: 4950,
      profitValue: 2550,
    });
    // A variant row carries its product's name and its own prices
    expect(rows[0]).toMatchObject({ productName: "Jeans Pant", barcode: "690", buyPrice: 900, stockQty: 6, buyStockValue: 5400 });
    expect(rows[2]).toMatchObject({ color: null, size: null });
    expect(totals).toMatchObject({ count: 3, totalStockQty: 11, totalBuyStockValue: 9400, totalSalesStockValue: 18450, totalProfitValue: 9050 });
  });

  it("drops an item sold at the counter or on the website in the period", async () => {
    await sell([{ productId: shirtId, quantity: 1, salesRate: 1650, salesStatus: "sale" }]);
    await insert(orderModel, { orderStatus: "Pending", items: [{ variant: { _id: jeans32 }, quantity: 2 }] });
    // A cancelled order is not a sale
    await insert(orderModel, { orderStatus: "Cancelled", items: [{ product: { _id: kotyId }, quantity: 1 }] });

    const { rows } = await runReport();
    expect(rows.map((r) => r.productName)).toEqual(["Koty"]);
  });

  it("ignores sales outside the period", async () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    await sell([{ productId: shirtId, quantity: 5, salesRate: 1650, salesStatus: "sale" }], { date: lastYear });

    const { rows } = await runReport();
    expect(rows.map((r) => r.productName)).toContain("Casual Full Shirt");
  });

  it("lists slow sellers too when maxSold allows a few units, least sold first", async () => {
    await sell([
      { productId: shirtId, quantity: 2, salesRate: 1650, salesStatus: "sale" },
      { variantId: jeans32, productId: null, quantity: 9, salesRate: 1700, salesStatus: "sale" },
    ]);

    const { rows } = await runReport({ maxSold: 3 });
    expect(rows.map((r) => [r.productName, r.soldQty])).toEqual([["Koty", 0], ["Casual Full Shirt", 2]]);
  });

  it("keeps only the top N, with totals for just those", async () => {
    const { rows, totals } = await runReport({ top: 1 });
    expect(rows).toHaveLength(1);
    expect(totals).toMatchObject({ count: 1, totalStockQty: 6 });
  });

  it("leaves out inactive products", async () => {
    await runForTenant(tenantId, () => productModel.collection.updateOne({ _id: kotyId }, { $set: { isActive: false } }));

    const { rows } = await runReport();
    expect(rows.map((r) => r.productName)).not.toContain("Koty");
  });
});
