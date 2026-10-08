const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { getCustomerInvoiceProfitReport } = require("../../src/controller/report.controller");

// PROFIT = SALES TOTAL − DISCOUNT − BUY PRICE, where SALES TOTAL is the stored
// sale.total, DISCOUNT is the invoice-level discountPercent + lessTaka and BUY
// PRICE is purchasePrice × quantity of the sold lines (variant first).
describe("customer invoice profit report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const variantProductId = new mongoose.Types.ObjectId();
  const variantId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(async () => {
    await clearTestDb();
    // Each case reads the same report key; a cached payload would leak across them.
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
      customerType: { type: "walking", walking: { customerName: "Zahirul Islam", mobileNumber: "01999878862" } },
      discountPercent: 0,
      lessTaka: 0,
      ...doc,
    });

  const runReport = () =>
    runForTenant(tenantId, async () => {
      const today = new Date().toISOString().split("T")[0];
      let body;
      let error;
      const req = { body: { startDate: today, endDate: today }, query: {} };
      const res = { status: () => res, json: (b) => (body = b) };
      await getCustomerInvoiceProfitReport(req, res, (err) => (error = err));
      if (error) throw error;
      return body.data;
    });

  beforeEach(async () => {
    await insert(productModel, { _id: productId, name: "Shirt", purchasePrice: 250 });
    await insert(productModel, { _id: variantProductId, name: "Pant", purchasePrice: 999 });
    await insert(variantModel, { _id: variantId, product: variantProductId, purchasePrice: 400 });
  });

  it("takes the buy price from the product and subtracts discount and less", async () => {
    // 10 × 250 = 2500 cost; 5000 total, 5% = 250 + less 250 = 500 discount
    await sale({
      invoiceNumber: "INV-1",
      total: 5000,
      discountPercent: 5,
      lessTaka: 250,
      searchItem: [{ productId, quantity: 10, salesRate: 500, salesStatus: "sale" }],
    });

    const { rows, totals } = await runReport();
    expect(rows[0]).toMatchObject({ buyPrice: 2500, salesTotal: 5000, discount: 500, profit: 2000 });
    expect(totals).toMatchObject({ count: 1, totalBuyPrice: 2500, totalSales: 5000, totalDiscount: 500, totalProfit: 2000 });
  });

  it("prefers the variant's purchase price and skips returned lines", async () => {
    // variant line: 3 × 400 = 1200 (not the product's 999); the return line costs nothing
    await sale({
      invoiceNumber: "INV-2",
      total: 3000,
      searchItem: [
        { productId: variantProductId, variantId, quantity: 3, salesStatus: "sale" },
        { productId, quantity: 4, salesStatus: "return" },
      ],
    });

    const { rows } = await runReport();
    expect(rows[0]).toMatchObject({ buyPrice: 1200, salesTotal: 3000, discount: 0, profit: 1800 });
  });

  it("sums totals across invoices", async () => {
    await sale({ invoiceNumber: "INV-3", total: 1000, searchItem: [{ productId, quantity: 2 }] });
    await sale({ invoiceNumber: "INV-4", total: 2000, lessTaka: 100, searchItem: [{ productId, quantity: 4 }] });

    const { totals } = await runReport();
    // cost 500 + 1000, discount 0 + 100, profit 500 + 900
    expect(totals).toMatchObject({ count: 2, totalBuyPrice: 1500, totalSales: 3000, totalDiscount: 100, totalProfit: 1400 });
  });
});

describe("top customer report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const typeId = new mongoose.Types.ObjectId();
  const bigId = new mongoose.Types.ObjectId();
  const smallId = new mongoose.Types.ObjectId();
  const { CustomerType, customerModel } = require("../../src/models/customer.model");
  const { getTopCustomerReport } = require("../../src/controller/report.controller");

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

  const listedSale = (customerId, doc) =>
    insert(salesModel, {
      customerType: { type: "listed", customerId, walking: null },
      discountPercent: 0,
      lessTaka: 0,
      ...doc,
    });

  const runReport = (extra = {}) =>
    runForTenant(tenantId, async () => {
      const today = new Date().toISOString().split("T")[0];
      let body;
      let error;
      const req = { body: { startDate: today, endDate: today, ...extra }, query: {} };
      const res = { status: () => res, json: (b) => (body = b) };
      await getTopCustomerReport(req, res, (err) => (error = err));
      if (error) throw error;
      return body.data;
    });

  beforeEach(async () => {
    await insert(productModel, { _id: productId, name: "Shirt", purchasePrice: 100 });
    await insert(CustomerType, { _id: typeId, customerType: "Retailsale" });
    await insert(customerModel, { _id: bigId, fullName: "Big", mobileNumber: "01999878862", customSerialId: "CUS-1", customerType: typeId });
    await insert(customerModel, { _id: smallId, fullName: "Small", mobileNumber: "01999878863", customSerialId: "CUS-2", customerType: typeId });
  });

  it("groups listed sales per customer, ranks by sales total and skips walking sales", async () => {
    const early = new Date();
    early.setHours(0, 0, 1, 0);
    const late = new Date();
    // Big: 2 invoices, qty 3 + 2, cost 500, total 1500, discount 10% of 1000 + 50
    await listedSale(bigId, { date: early, total: 1000, discountPercent: 10, payable: 900, paid: 500, presentDue: 400, searchItem: [{ productId, quantity: 3 }] });
    await listedSale(bigId, { date: late, total: 500, lessTaka: 50, payable: 450, paid: 450, presentDue: 0, searchItem: [{ productId, quantity: 2 }, { productId, quantity: 9, salesStatus: "return" }] });
    await listedSale(smallId, { date: early, total: 300, payable: 300, paid: 300, presentDue: 0, searchItem: [{ productId, quantity: 1 }] });
    await insert(salesModel, { date: late, total: 9999, customerType: { type: "walking", walking: { customerName: "Walk" } }, searchItem: [] });

    const { rows, totals } = await runReport();
    expect(rows.map((r) => r.customerName)).toEqual(["Big", "Small"]);
    expect(rows[0]).toMatchObject({
      customerCode: "CUS-1",
      customerType: "Retailsale",
      invoices: 2,
      itemsQty: 5,
      salesTotal: 1500,
      discount: 150,
      payable: 1350,
      paid: 950,
      due: 400,
      profit: 850, // 1500 − 150 − 500
    });
    expect(new Date(rows[0].lastSaleDate).getTime()).toBe(late.getTime());
    expect(totals).toMatchObject({ count: 2, totalInvoices: 3, totalSales: 1800, totalProfit: 1050 });
  });

  it("keeps only the top N customers", async () => {
    await listedSale(bigId, { date: new Date(), total: 1000, searchItem: [] });
    await listedSale(smallId, { date: new Date(), total: 10, searchItem: [] });

    const { rows, totals } = await runReport({ top: 1 });
    expect(rows.map((r) => r.customerName)).toEqual(["Big"]);
    expect(totals).toMatchObject({ count: 1, totalSales: 1000 });
  });
});
