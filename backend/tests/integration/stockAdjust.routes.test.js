const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { eventually } = require("../helpers/wait");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const StockAdjust = require("../../src/models/stockadjust.model");

describe("stock adjustment routes (/api/v1/stock)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;
  let product;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "stockshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    product = await f.product.create({ stock: 10 });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "stockshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const productNow = () => inTenant(() => Product.findById(product._id).lean());
  const adjust = (body) => as().post("/stock/stock-adjust").send({ productId: product._id.toString(), adjustReason: "Count", increaseQuantity: 0, decreaseQuantity: 0, ...body });

  describe("POST /stock/stock-adjust", () => {
    it("201: increases or decreases stock and keeps the adjustment totals", async () => {
      const res = await adjust({ increaseQuantity: 5 }).expect(201);
      expectSuccessEnvelope(res.body);
      await adjust({ decreaseQuantity: 3 }).expect(201);
      const p = await productNow();
      expect(p).toMatchObject({ stock: 12, stockAdjustmentPlus: 5, stockAdjustmentMinus: 3 });
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(2);
    });

    it("adjusts a variant's stock", async () => {
      const variant = await f.variant.create({ product: product._id, stockVariant: 4 });
      await as().post("/stock/stock-adjust").send({ variantId: variant._id.toString(), adjustReason: "Found", increaseQuantity: 2, decreaseQuantity: 0 }).expect(201);
      expect((await inTenant(() => Variant.findById(variant._id).lean())).stockVariant).toBe(6);
    });

    it("queues an audit event for the adjustment", async () => {
      const { auditQueue } = require("../../src/queues/audit.queue");
      await adjust({ increaseQuantity: 1, adjustReason: "Audit me" }).expect(201);
      await eventually(async () => {
        const jobs = await auditQueue.getJobs(["waiting", "delayed", "active", "completed"]);
        const job = jobs.find((j) => j.data.entity?.label === "Audit me");
        expect(job.data).toMatchObject({ action: "STOCK_ADJUST", tenantId: tenant._id.toString(), entity: { type: "stockadjust" } });
        expect(job.data.user.id).toBe(owner._id.toString());
      });
    });

    it("400 for a non-numeric quantity, nothing recorded", async () => {
      await adjust({ increaseQuantity: "lots" }).expect(400);
      expect((await productNow()).stock).toBe(10);
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(0);
    });

    it("400 without a product/variant or without a reason", async () => {
      await as().post("/stock/stock-adjust").send({ adjustReason: "x", increaseQuantity: 1 }).expect(400);
      await adjust({ adjustReason: "" }).expect(400);
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(0);
    });

    // BUG-031: the adjustment row is written before the product is checked
    // (no transaction), so failures leave an adjustment that was never applied
    it("leaves no adjustment record behind when the product does not exist [BUG-031]", async () => {
      await adjust({ productId: "0123456789abcdef01234567", increaseQuantity: 1 }).expect(404);
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(0);
    });

    it("refuses a decrease below zero without recording it [BUG-031]", async () => {
      const res = await adjust({ decreaseQuantity: 50 });
      expect(res.status).toBe(400);
      expect((await productNow()).stock).toBe(10);
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(0);
    });

    it("treats a missing quantity as 0 (only increaseQuantity sent)", async () => {
      await adjust({ increaseQuantity: 2, decreaseQuantity: undefined }).expect(201);
      expect((await productNow()).stock).toBe(12);
    });

    // BUG-032: quantities are not validated — a negative increase silently decreases
    it("validates the quantities: a negative increase [BUG-032]", async () => {
      const res = await adjust({ increaseQuantity: -4 });
      expect(res.status).toBe(400);
      expect((await productNow()).stock).toBe(10);
      expect(await inTenant(() => StockAdjust.countDocuments())).toBe(0);
    });

    // BUG-033: read-modify-write (findById, +=, save) — parallel adjustments lose updates
    it("20 parallel +1 adjustments add 20 [BUG-033]", async () => {
      const results = await Promise.all(Array.from({ length: 20 }, () => adjust({ increaseQuantity: 1 })));
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect((await productNow()).stock).toBe(30);
    });
  });

  describe("GET /stock/stock-adjust (list, search, pagination)", () => {
    it("paginates newest first and searches by product name or barcode", async () => {
      await adjust({ increaseQuantity: 1, adjustReason: "first" }).expect(201);
      await adjust({ increaseQuantity: 1, adjustReason: "second" }).expect(201);
      await adjust({ increaseQuantity: 1, adjustReason: "third" }).expect(201);
      const page1 = await as().get("/stock/stock-adjust").query({ page: 1, limit: 2 }).expect(200);
      expect(page1.body.data).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
      expect(page1.body.data.stockAdjusts).toHaveLength(2);
      const page2 = await as().get("/stock/stock-adjust").query({ page: 2, limit: 2 }).expect(200);
      expect(page2.body.data.stockAdjusts).toHaveLength(1);

      const byBarcode = await as().get("/stock/stock-adjust").query({ q: product.barCode }).expect(200);
      expect(byBarcode.body.data.total).toBe(3);
      const none = await as().get("/stock/stock-adjust").query({ q: "no-such-thing" }).expect(200);
      expect(none.body.data.total).toBe(0);
      const regex = await as().get("/stock/stock-adjust").query({ q: ".*" }).expect(200);
      expect(regex.body.data.total).toBe(0);
    });

    it("clamps limit to 1..100 and page to >= 1", async () => {
      const res = await as().get("/stock/stock-adjust").query({ page: -1, limit: 1000 }).expect(200);
      expect(res.body.data).toMatchObject({ page: 1, limit: 100 });
    });

    it("serves the list from cache until the next adjustment", async () => {
      await adjust({ increaseQuantity: 1 }).expect(201);
      await as().get("/stock/stock-adjust").expect(200);
      expect((await as().get("/stock/stock-adjust").expect(200)).body.data.fromCache).toBe(true);
      await adjust({ increaseQuantity: 1 }).expect(201);
      const fresh = await as().get("/stock/stock-adjust").expect(200);
      expect(fresh.body.data.fromCache).toBe(false);
      expect(fresh.body.data.total).toBe(2);
    });
  });

  describe("GET/PUT/DELETE /stock/stock-adjust/:id", () => {
    it("reads one, edits it (stock moves by the difference) and deletes it (stock restored)", async () => {
      const created = (await adjust({ increaseQuantity: 5 }).expect(201)).body.data;
      const one = await as().get(`/stock/stock-adjust/${created._id}`).expect(200);
      expect(one.body.data.stockAdjust._id).toBe(created._id);

      await as().put(`/stock/stock-adjust/${created._id}`).send({ increaseQuantity: 8 }).expect(200);
      expect((await productNow()).stock).toBe(18);
      expect((await productNow()).stockAdjustmentPlus).toBe(8);

      await as().delete(`/stock/deletestockadjust/${created._id}`).expect(200);
      const p = await productNow();
      expect(p.stock).toBe(10);
      expect(p.stockAdjustmentPlus).toBe(0);
      await as().delete(`/stock/deletestockadjust/${created._id}`).expect(404);
      await as().get(`/stock/stock-adjust/${created._id}`).expect(404);
    });

    it("never lets another store read or delete the adjustment", async () => {
      const created = (await adjust({ increaseQuantity: 5 }).expect(201)).body.data;
      const other = await tenantFactory.create({ slug: "otherstock" });
      const otherOwner = await createUserIn(other, { owner: true });
      const foreign = api(ctx.server, { token: tokenFor(otherOwner), tenant: "otherstock" });
      await foreign.get(`/stock/stock-adjust/${created._id}`).expect(404);
      await foreign.delete(`/stock/deletestockadjust/${created._id}`).expect(404);
      await foreign.put(`/stock/stock-adjust/${created._id}`).send({ increaseQuantity: 100 }).expect(404);
      expect((await productNow()).stock).toBe(15);
    });
  });

  describe("catalogue lookups", () => {
    it("lists products of a category, and of a subcategory (404 when none)", async () => {
      const res = await as().get(`/stock/stock-adjust/category/${product.category}`).expect(200);
      expect(res.body.data.map((p) => p._id)).toEqual([product._id.toString()]);
      await as().get("/stock/stock-adjust/subcategory/0123456789abcdef01234567").expect(404);
    });

    it("lists variants and single-variant products together", async () => {
      await f.variant.create({ product: product._id });
      const res = await as().get("/stock/getallmultiplevariant").expect(200);
      expect(res.body.data).toMatchObject({ total: 2 });
      expect(res.body.data.variants).toHaveLength(1);
      expect(res.body.data.singleProducts).toHaveLength(1);
    });
  });
});
