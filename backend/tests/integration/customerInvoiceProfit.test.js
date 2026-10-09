const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const productModel = require("../../src/models/product.model");
const variantModel = require("../../src/models/variant.model");
const { getCustomerInvoiceProfitReport } = require("../../src/controller/report.controller");

// The report reads startDate/endDate as local days, so "today" must be the
// local date — toISOString() is UTC and is yesterday just after local midnight.
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
      const today = localToday();
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
      const today = localToday();
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

describe("supplier ledger report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const supplierObjId = new mongoose.Types.ObjectId();
  const { SupplierModel, SupplierDuePayment } = require("../../src/models/supplier.model");
  const Purchase = require("../../src/models/purchase.model");
  const PurchaseReturn = require("../../src/models/purchaseReturn.model");
  const { getSupplierLedgerReport } = require("../../src/controller/report.controller");

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const insert = (model, doc) =>
    runForTenant(tenantId, () =>
      model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }),
    );

  const runReport = (body = {}) =>
    runForTenant(tenantId, async () => {
      let out;
      let error;
      const req = { body: { supplierId: String(supplierObjId), ...body }, query: {} };
      const res = { status: () => res, json: (b) => (out = b) };
      await getSupplierLedgerReport(req, res, (err) => (error = err));
      if (error) throw error;
      return out.data;
    });

  beforeEach(async () => {
    await insert(SupplierModel, { _id: supplierObjId, supplierId: "01711111111", supplierName: "Acme", initialDue: 5000, deletedAt: null });
    await insert(Purchase, { serial: "PUR-SI-00002", invoiceNumber: "P-2", date: new Date("2026-04-10"), supplierId: supplierObjId, payable: 50000, paid: 20000 });
    await insert(PurchaseReturn, { serial: "PUR-RTN-SI-00003", returnDate: new Date("2026-04-11"), supplier: supplierObjId, totalReturnAmount: 5000 });
    await insert(SupplierDuePayment, { supplierPaymentSerialId: "SP-SI-00004", date: new Date("2026-04-12"), supplierId: "01711111111", paidAmount: 10000, isActive: true, deletedAt: null });
    // a deleted payment never counts
    await insert(SupplierDuePayment, { date: new Date("2026-04-12"), supplierId: "01711111111", paidAmount: 999, isActive: false, deletedAt: new Date() });
  });

  it("lists opening, purchase, return and payment and nets them to the balance", async () => {
    const { rows, totals } = await runReport();
    expect(rows.map((r) => [r.category, r.received, r.payment])).toEqual([
      ["Add Supplier", 5000, 0],
      ["Add Purchase", 50000, 20000],
      ["Purchase Return", 0, 5000],
      ["Add Supplier Payment", 0, 10000],
    ]);
    expect(totals).toMatchObject({ totalReceived: 55000, totalPayment: 35000, balance: 20000 });
  });

  it("folds entries before the range into the opening balance", async () => {
    const { rows, totals } = await runReport({ startDate: "2026-04-11", endDate: "2026-04-30" });
    // 5000 opening + (50000 − 20000) purchase before the range
    expect(rows[0]).toMatchObject({ category: "Add Supplier", description: "Opening Balance (brought forward)", received: 35000 });
    expect(rows).toHaveLength(3);
    expect(totals.balance).toBe(20000);
  });
});

