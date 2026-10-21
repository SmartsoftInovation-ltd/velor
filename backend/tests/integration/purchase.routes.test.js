const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { testRedis } = require("../helpers/redis");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Purchase = require("../../src/models/purchase.model");
const PurchaseReturn = require("../../src/models/purchaseReturn.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Account = require("../../src/models/account.model");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const { SupplierModel: Supplier } = require("../../src/models/supplier.model");

describe("purchase and purchase-return routes", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let product;
  let supplier;
  let cash;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "buyshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    product = await f.product.create({ stock: 10, purchasePrice: 400, retailPrice: 600, wholesalePrice: 500 });
    supplier = await f.supplier.create({ openingDues: 0 });
    cash = await f.account.create({ name: "Cash", balance: 10000 });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "buyshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const productNow = () => inTenant(() => Product.findById(product._id).lean());
  const cashNow = async () => (await inTenant(() => Account.findById(cash._id).lean())).balance;
  const supplierDue = async () => (await inTenant(() => Supplier.findById(supplier._id).lean())).openingDues;

  let invoiceSeq = 0;
  const purchaseBody = (overrides = {}) => ({
    invoiceNumber: `PI-${(invoiceSeq += 1)}`,
    supplierId: supplier._id.toString(),
    cashType: cash._id.toString(),
    allproduct: [{ product: product._id.toString(), purchasePrice: 450, retailPrice: 700, wholesalePrice: 550, quantity: 5 }],
    payable: 2250,
    paid: 2000,
    dueamount: 250,
    ...overrides,
  });
  const createPurchase = (body) => as().post("/purchase/add-purchase").send(body);

  // ------------------------------------------------------------------ purchase
  describe("POST /purchase/add-purchase", () => {
    it("201: adds stock, takes the new prices, pays from the account, adds the due to the supplier", async () => {
      const res = await createPurchase(purchaseBody()).expect(201);
      expectSuccessEnvelope(res.body);
      const p = await productNow();
      expect(p.stock).toBe(15);
      expect(p.purchaseQuantityStock).toBe(5);
      expect(p).toMatchObject({ purchasePrice: 450, retailPrice: 700, wholesalePrice: 550 });
      expect(await cashNow()).toBe(8000);
      expect(await supplierDue()).toBe(250);

      const saved = await inTenant(() => Purchase.findOne({ invoiceNumber: res.body.data }).lean());
      expect(saved).toMatchObject({ subTotal: 2250, paymentStatus: "partial" });
      expect(saved.serial).toBe("PUR-INV-01");
      const txn = await inTenant(() => CrateTransaction.findOne({ purchaseReference: saved._id }).lean());
      expect(txn).toMatchObject({ amount: 2000, transactionType: "cash payment", balanceAfter: 8000 });
    });

    it("adds to the variant's stock for a variant line", async () => {
      const variant = await f.variant.create({ product: product._id, stockVariant: 2 });
      await createPurchase(purchaseBody({ allproduct: [{ variant: variant._id.toString(), purchasePrice: 300, retailPrice: 500, quantity: 3 }], payable: 900, paid: 900, dueamount: 0 })).expect(201);
      const v = await inTenant(() => Variant.findById(variant._id).lean());
      expect(v.stockVariant).toBe(5);
      expect(v.purchasePrice).toBe(300);
      expect((await productNow()).stock).toBe(10);
    });

    it("refuses paid above payable and a negative paid (400), changing nothing", async () => {
      await createPurchase(purchaseBody({ paid: 3000 })).expect(400);
      await createPurchase(purchaseBody({ paid: -1 })).expect(400);
      expect((await productNow()).stock).toBe(10);
      expect(await cashNow()).toBe(10000);
    });

    it.each([
      ["no items", () => ({ allproduct: [] })],
      ["a negative quantity", () => ({ allproduct: [{ product: product._id.toString(), purchasePrice: 450, retailPrice: 700, quantity: -5 }] })],
      ["no supplier", () => ({ supplierId: undefined })],
      ["a duplicate invoice number", () => ({ invoiceNumber: "DUP-1" })],
    ])("400 for %s and rolls back", async (name, overrides) => {
      if (name === "a duplicate invoice number") await createPurchase(purchaseBody({ invoiceNumber: "DUP-1" })).expect(201);
      const before = await productNow();
      const cashBefore = await cashNow();
      const res = await createPurchase(purchaseBody(overrides()));
      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 400);
      expect((await productNow()).stock).toBe(before.stock);
      expect(await cashNow()).toBe(cashBefore);
    });

    it("404 and rollback when the payment account does not exist", async () => {
      await createPurchase(purchaseBody({ cashType: "0123456789abcdef01234567" })).expect(404);
      expect((await productNow()).stock).toBe(10);
      expect(await inTenant(() => Purchase.countDocuments())).toBe(0);
    });

    // BUG-026: quantity is added with `+`, so a numeric string concatenates
    it("treats a numeric-string quantity as a number [BUG-026]", async () => {
      await createPurchase(purchaseBody({ allproduct: [{ product: product._id.toString(), purchasePrice: 450, retailPrice: 700, quantity: "5" }] })).expect(201);
      expect((await productNow()).stock).toBe(15);
    });

    // BUG-027: the supplier's due grows by the client's `dueamount`, unrelated to payable − paid
    it("works the supplier's due out from payable − paid, not from the client's dueamount [BUG-027]", async () => {
      await createPurchase(purchaseBody({ payable: 2250, paid: 2250, dueamount: 9999 })).expect(201);
      expect(await supplierDue()).toBe(0);
    });

    it("parallel purchases of one product add up without lost updates", async () => {
      const results = await Promise.all(Array.from({ length: 8 }, () => createPurchase(purchaseBody({ paid: 0, dueamount: 2250 }))));
      const ok = results.filter((r) => r.status === 201).length;
      const p = await productNow();
      expect(p.stock).toBe(10 + 5 * ok);
      expect(await inTenant(() => Purchase.countDocuments())).toBe(ok);
      expect(await supplierDue()).toBe(2250 * ok);
    });

    // BUG-025: manual startTransaction() without retry — a write conflict between
    // parallel purchases is answered 500 instead of being retried
    it("parallel purchases all succeed (conflicts are retried, not answered 500) [BUG-025]", async () => {
      const results = await Promise.all(Array.from({ length: 8 }, () => createPurchase(purchaseBody({ paid: 0, dueamount: 2250 }))));
      expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
    });

    it("needs purchase:add", async () => {
      const viewer = await createUserIn(tenant, { grants: { purchase: ["view"] } });
      await as(viewer).post("/purchase/add-purchase").send(purchaseBody()).expect(403);
    });
  });

  describe("GET /purchase/all-allpurchases, /single-purchase/:id, /search-purchase", () => {
    it("lists, reads one and searches by invoice number, supplier and account", async () => {
      await as().get("/purchase/all-allpurchases").expect(404);
      await createPurchase(purchaseBody({ invoiceNumber: "ALPHA-1" })).expect(201);
      await createPurchase(purchaseBody({ invoiceNumber: "BETA-2" })).expect(201);

      const all = await as().get("/purchase/all-allpurchases").expect(200);
      expect(all.body.data.purchases).toHaveLength(2);
      const id = all.body.data.purchases[0]._id;
      const one = await as().get(`/purchase/single-purchase/${id}`).expect(200);
      expect(one.body.data.purchase._id).toBe(id);
      await as().get("/purchase/single-purchase/0123456789abcdef01234567").expect(404);

      const byInvoice = await as().get("/purchase/search-purchase").query({ invoiceNumber: "alpha" }).expect(200);
      expect(byInvoice.body.data.purchases.map((p) => p.invoiceNumber)).toEqual(["ALPHA-1"]);
      const bySupplier = await as().get("/purchase/search-purchase").query({ supplierId: supplier._id.toString() }).expect(200);
      expect(bySupplier.body.data.total).toBe(2);
      await as().get("/purchase/search-purchase").expect(400);
      await as().get("/purchase/search-purchase").query({ supplierId: "bad" }).expect(400);
    });

    // BUG-028: invoiceNumber goes into $regex unescaped
    it("treats regex characters in the invoice search literally [BUG-028]", async () => {
      await createPurchase(purchaseBody({ invoiceNumber: "ALPHA-1" })).expect(201);
      const res = await as().get("/purchase/search-purchase").query({ invoiceNumber: "(" });
      expect(res.status).toBe(200);
      const wildcard = await as().get("/purchase/search-purchase").query({ invoiceNumber: ".*" }).expect(200);
      expect(wildcard.body.data.purchases).toEqual([]);
    });

    it("caches the list for an hour and refreshes it after a purchase", async () => {
      await createPurchase(purchaseBody()).expect(201);
      await as().get("/purchase/all-allpurchases").expect(200);
      const key = (await testRedis().keys(`t:${tenant._id}:purchase:v*:all`))[0];
      expect(await testRedis().ttl(key)).toBeGreaterThan(3500);
      expect((await as().get("/purchase/all-allpurchases").expect(200)).body.data.fromCache).toBe(true);
      await createPurchase(purchaseBody()).expect(201);
      const fresh = await as().get("/purchase/all-allpurchases").expect(200);
      expect(fresh.body.data.purchases).toHaveLength(2);
    });
  });

  describe("PUT /purchase/update-purchase/:id", () => {
    it("re-applies the purchase: stock, account and supplier due move by the difference", async () => {
      await createPurchase(purchaseBody({ invoiceNumber: "UP-1" })).expect(201);
      const saved = await inTenant(() => Purchase.findOne({ invoiceNumber: "UP-1" }).lean());
      await as()
        .put(`/purchase/update-purchase/${saved._id}`)
        .send(purchaseBody({ invoiceNumber: "UP-1", allproduct: [{ product: product._id.toString(), purchasePrice: 450, retailPrice: 700, wholesalePrice: 550, quantity: 8 }], payable: 3600, paid: 3000, dueamount: 600 }))
        .expect(200);
      expect((await productNow()).stock).toBe(18);
      expect(await cashNow()).toBe(7000);
      expect(await supplierDue()).toBe(600);
      expect(await inTenant(() => CrateTransaction.countDocuments({ purchaseReference: saved._id }))).toBe(1);
    });

    it("404 for an unknown purchase", async () => {
      await as().put("/purchase/update-purchase/0123456789abcdef01234567").send(purchaseBody()).expect(404);
    });

    // BUG-029: an edit without `allproduct` crashes on `for (const item of undefined)`
    it("an edit that leaves the items out is a 400, not a 500 [BUG-029]", async () => {
      await createPurchase(purchaseBody({ invoiceNumber: "UP-2" })).expect(201);
      const saved = await inTenant(() => Purchase.findOne({ invoiceNumber: "UP-2" }).lean());
      const res = await as().put(`/purchase/update-purchase/${saved._id}`).send({ paid: 100, payable: 2250 });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /purchase/delete-purchase/:id", () => {
    it("takes the stock back out, refunds the account, removes the supplier due", async () => {
      await createPurchase(purchaseBody({ invoiceNumber: "DEL-1" })).expect(201);
      const saved = await inTenant(() => Purchase.findOne({ invoiceNumber: "DEL-1" }).lean());
      await as().delete(`/purchase/delete-purchase/${saved._id}`).expect(200);
      expect((await productNow()).stock).toBe(10);
      expect(await cashNow()).toBe(10000);
      expect(await supplierDue()).toBe(0);
      expect(await inTenant(() => CrateTransaction.countDocuments())).toBe(0);
      await as().delete(`/purchase/delete-purchase/${saved._id}`).expect(404);
    });

    // BUG-030: the stock is taken back with a bare $inc; once the purchased
    // units are sold, deleting the purchase drives stock negative
    it("never drives stock below zero [BUG-030]", async () => {
      await createPurchase(purchaseBody({ invoiceNumber: "DEL-2" })).expect(201);
      const saved = await inTenant(() => Purchase.findOne({ invoiceNumber: "DEL-2" }).lean());
      await inTenant(() => Product.updateOne({ _id: product._id }, { stock: 1 }));
      await as().delete(`/purchase/delete-purchase/${saved._id}`);
      expect((await productNow()).stock).toBeGreaterThanOrEqual(0);
    });
  });

  // ------------------------------------------------------------------ purchase return
  describe("POST /purchase-return", () => {
    const returnBody = (overrides = {}) => ({
      supplier: supplier._id.toString(),
      cashType: cash._id.toString(),
      products: [{ product: product._id.toString(), quantity: 3, purchasePrice: 400 }],
      ...overrides,
    });

    it("takes the return off the supplier due and credits the same amount to the account; PUT and DELETE revert it", async () => {
      await inTenant(() => Supplier.updateOne({ _id: supplier._id }, { $set: { openingDues: 5000 } }));
      const created = (await as().post("/purchase-return").send(returnBody()).expect(201)).body.data;
      expect(created.dueReduced).toBe(1200);
      expect(await supplierDue()).toBe(3800);
      expect(await cashNow()).toBe(11200);

      await as().put(`/purchase-return/${created._id}`).send(returnBody({ products: [{ product: product._id.toString(), quantity: 1, purchasePrice: 400 }] })).expect(200);
      expect(await supplierDue()).toBe(4600);
      expect(await cashNow()).toBe(10400);

      await as().delete(`/purchase-return/${created._id}`).expect(200);
      expect(await supplierDue()).toBe(5000);
      expect(await cashNow()).toBe(10000);
    });

    it("takes the due down only to 0 and puts back only what it took", async () => {
      await inTenant(() => Supplier.updateOne({ _id: supplier._id }, { $set: { openingDues: 500 } }));
      const created = (await as().post("/purchase-return").send(returnBody()).expect(201)).body.data;
      expect(await supplierDue()).toBe(0);
      expect(await cashNow()).toBe(11200);
      await as().delete(`/purchase-return/${created._id}`).expect(200);
      expect(await supplierDue()).toBe(500);
    });

    it("201: takes stock out, credits the refund to the account; a supplier with no due stays at 0", async () => {
      await f.supplier.create(); // another supplier, untouched
      const res = await as().post("/purchase-return").send(returnBody()).expect(201);
      expect(res.body.data.totalReturnAmount).toBe(1200);
      const p = await productNow();
      expect(p.stock).toBe(7);
      expect(p.purchaseReturnStock).toBe(3);
      expect(await cashNow()).toBe(11200);
      expect(await supplierDue()).toBe(0);
      const txn = await inTenant(() => CrateTransaction.findOne({ purchaseReturnReference: res.body.data._id }).lean());
      expect(txn).toMatchObject({ transactionType: "cash recived", amount: 1200 });
    });

    it.each([
      ["no supplier", { supplier: undefined }],
      ["a malformed supplier", { supplier: "x" }],
      ["no refund account", { cashType: undefined }],
      ["no products", { products: [] }],
      ["a zero quantity", { products: [{ product: "0123456789abcdef01234567", quantity: 0, purchasePrice: 1 }] }],
      ["no price", { products: [{ product: "0123456789abcdef01234567", quantity: 1 }] }],
    ])("400 for %s", async (_name, overrides) => {
      const res = await as().post("/purchase-return").send(returnBody(overrides)).expect(400);
      expectErrorEnvelope(res.body, 400);
    });

    it("400 when returning more than is in stock — including two lines that together exceed it", async () => {
      await as().post("/purchase-return").send(returnBody({ products: [{ product: product._id.toString(), quantity: 11, purchasePrice: 400 }] })).expect(400);
      await as()
        .post("/purchase-return")
        .send(returnBody({ products: [{ product: product._id.toString(), quantity: 6, purchasePrice: 400 }, { product: product._id.toString(), quantity: 6, purchasePrice: 400 }] }))
        .expect(400);
      expect((await productNow()).stock).toBe(10);
      expect(await cashNow()).toBe(10000);
    });

    it("404 for an unknown supplier, product or account, with rollback", async () => {
      await as().post("/purchase-return").send(returnBody({ supplier: "0123456789abcdef01234567" })).expect(404);
      await as().post("/purchase-return").send(returnBody({ products: [{ product: "0123456789abcdef01234567", quantity: 1, purchasePrice: 1 }] })).expect(404);
      await as().post("/purchase-return").send(returnBody({ cashType: "0123456789abcdef01234567" })).expect(404);
      expect((await productNow()).stock).toBe(10);
      expect(await inTenant(() => PurchaseReturn.countDocuments())).toBe(0);
    });

    it("parallel returns never take stock below zero", async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => as().post("/purchase-return").send(returnBody({ products: [{ product: product._id.toString(), quantity: 3, purchasePrice: 400 }] }))));
      const ok = results.filter((r) => r.status === 201).length;
      const p = await productNow();
      expect(p.stock).toBe(10 - 3 * ok);
      expect(p.stock).toBeGreaterThanOrEqual(0);
      expect(ok).toBeLessThanOrEqual(3);
      expect(await cashNow()).toBe(10000 + 1200 * ok);
    });

    it("GET lists and reads; DELETE puts stock back and reverses the refund; PUT replaces it", async () => {
      const created = (await as().post("/purchase-return").send(returnBody()).expect(201)).body.data;
      const list = await as().get("/purchase-return").expect(200);
      expect(JSON.stringify(list.body.data)).toContain(created._id);
      await as().get(`/purchase-return/${created._id}`).expect(200);
      await as().get("/purchase-return/nope").expect(400);

      await as().put(`/purchase-return/${created._id}`).send(returnBody({ products: [{ product: product._id.toString(), quantity: 1, purchasePrice: 400 }] })).expect(200);
      expect((await productNow()).stock).toBe(9);
      expect(await cashNow()).toBe(10400);

      await as().delete(`/purchase-return/${created._id}`).expect(200);
      expect((await productNow()).stock).toBe(10);
      expect(await cashNow()).toBe(10000);
      await as().delete(`/purchase-return/${created._id}`).expect(404);
    });
  });
});
