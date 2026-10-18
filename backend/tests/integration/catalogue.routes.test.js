const { useIntegrationApp } = require("../setup/integration");
const { api, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { PNG, tempUploadTracker, enableCloudinary } = require("../helpers/uploads");
const { runForTenant } = require("../../src/tenancy/context");
const Category = require("../../src/models/category.model");
const Subcategory = require("../../src/models/subcategory.model");
const Brand = require("../../src/models/brand.model");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");
const Discount = require("../../src/models/discount.model");

describe("catalogue routes: categories, subcategories, brands, discounts", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "catshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "catshop" });
  const visitor = () => api(ctx.server, { tenant: "catshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);

  describe("categories", () => {
    it("creates (slug derived), lists publicly, reads by slug, renames, deletes", async () => {
      await as().post("/categories").send({ name: "Men's Wear" }).expect(201);
      const all = await visitor().get("/categories").expect(200);
      expect(JSON.stringify(all.body.data)).toContain("mens-wear");
      await visitor().get("/categories/mens-wear").expect(200);
      await as().put("/categories/mens-wear").send({ name: "Menswear" }).expect(200);
      expect(await inTenant(() => Category.countDocuments({ name: "Menswear" }))).toBe(1);
      await as().delete(`/categories/${(await inTenant(() => Category.findOne().lean())).slug}`).expect(200);
      expect(await inTenant(() => Category.countDocuments())).toBe(0);
    });

    it("400 for a duplicate name in the store; the same name is fine in another store", async () => {
      await as().post("/categories").send({ name: "Shoes" }).expect(201);
      const dup = await as().post("/categories").send({ name: "shoes" }).expect(400);
      expectErrorEnvelope(dup.body, 400);
      await forTenant(await tenantFactory.create()).category.create({ name: "Bags" });
      await as().post("/categories").send({ name: "Bags" }).expect(201);
    });

    it("deactivated categories leave the active list and appear in the inactive one", async () => {
      await as().post("/categories").send({ name: "Seasonal" }).expect(201);
      await visitor().get("/categories-active").expect(200);
      await as().put("/categories/seasonal/deactivate").expect(200);
      const active = await visitor().get("/categories-active").expect(200);
      expect(JSON.stringify(active.body.data)).not.toContain("seasonal");
      const inactive = await as().get("/categories-inactive").expect(200);
      expect(JSON.stringify(inactive.body.data)).toContain("seasonal");
      await as().put("/categories/seasonal/activate").expect(200);
      expect(JSON.stringify((await visitor().get("/categories-active").expect(200)).body.data)).toContain("seasonal");
    });

    it("searches (400 without a term), sorts and paginates", async () => {
      for (const name of ["Alpha Cat", "Beta Cat", "Gamma Cat"]) await as().post("/categories").send({ name }).expect(201);
      await visitor().get("/categories-search").expect(400);
      const hit = await visitor().get("/categories-search").query({ search: "beta" }).expect(200);
      expect(JSON.stringify(hit.body.data)).toContain("Beta Cat");
      expect(JSON.stringify(hit.body.data)).not.toContain("Alpha Cat");
      await visitor().get("/categories-sort").query({ sort: "name" }).expect(200);
      const page = await as().get("/category-pagination").query({ page: 1, limit: 2 }).expect(200);
      expect(JSON.stringify(page.body.data)).toMatch(/Cat/);
    });

    // BUG-037 (same family): activating an unknown category answers 200 "not found"
    test.failing("activating an unknown category answers 404 [BUG-037]", async () => {
      await as().put("/categories/nope/activate").expect(404);
    });

    it("404 when deleting another store's category", async () => {
      await forTenant(await tenantFactory.create({ slug: "othercats" })).category.create({ name: "Foreign Cat" });
      await as().delete("/categories/foreign-cat").expect(404);
    });
  });

  describe("subcategories and brands", () => {
    it("subcategory: needs a category; lists, searches, deactivates", async () => {
      const cat = await f.category.create({ name: "Parent" });
      await as().post("/subcategories").send({ name: "No Parent" }).expect(400);
      await as().post("/subcategories").send({ name: "Polo Shirts", category: cat._id.toString() }).expect(201);
      const list = await visitor().get("/subcategories").expect(200);
      expect(JSON.stringify(list.body.data)).toContain("Polo Shirts");
      await visitor().get("/subcategories/search").query({ search: "polo" }).expect(200);
      await as().put("/subcategories/polo-shirts/deactive").expect(200);
      const active = await visitor().get("/subcategories-active").expect(200);
      expect(JSON.stringify(active.body.data)).not.toContain("Polo Shirts");
      await as().delete("/subcategories/polo-shirts").expect(200);
      expect(await inTenant(() => Subcategory.countDocuments())).toBe(0);
    });

    it("brand: needs an image; creates, rejects duplicates, deactivates, searches, deletes", async () => {
      const uploads = tempUploadTracker();
      uploads.snapshot();
      try {
        await enableCloudinary(tenant);
        await as().post("/brand").send({ name: "No Logo" }).expect(400);
        await as().post("/brand").field("name", "Acme Wear").attach("image", PNG, "logo.png").expect(201);
        await as().post("/brand").field("name", "Acme Wear").attach("image", PNG, "logo.png").expect(400);
      } finally {
        uploads.cleanup();
      }
      await as().put("/brand/acme-wear/deactivate").expect(200);
      expect((await inTenant(() => Brand.findOne({ slug: "acme-wear" }).lean())).isActive).toBe(false);
      await as().put("/brand/acme-wear/activate").expect(200);
      const found = await visitor().get("/brand/search").query({ q: "acme" }).expect(200);
      expect(JSON.stringify(found.body.data)).toContain("Acme Wear");
      await as().delete("/brand/acme-wear").expect(200);
      await as().delete("/brand/acme-wear").expect(404);
    });
  });

  describe("discounts", () => {
    const discountBody = (overrides = {}) => ({
      discountName: `Eid ${Math.random().toString(36).slice(2, 6)}`,
      discountValidFrom: new Date(Date.now() - 864e5).toISOString(),
      discountValidTo: new Date(Date.now() + 864e5).toISOString(),
      discountType: "percentance",
      discountValueByPercentance: 10,
      discountPlan: "flat",
      ...overrides,
    });

    it("a flat discount reaches every product and variant of this store — and no other store's", async () => {
      const product = await f.product.create();
      const variant = await f.variant.create({ product: product._id });
      const other = await tenantFactory.create();
      const foreign = await forTenant(other).product.create();

      const res = await as().post("/discount").send(discountBody()).expect(201);
      const id = res.body.data._id;
      expect(String((await inTenant(() => Product.findById(product._id).lean())).discount)).toBe(id);
      expect(String((await inTenant(() => Variant.findById(variant._id).lean())).discount)).toBe(id);
      expect((await runForTenant(other._id, () => Product.findById(foreign._id).lean())).discount).toBeNull();
    });

    it("a category discount reaches the category, its subcategories and their products only", async () => {
      const cat = await f.category.create();
      const sub = await inTenant(() => Subcategory.create({ name: "Sub One", category: cat._id }));
      const inCat = await f.product.create({ category: cat._id });
      const inSub = await f.product.create({ subcategory: sub._id });
      const outside = await f.product.create();
      const id = (await as().post("/discount").send(discountBody({ discountPlan: "category", category: cat._id.toString() })).expect(201)).body.data._id;
      const ids = async (p) => String((await inTenant(() => Product.findById(p._id).lean())).discount);
      expect(await ids(inCat)).toBe(id);
      expect(await ids(inSub)).toBe(id);
      expect(await ids(outside)).toBe("null");
      expect(String((await inTenant(() => Category.findById(cat._id).lean())).discount)).toBe(id);
    });

    it("400 when the plan needs a target that is missing, or the type is unknown", async () => {
      await as().post("/discount").send(discountBody({ discountPlan: "product" })).expect(400);
      await as().post("/discount").send(discountBody({ discountType: "bogus" })).expect(400);
      await as().post("/discount").send(discountBody({ discountName: "" })).expect(400);
      expect(await inTenant(() => Discount.countDocuments())).toBe(0);
    });

    it("re-targeting a discount moves it; deleting clears every reference", async () => {
      const a = await f.product.create();
      const b = await f.product.create();
      const created = (await as().post("/discount").send(discountBody({ discountPlan: "product", product: a._id.toString() })).expect(201)).body.data;
      await as().put(`/discount/${created.slug}`).send({ product: b._id.toString() }).expect(200);
      expect((await inTenant(() => Product.findById(a._id).lean())).discount).toBeNull();
      expect(String((await inTenant(() => Product.findById(b._id).lean())).discount)).toBe(created._id);
      await as().delete(`/discount/${created.slug}`).expect(200);
      expect((await inTenant(() => Product.findById(b._id).lean())).discount).toBeNull();
      await as().get(`/discount/${created.slug}`).expect(404);
    });

    it("lists, paginates, deactivates and reactivates", async () => {
      const created = (await as().post("/discount").send(discountBody()).expect(201)).body.data;
      await as().get("/discount").expect(200);
      await as().get("/discountpagination").query({ page: 1, limit: 5 }).expect(200);
      await as().post("/discount/deactive").query({ slug: created.slug }).send({ slug: created.slug }).expect(200);
      expect((await inTenant(() => Discount.findById(created._id).lean())).isActive).toBe(false);
      await as().post("/discount/active").query({ slug: created.slug }).send({ slug: created.slug }).expect(200);
      expect((await inTenant(() => Discount.findById(created._id).lean())).isActive).toBe(true);
    });
  });
});
