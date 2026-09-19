const Role = require("../models/role.model");

// Roles are per-tenant: every tenant gets its own "owner", "manager", ... The
// legacy single-tenant schema declared `slug` and `name` globally unique, so
// provisioning a second tenant failed with
//   E11000 duplicate key ... index: slug_1 dup key: { slug: "owner" }
// even though the tenant-scoped replacements (tenantId_1_slug_1,
// tenantId_1_name_1) were already built by 003.
//
// The full cutover (runCutover) drops these across every collection, but it
// refuses to run until the last legacy document has a tenantId. Roles are
// already fully migrated, so this step unblocks tenant provisioning on its own.
// Uniqueness inside a tenant is unaffected — it is enforced by the scoped
// indexes, which this migration verifies are present before dropping anything.
const LEGACY_INDEXES = ["slug_1", "name_1"];
const REQUIRED_SCOPED_INDEXES = ["tenantId_1_slug_1", "tenantId_1_name_1"];

module.exports = {
  name: "006-drop-global-role-indexes",
  async up() {
    const collection = Role.collection;

    let indexes;
    try {
      indexes = await collection.indexes();
    } catch (error) {
      if (error.codeName === "NamespaceNotFound") return { dropped: [], skipped: "no roles collection" };
      throw error;
    }

    const names = indexes.map((index) => index.name);

    const missing = REQUIRED_SCOPED_INDEXES.filter((name) => !names.includes(name));
    if (missing.length) {
      throw new Error(
        `Refusing to drop global role indexes: scoped index ${missing.join(", ")} is missing — run 003-create-tenant-indexes first`,
      );
    }

    const untenanted = await collection.countDocuments({ tenantId: { $exists: false } });
    if (untenanted) {
      throw new Error(`roles has ${untenanted} documents without tenantId — run 002-backfill-tenant-id first`);
    }

    const dropped = [];
    for (const name of LEGACY_INDEXES) {
      if (!names.includes(name)) continue;
      await collection.dropIndex(name);
      dropped.push(`${collection.collectionName}.${name}`);
    }

    return { dropped };
  },
};
