const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");

jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

const salesModel = require("../../src/models/sales.model");
const { customerModel } = require("../../src/models/customer.model");
const {
  getUserSalesInvoiceReport,
  getUserSalesProductReport,
  getTopUserReport,
  getSalesmanSalesInvoiceReport,
  getSalesmanSalesProductReport,
  getTopSalesmanReport,
  getUpcomingDeliveryOrderReport,
} = require("../../src/controller/report.controller");
const employeeModel = require("../../src/models/employee.model");
const { employeeDesignationModel, departmentModel } = require("../../src/models/advancePayment.model");
const userModel = require("../../src/models/user.model");
const roleModel = require("../../src/models/role.model");
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

  describe("top user report", () => {
    const roleId = new mongoose.Types.ObjectId();
    const customerA = new mongoose.Types.ObjectId();
    const runTop = (extra) => run(getTopUserReport, me, extra);
    const walking = (mobileNumber) => ({ type: "walking", walking: { customerName: "Walk", mobileNumber } });

    beforeEach(async () => {
      await insert(roleModel, { _id: roleId, name: "Sales", slug: "sales" });
      await insert(userModel, { _id: me, name: "Zahirul Islam", phone: "01999878862", email: "zahirul@example.com", roles: [roleId] });
      await insert(userModel, { _id: other, name: "Sujon", phone: "01999878863", email: "sujon@example.com", roles: [] });
    });

    it("totals each user's sales and ranks by total sales", async () => {
      // me: 3 invoices, 2 customers (one listed twice, one walking)
      await sale({ createdBy: me, customerType: { type: "listed", customerId: customerA, walking: null }, total: 1000, discountPercent: 10, payable: 900, netPaid: 900, presentDue: 0 });
      await sale({ createdBy: me, customerType: { type: "listed", customerId: customerA, walking: null }, total: 2000, lessTaka: 200, payable: 1800, netPaid: 1000, presentDue: 800 });
      await sale({ createdBy: me, customerType: walking("01700000001"), total: 500, payable: 500, paid: 600, changes: 100, presentDue: 0 });
      // other: bigger seller, saved before createdBy existed
      await sale({ discountGivenBy: other, customerType: walking("01700000002"), total: 9000, payable: 9000, netPaid: 9000, presentDue: 0 });
      // Nobody to credit: left out
      await sale({ total: 99999, payable: 99999 });

      const { rows, totals } = await runTop();
      expect(rows.map((r) => r.name)).toEqual(["Sujon", "Zahirul Islam"]);
      expect(rows[1]).toMatchObject({
        name: "Zahirul Islam",
        phone: "01999878862",
        email: "zahirul@example.com",
        roles: ["Sales"],
        invoices: 3,
        customers: 2,
        totalSales: 3500,
        discount: 300,
        payable: 3200,
        paid: 2400,
        due: 800,
      });
      expect(rows[0]).toMatchObject({ roles: [], invoices: 1, customers: 1, totalSales: 9000 });
      expect(totals).toMatchObject({ count: 2, totalInvoices: 4, totalCustomers: 3, totalSales: 12500, totalDiscount: 300, totalPayable: 12200, totalPaid: 11400, totalDue: 800 });
    });

    it("keeps only the top N, with totals for just those", async () => {
      await sale({ createdBy: me, total: 100, payable: 100 });
      await sale({ createdBy: other, total: 900, payable: 900 });

      const { rows, totals } = await runTop({ top: 1 });
      expect(rows.map((r) => r.name)).toEqual(["Sujon"]);
      expect(totals).toMatchObject({ count: 1, totalSales: 900 });
    });
  });

  describe("salesman sales invoice report", () => {
    const akram = new mongoose.Types.ObjectId();
    const sajib = new mongoose.Types.ObjectId();
    const runSalesman = (extra) => run(getSalesmanSalesInvoiceReport, me, extra);

    beforeEach(async () => {
      await insert(employeeModel, { _id: akram, fullName: "Akram" });
      await insert(employeeModel, { _id: sajib, fullName: "Sajib" });
    });

    it("lists invoices by the sale's salesman, whoever entered them", async () => {
      // 10000 − 15% (1500) + 150 VAT → payable 8650, as on the sheet
      await sale({ invoiceNumber: "A-1", salesMen: akram, createdBy: other, total: 10000, discountPercent: 15, vatPercent: 1.7647058823529411, payable: 8650, netPaid: 7000, presentDue: 1650 });
      await sale({ invoiceNumber: "S-1", salesMen: sajib, createdBy: me, total: 500, payable: 500, netPaid: 500, presentDue: 0 });

      const one = await runSalesman({ salesMenId: String(akram) });
      expect(one.rows).toHaveLength(1);
      expect(one.rows[0]).toMatchObject({
        invoiceNumber: "A-1",
        salesmanName: "Akram",
        customerType: "walking",
        total: 10000,
        discount: 1500,
        vat: 150,
        payable: 8650,
        paid: 7000,
        due: 1650,
      });
      expect(one.totals).toMatchObject({ count: 1, totalAmount: 10000, totalPayable: 8650, totalDue: 1650 });

      require("../mocks/redisCache").__reset();
      const all = await runSalesman();
      expect(all.rows.map((r) => r.salesmanName).sort()).toEqual(["Akram", "Sajib"]);
      expect(all.totals).toMatchObject({ count: 2, totalAmount: 10500 });
    });

    it("lists the product lines of a salesman's sales", async () => {
      const shirtId = new mongoose.Types.ObjectId();
      await insert(productModel, { _id: shirtId, name: "Casual Full Shirt", barCode: "688", color: "Black", size: "S", purchasePrice: 800, wholesalePrice: 1250, retailPrice: 1650 });
      await sale({ invoiceNumber: "A-1", salesMen: akram, createdBy: other, searchItem: [{ productId: shirtId, quantity: 2, salesRate: 1650, discount: 550, discountType: "amount", subtotal: 2200 }] });
      await sale({ invoiceNumber: "S-1", salesMen: sajib, createdBy: me, searchItem: [{ productId: shirtId, quantity: 1, salesRate: 1650, subtotal: 1650 }] });

      const one = await run(getSalesmanSalesProductReport, me, { salesMenId: String(akram) });
      expect(one.rows).toHaveLength(1);
      expect(one.rows[0]).toMatchObject({
        invoiceNumber: "A-1",
        salesmanName: "Akram",
        productName: "Casual Full Shirt",
        barcode: "688",
        qty: 2,
        buyPrice: 800,
        wsPrice: 1250,
        rsPrice: 1650,
        discount: 550,
        total: 2200,
      });
      expect(one.totals).toMatchObject({ count: 1, totalQty: 2, totalAmount: 2200 });

      require("../mocks/redisCache").__reset();
      const all = await run(getSalesmanSalesProductReport, me);
      expect(all.rows.map((r) => r.salesmanName).sort()).toEqual(["Akram", "Sajib"]);
      expect(all.totals).toMatchObject({ count: 2, totalQty: 3, totalAmount: 3850 });
    });

    it("ranks salesmen by total sales, with their designation and department", async () => {
      const designationId = new mongoose.Types.ObjectId();
      const departmentId = new mongoose.Types.ObjectId();
      const zahirul = new mongoose.Types.ObjectId();
      await insert(employeeDesignationModel, { _id: designationId, name: "Manager", slug: "manager" });
      await insert(departmentModel, { _id: departmentId, name: "Sales", slug: "sales" });
      await insert(employeeModel, { _id: zahirul, fullName: "Zahirul Islam", employeeId: "EMP-000001", mobile: "01999878862", designation: designationId, deapartment: departmentId });

      const walking = (mobileNumber) => ({ type: "walking", walking: { customerName: "Walk", mobileNumber } });
      // Zahirul: 2 invoices to the same customer; entered by different users
      await sale({ salesMen: zahirul, createdBy: me, customerType: walking("01700000001"), total: 1000, discountPercent: 10, payable: 900, netPaid: 900, presentDue: 0 });
      await sale({ salesMen: zahirul, createdBy: other, customerType: walking("01700000001"), total: 2000, lessTaka: 200, payable: 1800, netPaid: 1000, presentDue: 800 });
      await sale({ salesMen: akram, createdBy: me, customerType: walking("01700000002"), total: 9000, payable: 9000, netPaid: 9000, presentDue: 0 });
      // No salesman: left out
      await sale({ createdBy: me, total: 99999, payable: 99999 });

      const { rows, totals } = await run(getTopSalesmanReport, me);
      expect(rows.map((r) => r.name)).toEqual(["Akram", "Zahirul Islam"]);
      expect(rows[0]).toMatchObject({ employeeId: null, mobile: null, designation: null, department: null, invoices: 1, totalSales: 9000 });
      expect(rows[1]).toMatchObject({
        employeeId: "EMP-000001",
        mobile: "01999878862",
        designation: "Manager",
        department: "Sales",
        invoices: 2,
        customers: 1,
        totalSales: 3000,
        discount: 300,
        payable: 2700,
        paid: 1900,
        due: 800,
      });
      expect(totals).toMatchObject({ count: 2, totalInvoices: 3, totalCustomers: 2, totalSales: 12000, totalDiscount: 300, totalPayable: 11700, totalPaid: 10900, totalDue: 800 });

      require("../mocks/redisCache").__reset();
      const top = await run(getTopSalesmanReport, me, { top: 1 });
      expect(top.rows.map((r) => r.name)).toEqual(["Akram"]);
      expect(top.totals).toMatchObject({ count: 1, totalSales: 9000 });
    });
  });

  describe("upcoming delivery order report", () => {
    const day = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return d;
    };
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const runUpcoming = (extra) => run(getUpcomingDeliveryOrderReport, me, { startDate: ymd(day(0)), endDate: ymd(day(7)), ...extra });

    it("lists pending sales due for delivery in the period, with their products", async () => {
      const shirtId = new mongoose.Types.ObjectId();
      const variantId = new mongoose.Types.ObjectId();
      await insert(productModel, { _id: shirtId, name: "Casual Full Shirt", barCode: "1783868530394", color: "Merun", size: "M" });
      await insert(variantModel, { _id: variantId, product: shirtId, variantName: "Shirt Red L", barCode: "999", color: "Red", size: "L" });

      await sale({
        invoiceNumber: "LATER", invoiceStatus: "pending", deliveryDate: day(4), remark: "Call first",
        searchItem: [
          { productId: shirtId, quantity: 1, salesRate: 100 },
          { variantId, productDescription: "Shirt Red L", quantity: 2, salesRate: 100 },
          { productId: shirtId, quantity: 5, salesRate: 100, salesStatus: "exchange" },
        ],
      });
      await sale({ invoiceNumber: "SOON", invoiceStatus: "pending", deliveryDate: day(1), searchItem: [{ productId: shirtId, quantity: 3, salesRate: 100 }] });
      // Not pending, outside the period, or no delivery date: left out
      await sale({ invoiceNumber: "DONE", invoiceStatus: "complete", deliveryDate: day(1) });
      await sale({ invoiceNumber: "FAR", invoiceStatus: "pending", deliveryDate: day(30) });
      await sale({ invoiceNumber: "NODATE", invoiceStatus: "pending" });

      const { rows, totals } = await runUpcoming();
      expect(rows.map((r) => r.invoiceNumber)).toEqual(["SOON", "LATER"]);
      expect(rows[1]).toMatchObject({ customerName: "Akram", customerPhone: "01999878862", remark: "Call first" });
      expect(rows[1].products).toEqual([
        { productName: "Casual Full Shirt", barcode: "1783868530394", color: "Merun", size: "M", qty: 1 },
        { productName: "Casual Full Shirt", barcode: "999", color: "Red", size: "L", qty: 2 },
      ]);
      expect(rows[0].remark).toBeNull();
      expect(totals).toMatchObject({ count: 2, totalQty: 6 });

      require("../mocks/redisCache").__reset();
      expect((await runUpcoming({ search: "soon" })).rows.map((r) => r.invoiceNumber)).toEqual(["SOON"]);
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
