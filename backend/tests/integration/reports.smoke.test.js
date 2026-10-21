const nock = require("nock");
const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { routeInventory, concretePath } = require("../helpers/routeInventory");
const { KNOWN } = require("../contract/knownFailures");

/**
 * Every report, dashboard widget and invoice sheet (104 routes) run against a
 * store holding real data — sales of every status, a return, purchases, a
 * purchase return, a listed customer with a due, a manual transaction — and a
 * second store whose names are all marked FOREIGN.
 *
 * Asserted for every route and every body shape: no 500, the standard
 * envelope, and nothing from the other store in the answer.
 */
const REPORT_PATHS = /\/api\/v1\/(report|dashboard|invoice)\//;
const routes = routeInventory().filter((r) => REPORT_PATHS.test(r.fullPath));
const label = (r) => `${r.method} ${r.fullPath}`;

const today = new Date().toISOString().slice(0, 10);
const BODIES = {
  "this year": { startDate: `${today.slice(0, 4)}-01-01`, endDate: today },
  "no filters": {},
  "garbage dates": { startDate: "not-a-date", endDate: "31/31/2026" },
  "malformed ids": { supplierId: "x", customerId: "y", productId: "z", accountId: "w", salesmanId: "v" },
};

describe("reports, dashboard and invoice sheets", () => {
  const ctx = useIntegrationApp({ clearAfterEach: false });
  let token;

  beforeAll(async () => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
    const seedStore = async (slug, prefix) => {
      const tenant = await tenantFactory.create({ slug });
      const f = forTenant(tenant);
      const owner = await createUserIn(tenant, { owner: true });
      const client = api(ctx.server, { token: tokenFor(owner), tenant: slug });
      const product = await f.product.create({ name: `${prefix} Kurta`, stock: 50, purchasePrice: 300, retailPrice: 800 });
      const variant = await f.variant.create({ product: product._id, variantName: `${prefix} Kurta XL`, stockVariant: 20 });
      const customer = await f.customer.create({ fullName: `${prefix} Customer`, openingDues: 100 });
      const supplier = await f.supplier.create({ supplierName: `${prefix} Supplier` });
      const account = await f.account.create({ name: `${prefix} Till`, balance: 50000 });
      const salesman = await f.employee.create({ fullName: `${prefix} Salesman` });

      const sale = (overrides) =>
        client.post("/sales/create-sales").send({
          customerType: { type: "walking", walking: { customerName: `${prefix} Walker`, mobileNumber: "01700000000" } },
          salesMen: salesman._id.toString(),
          searchItem: [{ productId: product._id.toString(), quantity: 2, salesRate: 800, salesStatus: "sale" }],
          payable: 1600,
          paid: 1600,
          invoiceStatus: "complete",
          paymentMethod: { singlePayment: { amount: 1600, paymentTo: account._id.toString() } },
          ...overrides,
        });
      const complete = (await sale().expect(201)).body.data;
      await sale({ invoiceStatus: "pending", salesType: "retailsaleorder", deliveryDate: new Date().toISOString() }).expect(201);
      await sale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 600, balance: 1100, discountPercent: 5, payable: 1520 }).expect(201);
      await sale({ searchItem: [{ variantId: variant._id.toString(), quantity: 1, salesRate: 900, salesStatus: "sale" }], payable: 900, paid: 900 }).expect(201);
      await client
        .post("/sales-return/createsalesreturn")
        .send({ invoiceNumber: complete._id, refundMethod: account._id.toString(), returnReason: "size", allproduct: [{ product: product._id.toString(), quantity: 1, unitPrice: 800, subtotal: 800 }], totalReturnAmount: 800 })
        .expect(201);
      await client
        .post("/purchase/add-purchase")
        .send({ invoiceNumber: `${prefix}-PUR-1`, supplierId: supplier._id.toString(), cashType: account._id.toString(), allproduct: [{ product: product._id.toString(), purchasePrice: 300, retailPrice: 800, quantity: 10 }], payable: 3000, paid: 1000, dueamount: 2000 })
        .expect(201);
      await client
        .post("/purchase-return")
        .send({ supplier: supplier._id.toString(), cashType: account._id.toString(), products: [{ product: product._id.toString(), quantity: 1, purchasePrice: 300 }] })
        .expect(201);
      const category = await client
        .post("/transaction-category/create-transaction-category")
        .send({ categories: [{ name: `${prefix} Rent`, allowedType: "cash payment" }] })
        .expect(200);
      await client
        .post("/transaction/create-transaction")
        .send({ date: today, transactionCategory: category.body.data[0]._id, account: account._id.toString(), transactionType: "cash payment", amount: 250, transactionDescription: `${prefix} rent` })
        .expect(201);
      return { tenant, owner };
    };

    const mine = await seedStore("reportshop", "LOCAL");
    await seedStore("foreignshop", "FOREIGN");
    token = tokenFor(mine.owner);
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  const call = (route, body) => {
    const req = api(ctx.server, { token, tenant: "reportshop" }).request(route.method, concretePath(route, "0123456789abcdef01234567"));
    return route.method === "GET" ? req.query(body) : req.send(body);
  };

  it("covers every report, dashboard and invoice route", () => {
    expect(routes.length).toBeGreaterThanOrEqual(100);
  });

  for (const route of routes) {
    for (const [name, body] of Object.entries(BODIES)) {
      const key = `${label(route)}|${name}`;
      const t = KNOWN[key] ? test.failing : test;
      t(`${label(route)} with ${name}${KNOWN[key] ? ` [${KNOWN[key]}]` : ""}`, async () => {
        const res = await call(route, body);
        expect(res.status).toBeLessThan(500);
        if (res.status === 200) expectSuccessEnvelope(res.body);
        expect(JSON.stringify(res.body)).not.toContain("FOREIGN");
      });
    }
  }

  // BUG-P2-002: rows, totals and the account summary are separate queries now;
  // the page is joined to customers only after it is cut
  it("sales invoice report: newest first, paged, totals over the whole range, customers on the page", async () => {
    const report = (page, limit) =>
      api(ctx.server, { token, tenant: "reportshop" })
        .post("/report/sales-invoice")
        .query({ page, limit })
        // The end of today, as the dashboard sends it (a bare date is its midnight)
        .send({ startDate: BODIES["this year"].startDate, endDate: `${today}T23:59:59.999Z` })
        .expect(200);
    const all = (await report(1, 50)).body.data;
    expect(all.rows.map((r) => r.invoiceNumber)).toEqual(["INV-INV-04", "INV-INV-03", "INV-INV-02", "INV-INV-01"]);
    expect(all.rows.find((r) => r.invoiceNumber === "INV-INV-03").customerName).toBe("LOCAL Customer");
    expect(all.rows.find((r) => r.invoiceNumber === "INV-INV-01").customerName).toBe("LOCAL Walker");
    expect(all.totals).toMatchObject({ count: 4, totalPayable: 1600 + 1600 + 1520 + 900 });
    expect(all.pagination).toMatchObject({ total: 4, page: 1, hasNextPage: false });
    expect(all.accountSummary.accounts.map((a) => a.accountName)).toEqual(["LOCAL Till"]);
    expect(all.accountSummary.grandTotal).toBe(all.accountSummary.accounts[0].totalAmount);

    const second = (await report(2, 2)).body.data;
    expect(second.rows.map((r) => r.invoiceNumber)).toEqual(["INV-INV-02", "INV-INV-01"]);
    expect(second.totals.count).toBe(4);
    expect(second.pagination).toMatchObject({ total: 4, page: 2, hasNextPage: false });
  });

  // BUG-P2-002: lines are grouped per item before the product/variant join, and
  // the buy price reads only the purchases holding the page's items
  it("sales summary report: one row per item, quantities summed, buy price from its purchases", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" })
      .post("/report/sales-summary")
      .send({ startDate: BODIES["this year"].startDate, endDate: today })
      .expect(200);
    const rows = res.body.data.rows;
    const kurta = rows.find((r) => r.productName === "LOCAL Kurta" && r.size !== "XL" && r.qty !== 1);
    expect(kurta).toMatchObject({ qty: 6, avgBuyPrice: 300 });
    expect(rows.find((r) => r.qty === 1)).toMatchObject({ productName: "LOCAL Kurta" });
    expect(rows).toHaveLength(2);
  });

  // BUG-P2-002: the customer picker reads customers, searched through indexes
  it("report customer picker: searched by a word of the name or the mobile, at most 50", async () => {
    const pick = (search) =>
      api(ctx.server, { token, tenant: "reportshop" }).get("/report/sales/customers").query(search ? { search } : {}).expect(200);
    expect((await pick()).body.data.customers.map((c) => c.fullName)).toEqual(["LOCAL Customer"]);
    expect((await pick("cust")).body.data.customers.map((c) => c.fullName)).toEqual(["LOCAL Customer"]);
    expect((await pick("nobody")).body.data.customers).toEqual([]);
  });

  // BUG-P2-002: lines paged before the joins; totals per item, prices once per line
  it("sales product report: one row per line, totals over all lines, product filter through the variant's parent", async () => {
    const range = { startDate: BODIES["this year"].startDate, endDate: `${today}T23:59:59.999Z` };
    const report = (body, query = {}) =>
      api(ctx.server, { token, tenant: "reportshop" }).post("/report/sales-product").query(query).send({ ...range, ...body }).expect(200);
    const all = (await report({})).body.data;
    expect(all.rows).toHaveLength(4);
    expect(all.rows[0].invoiceNumber).toBe("INV-INV-04");
    expect(all.totals).toMatchObject({ count: 4, totalQty: 7 });
    expect(all.totals.totalBuyPrice).toBe(all.rows.reduce((sum, r) => sum + r.buyPrice, 0));
    expect(all.rows.find((r) => r.invoiceNumber === "INV-INV-03").customerName).toBe("LOCAL Customer");

    const kurta = all.rows.find((r) => r.invoiceNumber === "INV-INV-01");
    const productId = (await api(ctx.server, { token, tenant: "reportshop" }).get("/product/search-product").query({ name: "LOCAL Kurta" }).expect(200))
      .body.data.products.find((p) => p.resultType === "product")._id;
    const byProduct = (await report({ productId })).body.data;
    expect(byProduct.totals.count).toBe(4);
    const none = (await report({ productId: "0123456789abcdef01234567" })).body.data;
    expect(none).toMatchObject({ rows: [], totals: { count: 0 } });

    const page2 = (await report({}, { page: 2, limit: 3 })).body.data;
    expect(page2.rows.map((r) => r.invoiceNumber)).toEqual(["INV-INV-01"]);
    expect(kurta.qty).toBe(2);
  });

  // BUG-P2-002: rows joined per page, totals grouped per item and priced in batches
  it("salesman sales product report: totals equal the sum of the rows when they fit on one page", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" })
      .post("/report/salesman-sales-product")
      .send({ startDate: BODIES["this year"].startDate, endDate: today })
      .expect(200);
    const { rows, totals } = res.body.data;
    expect(rows).toHaveLength(4);
    expect(rows[0].salesmanName).toBe("LOCAL Salesman");
    const sum = (key) => rows.reduce((total, r) => total + r[key], 0);
    expect(totals).toMatchObject({
      count: 4,
      totalQty: sum("qty"),
      totalBuyPrice: sum("buyPrice"),
      totalWsPrice: sum("wsPrice"),
      totalRsPrice: sum("rsPrice"),
      totalDiscount: sum("discount"),
      totalAmount: sum("total"),
    });
  });

  // BUG-P2-002: customer search through indexes, rows paged before joins,
  // line totals per item, invoice totals once per invoice
  it("customer sales product report: rows and totals agree, customer search, invoices counted once", async () => {
    const report = (body) =>
      api(ctx.server, { token, tenant: "reportshop" })
        .post("/report/customer-sales-product")
        .send({ startDate: BODIES["this year"].startDate, endDate: today, ...body })
        .expect(200);
    const all = (await report({})).body.data;
    expect(all.rows).toHaveLength(4);
    const sum = (key) => all.rows.reduce((total, r) => total + r[key], 0);
    expect(all.totals).toMatchObject({
      count: 4,
      totalQty: sum("qty"),
      totalWsPrice: sum("wsPrice"),
      totalRsPrice: sum("rsPrice"),
      totalSubTotal: sum("subTotal"),
      totalSoldSubtotal: sum("soldSubtotal"),
    });
    expect(all.invoiceTotals).toMatchObject({ invoiceCount: 4, totalPayable: 1600 + 1600 + 1520 + 900 });

    const listed = (await report({ customerName: "custom" })).body.data;
    expect(listed.rows.map((r) => r.customerName)).toEqual(["LOCAL Customer"]);
    expect(listed.invoiceTotals.invoiceCount).toBe(1);
    const walking = (await report({ customerName: "walker" })).body.data;
    expect(walking.rows.every((r) => r.customerName === "LOCAL Walker")).toBe(true);
    expect(walking.invoiceTotals.invoiceCount).toBe(3);
  });

  // BUG-P2-002: lines grouped per item in the database, folded per product here
  it("customer sales summary report: one row per product (variants folded in), invoices counted once", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" })
      .post("/report/customer-sales-summary")
      .send({ startDate: BODIES["this year"].startDate, endDate: today })
      .expect(200);
    const { rows, totals, invoiceTotals } = res.body.data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productName: "LOCAL Kurta", qty: 7 });
    expect(totals).toMatchObject({ count: 1, totalQty: 7, totalAmount: rows[0].total });
    expect(invoiceTotals).toMatchObject({ invoiceCount: 4, totalPayable: 1600 + 1600 + 1520 + 900 });
  });

  // BUG-P2-002: rows paged before the customer / salesman join, totals with no join
  it("salesman and user sales invoice reports: rows with names, totals over every invoice, search", async () => {
    const range = { startDate: BODIES["this year"].startDate, endDate: today };
    const salesman = (await api(ctx.server, { token, tenant: "reportshop" }).post("/report/salesman-sales-invoice").send(range).expect(200)).body.data;
    expect(salesman.rows).toHaveLength(4);
    expect(salesman.rows.every((r) => r.salesmanName === "LOCAL Salesman")).toBe(true);
    expect(salesman.rows.find((r) => r.invoiceNumber === "INV-INV-03").customerName).toBe("LOCAL Customer");
    expect(salesman.totals).toMatchObject({ count: 4, totalPayable: 1600 + 1600 + 1520 + 900 });
    const searched = (await api(ctx.server, { token, tenant: "reportshop" }).post("/report/salesman-sales-invoice").send({ ...range, search: "custom" }).expect(200)).body.data;
    expect(searched.rows.map((r) => r.invoiceNumber)).toEqual(["INV-INV-03"]);
    expect(searched.totals.count).toBe(1);

    const user = (await api(ctx.server, { token, tenant: "reportshop" }).post("/report/user-sales-invoice").send(range).expect(200)).body.data;
    expect(user.totals).toMatchObject({ count: 4, totalReturned: 800 });
    expect(user.rows.find((r) => r.invoiceNumber === "INV-INV-01").returned).toBe(800);
  });

  // BUG-P2-008: the ledger endpoints read accounts/categories directly and page the rows
  it("ledger endpoints: accounts and categories without the ledger rows, paged transaction report and cash ledger", async () => {
    const c = api(ctx.server, { token, tenant: "reportshop" });
    const accounts = (await c.get("/invoice/getallaccounts").expect(200)).body.data;
    expect(accounts.map((a) => a.name)).toEqual(["LOCAL Till"]);
    const categories = (await c.get("/invoice/transaction-category").expect(200)).body.data;
    expect(categories.map((e) => e.transactionCategory.name)).toContain("LOCAL Rent");
    expect(new Set(categories.map((e) => e.transactionCategory._id)).size).toBe(categories.length);

    const range = { startDate: BODIES["this year"].startDate, endDate: `${today}T23:59:59.999Z` };
    const all = (await c.post("/invoice/transaction-report").send(range).expect(200)).body.data;
    expect(all.pagination).toMatchObject({ page: 1, hasNextPage: false });
    expect(all.transactions).toHaveLength(all.pagination.total);
    const page1 = (await c.post("/invoice/transaction-report").query({ limit: 1 }).send(range).expect(200)).body.data;
    expect(page1.transactions).toHaveLength(1);
    expect(page1.summary).toEqual(all.summary);
    expect(all.summary.cashPayment).toBeGreaterThanOrEqual(250);

    const ledger = (await c.post("/invoice/cash-ledger-report").send(range).expect(200)).body;
    const data = ledger.data;
    expect(data.pagination.total).toBe(all.pagination.total);
    expect(data.totalCashReceived).toBe(all.summary.cashReceived);
    expect(data.totalCashPayment).toBe(all.summary.cashPayment);
    expect(data.transactions[0].account.name).toBe("LOCAL Till");
  });

  // BUG-P2-009: customers paged before the sales/payment lookups; totals counted directly
  it("customer due list: the page's customers with their due invoices, totals over every customer", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" }).post("/report/customer-due-list").send({}).expect(200);
    const { rows, totals } = res.body.data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ customerName: "LOCAL Customer", totalDues: 1020, dueInvoices: 1 });
    expect(rows[0].lastSalesDate).toBeTruthy();
    expect(totals).toMatchObject({ count: 1, totalDues: 1020, totalDueInvoices: 1 });
    const none = await api(ctx.server, { token, tenant: "reportshop" }).post("/report/customer-due-list").send({ customerName: "nobody" }).expect(200);
    expect(none.body.data.totals).toMatchObject({ count: 0, totalDueInvoices: 0 });
  });

  // BUG-P2-009: customers paged before the sales lookup; sales totals summed directly
  it("customer balance summary: the page's customers with their sales, totals over every customer", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" }).post("/report/customer-balance-summary").send({}).expect(200);
    const { rows, totals } = res.body.data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ customerName: "LOCAL Customer", totalSales: 1520, totalPaid: 600 });
    expect(rows[0].totalBalance).toBe(rows[0].openingBalance + 1520 - 600);
    expect(totals).toMatchObject({ count: 1, totalSales: 1520, totalPaid: 600, totalBalance: rows[0].totalBalance });
  });

  // BUG-P2-009: each source of the ledger reads its own index
  it("customer ledger: opening balance first, the customer's sales with a running balance", async () => {
    const c = api(ctx.server, { token, tenant: "reportshop" });
    const customer = (await c.get("/report/sales/customers").query({ search: "local" }).expect(200)).body.data.customers[0];
    const res = await c.post("/report/customer-ledger").send({ customerId: customer._id }).expect(200);
    const { rows } = res.body.data;
    expect(rows[0].description).toBe("Opening Balance");
    const sale = rows.find((r) => r.referenceId === "INV-INV-03");
    expect(sale).toMatchObject({ description: "Sales Invoice", received: 1520, payment: 600 });
    expect(sale.balance).toBe(rows[0].received + 1520 - 600);
    expect(rows.some((r) => r.referenceId === "INV-INV-01")).toBe(false);
  });

  it("a report shows this store's own data (sanity check that the seed reached the reports)", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" }).post("/report/invoice-profit").send(BODIES["this year"]).expect(200);
    expect(JSON.stringify(res.body)).toContain("INV-INV-01");
  });

  // BUG-P2-009: last in the file — it records payments, which move the customer's due.
  // Name search through the customer index, rows merged per side, nothing joined but the page.
  it("customer payment report: due and advance payments merged newest first, totals, dropdowns, name search", async () => {
    const c = api(ctx.server, { token, tenant: "reportshop" });
    const customer = (await c.get("/report/sales/customers").query({ search: "local" }).expect(200)).body.data.customers[0];
    const accountId = (await c.get("/invoice/getallaccounts").expect(200)).body.data[0]._id;
    await c.post("/customer/customer-payment-recived").send({ customer: customer._id, paidAmount: 100, paymentMode: accountId, date: today }).expect(201);
    await c.post("/customer/customer-advance-payment-recived").send({ customer: customer._id, paidAmount: 70, advanceCashBack: 20, paymentMode: accountId, date: today }).expect(201);

    const range = { startDate: BODIES["this year"].startDate, endDate: today };
    const all = (await c.post("/report/customer-payment").send(range).expect(200)).body.data;
    expect(all.rows.map((r) => r.paymentCategory)).toEqual(["Return Cash Back", "Customer Payment Received"]);
    expect(all.rows[0]).toMatchObject({ customerName: "LOCAL Customer", paymentMethod: "LOCAL Till", paid: 70, cashBack: 20 });
    expect(all.totals).toMatchObject({ count: 2, totalPaid: 170, totalCashBack: 20 });
    expect(all.methods).toEqual([expect.objectContaining({ name: "LOCAL Till", count: 2, totalPaid: 170 })]);
    expect(all.categories.map((x) => x.name).sort()).toEqual(["Customer Payment Received", "Return Cash Back"]);

    const page2 = (await c.post("/report/customer-payment").query({ page: 2, limit: 1 }).send(range).expect(200)).body.data;
    expect(page2.rows.map((r) => r.paid)).toEqual([100]);
    const byCategory = (await c.post("/report/customer-payment").send({ ...range, category: "Return Cash Back" }).expect(200)).body.data;
    expect(byCategory.totals.count).toBe(1);
    expect(byCategory.categories).toHaveLength(2);
    const byName = (await c.post("/report/customer-payment").send({ ...range, customerName: "cust" }).expect(200)).body.data;
    expect(byName.totals.count).toBe(2);
    const nobody = (await c.post("/report/customer-payment").send({ ...range, customerName: "nobody" }).expect(200)).body.data;
    expect(nobody.totals.count).toBe(0);
  });
});
