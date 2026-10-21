/**
 * Build every index the schemas declare on the perf DB (what migration 014
 * does in production, where autoIndex is off). Guarded: perf DB only.
 *
 *   node perf/lib/apply-indexes.js
 */
const { assertPerfTarget, assertConnectedTarget } = require("./guard");
const target = assertPerfTarget();

require("module-alias/register");
const mongoose = require("mongoose");
const { createTenantIndexes } = require("../../src/migrations/003-create-tenant-indexes");

(async () => {
  await mongoose.connect(target.uri, { autoIndex: false });
  assertConnectedTarget(mongoose.connection);
  const started = Date.now();
  const result = await createTenantIndexes();
  console.log(JSON.stringify({ ...result, seconds: Math.round((Date.now() - started) / 1000) }, null, 2));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
