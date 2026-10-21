const { useIntegrationApp } = require("../setup/integration");
const { api, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Account = require("../../src/models/account.model");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const {
  customerModel: Customer,
  customerPaymentRecived: CustomerPayment,
  customerAdvancePaymentModel: AdvancePayment,
} = require("../../src/models/customer.model");

describe("customer routes (/customer): customers, dues, payments, advances", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let account;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "custshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    account = await f.account.create({ name: "Cash", balance: 0 });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "custshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const customerNow = (id) => inTenant(() => Customer.findById(id).lean());
  const balance = async () => (await inTenant(() => Account.findById(account._id).lean())).balance;

  describe("customers", () => {
    it("creates a customer: initialDue seeded from openingDues, server-only fields refused or ignored", async () => {
      const type = (await as().post("/customer/create-customertype").send({ customerType: "Wholesale" }).expect(201)).body.data;
      const res = await as()
        .post("/customer/create-customer")
        .send({ fullName: "Rina Akter", mobileNumber: "01811112222", customerType: type._id || type.id, openingDues: 500, advancePaymentRecived: 9999, isActive: false })
        .expect(201);
      expect(res.body.data).toBe("Rina Akter");
      const stored = await inTenant(() => Customer.findOne({ mobileNumber: "01811112222" }).lean());
      expect(stored).toMatchObject({ openingDues: 500, initialDue: 500, customerId: "01811112222", advancePaymentRecived: 0, isActive: true });
    });

    it("400 without a customer type (required by the model, optional in the schema)", async () => {
      await as().post("/customer/create-customer").send({ fullName: "No Type", mobileNumber: "01899990000" }).expect(400);
    });

    it.each([
      ["no name", { fullName: "" }],
      ["a bad mobile number", { mobileNumber: "12345" }],
      ["negative dues", { openingDues: -1 }],
      ["a client-chosen customerId", { customerId: "C-1" }],
      ["a client-chosen initialDue", { initialDue: 100 }],
      ["a discount over 100%", { regularDiscountPercent: 101 }],
    ])("400 for %s", async (_name, overrides) => {
      const res = await as().post("/customer/create-customer").send({ fullName: "Valid Name", mobileNumber: "01811112222", ...overrides });
      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 400);
    });

    it("refuses a duplicate mobile number in the same store, allows it in another store", async () => {
      await f.customer.create({ mobileNumber: "01822223333" });
      const type = (await inTenant(() => Customer.findOne().lean())).customerType.toString();
      await as().post("/customer/create-customer").send({ fullName: "Copy Cat", mobileNumber: "01822223333", customerType: type }).expect(400);
      const other = await tenantFactory.create({ slug: "custother" });
      await forTenant(other).customer.create({ mobileNumber: "01833334444" });
      await as().post("/customer/create-customer").send({ fullName: "Same Number Elsewhere", mobileNumber: "01833334444", customerType: type }).expect(201);
    });

    it("lists and searches by name or phone; the list is cached and refreshed on write", async () => {
      await f.customer.create({ fullName: "Karim Uddin", mobileNumber: "01844445555" });
      await f.customer.create({ fullName: "Rahim Mia", mobileNumber: "01855556666" });
      const byName = await as().get("/customer/get-customers").query({ q: "karim" }).expect(200);
      expect(byName.body.data.customers.map((c) => c.fullName)).toEqual(["Karim Uddin"]);
      const byPhone = await as().get("/customer/get-customers").query({ q: "0185555" }).expect(200);
      expect(byPhone.body.data.customers).toHaveLength(1);

      await as().get("/customer/get-customers").expect(200);
      expect((await as().get("/customer/get-customers").expect(200)).body.data.fromCache).toBe(true);
      const type = (await inTenant(() => Customer.findOne().lean())).customerType.toString();
      await as().post("/customer/create-customer").send({ fullName: "New One", mobileNumber: "01866667777", customerType: type }).expect(201);
      expect((await as().get("/customer/get-customers").expect(200)).body.data.customers).toHaveLength(3);
    });

    // BUG-051: the search term goes into $regex unescaped
    it("searches literally: regex characters are not interpreted [BUG-051]", async () => {
      await f.customer.create({ fullName: "Karim Uddin" });
      const res = await as().get("/customer/get-customers").query({ q: "(" });
      expect(res.status).toBe(200);
      const all = await as().get("/customer/get-customers").query({ q: ".*" }).expect(200);
      expect(all.body.data.customers).toEqual([]);
    });

    it("update cannot touch the running due; changing initialDue moves it by the difference", async () => {
      const c = await f.customer.create({ openingDues: 1000, initialDue: 1000 });
      const form = { fullName: "Renamed", mobileNumber: c.mobileNumber, customerType: c.customerType.toString() };
      await as().put(`/customer/update-customer/${c.customerId}`).send({ ...form, openingDues: 0 }).expect(200);
      expect(await customerNow(c._id)).toMatchObject({ fullName: "Renamed", openingDues: 1000 });
      await as().put(`/customer/update-customer/${c.customerId}`).send({ ...form, initialDue: 1500 }).expect(200);
      expect(await customerNow(c._id)).toMatchObject({ initialDue: 1500, openingDues: 1500 });
    });

    it("activates / deactivates / deletes; another store's customer is never touched", async () => {
      const c = await f.customer.create();
      await as().put(`/customer/deactivate-customer/${c.customerId}`).expect(200);
      expect((await customerNow(c._id)).isActive).toBe(false);
      await as().put(`/customer/deactivate-customer/${c.customerId}`).expect(404);
      await as().put(`/customer/activate-customer/${c.customerId}`).expect(200);

      const other = await tenantFactory.create({ slug: "custother2" });
      const rival = await createUserIn(other, { owner: true });
      await api(ctx.server, { token: tokenFor(rival), tenant: "custother2" }).delete(`/customer/delete-customer/${c.customerId}`).expect(404);
      expect(await customerNow(c._id)).not.toBeNull();

      await as().delete(`/customer/delete-customer/${c.customerId}`).expect(200);
      expect(await customerNow(c._id)).toBeNull();
    });
  });

  describe("due payments (/customer/customer-payment-recived)", () => {
    const pay = (customer, body) =>
      as().post("/customer/customer-payment-recived").send({ customer: customer._id.toString(), paymentMode: account._id.toString(), ...body });

    it("reduces the due by paid + less + cash back, and only the net reaches the account", async () => {
      const c = await f.customer.create({ openingDues: 1000 });
      const res = await pay(c, { paidAmount: 600, lessAmount: 50, cashBack: 20 }).expect(201);
      expect(res.body.data).toBeTruthy();
      expect((await customerNow(c._id)).openingDues).toBe(330);
      expect(await balance()).toBe(530);
      const payment = await inTenant(() => CustomerPayment.findOne({ customer: c._id }).lean());
      expect(payment).toMatchObject({ dueBeforePayment: 1000, remainingDue: 330 });
      const txn = await inTenant(() => CrateTransaction.findOne({ customerPaymentReference: payment._id }).lean());
      expect(txn).toMatchObject({ amount: 530, transactionType: "cash recived" });
    });

    it("refuses to collect more than the due (400) and changes nothing", async () => {
      const c = await f.customer.create({ openingDues: 100 });
      const res = await pay(c, { paidAmount: 101 }).expect(400);
      expect(res.body.message).toMatch(/opening due not enough/i);
      expect((await customerNow(c._id)).openingDues).toBe(100);
      expect(await balance()).toBe(0);
    });

    it("400 for negative amounts or no customer; 404 for an unknown customer or account", async () => {
      const c = await f.customer.create({ openingDues: 100 });
      await pay(c, { paidAmount: -5 }).expect(400);
      await as().post("/customer/customer-payment-recived").send({ paidAmount: 5, paymentMode: account._id.toString() }).expect(400);
      await pay({ _id: "0123456789abcdef01234567" }, { paidAmount: 5 }).expect(404);
      await pay(c, { paidAmount: 5, paymentMode: "0123456789abcdef01234567" }).expect(404);
      expect((await customerNow(c._id)).openingDues).toBe(100);
    });

    it("parallel payments never take the due below zero", async () => {
      const c = await f.customer.create({ openingDues: 300 });
      const results = await Promise.all(Array.from({ length: 6 }, () => pay(c, { paidAmount: 100 })));
      const ok = results.filter((r) => r.status === 201).length;
      expect(ok).toBeLessThanOrEqual(3);
      const due = (await customerNow(c._id)).openingDues;
      expect(due).toBe(300 - 100 * ok);
      expect(await balance()).toBe(100 * ok);
    });

    // BUG-052: deleting a payment gives the money back out of the account but
    // never puts the amount back on the customer's due
    it("deleting a payment restores the customer's due [BUG-052]", async () => {
      const c = await f.customer.create({ openingDues: 1000 });
      await pay(c, { paidAmount: 400 }).expect(201);
      const payment = await inTenant(() => CustomerPayment.findOne({ customer: c._id }).lean());
      await as().delete(`/customer/delete-customer-payment-recived/${payment._id}`).expect(200);
      expect(await balance()).toBe(0);
      expect((await customerNow(c._id)).openingDues).toBe(1000);
    });

    // BUG-053: the edit route is keyed by customer and always edits the
    // customer's first payment; a specific payment cannot be addressed
    it("edits the payment the request names, not the customer's first one [BUG-053]", async () => {
      const c = await f.customer.create({ openingDues: 1000 });
      await pay(c, { paidAmount: 100 }).expect(201);
      await pay(c, { paidAmount: 200 }).expect(201);
      const second = await inTenant(() => CustomerPayment.findOne({ customer: c._id, paidAmount: 200 }).lean());
      await as().put(`/customer/update-customer-payment-recived/${second._id}`).send({ paidAmount: 250 }).expect(200);
      const after = await inTenant(() => CustomerPayment.findById(second._id).lean());
      expect(after.paidAmount).toBe(250);
    });
  });

  describe("advance payments", () => {
    const advance = (customer, body) =>
      as().post("/customer/customer-advance-payment-recived").send({ customer: customer._id.toString(), paymentMode: account._id.toString(), ...body });

    it("records an advance: cumulative balance on the customer, net into the account", async () => {
      const c = await f.customer.create();
      await advance(c, { paidAmount: 500, advanceCashBack: 50 }).expect(201);
      await advance(c, { paidAmount: 300 }).expect(201);
      expect((await customerNow(c._id)).advancePaymentRecived).toBe(800);
      expect(await balance()).toBe(750);
      const docs = await inTenant(() => AdvancePayment.find({ customer: c._id }).sort({ createdAt: 1 }).lean());
      expect(docs.map((d) => d.balance)).toEqual([500, 800]);
    });

    it("400 for a zero advance; deleting one recomputes the balances and reverses the money", async () => {
      const c = await f.customer.create();
      await advance(c, { paidAmount: 0 }).expect(400);
      await advance(c, { paidAmount: 500 }).expect(201);
      await advance(c, { paidAmount: 300 }).expect(201);
      const first = await inTenant(() => AdvancePayment.findOne({ customer: c._id, paidAmount: 500 }).lean());
      await as().delete(`/customer/delete-customer-advance-payment-recived/${first._id}`).expect(200);
      expect((await customerNow(c._id)).advancePaymentRecived).toBe(300);
      expect(await balance()).toBe(300);
      const rest = await inTenant(() => AdvancePayment.find({ customer: c._id }).lean());
      expect(rest.map((d) => d.balance)).toEqual([300]);
      await as().delete(`/customer/delete-customer-advance-payment-recived/${first._id}`).expect(404);
    });

    // BUG-054: a sale adjusts the advance by reading the customer's FIRST
    // advance document, whose balance is only the first payment
    it("a sale can use the whole advance the customer has paid [BUG-054]", async () => {
      const c = await f.customer.create();
      await advance(c, { paidAmount: 500 }).expect(201);
      await advance(c, { paidAmount: 500 }).expect(201);
      const product = await f.product.create({ stock: 10 });
      const salesman = await f.employee.create();
      const res = await as().post("/sales/create-sales").send({
        customerType: { type: "listed", customerId: c._id.toString() },
        salesMen: salesman._id.toString(),
        searchItem: [{ productId: product._id.toString(), quantity: 1, salesRate: 800, salesStatus: "sale" }],
        payable: 800, paid: 0, customerAdvancePaymentAdjust: 800, invoiceStatus: "complete", balance: 0,
      });
      expect(res.status).toBe(201);
    });
  });

  // BUG-055: dueLimit (credit limit) is stored and reported but never enforced
  // by the API — the discount limit is re-checked server-side, this is not
  it("a sale that would take a customer over their due limit is refused [BUG-055]", async () => {
    const c = await f.customer.create({ openingDues: 900, dueLimit: 1000 });
    const product = await f.product.create({ stock: 10 });
    const salesman = await f.employee.create();
    const res = await as().post("/sales/create-sales").send({
      customerType: { type: "listed", customerId: c._id.toString() },
      salesMen: salesman._id.toString(),
      searchItem: [{ productId: product._id.toString(), quantity: 1, salesRate: 5000, salesStatus: "sale" }],
      payable: 5000, paid: 0, invoiceStatus: "complete", previousDue: 900, balance: 5900,
    });
    expect(res.status).toBe(400);
  });
});
