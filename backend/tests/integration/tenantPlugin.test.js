const mongoose = require("mongoose");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const {
  tenantPlugin,
  scopePipeline,
  resetTenancyWarnings,
} = require("../../src/tenancy/tenantPlugin");

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();

const itemSchema = new mongoose.Schema({ name: String, sku: String, qty: Number });
itemSchema.plugin(tenantPlugin);
const Item = mongoose.model("TpItem", itemSchema);

const orderSchema = new mongoose.Schema({ item: { type: mongoose.Schema.Types.ObjectId, ref: "TpItem" } });
orderSchema.plugin(tenantPlugin);
const Order = mongoose.model("TpOrder", orderSchema);

const inA = (fn) => runForTenant(A, fn);
const inB = (fn) => runForTenant(B, fn);

const codeSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  serial: { type: String, unique: true, sparse: true },
  a: String,
  b: String,
});
codeSchema.index({ a: 1, b: 1 }, { unique: true, sparse: true });
codeSchema.plugin(tenantPlugin);
const Code = mongoose.model("TpCode", codeSchema);

describe("tenantPlugin unique indexes", () => {
  beforeAll(async () => {
    await connectTestDb();
    await Code.init();
  });
  afterAll(disconnectTestDb);

  it("rewrites every unique index to be unique per tenant", () => {
    const unique = Code.schema.indexes().filter(([, options]) => options.unique);
    expect(unique.map(([fields]) => Object.keys(fields)).sort()).toEqual([
      ["tenantId", "a", "b"],
      ["tenantId", "code"],
      ["tenantId", "serial"],
    ]);
  });

  it("allows the same value in two tenants but not twice in one", async () => {
    await runForTenant(A, () => Code.create({ code: "X1" }));
    await expect(runForTenant(B, () => Code.create({ code: "X1" }))).resolves.toBeDefined();
    await expect(runForTenant(A, () => Code.create({ code: "X1" }))).rejects.toThrow(/duplicate key/);
  });

  it("keeps sparse semantics: documents without the field do not collide", async () => {
    await runForTenant(A, () => Code.create({ code: "S1" }));
    await expect(runForTenant(A, () => Code.create({ code: "S2" }))).resolves.toBeDefined();
  });
});

