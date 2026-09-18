const { runAsPlatform } = require("../tenancy/context");
const { tenantModels } = require("./models");

/**
 * Read-only check of what a live database actually looks like, before strict
 * mode carries real traffic. Writes nothing and drops nothing — `runCutover()`
 * is the step that changes things, and it refuses to run while this reports
 * documents without a tenant.
 *
 * Three questions it answers, each of which silently breaks multi-tenancy:
 *
 * 1. Documents with no `tenantId`. In strict mode those rows belong to no store
 *    and no query will ever return them.
 * 2. Global unique indexes left over from the single-tenant schema (unique on
 *    `email`, `slug`, `invoiceNumber`, …). The second tenant to use the same
 *    value cannot insert at all, and the error looks like a duplicate bug.
 * 3. Per-tenant indexes the model declares that the database does not have —
 *    usually because a global unique index is still blocking them.
 */

// MongoDB does not store a text index under the fields it was declared with: it
// reports `{ _fts: "text", _ftsx: 1 }` and lists the real fields under `weights`.
// Both sides collapse to one "text" signature, since a collection can only hold
// a single text index anyway.
const indexSignature = (key) =>
  Object.values(key).includes("text")
    ? "text"
    : Object.entries(key).map(([field, dir]) => `${field}:${dir}`).join(",");

const collectionIndexes = async (collection) => {
  try {
    return await collection.indexes();
  } catch (error) {
    // Collection not created yet: nothing deployed, nothing to audit
    if (error.codeName === "NamespaceNotFound") return null;
    throw error;
  }
};

const auditTenancy = () =>
  runAsPlatform(async () => {
    const untenanted = [];
    const globalUniqueIndexes = [];
    const missingIndexes = [];
    const collections = [];

    for (const Model of tenantModels()) {
      const collection = Model.collection;
      const name = collection.collectionName;

      const live = await collectionIndexes(collection);
      if (live === null) continue;
      collections.push(name);

      const missing = await collection.countDocuments({ tenantId: { $exists: false } });
      if (missing) untenanted.push({ collection: name, documents: missing });

      // Unique, not led by tenantId: one store's value blocks every other store
      for (const index of live) {
        if (index.name !== "_id_" && index.unique && Object.keys(index.key)[0] !== "tenantId") {
          globalUniqueIndexes.push({ collection: name, index: index.name, key: index.key });
        }
      }

      const deployed = new Set(live.map((index) => indexSignature(index.key)));
      for (const [fields] of Model.schema.indexes()) {
        if (!deployed.has(indexSignature(fields))) {
          missingIndexes.push({ collection: name, fields });
        }
      }
    }

    return {
      collections: collections.length,
      untenanted,
      globalUniqueIndexes,
      missingIndexes,
      // Safe to run strict against this database only when all three are empty
      ready: !untenanted.length && !globalUniqueIndexes.length && !missingIndexes.length,
    };
  });

// Human-readable summary for the CLI; the JSON report stays the source of truth
const formatAudit = (report) => {
  const lines = [`Checked ${report.collections} tenant-scoped collections.`];

  if (report.untenanted.length) {
    lines.push("", "Documents without tenantId (invisible in strict mode):");
    report.untenanted.forEach((row) => lines.push(`  ${row.collection}: ${row.documents}`));
    lines.push("  Fix: npm run migrate -- --tenant <slug>");
  }

  if (report.globalUniqueIndexes.length) {
    lines.push("", "Global unique indexes (block the second tenant from inserting):");
    report.globalUniqueIndexes.forEach((row) => lines.push(`  ${row.collection}.${row.index} ${JSON.stringify(row.key)}`));
    lines.push("  Fix: npm run migrate:cutover");
  }

  if (report.missingIndexes.length) {
    lines.push("", "Indexes the models declare but the database does not have:");
    report.missingIndexes.forEach((row) => lines.push(`  ${row.collection} ${JSON.stringify(row.fields)}`));
    lines.push("  Fix: npm run migrate:cutover (it rebuilds them once the old ones are gone)");
  }

  lines.push("", report.ready ? "Ready for TENANCY_MODE=strict." : "Not ready for strict mode — fix the above first.");
  return lines.join("\n");
};

module.exports = { auditTenancy, formatAudit };