describe("supplier balance summary report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const aId = new mongoose.Types.ObjectId();
  const bId = new mongoose.Types.ObjectId();
  const { SupplierModel } = require("../../src/models/supplier.model");
  const Purchase = require("../../src/models/purchase.model");
  const { getSupplierBalanceSummaryReport } = require("../../src/controller/report.controller");

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const insert = (model, doc) =>
    runForTenant(tenantId, () =>
      model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }),
    );

  const runReport = (body = {}) =>
    runForTenant(tenantId, async () => {
      let out;
      let error;
      const res = { status: () => res, json: (b) => (out = b) };
      await getSupplierBalanceSummaryReport({ body, query: {} }, res, (err) => (error = err));
      if (error) throw error;
      return out.data;
    });

  const purchase = (supplierId, date, payable, paid) =>
    insert(Purchase, { supplierId, date: new Date(date), payable, paid, dueamount: payable - paid, invoiceNumber: String(Math.random()) });

  beforeEach(async () => {
    await insert(SupplierModel, { _id: aId, supplierSerialId: "SUPL-1", supplierName: "Color Mens", mobile: "01999878862", contactPersonName: "Tarek", initialDue: 30000, openingDues: 92000, deletedAt: null });
    await insert(SupplierModel, { _id: bId, supplierSerialId: "SUPL-2", supplierName: "Black Mens", mobile: "01999878863", contactPersonName: "Karim", initialDue: 20000, openingDues: 20000, deletedAt: null });
    await purchase(aId, "2026-04-01", 50000, 0);
    await purchase(aId, "2026-04-10", 20000, 5000);
  });

  it("sums purchases per supplier and takes the balance from the supplier's current due", async () => {
    const { rows, totals } = await runReport();
    const a = rows.find((r) => r.supplierName === "Color Mens");
    expect(a).toMatchObject({ supplierCode: "SUPL-1", contactPerson: "Tarek", openingBalance: 30000, totalPurchase: 70000, totalPaid: 5000, balance: 92000 });
    // a supplier without purchases still shows with its opening balance
    expect(rows.find((r) => r.supplierName === "Black Mens")).toMatchObject({ totalPurchase: 0, balance: 20000 });
    expect(totals).toMatchObject({ count: 2, totalOpening: 50000, totalPurchase: 70000, totalPaid: 5000, totalBalance: 112000 });
  });

  it("moves the due of purchases before the range into the opening balance", async () => {
    const { rows } = await runReport({ startDate: "2026-04-05", endDate: "2026-04-30", supplierId: String(aId) });
    expect(rows).toHaveLength(1);
    // 30000 + 50000 due from 1 Apr; only the 10 Apr purchase is in range
    expect(rows[0]).toMatchObject({ openingBalance: 80000, totalPurchase: 20000, totalPaid: 5000, balance: 92000 });
  });
});

describe("supplier dues report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const aId = new mongoose.Types.ObjectId();
  const { SupplierModel } = require("../../src/models/supplier.model");
  const Purchase = require("../../src/models/purchase.model");
  const { getSupplierDuesReport } = require("../../src/controller/report.controller");

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const insert = (model, doc) =>
    runForTenant(tenantId, () =>
      model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }),
    );

  it("lists suppliers with a due, their purchase count and last purchase date", async () => {
    await insert(SupplierModel, { _id: aId, supplierSerialId: "SUPL-1", supplierName: "Color Mens", openingDues: 5000, deletedAt: null });
    await insert(SupplierModel, { supplierName: "Settled", openingDues: 0, deletedAt: null });
    await insert(Purchase, { supplierId: aId, date: new Date("2026-04-01"), invoiceNumber: "A" });
    await insert(Purchase, { supplierId: aId, date: new Date("2026-04-10"), invoiceNumber: "B" });

    const data = await runForTenant(tenantId, async () => {
      let out;
      const res = { status: () => res, json: (b) => (out = b) };
      await getSupplierDuesReport({ body: {}, query: {} }, res, (err) => { throw err; });
      return out.data;
    });

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ supplierName: "Color Mens", purchaseCount: 2, totalDue: 5000 });
    expect(new Date(data.rows[0].lastPurchaseDate).toISOString()).toBe("2026-04-10T00:00:00.000Z");
    expect(data.totals).toMatchObject({ count: 1, totalPurchaseCount: 2, totalDue: 5000 });
  });
});

