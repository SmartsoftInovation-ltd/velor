const { tenantModels } = require("./models");

// Records which Cloudinary account existing images live in (the legacy env
// account), so deletes keep working after a tenant switches accounts.

const hasPublicIdPath = (schema) =>
  Boolean(schema.path("publicId")) || schema.childSchemas.some(({ schema: child }) => hasPublicIdPath(child));

const cloudNameUpdates = (value, path = "", updates = {}) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => cloudNameUpdates(item, path ? `${path}.${index}` : `${index}`, updates));
  } else if (value && typeof value === "object" && !(value instanceof Date) && !value._bsontype) {
    if (typeof value.publicId === "string" && value.publicId && !value.cloudName && path) {
      updates[`${path}.cloudName`] = true;
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "_id") cloudNameUpdates(child, path ? `${path}.${key}` : key, updates);
    }
  }
  return updates;
};

module.exports = {
  name: "004-backfill-cloud-name",
  async up({ tenant, env = process.env }) {
    const cloudName = env.CLOUD_NAME;
    if (!cloudName) return { skipped: "CLOUD_NAME is not set" };

    const updated = {};
    for (const Model of tenantModels().filter((M) => hasPublicIdPath(M.schema))) {
      const collection = Model.collection;
      const ops = [];

      for await (const doc of collection.find({ tenantId: tenant._id })) {
        const paths = Object.keys(cloudNameUpdates(doc));
        if (paths.length) {
          ops.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: Object.fromEntries(paths.map((p) => [p, cloudName])) },
            },
          });
        }
      }

      if (ops.length) {
        await collection.bulkWrite(ops, { ordered: false });
        updated[collection.collectionName] = ops.length;
      }
    }

    return { cloudName, updated };
  },
};
