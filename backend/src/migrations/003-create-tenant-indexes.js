const { tenantModels } = require("./models");

// Builds every index declared by the tenant-scoped schemas (per-tenant unique
// indexes included). Old global unique indexes are left in place until cutover;
// an index that conflicts with one of them is reported and built at cutover.
const createTenantIndexes = async () => {
  const created = [];
  const conflicts = [];

  for (const Model of tenantModels()) {
    for (const [fields, options] of Model.schema.indexes()) {
      try {
        const name = await Model.collection.createIndex(fields, { background: true, ...options });
        created.push(`${Model.collection.collectionName}.${name}`);
      } catch (error) {
        if ([85, 86].includes(error.code)) {
          conflicts.push({ collection: Model.collection.collectionName, fields, reason: error.message });
        } else {
          throw error;
        }
      }
    }
  }

  return { created, conflicts };
};

module.exports = {
  name: "003-create-tenant-indexes",
  up: createTenantIndexes,
  createTenantIndexes,
};
