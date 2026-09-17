const mongoose = require("mongoose");
const { runForTenant } = require("../../src/tenancy/context");
const cacheUtil = require("../../src/utils/cache.util");
const { cache, connection } = require("../../src/config/redis.config");

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();
const ns = `test-ns-${Date.now()}`;

describe("tenant-scoped cache", () => {
  afterAll(async () => {
    const keys = await cache.keys(`*${ns}*`);
    if (keys.length) await cache.del(keys);
    await Promise.allSettled([cache.quit(), connection.quit()]);
  });

  it("the same logical key holds different values per tenant", async () => {
    const key = await runForTenant(A, () => cacheUtil.buildCacheKey(ns, "list"));
    await runForTenant(A, () => cacheUtil.setCache(key, ["pizza"], 60));
    await runForTenant(B, () => cacheUtil.setCache(key, ["burger"], 60));

    await expect(runForTenant(A, () => cacheUtil.getCache(key))).resolves.toEqual(["pizza"]);
    await expect(runForTenant(B, () => cacheUtil.getCache(key))).resolves.toEqual(["burger"]);
    await expect(cache.get(`t:${A}:${key}`)).resolves.toBe(JSON.stringify(["pizza"]));
  });

  it("bumping a namespace version only invalidates that tenant", async () => {
    const before = await runForTenant(B, () => cacheUtil.getNsVersion(ns));
    await runForTenant(A, () => cacheUtil.bumpNsVersion(ns));

    await expect(runForTenant(B, () => cacheUtil.getNsVersion(ns))).resolves.toBe(before);
    await expect(runForTenant(A, () => cacheUtil.getNsVersion(ns))).resolves.toBeGreaterThan(before);
  });

  it("deleteCache removes only the tenant's copy", async () => {
    await runForTenant(A, () => cacheUtil.setCache(`${ns}:single`, 1, 60));
    await runForTenant(B, () => cacheUtil.setCache(`${ns}:single`, 2, 60));
    await runForTenant(A, () => cacheUtil.deleteCache(`${ns}:single`));

    await expect(runForTenant(A, () => cacheUtil.getCache(`${ns}:single`))).resolves.toBeNull();
    await expect(runForTenant(B, () => cacheUtil.getCache(`${ns}:single`))).resolves.toBe(2);
  });

  it("keeps legacy unprefixed keys without a tenant context", async () => {
    await cacheUtil.setCache(`${ns}:legacy`, "v", 60);
    await expect(cache.get(`${ns}:legacy`)).resolves.toBe(JSON.stringify("v"));
  });
});
