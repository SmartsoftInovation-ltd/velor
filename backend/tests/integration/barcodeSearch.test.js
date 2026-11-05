const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const StockAdjust = require("../../src/models/stockadjust.model");

/**
 * Every barcode search box in the dashboard goes through one of these routes.
 * A barcode's length or shape never decides whether it is found.
 */
const CODES = ["54868", "548681", "12345678", "8801234567890", "1234567890123456789012345"];

describe("barcode search finds an item whatever its barcode looks like", () => {
  const ctx = useIntegrationApp({ clearAfterEach: false });
  let as;
  let product;

  beforeAll(async () => {
    const tenant = await tenantFactory.create({ slug: "scanshop" });
    const f = forTenant(tenant);
    const owner = await createUserIn(tenant, { owner: true });
    as = () => api(ctx.server, { token: tokenFor(owner), tenant: "scanshop" });

    product = await f.product.create({ name: "Polo Shirt", variantType: "multipleVariant" });
    let n = 0;
    for (const barCode of CODES) {
      n += 1;
      const variant = await f.variant.create({
        product: product._id,
        variantName: `Polo ${n}`,
        barCode,
        sku: `9900${n}`,
        size: "L",
        color: "Red",
        stockVariant: 1,
        alertQuantity: 5,
      });
      await runForTenant(tenant._id, () =>
        StockAdjust.create({ variantId: variant._id, productId: product._id, adjustReason: "count", increaseQuantity: 1, date: new Date() }),
      );
    }
  });

  // Reports echo the search under `filters`, which must not count as a result
  const found = (res, text) => {
    const { filters: _echoed, ...results } = res.body.data ?? {};
    return JSON.stringify(Array.isArray(res.body.data) ? res.body.data : results).includes(text);
  };

  const ROUTES = [
    ["GET /product/search-product (name, barCode, sku)", (code) => as().get("/product/search-product").query({ name: code, barCode: code, sku: code })],
    ["GET /product/search-product (barCode)", (code) => as().get("/product/search-product").query({ barCode: code })],
    ["GET /sales/get-sales-products", (code) => as().get("/sales/get-sales-products").query({ q: code })],
    ["GET /sales/get-sales-products (picker)", (code) => as().get("/sales/get-sales-products").query({ q: code, page: 1, limit: 20 })],
    ["GET /product/getproduct (a variant's barcode finds its product)", (code) => as().get("/product/getproduct").query({ search: code, limit: 50 }), "Polo Shirt"],
    ["GET /variant", (code) => as().get("/variant").query({ search: code, limit: 50 })],
    ["GET /stock/stock-adjust", (code) => as().get("/stock/stock-adjust").query({ q: code })],
    ["POST /report/stock", (code) => as().post("/report/stock").send({ search: code })],
    ["POST /report/stock-details", (code) => as().post("/report/stock-details").send({ search: code })],
    ["POST /report/size-color-stock", (code) => as().post("/report/size-color-stock").send({ search: code }), "Polo Shirt"],
    ["POST /report/stock-adjustment", (code) => as().post("/report/stock-adjustment").send({ search: code })],
    ["POST /report/low-stock", (code) => as().post("/report/low-stock").send({ search: code })],
    ["POST /stock/low-stock", (code) => as().post("/stock/low-stock").send({ search: code })],
    ["GET /report/ledger-items", (code) => as().get("/report/ledger-items").query({ search: code })],
  ];

  describe.each(ROUTES)("%s", (_name, request, expected) => {
    it("shows nothing for a barcode no item has", async () => {
      const res = await request("00000000");
      expect(found(res, "Polo")).toBe(false);
    });

    it.each(CODES)("finds the full barcode %s", async (code) => {
      const res = await request(code);
      expect(res.status).toBe(200);
      expect(found(res, expected ?? code)).toBe(true);
    });
  });

  // Reports and stock pages list what starts with what was typed so far. The sale
  // forms do not: a scan with no exact match must never pick a similar item.
  const TYPED_SO_FAR = ROUTES.filter(([name]) => !name.includes("get-sales-products"));

  describe.each(TYPED_SO_FAR)("%s, part typed", (_name, request, expected) => {
    it("finds a long barcode from its first digits", async () => {
      const res = await request("88012345");
      expect(res.status).toBe(200);
      expect(found(res, expected ?? "8801234567890")).toBe(true);
    });
  });
});
