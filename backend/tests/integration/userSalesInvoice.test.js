const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const { customerModel } = require("../../src/models/customer.model");
const { getUserSalesInvoiceReport, getUserSalesProductReport } = require("../../src/controller/report.controller");
const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const migration = require("../../src/migrations/009-backfill-sale-created-by");

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The invoices the signed-in user made, with what was returned on them.
describe("user sales invoice report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const me = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();

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

  const run = (handler, userId = me, extra = {}) =>
    runForTenant(tenantId, async () => {
      const today = localToday();
      let body;
      let error;
      const req = { user: { _id: userId, name: "Akram" }, body: { startDate: today, endDate: today, ...extra }, query: {} };
      const res = { status: () => res, json: (b) => (body = b) };
      await handler(req, res, (err) => (error = err));
      if (error) throw error;
      return body.data;
    });
  const runReport = (userId, extra) => run(getUserSalesInvoiceReport, userId, extra);
  const runProducts = (userId, extra) => run(getUserSalesProductReport, userId, extra);

  const sale = (doc) =>
    insert(salesModel, {
      date: new Date(),
      customerType: { type: "walking", walking: { customerName: "Akram", mobileNumber: "01999878862" } },
      salesType: "retailsale",
      ...doc,
    });

  it("shows the bill from the sale's own fields, with the return beside it", async () => {
    // 10000 − 15% (1500) + 1% VAT on 8500 (85) = 8585 payable; 550 returned
    await sale({ invoiceNumber: "INV-1", createdBy: me, total: 10000, discountPercent: 15, vatPercent: 1, payable: 8585, netPaid: 7000, presentDue: 1585, return: 550 });

    const { rows, totals, user } = await runReport();
    expect(user).toMatchObject({ name: "Akram" });
    expect(rows[0]).toMatchObject({
      invoiceNumber: "INV-1",
      salesType: "retailsale",
      customerType: "walking",
      customerName: "Akram",
      customerPhone: "01999878862",
      total: 10000,
      returned: 550,
      discount: 1500,
      vat: 85,
      payable: 8585,
      paid: 7000,
      due: 1585,
    });
    expect(totals).toMatchObject({ count: 1, totalAmount: 10000, totalReturned: 550, totalPayable: 8585, totalDue: 1585 });
  });

  it("counts less taka as discount, with delivery and labour, for a listed customer", async () => {
    await insert(customerModel, { _id: customerId, fullName: "Zahirul Islam", mobileNumber: "01999878864" });
    await sale({
      invoiceNumber: "INV-2",
      createdBy: me,
      customerType: { type: "listed", customerId, walking: null },
      salesType: "wholesale",
      total: 15000,
      lessTaka: 1000,
      deliveryCost: 550,
      labourCost: 350,
      payable: 14900,
      paid: 12100,
      changes: 100, // no netPaid stored: falls back to paid − changes
      presentDue: 2900,
    });

    const { rows } = await runReport();
    expect(rows[0]).toMatchObject({
      customerType: "listed",
      customerName: "Zahirul Islam",
      customerPhone: "01999878864",
      returned: 0,
      discount: 1000,
      delivery: 550,
      labour: 350,
      payable: 14900,
      paid: 12000,
      due: 2900,
    });
  });

  it("lists only the signed-in user's sales", async () => {
    await sale({ invoiceNumber: "MINE", createdBy: me, total: 100 });
    await sale({ invoiceNumber: "THEIRS", createdBy: other, total: 100 });
    // Edited by me afterwards, but still the other user's sale
    await sale({ invoiceNumber: "EDITED", createdBy: other, discountGivenBy: me, total: 100 });
    // Saved before createdBy existed: discountGivenBy is the only record
    await sale({ invoiceNumber: "LEGACY", discountGivenBy: me, total: 100 });

    expect((await runReport(me)).rows.map((r) => r.invoiceNumber).sort()).toEqual(["LEGACY", "MINE"]);
    require("../mocks/redisCache").__reset();
    expect((await runReport(other)).rows.map((r) => r.invoiceNumber).sort()).toEqual(["EDITED", "THEIRS"]);
  });

  it("does not serve one user's cached sheet to another", async () => {
    await sale({ invoiceNumber: "MINE", createdBy: me, total: 100 });

    expect((await runReport(me)).rows).toHaveLength(1);
    // Same filters, cache left warm
    expect((await runReport(other)).rows).toHaveLength(0);
  });

  describe("user sales product report", () => {
    const shirtId = new mongoose.Types.ObjectId();
    const parentId = new mongoose.Types.ObjectId();
    const variantId = new mongoose.Types.ObjectId();

    beforeEach(async () => {
      await insert(productModel, { _id: shirtId, name: "Casual Full Shirt", barCode: "688", color: "Black", size: "S", purchasePrice: 800, wholesalePrice: 1250, retailPrice: 1650 });
      await insert(productModel, { _id: parentId, name: "Jeans Pant" });
      await insert(variantModel, { _id: variantId, product: parentId, barCode: "689", color: "Green", size: "M", purchasePrice: 850, wholesalePrice: 1250, retailPrice: 1750 });
    });

    it("lists the lines of my sales with unit prices, unit discount and the line total", async () => {
      await sale({
        invoiceNumber: "INV-1",
        createdBy: me,
        searchItem: [
          // (1650 − 550) × 2
          { productId: shirtId, variantId: null, quantity: 2, salesRate: 1650, discount: 550, discountType: "amount", subtotal: 2200, barcode: "688", color: "Black", size: "S" },
          // 1750 less 20% = 350 off a unit; the cost stamped on the line wins
          { productId: null, variantId, quantity: 1, salesRate: 1750, discount: 20, discountType: "percent", subtotal: 1400, purchasePrice: 700, productDescription: "Jeans Pant - Green M" },
          { productId: shirtId, quantity: 1, salesRate: 1650, salesStatus: "exchange", subtotal: 1650 },
        ],
      });
      await sale({ invoiceNumber: "THEIRS", createdBy: other, searchItem: [{ productId: shirtId, quantity: 9, salesRate: 1650, subtotal: 14850 }] });

      const { rows, totals, user } = await runProducts();
      expect(user).toMatchObject({ name: "Akram" });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        invoiceNumber: "INV-1",
        salesType: "retailsale",
        productName: "Casual Full Shirt",
        barcode: "688",
        color: "Black",
        size: "S",
        qty: 2,
        buyPrice: 800,
        wsPrice: 1250,
        rsPrice: 1650,
        discount: 550,
        total: 2200,
      });
      // The variant shows its product's name, never the name it was sold under
      expect(rows[1]).toMatchObject({ productName: "Jeans Pant", barcode: "689", color: "Green", size: "M", qty: 1, buyPrice: 700, rsPrice: 1750, discount: 350, total: 1400 });
      expect(totals).toMatchObject({ count: 2, totalQty: 3, totalBuyPrice: 1500, totalWsPrice: 2500, totalRsPrice: 3400, totalDiscount: 900, totalAmount: 3600 });
    });

    it("works the total out when the line has no subtotal, and searches by barcode", async () => {
      await sale({ invoiceNumber: "OLD", createdBy: me, searchItem: [{ productId: shirtId, quantity: 3, salesRate: 1000, discount: 100, barcode: "688" }] });

      const { rows } = await runProducts(me, { search: "688" });
      expect(rows[0]).toMatchObject({ discount: 100, total: 2700 });
      require("../mocks/redisCache").__reset();
      expect((await runProducts(me, { search: "nothing" })).rows).toHaveLength(0);
    });
  });

  it("the backfill gives older sales a seller from discountGivenBy and leaves the rest alone", async () => {
    await sale({ invoiceNumber: "OLD", discountGivenBy: me });
    await sale({ invoiceNumber: "NEW", createdBy: other, discountGivenBy: me });
    await sale({ invoiceNumber: "UNKNOWN" });

    const result = await migration.up({ tenant: { _id: tenantId } });
    expect(result).toEqual({ assigned: 1 });

    const saved = await runForTenant(tenantId, () => salesModel.find({}).select("invoiceNumber createdBy").lean());
    const sellerOf = Object.fromEntries(saved.map((s) => [s.invoiceNumber, s.createdBy ? String(s.createdBy) : null]));
    expect(sellerOf).toEqual({ OLD: String(me), NEW: String(other), UNKNOWN: null });
  });
});
