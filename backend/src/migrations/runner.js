const mongoose = require("mongoose");
const Tenant = require("../models/platform/tenant.model");
const { runAsPlatform } = require("../tenancy/context");
const { tenantModels } = require("./models");
const { createTenantIndexes } = require("./003-create-tenant-indexes");

const MIGRATIONS = [
  require("./001-import-env-settings"),
  require("./002-backfill-tenant-id"),
  require("./003-create-tenant-indexes"),
  require("./004-backfill-cloud-name"),
  require("./005-owner-role"),
  require("./006-drop-global-role-indexes"),
  require("./007-backfill-category-serial"),
  require("./008-backfill-sale-purchase-price"),
  require("./009-backfill-sale-created-by"),
  require("./010-decrypt-settings-secrets"),
  require("./011-mark-system-transaction-categories"),
  require("./012-sales-return-unique-invoice"),
  require("./013-audit-job-id-index"),
  require("./014-phase2-indexes"),
  require("./015-backfill-search-words"),
];

const records = () => mongoose.connection.collection("migrations");

/**
 * Moves the existing single-tenant data into the given tenant.
 * Each migration runs once per tenant (recorded in the `migrations` collection).
 */
const runMigrations = ({ tenantSlug, force = false }) =>
  runAsPlatform(async () => {
    const tenant = await Tenant.findOne({ slug: tenantSlug });
    if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found — create it first (npm run tenant:create)`);

    const report = [];
    for (const migration of MIGRATIONS) {
      const done = await records().findOne({ name: migration.name, tenantId: tenant._id });
      if (done && !force) {
        report.push({ name: migration.name, status: "skipped" });
        continue;
      }

      const result = await migration.up({ tenant });
      await records().updateOne(
        { name: migration.name, tenantId: tenant._id },
        { $set: { appliedAt: new Date(), result } },
        { upsert: true },
      );
      report.push({ name: migration.name, status: "applied", result });
    }
    return report;
  });

/**
 * Final step, run once every legacy document has a tenant: drops the old
 * global unique indexes and builds any per-tenant index they were blocking.
 */
const runCutover = () =>
  runAsPlatform(async () => {
    const models = tenantModels();

    for (const Model of models) {
      const missing = await Model.collection.countDocuments({ tenantId: { $exists: false } });
      if (missing) {
        throw new Error(`${Model.collection.collectionName} has ${missing} documents without tenantId — run migrations first`);
      }
    }

    const dropped = [];
    for (const Model of models) {
      const collection = Model.collection;
      let indexes;
      try {
        indexes = await collection.indexes();
      } catch (error) {
        if (error.codeName === "NamespaceNotFound") continue;
        throw error;
      }

      for (const index of indexes) {
        if (index.name !== "_id_" && index.unique && Object.keys(index.key)[0] !== "tenantId") {
          await collection.dropIndex(index.name);
          dropped.push(`${collection.collectionName}.${index.name}`);
        }
      }
    }

    const { conflicts } = await createTenantIndexes();
    return { dropped, remainingConflicts: conflicts };
  });

module.exports = { runMigrations, runCutover, MIGRATIONS };
