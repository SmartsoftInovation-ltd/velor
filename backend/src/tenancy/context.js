const { AsyncLocalStorage } = require("async_hooks");
const mongoose = require("mongoose");

// Request-scoped tenancy state. Propagates through awaits, timers and
// Mongoose hooks, so models can scope queries without controllers passing ids.
const storage = new AsyncLocalStorage();

const toObjectId = (tenantId) => {
  if (tenantId instanceof mongoose.Types.ObjectId) return tenantId;
  if (typeof tenantId === "string" && mongoose.Types.ObjectId.isValid(tenantId) && /^[a-f0-9]{24}$/i.test(tenantId)) {
    return new mongoose.Types.ObjectId(tenantId);
  }
  throw new Error(`Invalid tenant id: ${tenantId}`);
};

// Mongoose queries/aggregates are lazy: returned un-awaited they would execute
// after the scope ends, unscoped. Execute them while still inside the scope.
const runInScope = (store, fn) =>
  storage.run(store, () => {
    const result = fn();
    return result && typeof result.exec === "function" ? result.exec() : result;
  });

// Runs fn with every tenant-scoped query limited to tenantId
const runForTenant = (tenantId, fn) =>
  runInScope({ tenantId: toObjectId(tenantId), platform: false }, fn);

// Runs fn with tenant scoping deliberately bypassed (platform/migration code only)
const runAsPlatform = (fn) => runInScope({ tenantId: undefined, platform: true }, fn);

const getTenantId = () => storage.getStore()?.tenantId;

const isPlatform = () => storage.getStore()?.platform === true;

module.exports = { runForTenant, runAsPlatform, getTenantId, isPlatform, toObjectId };
