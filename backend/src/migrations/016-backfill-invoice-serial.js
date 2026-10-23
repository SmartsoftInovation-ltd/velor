const Invoice = require("../models/invoice.model");
const { runForTenant } = require("../tenancy/context");

// Gives invoices created before serials existed an INV-<prefix>-NN serial,
// oldest first, so the numbering follows creation order.
module.exports = {
  name: "016-backfill-invoice-serial",
  up: ({ tenant }) =>
    runForTenant(tenant._id, async () => {
      const missing = await Invoice.find({ invoiceSerialId: { $in: [null, ""] } })
        .sort({ createdAt: 1, _id: 1 })
        .select("_id");

      for (const doc of missing) {
        await Invoice.assignSerial(doc);
      }

      return { assigned: missing.length };
    }),
};
