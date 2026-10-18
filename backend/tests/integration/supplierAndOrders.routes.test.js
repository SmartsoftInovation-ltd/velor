const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const { SupplierModel: Supplier, SupplierDuePayment } = require("../../src/models/supplier.model");
const Account = require("../../src/models/account.model");
const Order = require("../../src/models/order.model");
const Product = require("../../src/models/product.model");
const Coupon = require("../../src/models/coupon.model");

describe("suppliers (/supplier) and order lookups (/order)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "supshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
  });

  const as = () => api(ctx.server, { token: tokenFor(owner), tenant: "supshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);

  describe("suppliers", () => {
    it("creates (initialDue seeded, id = mobile), lists with dues, updates, soft-deletes and deletes", async () => {
      await as().post("/supplier/addsupplier").send({ supplierName: "Dhaka Textiles", mobile: "01712340000", openingDues: 700 }).expect(201);
      const s = await inTenant(() => Supplier.findOne({ supplierName: "Dhaka Textiles" }).lean());
      expect(s).toMatchObject({ openingDues: 700, initialDue: 700 });
      const list = await as().get("/supplier/getsuppliers").expect(200);
      expect(JSON.stringify(list.body.data)).toContain("Dhaka Textiles");

      await as().put(`/supplier/update-supplier/${s.supplierId}`).send({ supplierName: "Dhaka Textiles Ltd", mobile: "01712340000", openingDues: 0 }).expect(200);
      const after = await inTenant(() => Supplier.findById(s._id).lean());
      expect(after).toMatchObject({ supplierName: "Dhaka Textiles Ltd", openingDues: 700 });

      await as().get(`/supplier/soft-delete-supplier/${s.supplierId}`).expect(200);
      await as().delete(`/supplier/delete-supplier/${s.supplierId}`).expect(200);
      expect(await inTenant(() => Supplier.findById(s._id))).toBeNull();
    });

    it.each([
      ["no name", { supplierName: "" }],
      ["a bad mobile", { mobile: "123" }],
      ["negative dues", { openingDues: -5 }],
      ["a client-chosen initialDue", { initialDue: 5 }],
    ])("400 for %s", async (_n, o) => {
      await as().post("/supplier/addsupplier").send({ supplierName: "Valid Name", mobile: "01712340001", ...o }).expect(400);
    });

    it("due payments: list, read, edit (due and account follow the difference), deactivate, reactivate", async () => {
      const account = await f.account.create({ balance: 5000 });
      const s = await f.supplier.create({ openingDues: 1000, supplierId: "01712340002" });
      await as().post("/supplier/create-supplier-due-payment").send({ supplierId: s.supplierId, paidAmount: 300, paymentMode: account._id.toString() }).expect(201);
      const p = await inTenant(() => SupplierDuePayment.findOne().lean());
      await as().get("/supplier/get-supplier-due-payment").expect(200);
      await as().get(`/supplier/get-supplier-due-payment/${p._id}`).expect(200);

      await as().put(`/supplier/update-supplier-due-payment/${p._id}`).send({ paidAmount: 500, paymentMode: account._id.toString() }).expect(200);
      expect((await inTenant(() => Supplier.findById(s._id).lean())).openingDues).toBe(500);
      expect((await inTenant(() => Account.findById(account._id).lean())).balance).toBe(4500);

      await as().put(`/supplier/supplier-due-payment/${p._id}/deactivate`).expect(200);
      expect((await inTenant(() => SupplierDuePayment.findById(p._id).lean())).isActive).toBe(false);
      await as().put(`/supplier/supplier-due-payment/${p._id}/activate`).expect(200);
      await as().put("/supplier/supplier-due-payment/0123456789abcdef01234567/activate").expect(404);
      await as().put("/supplier/update-supplier-due-payment/0123456789abcdef01234567").send({ paidAmount: 1 }).expect(404);
    });

    it("refuses a payment to an inactive or unknown supplier", async () => {
      const account = await f.account.create();
      await as().post("/supplier/create-supplier-due-payment").send({ supplierId: "01799999999", paidAmount: 10, paymentMode: account._id.toString() }).expect(404);
    });
  });

  describe("order lookups and counters", () => {
    let product;
    beforeEach(async () => {
      product = await f.product.create({ stock: 10 });
    });
    const seed = (o = {}) =>
      inTenant(() =>
        Order.create({
          items: [{ product: product._id, quantity: 1, retailPrice: 500, totalPrice: 500 }],
          shippingInfo: { fullName: "Karim", phone: "01712345678", address: "Dhaka" },
          totalAmount: 500,
          finalAmount: 560,
          paymentMethod: "cod",
          invoiceId: `INV-${Math.random().toString(36).slice(2, 8)}`,
          ...o,
        }),
      );

    it("counts by status, amounts, today's summary, courier lists and search", async () => {
      await seed({ orderStatus: "Pending" });
      await seed({ orderStatus: "CourierPending", invoiceId: "INV-FINDME" });
      await seed({ orderStatus: "Shipped", courier: { name: "steadfast", trackingId: "T1" } });
      const counts = await as().get("/order/getorderstatus").expect(200);
      expect(JSON.stringify(counts.body.data)).toContain("CourierPending");
      await as().get("/order/getordercountandamount").expect(200);
      await as().get("/order/datewiseordersummary").expect(200);
      const pending = await as().get("/order/getallcourierpendingorder").expect(200);
      expect(JSON.stringify(pending.body.data)).toContain("INV-FINDME");
      const sent = await as().get("/order/couriersendedorders").expect(200);
      expect(JSON.stringify(sent.body.data)).toContain("T1");
      const search = await as().get("/order/getorderbyid").query({ search: "INV-FINDME" }).expect(200);
      expect(JSON.stringify(search.body.data)).toContain("INV-FINDME");
      await as().get("/order/getcourierinfo").expect(200);
      const miss = await as().get("/order/getorderbyid").query({ search: "INV-NOPE" }).expect(200);
      expect(miss.body.data).toBeNull(); // a miss is 200 with null (BUG-037 family)
    });

    it("filters by date range (today in, an old order out)", async () => {
      await seed({ invoiceId: "INV-TODAY" });
      const old = await seed({ invoiceId: "INV-OLD" });
      await inTenant(() => Order.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date("2020-01-01") } }));
      const start = new Date(Date.now() - 864e5).toISOString();
      const end = new Date(Date.now() + 864e5).toISOString();
      const res = await as().get("/order/filterorderbydate").query({ startDate: start, endDate: end }).expect(200);
      expect(JSON.stringify(res.body.data)).toContain("INV-TODAY");
      expect(JSON.stringify(res.body.data)).not.toContain("INV-OLD");
    });

    it("deleting an order restocks it and gives the coupon use back", async () => {
      const coupon = await f.coupon.create({ code: "BACK1", usedCount: 1, usageLimit: 5 });
      const order = await seed({ coupon: coupon._id });
      await as().delete(`/order/delete-Order/${order._id}`).expect(200);
      expect((await inTenant(() => Product.findById(product._id).lean())).stock).toBe(11);
      expect((await inTenant(() => Coupon.findById(coupon._id).lean())).usedCount).toBe(0);
      await as().delete(`/order/order-delete/${order._id}`).expect(404);
    });
  });
});
