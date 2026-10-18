const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Sales = require("../../src/models/sales.model");
const Product = require("../../src/models/product.model");
const { customerModel: Customer, customerAdvancePaymentModel: Advance } = require("../../src/models/customer.model");
const { SupplierModel: Supplier, SupplierDuePayment } = require("../../src/models/supplier.model");
const Account = require("../../src/models/account.model");

// Findings of the code review turned into tests: how a sale's edits and
// deletes keep (or fail to keep) stock, dues and advances consistent, plus
// the storefront audience check and supplier payments.
describe("sale integrity, audience and supplier payments", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let product;
  let salesman;
  let account;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "integrity" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    product = await f.product.create({ stock: 10, purchasePrice: 400, retailPrice: 1000 });
    salesman = await f.employee.create();
    account = await f.account.create({ balance: 1000 });
  });

  const as = (token = tokenFor(owner)) => api(ctx.server, { token, tenant: "integrity" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const stock = async () => (await inTenant(() => Product.findById(product._id).lean())).stock;
  const line = (o = {}) => ({ productId: product._id.toString(), quantity: 2, salesRate: 1000, salesStatus: "sale", ...o });
  const sale = (o = {}) => ({
    customerType: { type: "walking", walking: { customerName: "W", mobileNumber: "01700000000" } },
    salesMen: salesman._id.toString(),
    searchItem: [line()],
    payable: 2000,
    paid: 2000,
    invoiceStatus: "complete",
    ...o,
  });
  const create = async (o) => (await as().post("/sales/create-sales").send(sale(o)).expect(201)).body.data;
  const update = (id, body) => as().put(`/sales/update-sales/${id}`).send(body);

  // ------------------------------------------------------------------ stock
  // BUG-067: the sale schema accepts salesStatus "return" on a new sale; such a
  // line adds stock with no sales return, refund or approval behind it
  test.failing("a new sale cannot carry a 'return' line that puts stock back [BUG-067]", async () => {
    const res = await as().post("/sales/create-sales").send(sale({ searchItem: [line({ salesStatus: "return", quantity: 5 })], payable: 0, paid: 0 }));
    expect(res.status).toBe(400);
    expect(await stock()).toBe(10);
  });

  // BUG-068: after a return flips a line to "return", an edit that sends the
  // line back as "sale" is read as −qty − (+qty): stock moves twice the quantity
  test.failing("editing a sale after a partial return does not move stock [BUG-068]", async () => {
    const s = await create();
    await as()
      .post("/sales-return/createsalesreturn")
      .send({ invoiceNumber: s._id, refundMethod: account._id.toString(), returnReason: "x", allproduct: [{ product: product._id.toString(), quantity: 1, unitPrice: 1000, subtotal: 1000 }], totalReturnAmount: 1000 })
      .expect(201);
    expect(await stock()).toBe(9);
    await update(s._id, { remark: "typo fixed", searchItem: [line()] }).expect(200);
    expect(await stock()).toBe(9);
  });

  // ------------------------------------------------------------------ mass assignment
  // BUG-069: updateSales writes `{ $set: req.body }` — the refund total, the due
  // and the invoice number are all client-writable on an edit
  test.failing("an edit cannot rewrite the refund total, the due or the invoice number [BUG-069]", async () => {
    const s = await create();
    await update(s._id, { return: 99999, presentDue: 12345, invoiceNumber: "FAKE-1" }).expect(200);
    const stored = await inTenant(() => Sales.findById(s._id).lean());
    expect(stored.return).toBe(0);
    expect(stored.invoiceNumber).toBe("INV-INV-01");
  });

  // ------------------------------------------------------------------ dues & advances
  // BUG-014 (delete path): the due is restored from the sale's previousDue
  // snapshot, wiping every payment received since
  test.failing("deleting a sale takes only that sale's due back off the customer [BUG-014]", async () => {
    const c = await f.customer.create({ openingDues: 500 });
    const s = await create({ customerType: { type: "listed", customerId: c._id.toString() }, paid: 1200, payable: 2000, previousDue: 500, balance: 1300 });
    await as().post("/customer/customer-payment-recived").send({ customer: c._id.toString(), paidAmount: 300, paymentMode: account._id.toString() }).expect(201);
    expect((await inTenant(() => Customer.findById(c._id).lean())).openingDues).toBe(1000);
    await as().delete(`/sales/delete-sales/${s._id}`).expect(200);
    expect((await inTenant(() => Customer.findById(c._id).lean())).openingDues).toBe(200);
  });

  // BUG-070: updateSales never applies a change of customerAdvancePaymentAdjust,
  // but deleteSales credits the stored figure back
  test.failing("an edit that raises the advance used, then a delete, leaves the advance unchanged [BUG-070]", async () => {
    const c = await f.customer.create();
    await as().post("/customer/customer-advance-payment-recived").send({ customer: c._id.toString(), paidAmount: 1000, paymentMode: account._id.toString() }).expect(201);
    const s = await create({ customerType: { type: "listed", customerId: c._id.toString() }, paid: 2000, balance: 0 });
    await update(s._id, { customerAdvancePaymentAdjust: 800 }).expect(200);
    await as().delete(`/sales/delete-sales/${s._id}`).expect(200);
    const docs = await inTenant(() => Advance.find({ customer: c._id }).lean());
    const total = docs.reduce((sum, d) => Math.max(sum, d.balance), 0);
    expect(total).toBe(1000);
  });

  // ------------------------------------------------------------------ audience
  // BUG-071: optionalAuth sets req.user for any valid token, so forAudience()
  // treats a storefront shopper exactly like staff and hands them the cost price
  test.failing("a signed-in shopper does not see cost prices on the catalogue [BUG-071]", async () => {
    const shopper = await createUserIn(tenant, { shopper: true });
    const res = await as(tokenFor(shopper)).get("/product/getproduct").expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/"purchasePrice":/);
  });

  it("staff still see cost prices on the catalogue", async () => {
    const res = await as().get("/product/getproduct").expect(200);
    expect(res.body.data.products[0].purchasePrice).toBe(400);
  });

  // ------------------------------------------------------------------ supplier payments
  describe("supplier due payments", () => {
    let supplier;
    beforeEach(async () => {
      supplier = await f.supplier.create({ openingDues: 1000, supplierId: "01711112222", isActive: true });
    });
    const pay = (body) => as().post("/supplier/create-supplier-due-payment").send({ supplierId: supplier.supplierId, paidAmount: 400, paymentMode: account._id.toString(), ...body });
    const due = async () => (await inTenant(() => Supplier.findById(supplier._id).lean())).openingDues;

    it("reduces the supplier's due and takes the net out of the account", async () => {
      await pay().expect(201);
      expect(await due()).toBe(600);
      expect((await inTenant(() => Account.findById(account._id).lean())).balance).toBe(600);
      await pay({ paidAmount: 5000 }).expect(400);
      await pay({ paidAmount: 0 }).expect(400);
    });

    // BUG-072: not transactional — the due is cut and the payment saved before
    // the account is checked; an unknown account answers 404 but the due stays cut
    test.failing("an unknown payment account changes nothing [BUG-072]", async () => {
      await pay({ paymentMode: "0123456789abcdef01234567" }).expect(404);
      expect(await due()).toBe(1000);
      expect(await inTenant(() => SupplierDuePayment.countDocuments())).toBe(0);
    });

    // BUG-072: deleting a payment refunds the account but not the supplier's due
    test.failing("deleting a payment restores the supplier's due [BUG-072]", async () => {
      await pay().expect(201);
      const p = await inTenant(() => SupplierDuePayment.findOne().lean());
      await as().delete(`/supplier/delete-supplier-due-payment/${p._id}`).expect(200);
      expect((await inTenant(() => Account.findById(account._id).lean())).balance).toBe(1000);
      expect(await due()).toBe(1000);
    });
  });
});
