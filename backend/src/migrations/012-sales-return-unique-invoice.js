const SalesReturn = require("../models/salesReturn.model");

// Builds the "one sales return per invoice" unique index (BUG-023) where
// autoIndex is off. If a store already has two returns for one invoice the
// build fails; those invoices are reported so they can be cleaned up by hand,
// and the migration can then be re-run with --force.
module.exports = {
  name: "012-sales-return-unique-invoice",
  up: async () => {
    // Databases built before this carry a non-unique index under the same name
    // (from the field's old `index: true`); MongoDB refuses to create the
    // unique one over it, so it is dropped first.
    const existing = await SalesReturn.collection.indexes().catch(() => []);
    const old = existing.find(
      (i) => i.name === "tenantId_1_invoiceNumber_1" && !i.unique,
    );
    if (old) await SalesReturn.collection.dropIndex(old.name);

    try {
      const name = await SalesReturn.collection.createIndex(
        { tenantId: 1, invoiceNumber: 1 },
        { unique: true, background: true },
      );
      return { created: name };
    } catch (error) {
      if (error.code !== 11000) throw error;
      const duplicates = await SalesReturn.collection
        .aggregate([
          { $group: { _id: { tenantId: "$tenantId", invoiceNumber: "$invoiceNumber" }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();
      return { created: null, duplicates: duplicates.map((d) => ({ ...d._id, count: d.count })) };
    }
  },
};