describe("transaction report", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const CrateTransaction = require("../../src/models/crateTransaction.model");
  const Account = require("../../src/models/account.model");
  const TransactionCategory = require("../../src/models/transitionCategory.model");
  const {
    getTransactionReport,
    getTransactionSummaryReport,
    getAllTransactionSummaryReport,
    getAccountsLedgerReport,
    getAccountDayTransactionReport,
  } = require("../../src/controller/report.controller");
  const { MANUAL_ENTRY_ONLY } = require("../../src/controller/createTransition.controller");

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const insert = (model, doc) =>
    runForTenant(tenantId, () =>
      model.collection.insertOne({ tenantId, createdAt: new Date(), updatedAt: new Date(), ...doc }),
    );

  const runReport = (body = {}, handler = getTransactionReport) =>
    runForTenant(tenantId, async () => {
      let out;
      const res = { status: () => res, json: (b) => (out = b) };
      await handler({ body, query: {} }, res, (err) => { throw err; });
      return out.data;
    });

  it("lists only hand-typed entries, receive vs payment by type, with balance", async () => {
    const cash = new mongoose.Types.ObjectId();
    const rent = new mongoose.Types.ObjectId();
    const credit = new mongoose.Types.ObjectId();
    await insert(Account, { _id: cash, name: "Cash" });
    await insert(TransactionCategory, { _id: rent, name: "Shop Rent", allowedType: "cash payment" });
    await insert(TransactionCategory, { _id: credit, name: "Owner Credit", allowedType: "cash recived" });
    await insert(CrateTransaction, {
      date: new Date("2026-08-02"), transactionSerialId: "TRXID-1", account: cash, transactionCategory: rent,
      transactionDescription: "Sujon", voucherNumber: "2548", transactionType: "cash payment", amount: 5000,
    });
    await insert(CrateTransaction, {
      date: new Date("2026-08-04"), transactionSerialId: "TRXID-2", account: cash, transactionCategory: credit,
      transactionDescription: "Raja", voucherNumber: "659884", transactionType: "cash recived", amount: 3000,
    });
    // Auto-generated by a sale — belongs to the sales reports, not this one.
    await insert(CrateTransaction, {
      date: new Date("2026-08-03"), account: cash, transactionType: "cash recived", amount: 900,
      saleReference: new mongoose.Types.ObjectId(),
    });

    const data = await runReport();

    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]).toMatchObject({
      transactionId: "TRXID-1", category: "Shop Rent", description: "Sujon",
      referenceId: "2548", account: "Cash", receive: 0, payment: 5000,
    });
    expect(data.rows[1]).toMatchObject({ transactionId: "TRXID-2", receive: 3000, payment: 0 });
    expect(data.totals).toMatchObject({ count: 2, receive: 3000, payment: 5000, balance: -2000 });

    const received = await runReport({ transactionType: "cash recived" });
    expect(received.rows.map((r) => r.transactionId)).toEqual(["TRXID-2"]);
    expect(received.totals).toMatchObject({ receive: 3000, payment: 0, balance: 3000 });
  });

  it("summary totals each category's entries — count, receive and payment", async () => {
    const cash = new mongoose.Types.ObjectId();
    const wifi = new mongoose.Types.ObjectId();
    const credit = new mongoose.Types.ObjectId();
    await insert(Account, { _id: cash, name: "Cash" });
    await insert(TransactionCategory, { _id: wifi, name: "Wifi Bill", allowedType: "cash payment" });
    await insert(TransactionCategory, { _id: credit, name: "Owner Credit", allowedType: "cash recived" });
    for (const month of ["01", "02", "03"]) {
      await insert(CrateTransaction, {
        date: new Date(`2026-${month}-05`), account: cash, transactionCategory: wifi,
        transactionType: "cash payment", amount: 1000,
      });
    }
    await insert(CrateTransaction, {
      date: new Date("2026-02-10"), account: cash, transactionCategory: credit,
      transactionType: "cash recived", amount: 4000,
    });
    await insert(CrateTransaction, {
      date: new Date("2026-02-11"), account: cash, transactionCategory: wifi,
      transactionType: "cash payment", amount: 700, purchaseReference: new mongoose.Types.ObjectId(),
    });

    const data = await runReport({}, getTransactionSummaryReport);

    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]).toMatchObject({ category: "Owner Credit", count: 1, receive: 4000, payment: 0 });
    expect(data.rows[1]).toMatchObject({ category: "Wifi Bill", count: 3, receive: 0, payment: 3000 });
    expect(data.totals).toMatchObject({ count: 4, categories: 2, receive: 4000, payment: 3000, balance: 1000 });
  });

  it("all-transaction summary puts module rows under one line each, ahead of manual categories", async () => {
    const cash = new mongoose.Types.ObjectId();
    const wifi = new mongoose.Types.ObjectId();
    const salesCategory = new mongoose.Types.ObjectId();
    await insert(Account, { _id: cash, name: "Cash" });
    await insert(TransactionCategory, { _id: wifi, name: "Wifi Bill", allowedType: "cash payment" });
    await insert(TransactionCategory, { _id: salesCategory, name: "Sales Payment", allowedType: "cash recived" });
    const row = (extra) => insert(CrateTransaction, { date: new Date("2026-08-05"), account: cash, ...extra });

    await row({ transactionCategory: salesCategory, transactionType: "cash recived", amount: 150000, saleReference: new mongoose.Types.ObjectId() });
    await row({ transactionCategory: salesCategory, transactionType: "cash recived", amount: 50000, saleReference: new mongoose.Types.ObjectId() });
    await row({ transactionType: "cash payment", amount: 20000, supplierPaymentReference: new mongoose.Types.ObjectId() });
    await row({ transactionType: "cash payment", amount: 10000, purchaseReference: new mongoose.Types.ObjectId() });
    await row({ transactionCategory: wifi, transactionType: "cash payment", amount: 1000 });

    const data = await runReport({}, getAllTransactionSummaryReport);

    expect(data.rows.map((r) => [r.category, r.count, r.receive, r.payment])).toEqual([
      ["Product Sales", 2, 200000, 0],
      ["Supplier Purchase Payment", 1, 0, 10000],
      ["Supplier Dues Payment", 1, 0, 20000],
      ["Wifi Bill", 1, 0, 1000],
    ]);
    expect(data.totals).toMatchObject({ count: 5, receive: 200000, payment: 31000, balance: 169000 });
  });

  // A module added to MANUAL_ENTRY_ONLY but not to the summary's source list
  // would have its rows land under its category name instead of its own line.
  it("all-transaction summary knows every module reference", async () => {
    const cash = new mongoose.Types.ObjectId();
    for (const field of Object.keys(MANUAL_ENTRY_ONLY)) {
      await insert(CrateTransaction, {
        date: new Date(), account: cash, transactionType: "cash payment", amount: 1,
        [field]: new mongoose.Types.ObjectId(),
      });
    }

    const data = await runReport({}, getAllTransactionSummaryReport);

    expect(data.rows).toHaveLength(Object.keys(MANUAL_ENTRY_ONLY).length);
    expect(data.rows.every((r) => r.isAuto)).toBe(true);
  });

  it("accounts ledger lists every row, module rows under their source document's number", async () => {
    const cash = new mongoose.Types.ObjectId();
    const rent = new mongoose.Types.ObjectId();
    const paymentId = new mongoose.Types.ObjectId();
    const { SupplierDuePayment } = require("../../src/models/supplier.model");
    await insert(Account, { _id: cash, name: "Cash" });
    await insert(TransactionCategory, { _id: rent, name: "Shop Rent", allowedType: "cash payment" });
    await insert(SupplierDuePayment, { _id: paymentId, supplierPaymentSerialId: "SUPLP-SI-09" });
    await insert(CrateTransaction, {
      date: new Date("2026-08-01"), transactionSerialId: "TRXID-1", account: cash, transactionCategory: rent,
      transactionDescription: "Sujon", voucherNumber: "58689", transactionType: "cash payment", amount: 20000,
    });
    await insert(CrateTransaction, {
      date: new Date("2026-08-02"), transactionSerialId: "TRXID-2", account: cash,
      transactionDescription: "Supplier payment", transactionType: "cash payment", amount: 50000,
      supplierPaymentReference: paymentId,
    });

    const data = await runReport({}, getAccountsLedgerReport);

    expect(data.rows.map((r) => [r.transactionId, r.category, r.referenceId, r.payment])).toEqual([
      ["TRXID-1", "Shop Rent", "58689", 20000],
      ["SUPLP-SI-09", "Supplier Dues Payment", "", 50000],
    ]);
    expect(data.totals).toMatchObject({ count: 2, receive: 0, payment: 70000, balance: -70000 });
  });

  it("account day transaction totals each day per account", async () => {
    const cash = new mongoose.Types.ObjectId();
    const bkash = new mongoose.Types.ObjectId();
    await insert(Account, { _id: cash, name: "Cash" });
    await insert(Account, { _id: bkash, name: "Bikash" });
    const row = (date, account, transactionType, amount, extra = {}) =>
      insert(CrateTransaction, { date: new Date(date), account, transactionType, amount, ...extra });

    await row("2026-08-01T10:00:00", cash, "cash recived", 80000);
    await row("2026-08-01T15:00:00", cash, "cash payment", 50000, { purchaseReference: new mongoose.Types.ObjectId() });
    await row("2026-08-01T16:00:00", bkash, "cash recived", 3000);
    await row("2026-08-02T11:00:00", cash, "cash payment", 1000);

    const data = await runReport({}, getAccountDayTransactionReport);

    expect(data.rows.map((r) => [r.date, r.account, r.receive, r.payment, r.balance])).toEqual([
      ["2026-08-01", "Bikash", 3000, 0, 3000],
      ["2026-08-01", "Cash", 80000, 50000, 30000],
      ["2026-08-02", "Cash", 0, 1000, -1000],
    ]);
    expect(data.totals).toMatchObject({ receive: 83000, payment: 51000, balance: 32000 });
  });
});
