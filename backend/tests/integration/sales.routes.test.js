const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { testRedis } = require("../helpers/redis");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Sales = require("../../src/models/sales.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Account = require("../../src/models/account.model");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const SalesReturn = require("../../src/models/salesReturn.model");
const SmsLog = require("../../src/models/smsLog.model");
const Counter = require("../../src/models/counter.model");
const { customerModel: Customer } = require("../../src/models/customer.model");

describe("sales routes (/api/v1/sales)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let salesman;
  let product;
  let account;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "saleshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    salesman = await f.employee.create();
    product = await f.product.create({ stock: 10, purchasePrice: 400, retailPrice: 1000 });
    account = await f.account.create({ name: "Cash", balance: 0 });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "saleshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const productNow = () => inTenant(() => Product.findById(product._id).lean());
  const accountNow = () => inTenant(() => Account.findById(account._id).lean());

  const line = (overrides = {}) => ({
    productId: product._id.toString(),
    quantity: 1,
    salesRate: 1000,
    salesStatus: "sale",
    ...overrides,
  });

  const sale = (overrides = {}) => ({
    customerType: { type: "walking", walking: { customerName: "Walk-in", mobileNumber: "01700000000" } },
    salesMen: salesman._id.toString(),
    searchItem: [line()],
    payable: 1000,
    paid: 1000,
    salesType: "retailsale",
    invoiceStatus: "complete",
    paymentMethod: { singlePayment: { amount: 1000, paymentTo: account._id.toString() } },
    ...overrides,
  });

  const create = (body, user) => as(user).post("/sales/create-sales").send(body);

  // ------------------------------------------------------------------ create
  describe("POST /sales/create-sales", () => {
    it("201: saves the sale, numbers it, deducts stock, posts the payment and records who sold it", async () => {
      const res = await create(sale()).expect(201);
      expectSuccessEnvelope(res.body);
      const saved = await inTenant(() => Sales.findById(res.body.data._id).lean());

      expect(saved.invoiceNumber).toBe("INV-INV-01");
      expect(saved.createdBy.toString()).toBe(owner._id.toString());
      expect(saved.searchItem[0].purchasePrice).toBe(400);
      expect(saved.netPaid).toBe(1000);
      expect(saved.changes).toBe(0);

      const p = await productNow();
      expect(p.stock).toBe(9);
      expect(p.posSold).toBe(1);

      expect((await accountNow()).balance).toBe(1000);
      const txns = await inTenant(() => CrateTransaction.find({ saleReference: saved._id }).lean());
      expect(txns).toHaveLength(1);
      expect(txns[0]).toMatchObject({ amount: 1000, transactionType: "cash recived", balanceAfter: 1000 });
    });

    it("numbers consecutive sales 01, 02, 03 within the store", async () => {
      for (const n of ["01", "02", "03"]) {
        const res = await create(sale()).expect(201);
        const saved = await inTenant(() => Sales.findById(res.body.data._id).lean());
        expect(saved.invoiceNumber).toBe(`INV-INV-${n}`);
      }
    });

    it("ignores createdBy and line purchasePrice sent by the client", async () => {
      const res = await create(sale({ createdBy: salesman._id.toString(), searchItem: [line({ purchasePrice: 1 })] })).expect(201);
      const saved = await inTenant(() => Sales.findById(res.body.data._id).lean());
      expect(saved.createdBy.toString()).toBe(owner._id.toString());
      expect(saved.searchItem[0].purchasePrice).toBe(400);
    });

    it("refuses a sale stamped with another store's tenantId (400) and saves nothing", async () => {
      const intruder = await tenantFactory.create();
      const res = await create(sale({ tenantId: intruder._id.toString() })).expect(400);
      expect(res.body.code).toBe("TENANT_CONTEXT_REQUIRED");
      expect(await runForTenant(intruder._id, () => Sales.countDocuments())).toBe(0);
      expect(await inTenant(() => Sales.countDocuments())).toBe(0);
    });

    it("works out change and the net paid on an overpayment; only the net amount reaches the account", async () => {
      const res = await create(
        sale({ paid: 1500, paymentMethod: { singlePayment: { amount: 1500, paymentTo: account._id.toString() } } }),
      ).expect(201);
      expect(res.body.data.changes).toBe(500);
      expect(res.body.data.netPaid).toBe(1000);
      expect((await accountNow()).balance).toBe(1000);
    });

    it("splits a multiple payment across accounts, taking the change off the last tender", async () => {
      const bank = await f.account.create({ name: "Bank" });
      await create(
        sale({
          paid: 1200,
          paymentMethod: {
            multiplePayment: [
              { amount: 700, paymentTo: account._id.toString() },
              { amount: 500, paymentTo: bank._id.toString() },
            ],
          },
        }),
      ).expect(201);
      expect((await accountNow()).balance).toBe(700);
      expect((await inTenant(() => Account.findById(bank._id).lean())).balance).toBe(300);
    });

    it.each(["pending", "draft"])("a %s sale saves without touching stock", async (invoiceStatus) => {
      await create(sale({ invoiceStatus })).expect(201);
      expect((await productNow()).stock).toBe(10);
    });

    it("a variant line deducts the variant's stock", async () => {
      const variant = await f.variant.create({ product: product._id, stockVariant: 4 });
      await create(sale({ searchItem: [line({ productId: undefined, variantId: variant._id.toString() })] })).expect(201);
      const v = await inTenant(() => Variant.findById(variant._id).lean());
      expect(v.stockVariant).toBe(3);
      expect(v.posSold).toBe(1);
      expect((await productNow()).stock).toBe(10);
    });

    it("rolls everything back when stock is short: no sale, no stock move, no money posted", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 11 })], payable: 11000, paid: 11000 }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await inTenant(() => Sales.countDocuments())).toBe(0);
      expect((await productNow()).stock).toBe(10);
      expect((await accountNow()).balance).toBe(0);
      expect(await inTenant(() => CrateTransaction.countDocuments())).toBe(0);
    });

    // BUG-013: a business rule failure answered as an internal error
    it("answers short stock with a 4xx, as update-sales does [BUG-013]", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 11 })], payable: 11000, paid: 11000 }));
      expect(res.status).toBe(400);
    });

    it("rolls back when the payment account does not exist (404)", async () => {
      const res = await create(
        sale({ paymentMethod: { singlePayment: { amount: 1000, paymentTo: "0123456789abcdef01234567" } } }),
      ).expect(404);
      expectErrorEnvelope(res.body, 404);
      expect(await inTenant(() => Sales.countDocuments())).toBe(0);
      expect((await productNow()).stock).toBe(10);
    });

    it("refuses a walking sale with a due (WALKING_DUE_NOT_ALLOWED)", async () => {
      const res = await create(sale({ paid: 900 })).expect(400);
      expect(res.body.code).toBe("WALKING_DUE_NOT_ALLOWED");
    });

    it("enforces the seller's discount limit (403) on the invoice discount", async () => {
      const limited = await createUserIn(tenant, { grants: { "retail-sales": ["add"] }, discountLimit: 10 });
      const over = await create(sale({ discountPercent: 15, payable: 850, paid: 850 }), limited).expect(403);
      expect(over.body.message).toMatch(/discount limit exceeded/i);
      await create(sale({ discountPercent: 10, payable: 900, paid: 900 }), limited).expect(201);
    });

    it("lets a listed customer's regular discount through a lower seller limit, but no further", async () => {
      const limited = await createUserIn(tenant, { grants: { "retail-sales": ["add"] }, discountLimit: 10 });
      const vip = await f.customer.create({ regularDiscountPercent: 20 });
      const listed = { type: "listed", customerId: vip._id.toString() };
      // The customer's own 20% is given by the store, not the seller
      await create(sale({ customerType: listed, discountPercent: 20, payable: 800, paid: 800 }), limited).expect(201);
      // Above it, the higher of the two limits still applies
      const over = await create(sale({ customerType: listed, discountPercent: 25, payable: 750, paid: 750 }), limited).expect(403);
      expect(over.body.message).toMatch(/limit is 20%/i);
      // A walking sale gets no such allowance
      await create(sale({ discountPercent: 20, payable: 800, paid: 800 }), limited).expect(403);
    });

    it.each([
      ["no salesman", undefined],
      ["an empty salesman", null],
    ])("saves a sale with %s", async (_name, salesMen) => {
      const res = await create(sale({ salesMen })).expect(201);
      const saved = await inTenant(() => Sales.findById(res.body.data._id).lean());
      expect(saved.salesMen).toBeNull();
    });

    it.each([
      ["no line", () => ({ searchItem: [] })],
      ["a malformed salesman id", () => ({ salesMen: "nope" })],
      ["a line without product or variant", () => ({ searchItem: [{ quantity: 1, salesRate: 10, salesStatus: "sale" }] })],
      ["a negative quantity", () => ({ searchItem: [line({ quantity: -1 })] })],
      ["a negative price", () => ({ searchItem: [line({ salesRate: -5 })] })],
      ["an unknown line status", () => ({ searchItem: [line({ salesStatus: "gift" })] })],
      ["an unknown invoice status", () => ({ invoiceStatus: "paid" })],
      ["a discount over 100%", () => ({ discountPercent: 101 })],
      ["a non-numeric paid", () => ({ paid: "lots" })],
      ["no customer type", () => ({ customerType: undefined })],
    ])("400 for %s, and nothing is saved", async (_name, overrides) => {
      const res = await create(sale(overrides()));
      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 400);
      expect(await inTenant(() => Sales.countDocuments())).toBe(0);
      expect((await productNow()).stock).toBe(10);
    });

    it("needs the permission of the sale's own type", async () => {
      const retailOnly = await createUserIn(tenant, { grants: { "retail-sales": ["add"] } });
      await create(sale({ salesType: "wholesale" }), retailOnly).expect(403);
      const wholesaler = await createUserIn(tenant, { grants: { "wholesale-sales": ["add"] } });
      await create(sale({ salesType: "wholesale" }), wholesaler).expect(201);
      await create(sale({ salesType: "retailsale" }), wholesaler).expect(403);
    });

    it("updates a listed customer's due and bumps the customer cache namespace", async () => {
      const customer = await f.customer.create({ openingDues: 500 });
      await testRedis().set(`t:${tenant._id}:customer:v`, "5");
      await create(
        sale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 200, previousDue: 500, presentDue: 800, balance: 1300 }),
      ).expect(201);
      const stored = await inTenant(() => Customer.findById(customer._id).lean());
      expect(stored.openingDues).toBe(1300);
      expect(await testRedis().get(`t:${tenant._id}:customer:v`)).toBe("6");
    });

    // BUG-014: the customer's running due is overwritten with the client's `balance`
    it("works a listed customer's due out on the server, not from the client's balance [BUG-014]", async () => {
      const customer = await f.customer.create({ openingDues: 500 });
      await create(
        sale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 200, balance: 0 }),
      ).expect(201);
      const stored = await inTenant(() => Customer.findById(customer._id).lean());
      expect(stored.openingDues).toBe(1300);
    });

    it("queues the SMS receipt and the invoice email after commit when sendSms is set", async () => {
      const { smsQueue } = require("../../src/queues/sms.queue");
      const { emailQueue } = require("../../src/queues/email.queue");
      const res = await create(
        sale({ sendSms: true, customerType: { type: "walking", walking: { customerName: "Rina", mobileNumber: "01711112222", email: "rina@example.com" } } }),
      ).expect(201);
      const id = res.body.data._id;

      const smsJob = await smsQueue.getJob(`sales-sms-${id}`);
      expect(smsJob).toBeTruthy();
      expect(smsJob.data).toMatchObject({ tenantId: tenant._id.toString(), recipients: [{ phone: "01711112222", index: 0 }] });
      expect(smsJob.data.message).toContain("INV-INV-01");
      const log = await inTenant(() => SmsLog.findById(smsJob.data.logId).lean());
      expect(log).toMatchObject({ status: "queued", recipientType: "sales", jobId: smsJob.id });

      const emailJob = await emailQueue.getJob(`sales-email-${id}`);
      expect(emailJob.data).toMatchObject({ to: "rina@example.com", tenantId: tenant._id.toString() });
      expect(emailJob.data.subject).toContain("INV-INV-01");
    });

    it("queues nothing when sendSms is off", async () => {
      const { smsQueue } = require("../../src/queues/sms.queue");
      const res = await create(sale()).expect(201);
      expect(await smsQueue.getJob(`sales-sms-${res.body.data._id}`)).toBeUndefined();
    });

    it("bumps the sales, product and dashboard cache namespaces", async () => {
      await create(sale()).expect(201);
      const keys = await testRedis().keys(`t:${tenant._id}:*:v`);
      expect(keys.sort()).toEqual(
        expect.arrayContaining([`t:${tenant._id}:sales:v`, `t:${tenant._id}:product:v`, `t:${tenant._id}:dashboard:v`, `t:${tenant._id}:account:v`]),
      );
      // namespace version keys are meant to live forever
      expect(await testRedis().ttl(`t:${tenant._id}:sales:v`)).toBe(-1);
    });
  });

  // ------------------------------------------------------------------ concurrency
  describe("concurrency", () => {
    it("20 parallel sales of the last 5 units: exactly 5 succeed and stock never goes negative", async () => {
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 5 }));
      const results = await Promise.all(Array.from({ length: 20 }, () => create(sale())));
      const ok = results.filter((r) => r.status === 201);
      expect(ok).toHaveLength(5);
      results.filter((r) => r.status !== 201).forEach((r) => expect(r.status).toBeGreaterThanOrEqual(400));
      const p = await productNow();
      expect(p.stock).toBe(0);
      expect(p.posSold).toBe(5);
      expect(await inTenant(() => Sales.countDocuments())).toBe(5);
      expect((await accountNow()).balance).toBe(5000);
    });

    it("parallel sales get unique, gap-free invoice numbers", async () => {
      await create(sale()).expect(201); // the counter exists from here on
      const results = await Promise.all(Array.from({ length: 15 }, () => create(sale({ invoiceStatus: "pending" }))));
      expect(results.every((r) => r.status === 201)).toBe(true);
      const numbers = (await inTenant(() => Sales.find().lean())).map((s) => s.invoiceNumber).sort();
      expect(new Set(numbers).size).toBe(16);
      const seqs = numbers.map((n) => Number(n.split("-").pop())).sort((a, b) => a - b);
      expect(seqs).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    });

    // The counter is created by an upsert inside each sale's transaction: the
    // first sales of a store race to insert it
    it("the very first sales of a store can be rung up at the same time", async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => create(sale({ invoiceStatus: "pending" }))));
      expect(results.map((r) => r.status)).toEqual(Array(10).fill(201));
      expect(await inTenant(() => Counter.countDocuments({ key: "SALES_INVOICE" }))).toBe(1);
    });
  });

  // ------------------------------------------------------------------ read
  describe("GET /sales/get-sales", () => {
    const seed = async () => {
      await create(sale()).expect(201);
      await create(sale({ invoiceStatus: "pending", salesType: "retailsaleorder" })).expect(201);
      await create(sale({ invoiceStatus: "draft", salesType: "wholesale" })).expect(201);
    };

    // BUG-P2-005: the list is always paged — there is no "everything" answer
    it("lists the store's sales newest first, one page at a time", async () => {
      await seed();
      const other = await tenantFactory.create({ slug: "othershop" });
      await runForTenant(other._id, () => Sales.collection.insertOne({ tenantId: other._id, invoiceNumber: "X-1", customerType: { type: "walking" }, createdAt: new Date() }));
      const res = await as().get("/sales/get-sales").expect(200);
      expect(res.body.data).toMatchObject({ page: 1, limit: 50, hasNextPage: false, nextCursor: null });
      expect(res.body.data.sales.map((s) => s.invoiceNumber)).toEqual(["INV-INV-03", "INV-INV-02", "INV-INV-01"]);
    });

    it("filters by salesType and invoiceStatus, single or comma-separated", async () => {
      await seed();
      const byType = await as().get("/sales/get-sales").query({ salesType: "wholesale" }).expect(200);
      expect(byType.body.data.sales.map((s) => s.salesType)).toEqual(["wholesale"]);
      const byStatuses = await as().get("/sales/get-sales").query({ invoiceStatus: "complete,pending" }).expect(200);
      expect(byStatuses.body.data.sales.map((s) => s.invoiceStatus).sort()).toEqual(["complete", "pending"]);
      const none = await as().get("/sales/get-sales").query({ salesType: "wholesaleorder" }).expect(200);
      expect(none.body.data.sales).toEqual([]);
    });

    it("finds one invoice by number, 404 when there is none", async () => {
      await seed();
      const res = await as().get("/sales/get-sales").query({ invoiceNumber: "INV-INV-02" }).expect(200);
      expect(res.body.data).toHaveLength(1);
      await as().get("/sales/get-sales").query({ invoiceNumber: "INV-INV-99" }).expect(404);
    });

    // BUG-P2-006: no per-page count of every sale; limit + 1 tells whether there is more
    it("pages by number: first, last and empty pages, limit capped at 100, bad page numbers clamped", async () => {
      await seed();
      const first = await as().get("/sales/get-sales").query({ page: 1, limit: 2 }).expect(200);
      expect(first.body.data).toMatchObject({ page: 1, limit: 2, hasNextPage: true });
      expect(first.body.data).not.toHaveProperty("total");
      expect(first.body.data.sales).toHaveLength(2);
      const last = await as().get("/sales/get-sales").query({ page: 2, limit: 2 }).expect(200);
      expect(last.body.data).toMatchObject({ hasNextPage: false });
      expect(last.body.data.sales).toHaveLength(1);
      const empty = await as().get("/sales/get-sales").query({ page: 9, limit: 2 }).expect(200);
      expect(empty.body.data.sales).toEqual([]);
      const capped = await as().get("/sales/get-sales").query({ page: 1, limit: 5000 }).expect(200);
      expect(capped.body.data.limit).toBe(100);
      const clamped = await as().get("/sales/get-sales").query({ page: -3, limit: "abc" }).expect(200);
      expect(clamped.body.data).toMatchObject({ page: 1, limit: 50 });
      // Deep page numbers are refused: the cursor pages at the same cost everywhere
      const deep = await as().get("/sales/get-sales").query({ page: 202, limit: 50 }).expect(400);
      expect(deep.body.code).toBe("USE_CURSOR");
    });

    it("pages by cursor (keyset): each page continues after the last row of the one before", async () => {
      await seed();
      const first = await as().get("/sales/get-sales").query({ limit: 2 }).expect(200);
      expect(first.body.data.nextCursor).toEqual(expect.any(String));
      const second = await as().get("/sales/get-sales").query({ limit: 2, after: first.body.data.nextCursor }).expect(200);
      expect(second.body.data).toMatchObject({ hasNextPage: false, nextCursor: null });
      const all = [...first.body.data.sales, ...second.body.data.sales].map((s) => s.invoiceNumber);
      expect(all).toEqual(["INV-INV-03", "INV-INV-02", "INV-INV-01"]);
      await as().get("/sales/get-sales").query({ after: "garbage" }).expect(400);
    });

    it("searches invoice numbers by prefix (any case) or sequence number, literally", async () => {
      await seed();
      const hit = await as().get("/sales/get-sales").query({ search: "inv-inv-02" }).expect(200);
      expect(hit.body.data.sales.map((s) => s.invoiceNumber)).toEqual(["INV-INV-02"]);
      const bySequence = await as().get("/sales/get-sales").query({ search: "3" }).expect(200);
      expect(bySequence.body.data.sales.map((s) => s.invoiceNumber)).toEqual(["INV-INV-03"]);
      const regex = await as().get("/sales/get-sales").query({ search: ".*" }).expect(200);
      expect(regex.body.data.sales).toEqual([]);
    });

    it("filters by payment status and by the account paid into", async () => {
      await create(sale({ paymentStatus: "paid" })).expect(201);
      const due = await f.customer.create();
      await create(sale({ customerType: { type: "listed", customerId: due._id.toString() }, paid: 0, paymentStatus: "due", paymentMethod: {} })).expect(201);
      const paid = await as().get("/sales/get-sales").query({ paymentStatus: "paid" }).expect(200);
      expect(paid.body.data.sales.map((s) => s.invoiceNumber)).toEqual(["INV-INV-01"]);
      const intoTill = await as().get("/sales/get-sales").query({ paymentTo: account._id.toString() }).expect(200);
      expect(intoTill.body.data.sales.map((s) => s.invoiceNumber)).toEqual(["INV-INV-01"]);
    });

    it("answers the list's stat cards on the server", async () => {
      await create(sale({ paymentStatus: "paid" })).expect(201);
      const due = await f.customer.create();
      await create(sale({ customerType: { type: "listed", customerId: due._id.toString() }, paid: 400, presentDue: 600, paymentStatus: "partial", paymentMethod: { singlePayment: { amount: 400, paymentTo: account._id.toString() } } })).expect(201);
      const res = await as().get("/sales/get-sales-stats").expect(200);
      expect(res.body.data).toMatchObject({ todayCount: 2, todayAmount: 2000, paidCount: 1, dueCount: 1, totalDue: 600 });
    });

    it("never caches a whole-shop list", async () => {
      await create(sale()).expect(201);
      await as().get("/sales/get-sales").expect(200);
      expect(await testRedis().keys(`t:${tenant._id}:sales:v*:all*`)).toEqual([]);
    });

    it("lets a sale-order-only user read the list, but not create a direct sale", async () => {
      const orderTaker = await createUserIn(tenant, { grants: { "retail-sale-order": ["view", "add"] } });
      await as(orderTaker).get("/sales/get-sales").expect(200);
      await create(sale(), orderTaker).expect(403);
      await create(sale({ salesType: "retailsaleorder", invoiceStatus: "pending" }), orderTaker).expect(201);
    });
  });

  describe("GET /sales/get-sales-products", () => {
    it("finds products by a multi-word name, and by exact barcode with a higher score", async () => {
      const named = await f.product.create({ name: "Cotton Shirt Large" });
      const byName = await as().get("/sales/get-sales-products").query({ q: "cotton shirt" }).expect(200);
      expect(byName.body.data.map((r) => String(r._id))).toEqual([named._id.toString()]);
      const byCode = await as().get("/sales/get-sales-products").query({ q: product.barCode }).expect(200);
      expect(byCode.body.data[0]).toMatchObject({ _id: product._id.toString(), _type: "product", _score: 100 });
    });

    // BUG-017: any single word of 4+ letters/digits is taken for a barcode and
    // matched exactly against sku/barcode/qr/slug, so "Shirt" finds nothing
    it("finds a product by a single word of its name [BUG-017]", async () => {
      const named = await f.product.create({ name: "Cotton Shirt Large" });
      const res = await as().get("/sales/get-sales-products").query({ q: "Shirt" }).expect(200);
      expect(res.body.data.map((r) => String(r._id))).toContain(named._id.toString());
    });

    it("returns variants with their product's name", async () => {
      const variant = await f.variant.create({ product: product._id, variantName: "Zebra Blue" });
      const res = await as().get("/sales/get-sales-products").query({ q: "zebra blue" }).expect(200);
      expect(res.body.data[0]).toMatchObject({ _id: variant._id.toString(), _type: "variant", productName: product.name });
    });

    it("applies a product discount only while it is active and in date", async () => {
      const live = await f.discount.create();
      const expired = await f.discount.create({ discountValidFrom: new Date("2020-01-01"), discountValidTo: new Date("2020-02-01") });
      const a = await f.product.create({ name: "Discounted Alpha", discount: live._id });
      const b = await f.product.create({ name: "Discounted Beta", discount: expired._id });
      const search = async (q) => (await as().get("/sales/get-sales-products").query({ q }).expect(200)).body.data[0];
      const alpha = await search("discounted alpha");
      const beta = await search("discounted beta");
      expect(alpha._id).toBe(a._id.toString());
      expect(alpha.discount).toMatchObject({ _id: live._id.toString() });
      expect(beta._id).toBe(b._id.toString());
      expect(beta.discount).toBeUndefined();
    });

    it("400 without q; never matches other stores' products", async () => {
      await as().get("/sales/get-sales-products").expect(400);
      const other = await tenantFactory.create();
      await forTenant(other).product.create({ name: "Foreign Gadget" });
      const res = await as().get("/sales/get-sales-products").query({ q: "Foreign" }).expect(200);
      expect(res.body.data).toEqual([]);
    });

    it("caps the result count at 50, and a blank query is a 400", async () => {
      for (let i = 0; i < 55; i += 1) await f.product.create({ name: `Shirt ${i}` });
      await as().get("/sales/get-sales-products").query({ q: "   ", limit: 500 }).expect(400);
      const hit = await as().get("/sales/get-sales-products").query({ q: "sh", limit: 500 }).expect(200);
      expect(hit.body.data).toHaveLength(50);
      const small = await as().get("/sales/get-sales-products").query({ q: "sh", limit: 3 }).expect(200);
      expect(small.body.data).toHaveLength(3);
    });

    // A typed name matches any part of it, in any case
    it("matches any part of a name, every typed word somewhere in it", async () => {
      const named = await f.product.create({ name: "Cotton Shirt Large" });
      const ids = async (q) => (await as().get("/sales/get-sales-products").query({ q }).expect(200)).body.data.map((r) => String(r._id));
      expect(await ids("shi")).toContain(named._id.toString());
      expect(await ids("lar cot")).toEqual([named._id.toString()]);
      expect(await ids("hirt")).toContain(named._id.toString());
      expect(await ids("TTONSH")).toEqual([]);
    });

    // Variant names are often one glued word; the parent product's name finds them too
    it("finds a variant by any part of its own name or its product's name", async () => {
      const shirt = await f.product.create({ name: "Casual Full Shirt" });
      const variant = await f.variant.create({ product: shirt._id, variantName: "CASUALFULLSHIRT2" });
      const variantIds = async (q) =>
        (await as().get("/sales/get-sales-products").query({ q }).expect(200)).body.data
          .filter((r) => r._type === "variant")
          .map((r) => String(r._id));
      expect(await variantIds("ullshirt2")).toEqual([variant._id.toString()]);
      expect(await variantIds("full shirt")).toEqual([variant._id.toString()]);
    });

    // Paged mode for scrolling pickers: exact code first, then names, page by page
    it("pages through every match with ?page, the exact code first", async () => {
      for (let i = 0; i < 7; i += 1) await f.product.create({ name: `Paged Shirt ${String(i).padStart(2, "0")}` });
      const page = (n) =>
        as().get("/sales/get-sales-products").query({ q: "paged shirt", page: n, limit: 3 }).expect(200).then((r) => r.body.data);

      const p1 = await page(1);
      const p2 = await page(2);
      const p3 = await page(3);
      expect(p1.hasMore).toBe(true);
      expect(p2.hasMore).toBe(true);
      expect(p3.hasMore).toBe(false);
      const names = [...p1.items, ...p2.items, ...p3.items].map((r) => r.name);
      expect(names).toEqual([...names].sort());
      expect(new Set(names).size).toBe(7);

      const byCode = await as().get("/sales/get-sales-products").query({ q: product.barCode, page: 1 }).expect(200);
      expect(byCode.body.data.items[0]).toMatchObject({ _id: product._id.toString(), _score: 100 });

      // Opened without typing: everything, page by page
      const all = await as().get("/sales/get-sales-products").query({ page: 1, limit: 50 }).expect(200);
      expect(all.body.data.items.length).toBeGreaterThanOrEqual(8);
      // Without ?page a query is still required
      await as().get("/sales/get-sales-products").expect(400);
    });

    // BUG-016: a non-numeric or zero limit reaches $limit and the driver rejects it
    it.each(["abc", "0", "-5"])("limit=%s is a client error or clamped, not a 500 [BUG-016]", async (limit) => {
      const res = await as().get("/sales/get-sales-products").query({ q: "SKU", limit });
      expect(res.status).toBeLessThan(500);
    });
  });

  // ------------------------------------------------------------------ update
  describe("PUT /sales/update-sales/:saleId", () => {
    const update = (id, body, user) => as(user).put(`/sales/update-sales/${id}`).send(body);

    it("pending → complete deducts stock; complete → pending puts it back", async () => {
      const res = await create(sale({ invoiceStatus: "pending", searchItem: [line({ quantity: 3 })], payable: 3000, paid: 3000 })).expect(201);
      expect((await productNow()).stock).toBe(10);
      await update(res.body.data._id, { invoiceStatus: "complete" }).expect(200);
      expect((await productNow()).stock).toBe(7);
      await update(res.body.data._id, { invoiceStatus: "pending" }).expect(200);
      const p = await productNow();
      expect(p.stock).toBe(10);
      expect(p.posSold).toBe(0);
    });

    it("complete → complete applies only the difference in quantity", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 2 })], payable: 2000, paid: 2000 })).expect(201);
      expect((await productNow()).stock).toBe(8);
      await update(res.body.data._id, { searchItem: [line({ quantity: 5 })], payable: 5000, paid: 5000 }).expect(200);
      expect((await productNow()).stock).toBe(5);
      await update(res.body.data._id, { searchItem: [line({ quantity: 1 })], payable: 1000, paid: 1000 }).expect(200);
      expect((await productNow()).stock).toBe(9);
    });

    it("400 and nothing changes when the edit needs more stock than there is", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 2 })], payable: 2000, paid: 2000 })).expect(201);
      const balanceBefore = (await accountNow()).balance;
      await update(res.body.data._id, {
        searchItem: [line({ quantity: 50 })], payable: 50000, paid: 50000,
        paymentMethod: { singlePayment: { amount: 50000, paymentTo: account._id.toString() } },
      }).expect(400);
      expect((await productNow()).stock).toBe(8);
      const saved = await inTenant(() => Sales.findById(res.body.data._id).lean());
      expect(saved.searchItem[0].quantity).toBe(2);
      expect((await accountNow()).balance).toBe(balanceBefore);
    });

    it("re-posts the payment: the account moves by the difference, one transaction remains", async () => {
      const res = await create(sale()).expect(201);
      await update(res.body.data._id, {
        paid: 1500, payable: 1500, searchItem: [line({ salesRate: 1500 })],
        paymentMethod: { singlePayment: { amount: 1500, paymentTo: account._id.toString() } },
      }).expect(200);
      expect((await accountNow()).balance).toBe(1500);
      expect(await inTenant(() => CrateTransaction.countDocuments({ saleReference: res.body.data._id }))).toBe(1);
    });

    it("404 for an unknown sale, and for another store's sale", async () => {
      await update("0123456789abcdef01234567", { remark: "x" }).expect(404);
      const other = await tenantFactory.create({ slug: "othershop" });
      const otherOwner = await createUserIn(other, { owner: true });
      const foreignSale = await create(sale()).expect(201);
      const res = await api(ctx.server, { token: tokenFor(otherOwner), tenant: "othershop" })
        .put(`/sales/update-sales/${foreignSale.body.data._id}`)
        .send({ remark: "hijack" });
      expect(res.status).toBe(404);
      const saved = await inTenant(() => Sales.findById(foreignSale.body.data._id).lean());
      expect(saved.remark).toBeUndefined();
    });

    it("400 for an empty edit and for a walking sale edited into a due", async () => {
      const res = await create(sale()).expect(201);
      await update(res.body.data._id, {}).expect(400);
      const due = await update(res.body.data._id, { paid: 100 }).expect(400);
      expect(due.body.code).toBe("WALKING_DUE_NOT_ALLOWED");
    });

    it("needs retail-sales:edit", async () => {
      const res = await create(sale()).expect(201);
      const viewer = await createUserIn(tenant, { grants: { "retail-sales": ["view", "add"] } });
      await update(res.body.data._id, { remark: "x" }, viewer).expect(403);
    });
  });

  // ------------------------------------------------------------------ delete
  describe("DELETE /sales/delete-sales/:saleId", () => {
    const remove = (id, user) => as(user).delete(`/sales/delete-sales/${id}`);

    it("undoes a completed sale: stock and posSold back, money reversed, transaction gone", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 4 })], payable: 4000, paid: 4000, paymentMethod: { singlePayment: { amount: 4000, paymentTo: account._id.toString() } } })).expect(201);
      expect((await productNow()).stock).toBe(6);
      await remove(res.body.data._id).expect(200);
      const p = await productNow();
      expect(p.stock).toBe(10);
      expect(p.posSold).toBe(0);
      expect((await accountNow()).balance).toBe(0);
      expect(await inTenant(() => CrateTransaction.countDocuments())).toBe(0);
      expect(await inTenant(() => Sales.countDocuments())).toBe(0);
    });

    it("deletes the sales returns raised against the sale and undoes their restock", async () => {
      const res = await create(sale({ searchItem: [line({ quantity: 2 })], payable: 2000, paid: 2000 })).expect(201);
      const saleId = res.body.data._id;
      // As the sales return controller leaves things: 1 unit back in stock, line flipped
      await inTenant(async () => {
        await SalesReturn.collection.insertOne({ tenantId: tenant._id, invoiceNumber: Sales.castObject({ _id: saleId })._id, allproduct: [{ product: product._id, quantity: 1 }] });
        await Product.updateOne({ _id: product._id }, { $inc: { stock: 1, salesReturnStock: 1 } });
        await Sales.updateOne({ _id: saleId }, { $set: { "searchItem.0.salesStatus": "return" } });
      });
      expect((await productNow()).stock).toBe(9);
      await remove(saleId).expect(200);
      const p = await productNow();
      expect(p.stock).toBe(10);
      expect(p.salesReturnStock).toBe(0);
      expect(p.posSold).toBe(0);
      expect(await inTenant(() => SalesReturn.countDocuments())).toBe(0);
    });

    it("restores a listed customer's due to what it was before the sale", async () => {
      const customer = await f.customer.create({ openingDues: 500 });
      const res = await create(sale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 200, previousDue: 500, balance: 1300 })).expect(201);
      await remove(res.body.data._id).expect(200);
      expect((await inTenant(() => Customer.findById(customer._id).lean())).openingDues).toBe(500);
    });

    it("a pending sale leaves stock alone when deleted", async () => {
      const res = await create(sale({ invoiceStatus: "pending" })).expect(201);
      await remove(res.body.data._id).expect(200);
      expect((await productNow()).stock).toBe(10);
    });

    it("404 for an unknown or already deleted sale (deleting twice is safe)", async () => {
      const res = await create(sale()).expect(201);
      await remove(res.body.data._id).expect(200);
      await remove(res.body.data._id).expect(404);
      expect((await productNow()).stock).toBe(10);
    });

    it("needs retail-sales:delete", async () => {
      const res = await create(sale()).expect(201);
      const editor = await createUserIn(tenant, { grants: { "retail-sales": ["view", "edit"] } });
      await remove(res.body.data._id, editor).expect(403);
    });
  });
});
