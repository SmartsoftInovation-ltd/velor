const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { PNG, tempUploadTracker, enableCloudinary } = require("../helpers/uploads");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");

const COST_FIELDS = /"(purchasePrice|retailProfitMarginByAmount|wholesaleProfitMarginByAmount)":/;

describe("product and variant routes", () => {
  const ctx = useIntegrationApp();
  const uploads = tempUploadTracker();
  let tenant;
  let f;
  let owner;
  let category;

  beforeEach(async () => {
    uploads.snapshot();
    tenant = await tenantFactory.create({ slug: "catalog" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
    category = await f.category.create({ name: "Shirts" });
  });
  afterEach(() => uploads.cleanup());

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "catalog" });
  const anonymous = () => api(ctx.server, { tenant: "catalog" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);

  const multipartProduct = (req, fields = {}) => {
    const body = {
      name: "Oxford Shirt",
      category: category._id.toString(),
      variantType: "singleVariant",
      sku: "OX-1",
      barCode: "1000001",
      purchasePrice: "400",
      retailPrice: "900",
      color: "Blue",
      unit: "Piece",
      stock: "12",
      ...fields,
    };
    for (const [k, v] of Object.entries(body)) if (v !== undefined) req = req.field(k, v);
    return req.attach("thumbnail", PNG, "thumb.png").attach("image", PNG, "gallery.png");
  };

  // ------------------------------------------------------------------ create
  describe("POST /product/createproduct", () => {
    it("201: saves the product with pending images and queues one upload per file", async () => {
      await enableCloudinary(tenant);
      const res = await multipartProduct(as().post("/product/createproduct")).expect(201);
      expectSuccessEnvelope(res.body);
      expect(res.body.data).toMatchObject({ slug: "oxford-shirt", name: "Oxford Shirt" });

      const saved = await inTenant(() => Product.findOne({ slug: "oxford-shirt" }).lean());
      expect(saved).toMatchObject({ stock: 12, initialStock: 12, purchasePrice: 400, retailPrice: 900, isActive: true });
      expect(saved.thumbnail.status).toBe("pending");
      expect(saved.image).toHaveLength(1);

      const { imageQueue } = require("../../src/queues/image.queue");
      const jobs = await imageQueue.getJobs(["waiting"]);
      const mine = jobs.filter((j) => String(j.data.documentId) === saved._id.toString());
      expect(mine.map((j) => j.name).sort()).toEqual(["create-product-image", "create-product-thumbnail"]);
      expect(mine.every((j) => j.data.tenantId === tenant._id.toString())).toBe(true);
      expect(uploads.created()).toHaveLength(2); // kept on disk for the worker
    });

    it("422 CLOUDINARY_NOT_CONFIGURED when the store has no image storage, and deletes the uploaded files", async () => {
      const res = await multipartProduct(as().post("/product/createproduct")).expect(422);
      expect(res.body.code).toBe("CLOUDINARY_NOT_CONFIGURED");
      expect(uploads.created()).toEqual([]);
      expect(await inTenant(() => Product.countDocuments())).toBe(0);
    });

    it("strips protected fields sent with the product (posSold, totalSales, tenantId)", async () => {
      await enableCloudinary(tenant);
      const other = await tenantFactory.create();
      await multipartProduct(as().post("/product/createproduct"), { posSold: "999", totalSales: "50", tenantId: other._id.toString(), salesReturnStock: "7" }).expect(201);
      const saved = await inTenant(() => Product.findOne({ slug: "oxford-shirt" }).lean());
      expect(saved).toMatchObject({ posSold: 0, totalSales: 0, salesReturnStock: 0 });
      expect(saved.tenantId.equals(tenant._id)).toBe(true);
    });

    it("400 for a duplicate name, SKU or barcode", async () => {
      await enableCloudinary(tenant);
      await multipartProduct(as().post("/product/createproduct")).expect(201);
      const dupName = await multipartProduct(as().post("/product/createproduct"), { sku: "OX-2", barCode: "1000002" }).expect(400);
      expect(dupName.body.message).toMatch(/already exists/);
      await multipartProduct(as().post("/product/createproduct"), { name: "Other", barCode: "1000003" }).expect(400);
      await multipartProduct(as().post("/product/createproduct"), { name: "Other", sku: "OX-3" }).expect(400);
    });

    it("400 for a single-variant product without a thumbnail", async () => {
      await enableCloudinary(tenant);
      let req = as().post("/product/createproduct");
      for (const [k, v] of Object.entries({ name: "No Pic", category: category._id.toString(), variantType: "singleVariant", sku: "NP", barCode: "1", purchasePrice: "1", retailPrice: "2", color: "x", unit: "Piece" })) req = req.field(k, v);
      const res = await req.expect(400);
      expect(res.body.message).toMatch(/thumbnail is required/i);
    });

    // BUG-034: multer's file-type rejection (statusCode 400) is rewrapped as a
    // customError with status 500 by the upload wrappers
    it("400 for a non-image upload [BUG-034]", async () => {
      await enableCloudinary(tenant);
      const res = await as().post("/product/createproduct").field("name", "X").attach("thumbnail", Buffer.from("GIF89a"), "anim.gif");
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  // ------------------------------------------------------------------ read / leakage
  describe("catalogue reads", () => {
    let product;
    beforeEach(async () => {
      product = await f.product.create({ name: "Linen Shirt", category: category._id, purchasePrice: 400, retailPrice: 900, totalSales: 3, isActive: true });
    });

    it("GET /product/getproduct: staff see the cost price, anonymous visitors do not", async () => {
      const staff = await as().get("/product/getproduct").expect(200);
      expect(staff.body.data.products[0].purchasePrice).toBe(400);
      const visitor = await anonymous().get("/product/getproduct").expect(200);
      expect(visitor.body.data.products[0].purchasePrice).toBeUndefined();
      expect(visitor.body.data.products[0].retailPrice).toBe(900);
    });

    it("GET /product/getproduct/:slug gives anonymous visitors no cost figure", async () => {
      const visitor = await anonymous().get(`/product/getproduct/${product.slug}`).expect(200);
      expect(JSON.stringify(visitor.body)).not.toMatch(COST_FIELDS);
    });

    // BUG-035: these public endpoints return the raw documents, cost price included
    it.each([
      ["GET", "/product/newarrival", undefined],
      ["GET", "/product/price-range?minPrice=0&maxPrice=5000", undefined],
      ["POST", "/product/related-products", "category"],
      ["GET", "/product/best-selling-products", undefined],
      ["GET", "/product/search-product?name=Linen", undefined],
    ])("%s %s does not expose the cost price to anonymous visitors [BUG-035]", async (method, url, bodyKey) => {
      let req = anonymous().request(method, url);
      if (bodyKey) req = req.send({ category: category._id.toString() });
      const res = await req.expect(200);
      expect(JSON.stringify(res.body)).toContain("Linen Shirt");
      expect(JSON.stringify(res.body)).not.toMatch(COST_FIELDS);
    });

    // BUG-036: deactivated products stay in the storefront's main listing
    it("GET /product/getproduct hides deactivated products from anonymous visitors [BUG-036]", async () => {
      await as().put(`/product/product-status/${product.slug}`).send({ isActive: false }).expect(200);
      const visitor = await anonymous().get("/product/getproduct").expect(200);
      expect(visitor.body.data.products).toEqual([]);
    });

    it("GET /product/getproduct filters by category and price, caches, and the cache is shared safely between audiences", async () => {
      await f.product.create({ name: "Cheap Sock", retailPrice: 50 });
      const byCat = await anonymous().get("/product/getproduct").query({ category: category._id.toString() }).expect(200);
      expect(byCat.body.data.products.map((p) => p.name)).toEqual(["Linen Shirt"]);
      const byPrice = await anonymous().get("/product/getproduct").query({ minPrice: 100, maxPrice: 1000 }).expect(200);
      expect(byPrice.body.data.products.map((p) => p.name)).toEqual(["Linen Shirt"]);

      // Staff warm the cache; a visitor then reads the same key and still gets stripped data
      await as().get("/product/getproduct").query({ category: category._id.toString() }).expect(200);
      const cached = await anonymous().get("/product/getproduct").query({ category: category._id.toString() }).expect(200);
      expect(cached.body.data.fromCache).toBe(true);
      expect(cached.body.data.products[0].purchasePrice).toBeUndefined();
    });

    // BUG-037: a missing product is answered 200 with `product: null`
    it("GET /product/getproduct/:slug answers 404 for an unknown slug [BUG-037]", async () => {
      await anonymous().get("/product/getproduct/no-such-product").expect(404);
    });

    it("GET /product/price-range validates the range", async () => {
      await anonymous().get("/product/price-range").query({ minPrice: "x", maxPrice: 10 }).expect(400);
      await anonymous().get("/product/price-range").query({ minPrice: 100, maxPrice: 10 }).expect(400);
    });

    it("POST /product/related-products needs a category and 404s when there is nothing related", async () => {
      await anonymous().post("/product/related-products").send({}).expect(400);
      const empty = await f.category.create();
      await anonymous().post("/product/related-products").send({ category: empty._id.toString() }).expect(404);
    });

    it("GET /product/search-product needs a term and searches literally", async () => {
      await anonymous().get("/product/search-product").expect(400);
      const hit = await anonymous().get("/product/search-product").query({ name: "linen" }).expect(200);
      expect(JSON.stringify(hit.body.data)).toContain("Linen Shirt");
      const regex = await anonymous().get("/product/search-product").query({ name: ".*" }).expect(200);
      expect(JSON.stringify(regex.body.data)).not.toContain("Linen Shirt");
    });

    it("GET /product/productperpage paginates for staff", async () => {
      await f.product.createList(3);
      const page = await as().get("/product/productperpage").query({ page: 2, limit: 3 }).expect(200);
      expect(page.body.data).toMatchObject({ page: 2, limit: 3, total: 4, totalPages: 2 });
      expect(page.body.data.products).toHaveLength(1);
      const empty = await as().get("/product/productperpage").query({ page: 9, limit: 3 }).expect(200);
      expect(empty.body.data.products).toEqual([]);
    });

    it("never shows another store's products", async () => {
      const other = await tenantFactory.create({ slug: "rival" });
      await forTenant(other).product.create({ name: "Rival Product" });
      const res = await anonymous().get("/product/getproduct").expect(200);
      expect(res.body.data.products.map((p) => p.name)).toEqual(["Linen Shirt"]);
      const slug = await api(ctx.server, { tenant: "rival" }).get("/product/getproduct").expect(200);
      expect(slug.body.data.products.map((p) => p.name)).toEqual(["Rival Product"]);
    });
  });

  // ------------------------------------------------------------------ update / status / delete
  describe("product writes", () => {
    let product;
    beforeEach(async () => {
      product = await f.product.create({ name: "Denim Jacket", category: category._id, stock: 5 });
    });

    it("PUT /product/updateproductinfo/:slug updates fields; the slug (the product's URL) stays stable", async () => {
      await as().put(`/product/updateproductinfo/${product.slug}`).send({ name: "Denim Jacket Pro", retailPrice: 1500 }).expect(200);
      const saved = await inTenant(() => Product.findById(product._id).lean());
      expect(saved).toMatchObject({ name: "Denim Jacket Pro", slug: "denim-jacket", retailPrice: 1500 });
      await as().put("/product/updateproductinfo/no-such-slug").send({ retailPrice: 1 }).expect(404);
    });

    it("PUT /product/product-status/:slug toggles isActive; bad value 400; unknown 404; bumps the cache", async () => {
      await anonymous().get("/product/newarrival").expect(200); // warm
      await as().put(`/product/product-status/${product.slug}`).send({ isActive: false }).expect(200);
      expect((await inTenant(() => Product.findById(product._id).lean())).isActive).toBe(false);
      const fresh = await anonymous().get("/product/newarrival").expect(200);
      expect(fresh.body.data.products).toEqual([]);
      await as().put(`/product/product-status/${product.slug}`).send({ isActive: "maybe" }).expect(400);
      await as().put("/product/product-status/nope").send({ isActive: true }).expect(404);
    });

    it("PUT /product/product-status/:slug cannot touch another store's product", async () => {
      const other = await tenantFactory.create({ slug: "rival2" });
      const rivalOwner = await createUserIn(other, { owner: true });
      await api(ctx.server, { token: tokenFor(rivalOwner), tenant: "rival2" }).put(`/product/product-status/${product.slug}`).send({ isActive: false }).expect(404);
      expect((await inTenant(() => Product.findById(product._id).lean())).isActive).toBe(true);
    });

    it("DELETE /product/deleteproduct/:slug removes it", async () => {
      await as().delete(`/product/deleteproduct/${product.slug}`).expect(200);
      expect(await inTenant(() => Product.findById(product._id))).toBeNull();
    });

    // BUG-038: deleting a product leaves its variants behind, still sellable
    it("DELETE /product/deleteproduct/:slug also removes its variants [BUG-038]", async () => {
      const variant = await f.variant.create({ product: product._id });
      await inTenant(() => Product.updateOne({ _id: product._id }, { $push: { variant: variant._id } }));
      await as().delete(`/product/deleteproduct/${product.slug}`).expect(200);
      expect(await inTenant(() => Variant.findById(variant._id))).toBeNull();
    });

    it("POST /product/addproductimage/:slug queues the images; DELETE /deleteproductimage/:slug needs a known publicId", async () => {
      await enableCloudinary(tenant);
      await as().post(`/product/addproductimage/${product.slug}`).attach("image", PNG, "a.png").attach("image", PNG, "b.png").expect(200);
      expect((await inTenant(() => Product.findById(product._id).lean())).image).toHaveLength(2);
      await as().delete(`/product/deleteproductimage/${product.slug}`).send({}).expect(400);
      await as().delete(`/product/deleteproductimage/${product.slug}`).send({ publicId: "nope" }).expect(404);
      await inTenant(() => Product.updateOne({ _id: product._id }, { $set: { "image.0.publicId": "cloud/abc" } }));
      await as().delete(`/product/deleteproductimage/${product.slug}`).send({ publicId: "cloud/abc" }).expect(200);
      expect((await inTenant(() => Product.findById(product._id).lean())).image).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------------ variants
  describe("variants (/variant)", () => {
    let product;
    beforeEach(async () => {
      product = await f.product.create({ name: "Polo", category: category._id, variantType: "multipleVariant", stock: 0 });
    });
    const variantPayload = (overrides = {}) => ({
      product: product._id.toString(),
      variantName: "Polo Red M",
      color: "Red",
      size: "M",
      stockVariant: 6,
      purchasePrice: 300,
      retailPrice: 500,
      sku: "555001",
      barCode: "777001",
      ...overrides,
    });

    it("POST /variant creates variants and links them to the product", async () => {
      const res = await as().post("/variant").send({ variants: [variantPayload(), variantPayload({ variantName: "Polo Red L", sku: "555002", barCode: "777002", size: "L" })] }).expect(201);
      expect(res.body.data).toHaveLength(2);
      const p = await inTenant(() => Product.findById(product._id).lean());
      expect(p.variant).toHaveLength(2);
      const v = await inTenant(() => Variant.findOne({ variantName: "Polo Red M" }).lean());
      expect(v).toMatchObject({ stockVariant: 6, initialStock: 6, purchasePrice: 300 });
    });

    it.each([
      ["no variants", { variants: [] }],
      ["a non-numeric SKU", { variants: [{ sku: "ABC" }] }],
      ["a missing colour", { variants: [{ color: undefined }] }],
      ["a negative stock", { variants: [{ stockVariant: -1 }] }],
    ])("400 for %s", async (_name, body) => {
      const payload = body.variants.length ? { variants: body.variants.map((o) => variantPayload(o)) } : body;
      await as().post("/variant").send(payload).expect(400);
      expect(await inTenant(() => Variant.countDocuments())).toBe(0);
    });

    it("400 for a duplicate SKU or barcode", async () => {
      await as().post("/variant").send({ variants: [variantPayload()] }).expect(201);
      await as().post("/variant").send({ variants: [variantPayload({ variantName: "Other", barCode: "777009" })] }).expect(400);
      await as().post("/variant").send({ variants: [variantPayload({ variantName: "Other", sku: "555009" })] }).expect(400);
    });

    // BUG-065: a bracketed field name reaches Object.prototype of the server process
    it("POST /variant cannot pollute Object.prototype through a field name [BUG-065]", async () => {
      try {
        await as().post("/variant").send({ "__proto__[apiPolluted]": "yes", variants: [variantPayload()] });
        expect({}.apiPolluted).toBeUndefined();
      } finally {
        delete Object.prototype.apiPolluted;
      }
    });

    // BUG-039: allowUnknown + spread lets the client set sales counters on create
    it("POST /variant ignores sales counters sent by the client [BUG-039]", async () => {
      await as().post("/variant").send({ variants: [variantPayload({ posSold: 40, totalSales: 99, salesReturnStock: 5 })] }).expect(201);
      const v = await inTenant(() => Variant.findOne({ variantName: "Polo Red M" }).lean());
      expect(v).toMatchObject({ posSold: 0, totalSales: 0, salesReturnStock: 0 });
    });

    it("lists, searches, reads by slug, deactivates/activates and deletes (unlinking from the product)", async () => {
      const created = (await as().post("/variant").send({ variants: [variantPayload()] }).expect(201)).body.data[0];
      const list = await as().get("/variant").expect(200);
      expect(list.body.data.variants).toHaveLength(1);
      const search = await as().get("/search-variant").query({ q: "red m" }).expect(200);
      expect(search.body.data.variants).toHaveLength(1);
      await as().get("/search-variant").expect(400);
      await as().get("/search-variant").query({ q: "x", isActive: "maybe" }).expect(400);
      const one = await as().get(`/variant/${created.slug}`).expect(200);
      expect(one.body.data.variant._id).toBe(created._id);

      await as().post("/variant/deactive").query({ slug: created.slug }).expect(200);
      expect((await inTenant(() => Variant.findById(created._id).lean())).isActive).toBe(false);
      await as().post("/variant/active").query({ slug: created.slug }).expect(200);
      await as().post("/variant/active").query({ slug: "nope" }).expect(404);

      await as().put(`/variant/${created.slug}`).send({ retailPrice: 650 }).expect(200);
      expect((await inTenant(() => Variant.findById(created._id).lean())).retailPrice).toBe(650);

      await as().delete(`/variant/${created.slug}`).expect(200);
      expect(await inTenant(() => Variant.findById(created._id))).toBeNull();
      expect((await inTenant(() => Product.findById(product._id).lean())).variant).toEqual([]);
    });
  });
});
