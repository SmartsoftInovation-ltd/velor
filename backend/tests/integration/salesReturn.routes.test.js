const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Sales = require("../../src/models/sales.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Account = require("../../src/models/account.model");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const SalesReturn = require("../../src/models/salesReturn.model");
const { customerModel: Customer } = require("../../src/models/customer.model");

describe("sales return routes (/api/v1/sales-return)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let product;
  let till;
  let refundAccount;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "returnshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    product = await f.product.create({ stock: 10, purchasePrice: 400 });
    till = await f.account.create({ name: "Till" });
    refundAccount = await f.account.create({ name: "Refunds", balance: 5000 });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "returnshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const productNow = () => inTenant(() => Product.findById(product._id).lean());
  const saleNow = (id) => inTenant(() => Sales.findById(id).lean());

  const makeSale = async ({ quantity = 2, salesRate = 1000, invoiceStatus = "complete", customerType, ...rest } = {}) => {
    const salesman = await f.employee.create();
    const total = quantity * salesRate;
    const res = await as()
      .post("/sales/create-sales")
      .send({
        customerType: customerType || { type: "walking", walking: { customerName: "Walk-in", mobileNumber: "01700000000" } },
        salesMen: salesman._id.toString(),
        searchItem: [{ productId: product._id.toString(), quantity, salesRate, salesStatus: "sale" }],
        payable: total,
        paid: total,
        invoiceStatus,
        paymentMethod: { singlePayment: { amount: total, paymentTo: till._id.toString() } },
        ...rest,
      })
      .expect(201);
    return res.body.data;
  };

  const returnBody = (sale, overrides = {}) => ({
    invoiceNumber: sale._id,
    refundMethod: refundAccount._id.toString(),
    returnReason: "Damaged",
    allproduct: [{ product: product._id.toString(), quantity: 1, unitPrice: 1000, subtotal: 1000 }],
    totalReturnAmount: 1000,
    ...overrides,
  });

  const createReturn = (body) => as().post("/sales-return/createsalesreturn").send(body);

  describe("POST /sales-return/createsalesreturn", () => {
    it("201: restocks, flags the line, adds the refund to the sale and records a refund transaction", async () => {
      const sale = await makeSale();
      expect((await productNow()).stock).toBe(8);
      const res = await createReturn(returnBody(sale)).expect(201);
      expectSuccessEnvelope(res.body);

      const p = await productNow();
      expect(p.stock).toBe(9);
      expect(p.salesReturnStock).toBe(1);

      const s = await saleNow(sale._id);
      expect(s.return).toBe(1000);
      expect(s.searchItem[0].salesStatus).toBe("return");

      const ret = await inTenant(() => SalesReturn.findById(res.body.data._id).lean());
      expect(ret).toMatchObject({ totalReturnAmount: 1000, grossReturnAmount: 1000 });
      const txn = await inTenant(() => CrateTransaction.findById(ret.transaction).lean());
      expect(txn).toMatchObject({ transactionType: "cash payment", amount: 1000 });
      expect(txn.salesReturnReference.toString()).toBe(ret._id.toString());
    });

    it("works the refund out from the sale, ignoring the amounts in the request", async () => {
      const sale = await makeSale({ quantity: 2, salesRate: 1000, discountPercent: 10, payable: 1800, paid: 1800 });
      const res = await createReturn(
        returnBody(sale, { allproduct: [{ product: product._id.toString(), quantity: 1, unitPrice: 99999, subtotal: 99999 }], totalReturnAmount: 99999 }),
      ).expect(201);
      expect(res.body.data.totalReturnAmount).toBe(900);
      expect((await saleNow(sale._id)).return).toBe(900);
    });

    it("refunds a share of less-taka per returned unit", async () => {
      const sale = await makeSale({ quantity: 2, salesRate: 1000, lessTaka: 200, payable: 1800, paid: 1800 });
      const res = await createReturn(returnBody(sale)).expect(201);
      expect(res.body.data).toMatchObject({ grossReturnAmount: 1000, lessTakaShare: 100, totalReturnAmount: 900 });
    });

    it("reduces a listed customer's due by the refund, never below zero", async () => {
      const customer = await f.customer.create({ openingDues: 0 });
      const sale = await makeSale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 0, payable: 2000, balance: 2000 });
      expect((await inTenant(() => Customer.findById(customer._id).lean())).openingDues).toBe(2000);
      await createReturn(returnBody(sale)).expect(201);
      expect((await inTenant(() => Customer.findById(customer._id).lean())).openingDues).toBe(1000);
    });

    it("restocks the variant when the return names one", async () => {
      const variant = await f.variant.create({ product: product._id, stockVariant: 5 });
      const salesman = await f.employee.create();
      const sale = (
        await as().post("/sales/create-sales").send({
          customerType: { type: "walking", walking: { customerName: "W", mobileNumber: "01700000000" } },
          salesMen: salesman._id.toString(),
          searchItem: [{ variantId: variant._id.toString(), quantity: 2, salesRate: 500, salesStatus: "sale" }],
          payable: 1000, paid: 1000, invoiceStatus: "complete",
        }).expect(201)
      ).body.data;
      await createReturn(returnBody(sale, { allproduct: [{ variant: variant._id.toString(), quantity: 1, unitPrice: 500, subtotal: 500 }] })).expect(201);
      const v = await inTenant(() => Variant.findById(variant._id).lean());
      expect(v.stockVariant).toBe(4);
      expect(v.salesReturnStock).toBe(1);
    });

    it.each([
      ["no invoice", { invoiceNumber: undefined }],
      ["a malformed invoice id", { invoiceNumber: "abc" }],
      ["no refund account", { refundMethod: undefined }],
      ["no reason", { returnReason: "" }],
      ["no items", { allproduct: [] }],
      ["a zero quantity", { allproduct: [{ product: "0123456789abcdef01234567", quantity: 0, unitPrice: 1, subtotal: 1 }] }],
      ["an item with neither product nor variant", { allproduct: [{ quantity: 1, unitPrice: 1, subtotal: 1 }] }],
    ])("400 for %s, nothing changes", async (_name, overrides) => {
      const sale = await makeSale();
      const res = await createReturn(returnBody(sale, overrides)).expect(400);
      expectErrorEnvelope(res.body, 400);
      expect((await productNow()).stock).toBe(8);
      expect(await inTenant(() => SalesReturn.countDocuments())).toBe(0);
    });

    it("404 for an unknown sale, and for another store's sale", async () => {
      await createReturn(returnBody({ _id: "0123456789abcdef01234567" })).expect(404);
      const sale = await makeSale();
      const other = await tenantFactory.create({ slug: "otherreturns" });
      const otherOwner = await createUserIn(other, { owner: true });
      const res = await api(ctx.server, { token: tokenFor(otherOwner), tenant: "otherreturns" })
        .post("/sales-return/createsalesreturn")
        .send(returnBody(sale));
      expect(res.status).toBe(404);
      expect((await productNow()).stock).toBe(8);
    });

    // BUG-018: nothing caps the returned quantity at what was sold (less what
    // came back already) — stock and the refund grow without limit
    test.failing("refuses to take back more units than the sale sold [BUG-018]", async () => {
      const sale = await makeSale({ quantity: 2 });
      const res = await createReturn(returnBody(sale, { allproduct: [{ product: product._id.toString(), quantity: 50, unitPrice: 1000, subtotal: 50000 }] }));
      expect(res.status).toBe(400);
      expect((await productNow()).stock).toBe(8);
    });

    it("allows one return per invoice: a second one is refused (400) and changes nothing", async () => {
      const sale = await makeSale({ quantity: 2, salesRate: 1000 });
      await createReturn(returnBody(sale)).expect(201);
      const again = await createReturn(returnBody(sale)).expect(400);
      expect(again.body.message).toMatch(/already exists/);
      expect((await saleNow(sale._id)).return).toBe(1000);
      expect((await productNow()).stock).toBe(9);
    });

    // BUG-019: a product that is not on the sale is refunded at the unitPrice
    // the client sends
    test.failing("refuses to refund a product that was not on the sale [BUG-019]", async () => {
      const sale = await makeSale();
      const stranger = await f.product.create({ stock: 0 });
      const res = await createReturn(
        returnBody(sale, { allproduct: [{ product: stranger._id.toString(), quantity: 1, unitPrice: 75000, subtotal: 75000 }] }),
      );
      expect(res.status).toBe(400);
    });

    // BUG-020: a pending/draft sale never took stock, yet its return adds stock
    test.failing("refuses a return against a sale that never left the shop (pending) [BUG-020]", async () => {
      const sale = await makeSale({ invoiceStatus: "pending" });
      const res = await createReturn(returnBody(sale));
      expect(res.status).toBe(400);
      expect((await productNow()).stock).toBe(10);
    });

    // BUG-021: the refund is written as a "cash payment" transaction but the
    // refund account's balance is never reduced (every other module $incs it)
    test.failing("takes the refund out of the refund account's balance [BUG-021]", async () => {
      const sale = await makeSale();
      await createReturn(returnBody(sale)).expect(201);
      const account = await inTenant(() => Account.findById(refundAccount._id).lean());
      expect(account.balance).toBe(4000);
    });

    it("parallel returns: stock, refunds and return documents stay consistent with each other", async () => {
      const sale = await makeSale({ quantity: 1 });
      const results = await Promise.all(Array.from({ length: 8 }, () => createReturn(returnBody(sale))));
      const created = results.filter((r) => r.status === 201).length;
      expect(created).toBeGreaterThanOrEqual(1);
      expect(await inTenant(() => SalesReturn.countDocuments())).toBe(created);
      expect((await productNow()).stock).toBe(9 + created);
      expect((await saleNow(sale._id)).return).toBe(1000 * created);
    });

    // BUG-025: the transaction is started by hand (startTransaction) with no
    // retry, so a write conflict between parallel requests surfaces as a 500
    test.failing("parallel returns are refused cleanly (4xx), never with a 500 [BUG-025]", async () => {
      const statuses = [];
      for (let round = 0; round < 3; round += 1) {
        const sale = await makeSale({ quantity: 1 });
        const results = await Promise.all(Array.from({ length: 10 }, () => createReturn(returnBody(sale))));
        statuses.push(...results.map((r) => r.status));
      }
      expect(statuses.filter((s) => s >= 500)).toEqual([]);
    });

    // BUG-023: "one return per invoice" is a findOne() in a pre-save hook,
    // outside the transaction and with no unique index behind it, so parallel
    // requests can all pass it (the race is timing-dependent; the missing
    // index is what makes it possible, and is asserted here deterministically)
    test.failing("one return per invoice is enforced by a unique index [BUG-023]", async () => {
      await SalesReturn.init();
      const indexes = await SalesReturn.collection.indexes();
      const unique = indexes.find((i) => i.unique && i.key.invoiceNumber === 1);
      expect(unique).toBeDefined();
    });
  });

  describe("GET /sales-return/allsalesreturn and /single-salesreturn/:id", () => {
    it("lists this store's returns (404 when there are none) and reads one by id", async () => {
      await as().get("/sales-return/allsalesreturn").expect(404);
      const sale = await makeSale();
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      const list = await as().get("/sales-return/allsalesreturn").expect(200);
      expect(list.body.data.salesReturns).toHaveLength(1);
      const one = await as().get(`/sales-return/single-salesreturn/${created._id}`).expect(200);
      expect(one.body.data.salesReturn._id).toBe(created._id);
      await as().get("/sales-return/single-salesreturn/0123456789abcdef01234567").expect(404);
      await as().get("/sales-return/single-salesreturn/nope").expect(400);
    });

    it("refreshes the cached list after a new return", async () => {
      const sale = await makeSale({ quantity: 3 });
      await createReturn(returnBody(sale)).expect(201);
      await as().get("/sales-return/allsalesreturn").expect(200);
      const second = await as().get("/sales-return/allsalesreturn").expect(200);
      expect(second.body.data.fromCache).toBe(true);
      await createReturn(returnBody(await makeSale())).expect(201);
      const fresh = await as().get("/sales-return/allsalesreturn").expect(200);
      expect(fresh.body.data.fromCache).toBeUndefined();
      expect(fresh.body.data.salesReturns).toHaveLength(2);
    });

    it("does not show another store's return by id", async () => {
      const sale = await makeSale();
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      const other = await tenantFactory.create({ slug: "peekshop" });
      const otherOwner = await createUserIn(other, { owner: true });
      await api(ctx.server, { token: tokenFor(otherOwner), tenant: "peekshop" }).get(`/sales-return/single-salesreturn/${created._id}`).expect(404);
    });
  });

  describe("DELETE /sales-return/delete-salesreturn/:id", () => {
    it("undoes the return: stock, line status, sale refund, customer due and transaction", async () => {
      const customer = await f.customer.create();
      const sale = await makeSale({ customerType: { type: "listed", customerId: customer._id.toString() }, paid: 0, payable: 2000, balance: 2000 });
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      await as().delete(`/sales-return/delete-salesreturn/${created._id}`).expect(200);

      const p = await productNow();
      expect(p.stock).toBe(8);
      expect(p.salesReturnStock).toBe(0);
      const s = await saleNow(sale._id);
      expect(s.return).toBe(0);
      expect(s.searchItem[0].salesStatus).toBe("sale");
      expect((await inTenant(() => Customer.findById(customer._id).lean())).openingDues).toBe(2000);
      expect(await inTenant(() => CrateTransaction.countDocuments({ salesReturnReference: { $ne: null } }))).toBe(0);
      expect(await inTenant(() => SalesReturn.countDocuments())).toBe(0);
    });

    it("404 the second time (idempotent from the caller's side)", async () => {
      const sale = await makeSale();
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      await as().delete(`/sales-return/delete-salesreturn/${created._id}`).expect(200);
      await as().delete(`/sales-return/delete-salesreturn/${created._id}`).expect(404);
      expect((await productNow()).stock).toBe(8);
    });

    // BUG-022: the restock is taken back with a bare $inc, so stock goes
    // negative when the returned units were sold again in the meantime
    test.failing("never drives stock below zero [BUG-022]", async () => {
      const sale = await makeSale({ quantity: 2 });
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 0 }));
      const res = await as().delete(`/sales-return/delete-salesreturn/${created._id}`);
      expect((await productNow()).stock).toBeGreaterThanOrEqual(0);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("PUT /sales-return/update-salesreturn/:id", () => {
    // BUG-024: the old and the new sale are the same document loaded twice; the
    // second save() hits a VersionError, so every edit answers 500
    test.failing("replaces the return: old effect reverted, new one applied, one transaction kept [BUG-024]", async () => {
      const sale = await makeSale({ quantity: 3 });
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      expect((await productNow()).stock).toBe(8);
      await as()
        .put(`/sales-return/update-salesreturn/${created._id}`)
        .send(returnBody(sale, { allproduct: [{ product: product._id.toString(), quantity: 2, unitPrice: 1000, subtotal: 2000 }] }))
        .expect(200);
      const p = await productNow();
      expect(p.stock).toBe(9);
      expect(p.salesReturnStock).toBe(2);
      expect((await saleNow(sale._id)).return).toBe(2000);
      const txns = await inTenant(() => CrateTransaction.find({ salesReturnReference: created._id }).lean());
      expect(txns).toHaveLength(1);
      expect(txns[0].amount).toBe(2000);
    });

    it("404 for an unknown return, 400 for an invalid body", async () => {
      const sale = await makeSale();
      await as().put("/sales-return/update-salesreturn/0123456789abcdef01234567").send(returnBody(sale)).expect(404);
      const created = (await createReturn(returnBody(sale)).expect(201)).body.data;
      await as().put(`/sales-return/update-salesreturn/${created._id}`).send({}).expect(400);
    });
  });
});