describe("tenantPlugin", () => {
  let a1, b1;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    await connectTestDb();
    await Item.init();
    await Order.init();
  });
  afterAll(disconnectTestDb);

  beforeEach(async () => {
    process.env.TENANCY_MODE = "shadow";
    resetTenancyWarnings();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await runAsPlatform(async () => {
      await Item.deleteMany({});
      await Order.deleteMany({});
    });
    a1 = await inA(() => Item.create({ name: "shirt", sku: "S1", qty: 1 }));
    await inA(() => Item.create({ name: "pant", sku: "P1", qty: 2 }));
    b1 = await inB(() => Item.create({ name: "shirt", sku: "S1", qty: 9 }));
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  describe("reads", () => {
    it("find returns only the current tenant's documents", async () => {
      const items = await inA(() => Item.find().lean());
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.tenantId.equals(A))).toBe(true);
    });

    it("findOne and findById cannot reach another tenant's document", async () => {
      await expect(inA(() => Item.findById(b1._id))).resolves.toBeNull();
      const shirt = await inA(() => Item.findOne({ name: "shirt" }));
      expect(shirt._id.equals(a1._id)).toBe(true);
    });

    it("a tenantId in the filter cannot widen the scope", async () => {
      await expect(inA(() => Item.find({ tenantId: B }))).resolves.toHaveLength(0);
    });

    it("countDocuments, distinct and exists are scoped", async () => {
      await expect(inA(() => Item.countDocuments())).resolves.toBe(2);
      await expect(inB(() => Item.distinct("qty"))).resolves.toEqual([9]);
      await expect(inA(() => Item.exists({ _id: b1._id }))).resolves.toBeNull();
    });

    it("populate cannot pull in another tenant's document", async () => {
      await runAsPlatform(() => Order.collection.insertOne({ tenantId: A, item: b1._id }));
      const order = await inA(() => Order.findOne().populate("item"));
      expect(order.item).toBeNull();
    });
  });

  describe("writes", () => {
    it("create stamps the current tenant", () => {
      expect(a1.tenantId.equals(A)).toBe(true);
      expect(b1.tenantId.equals(B)).toBe(true);
    });

    it("create with another tenant's id is rejected", async () => {
      await expect(inA(() => Item.create({ name: "x", tenantId: B }))).rejects.toThrow(/tenant mismatch/i);
    });

    it("saving another tenant's document is rejected", async () => {
      const foreign = await runAsPlatform(() => Item.findById(b1._id));
      foreign.qty = 100;
      await expect(inA(() => foreign.save())).rejects.toThrow(/tenant mismatch/i);
    });

    it("updateMany and updateOne only touch the current tenant", async () => {
      await inA(() => Item.updateMany({}, { $set: { qty: 0 } }));
      const res = await inA(() => Item.updateOne({ _id: b1._id }, { $set: { qty: 0 } }));

      expect(res.matchedCount).toBe(0);
      const b = await runAsPlatform(() => Item.findById(b1._id));
      expect(b.qty).toBe(9);
    });

    it("tenantId cannot be changed by an update", async () => {
      await inA(() => Item.updateOne({ _id: a1._id }, { $set: { tenantId: B } }));
      const a = await runAsPlatform(() => Item.findById(a1._id));
      expect(a.tenantId.equals(A)).toBe(true);
    });

    it("upsert stamps the current tenant on the inserted document", async () => {
      const doc = await inA(() =>
        Item.findOneAndUpdate({ sku: "NEW" }, { $set: { qty: 5 } }, { upsert: true, new: true }),
      );
      expect(doc.tenantId.equals(A)).toBe(true);
    });

    it("deleteMany and findOneAndDelete cannot remove another tenant's documents", async () => {
      await inA(() => Item.deleteMany({}));
      await expect(inA(() => Item.findOneAndDelete({ _id: b1._id }))).resolves.toBeNull();
      await expect(runAsPlatform(() => Item.countDocuments())).resolves.toBe(1);
    });

    it("document-level deleteOne and updateOne cannot touch another tenant's document", async () => {
      const foreign = await runAsPlatform(() => Item.findById(b1._id));

      await inA(async () => {
        await foreign.updateOne({ $set: { qty: 0 } });
        await foreign.deleteOne();
      });

      const b = await runAsPlatform(() => Item.findById(b1._id));
      expect(b).not.toBeNull();
      expect(b.qty).toBe(9);
    });

    it("replaceOne keeps the tenant on the replacement", async () => {
      await inA(() => Item.replaceOne({ _id: a1._id }, { name: "replaced" }));
      const a = await runAsPlatform(() => Item.findById(a1._id));
      expect(a.name).toBe("replaced");
      expect(a.tenantId.equals(A)).toBe(true);
    });

    it("insertMany stamps every document and rejects foreign tenant ids", async () => {
      const docs = await inA(() => Item.insertMany([{ name: "m1" }, { name: "m2" }]));
      expect(docs.every((d) => d.tenantId.equals(A))).toBe(true);
      await expect(inA(() => Item.insertMany([{ name: "m3", tenantId: B }]))).rejects.toThrow(/tenant mismatch/i);
    });

    it("bulkWrite scopes filters and stamps inserts", async () => {
      await inA(() =>
        Item.bulkWrite([
          { insertOne: { document: { name: "bulk" } } },
          { updateMany: { filter: {}, update: { $set: { qty: 7 } } } },
          { deleteOne: { filter: { _id: b1._id } } },
        ]),
      );

      const all = await runAsPlatform(() => Item.find().lean());
      const bulk = all.find((i) => i.name === "bulk");
      expect(bulk.tenantId.equals(A)).toBe(true);
      const b = all.find((i) => i._id.equals(b1._id));
      expect(b.qty).toBe(9);
    });
  });

  describe("aggregate", () => {
    it("only aggregates the current tenant's documents", async () => {
      const [row] = await inB(() => Item.aggregate([{ $group: { _id: null, total: { $sum: "$qty" } } }]));
      expect(row.total).toBe(9);
    });

    it("scopePipeline prepends a tenant $match", () => {
      expect(scopePipeline([{ $sort: { qty: 1 } }], A)).toEqual([
        { $match: { tenantId: A } },
        { $sort: { qty: 1 } },
      ]);
    });

    it("scopePipeline adds the tenant to $vectorSearch.filter instead of a leading $match", () => {
      const pipeline = [{ $vectorSearch: { index: "v", filter: { isActive: true } } }, { $limit: 3 }];
      expect(scopePipeline(pipeline, A)).toEqual([
        { $vectorSearch: { index: "v", filter: { $and: [{ isActive: true }, { tenantId: A }] } } },
        { $limit: 3 },
      ]);
    });

    it("scopePipeline adds the tenant to $geoNear.query", () => {
      const pipeline = [{ $geoNear: { near: [0, 0], distanceField: "d" } }];
      expect(scopePipeline(pipeline, A)[0].$geoNear.query).toEqual({ tenantId: A });
    });

    it("scopePipeline keeps stages that must be first ahead of the $match", () => {
      const pipeline = [{ $search: { text: { query: "x", path: "name" } } }, { $limit: 1 }];
      expect(scopePipeline(pipeline, A)).toEqual([
        pipeline[0],
        { $match: { tenantId: A } },
        { $limit: 1 },
      ]);
    });
  });

  describe("modes", () => {
    it("shadow mode does not warn unless unscoped logging is enabled", async () => {
      await Item.find();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("shadow mode leaves queries without context unscoped and warns once per model and operation", async () => {
      process.env.TENANCY_LOG_UNSCOPED = "true";
      const all = await Item.find();
      await Item.find();

      expect(all).toHaveLength(3);
      const findWarnings = console.warn.mock.calls.filter(([msg]) => /TpItem.*find/.test(msg));
      expect(findWarnings).toHaveLength(1);
    });

    it("strict mode rejects queries and writes without context", async () => {
      process.env.TENANCY_MODE = "strict";
      await expect(Item.find()).rejects.toThrow(/tenant context/i);
      await expect(Item.create({ name: "x" })).rejects.toThrow(/tenant context/i);
      await expect(Item.aggregate([{ $match: {} }])).rejects.toThrow(/tenant context/i);
    });

    it("platform scope is unscoped even in strict mode", async () => {
      process.env.TENANCY_MODE = "strict";
      await expect(runAsPlatform(() => Item.countDocuments())).resolves.toBe(3);
    });

    it("estimatedDocumentCount is refused inside a tenant scope", async () => {
      await expect(inA(() => Item.estimatedDocumentCount())).rejects.toThrow(/estimatedDocumentCount/);
    });
  });
});
