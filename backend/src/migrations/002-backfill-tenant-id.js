const { tenantModels } = require("./models");

const BATCH_SIZE = 1000;

// Stamps tenantId on every document that has none. Batched and re-runnable.
// Uses the driver directly: tenantId is immutable at the Mongoose level.
module.exports = {
  name: "002-backfill-tenant-id",
  async up({ tenant }) {
    const updated = {};

    for (const Model of tenantModels()) {
      const collection = Model.collection;
      let total = 0;

      for (;;) {
        const batch = await collection
          .find({ tenantId: { $exists: false } }, { projection: { _id: 1 } })
          .limit(BATCH_SIZE)
          .toArray();
        if (!batch.length) break;

        const result = await collection.updateMany(
          { _id: { $in: batch.map((d) => d._id) }, tenantId: { $exists: false } },
          { $set: { tenantId: tenant._id } },
        );
        total += result.modifiedCount;
      }

      if (total) updated[collection.collectionName] = total;
    }

    return { updated };
  },
};
