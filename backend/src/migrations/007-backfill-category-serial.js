const Category = require("../models/category.model");
const { runForTenant } = require("../tenancy/context");

// Gives categories created before serials existed a CAT-<prefix>-NN serial,
// oldest first, so the numbering follows creation order.
module.exports = {
  name: "007-backfill-category-serial",
  up: ({ tenant }) =>
    runForTenant(tenant._id, async () => {
      const missing = await Category.find({ categorySerialId: { $in: [null, ""] } })
        .sort({ createdAt: 1, _id: 1 })
        .select("_id");

      for (const doc of missing) {
        await Category.assignSerial(doc);
      }

      return { assigned: missing.length };
    }),
};
