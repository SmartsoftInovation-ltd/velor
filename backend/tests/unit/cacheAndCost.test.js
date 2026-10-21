const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { flushRedis, testRedis, closeRedis, closeAppRedis } = require("../helpers/redis");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const cacheUtil = require("../../src/utils/cache.util");
const { stampPurchasePrices } = require("../../src/utils/saleCost.util");
const Product = require("../../src/models/product.model");
const Variant = require("../../src/models/variant.model");

// cache.util against the real test Redis; saleCost.util against Mongo.
describe("cache.util (tenant-scoped Redis cache)", () => {
  const tenantA = new mongoose.Types.ObjectId();
  const tenantB = new mongoose.Types.ObjectId();

  beforeEach(flushRedis);
  afterAll(async () => {
    await closeAppRedis();
    await closeRedis();
  });

  it("stores JSON under t:<tenant>:<key> with the given TTL, and reads it back", async () => {
    await runForTenant(tenantA, () => cacheUtil.setCache("product:list", { n: 1 }, 120));
    expect(await testRedis().get(`t:${tenantA}:product:list`)).toBe('{"n":1}');
    const ttl = await testRedis().ttl(`t:${tenantA}:product:list`);
    expect(ttl).toBeGreaterThan(100);
    expect(ttl).toBeLessThanOrEqual(120);
    expect(await runForTenant(tenantA, () => cacheUtil.getCache("product:list"))).toEqual({ n: 1 });
  });

  it("defaults to a 60 second TTL — no cache entry lives forever", async () => {
    await runForTenant(tenantA, () => cacheUtil.setCache("k", 1));
    const ttl = await testRedis().ttl(`t:${tenantA}:k`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });

  it("never lets one tenant read another's entry", async () => {
    await runForTenant(tenantA, () => cacheUtil.setCache("same-key", "A"));
    expect(await runForTenant(tenantB, () => cacheUtil.getCache("same-key"))).toBeNull();
  });

  it("refuses to cache without a tenant (TenancyError), uses p: for platform code", async () => {
    await expect(cacheUtil.getCache("x")).rejects.toMatchObject({ name: "TenancyError" });
    await runAsPlatform(() => cacheUtil.setCache("x", 1));
    expect(await testRedis().get("p:x")).toBe("1");
  });

  it("answers null for a corrupt entry instead of throwing", async () => {
    await testRedis().set(`t:${tenantA}:bad`, "{not json");
    expect(await runForTenant(tenantA, () => cacheUtil.getCache("bad"))).toBeNull();
  });

  it("namespace versions start at 1, go to 2 on the first bump, then count up; old keys become unreachable", async () => {
    await runForTenant(tenantA, async () => {
      expect(await cacheUtil.getNsVersion("brand")).toBe(1);
      const k1 = await cacheUtil.buildCacheKey("brand", "all");
      expect(k1).toBe("brand:v1:all");
      expect(await cacheUtil.bumpNsVersion("brand")).toBe(2);
      expect(await cacheUtil.bumpNsVersion("brand")).toBe(3);
      expect(await cacheUtil.buildCacheKey("brand", "all")).toBe("brand:v3:all");
    });
    expect(await testRedis().ttl(`t:${tenantA}:brand:v`)).toBe(-1);
  });

  it("bumping a namespace the dashboard reads also bumps the dashboard; others do not", async () => {
    await runForTenant(tenantA, async () => {
      await cacheUtil.bumpNsVersion("sales");
      expect(await cacheUtil.getNsVersion("dashboard")).toBe(2);
      await cacheUtil.bumpNsVersion("coupon");
      expect(await cacheUtil.getNsVersion("dashboard")).toBe(2);
    });
    expect([...cacheUtil.DASHBOARD_SOURCE_NAMESPACES]).toEqual(expect.arrayContaining(["sales", "purchase", "stock", "account"]));
  });

  // BUG-066: bumpOne() turns the very first INCR (result 1) into 2 with a
  // separate SET; when other bumps land in between, that SET drags the version
  // back down to 2 and keys cached at the higher versions become live again
  it("concurrent bumps never move the version backwards [BUG-066]", async () => {
    await runForTenant(tenantA, () => Promise.all(Array.from({ length: 25 }, () => cacheUtil.bumpNsVersion("load"))));
    // first bump goes 1→2, so 25 bumps land on 26
    expect(await runForTenant(tenantA, () => cacheUtil.getNsVersion("load"))).toBe(26);
  });
});

describe("stampPurchasePrices (sale line cost)", () => {
  const tenantId = new mongoose.Types.ObjectId();
  const inTenant = (fn) => runForTenant(tenantId, fn);
  let product;
  let freeVariant;
  let unpricedVariant;

  beforeAll(connectTestDb);
  beforeEach(async () => {
    product = await inTenant(() => Product.collection.insertOne({ tenantId, name: "P", purchasePrice: 400 }));
    freeVariant = await inTenant(() => Variant.collection.insertOne({ tenantId, product: product.insertedId, purchasePrice: 0 }));
    unpricedVariant = await inTenant(() => Variant.collection.insertOne({ tenantId, product: product.insertedId }));
  });
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  it("stamps the product's price on a product line, ignoring a price in the request", async () => {
    const [line] = await inTenant(() => stampPurchasePrices([{ productId: product.insertedId, purchasePrice: 1 }]));
    expect(line.purchasePrice).toBe(400);
  });

  it("a variant priced 0 is stamped 0; a variant with no price falls back to its product", async () => {
    const lines = await inTenant(() =>
      stampPurchasePrices([
        { productId: product.insertedId, variantId: freeVariant.insertedId },
        { productId: product.insertedId, variantId: unpricedVariant.insertedId },
      ]),
    );
    expect(lines.map((l) => l.purchasePrice)).toEqual([0, 400]);
  });

  it("keeps the first stamp of a line already on the sale", async () => {
    const [line] = await inTenant(() => stampPurchasePrices([{ productId: product.insertedId }], null, [{ productId: product.insertedId, purchasePrice: 250 }]));
    expect(line.purchasePrice).toBe(250);
  });

  it("stamps 0 for an unknown product; passes empty input through", async () => {
    const [line] = await inTenant(() => stampPurchasePrices([{ productId: new mongoose.Types.ObjectId() }]));
    expect(line.purchasePrice).toBe(0);
    expect(await stampPurchasePrices([])).toEqual([]);
    expect(await stampPurchasePrices(undefined)).toBeUndefined();
  });

  it("never reads another tenant's catalogue", async () => {
    const other = new mongoose.Types.ObjectId();
    const [line] = await runForTenant(other, () => stampPurchasePrices([{ productId: product.insertedId }]));
    expect(line.purchasePrice).toBe(0);
  });
});
