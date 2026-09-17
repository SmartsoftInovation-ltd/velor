const mongoose = require("mongoose");
const {
  runForTenant,
  runAsPlatform,
  getTenantId,
  isPlatform,
} = require("../../src/tenancy/context");

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();

describe("tenancy/context", () => {
  it("has no tenant outside a scope", () => {
    expect(getTenantId()).toBeUndefined();
    expect(isPlatform()).toBe(false);
  });

  it("exposes the tenant inside a scope and returns the callback result", () => {
    const result = runForTenant(A, () => {
      expect(getTenantId().equals(A)).toBe(true);
      return "done";
    });
    expect(result).toBe("done");
    expect(getTenantId()).toBeUndefined();
  });

  it("accepts a hex string id and normalizes it to an ObjectId", () => {
    runForTenant(A.toString(), () => {
      expect(getTenantId()).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(getTenantId().equals(A)).toBe(true);
    });
  });

  it("rejects an invalid tenant id", () => {
    expect(() => runForTenant("not-an-id", () => {})).toThrow(/invalid tenant id/i);
    expect(() => runForTenant(undefined, () => {})).toThrow(/invalid tenant id/i);
  });

  it("survives awaits and timers", async () => {
    await runForTenant(A, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await Promise.resolve();
      expect(getTenantId().equals(A)).toBe(true);
    });
  });

  it("keeps concurrent scopes isolated", async () => {
    const seen = [];
    const work = (id, delay) =>
      runForTenant(id, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        seen.push([id.toString(), getTenantId().toString()]);
      });

    await Promise.all([work(A, 10), work(B, 1)]);

    for (const [expected, actual] of seen) expect(actual).toBe(expected);
  });

  it("restores the outer scope after a nested scope", () => {
    runForTenant(A, () => {
      runForTenant(B, () => expect(getTenantId().equals(B)).toBe(true));
      expect(getTenantId().equals(A)).toBe(true);
    });
  });

  it("marks platform scopes and clears any tenant", () => {
    runForTenant(A, () => {
      runAsPlatform(() => {
        expect(isPlatform()).toBe(true);
        expect(getTenantId()).toBeUndefined();
      });
      expect(isPlatform()).toBe(false);
    });
  });

  it("executes a returned query-like value (exec) inside the scope", async () => {
    const seen = [];
    const queryLike = { exec: () => Promise.resolve(seen.push(getTenantId()?.toString())) };

    await runForTenant(A, () => queryLike);
    await runAsPlatform(() => ({ exec: async () => seen.push(isPlatform()) }));

    expect(seen).toEqual([A.toString(), true]);
  });
});
