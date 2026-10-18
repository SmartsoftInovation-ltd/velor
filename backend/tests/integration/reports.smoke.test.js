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

  it("a report shows this store's own data (sanity check that the seed reached the reports)", async () => {
    const res = await api(ctx.server, { token, tenant: "reportshop" }).post("/report/invoice-profit").send(BODIES["this year"]).expect(200);
    expect(JSON.stringify(res.body)).toContain("INV-INV-01");
  });
});
