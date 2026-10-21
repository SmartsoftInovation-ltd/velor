const { auditLogModel } = require("../models/auditLog.model");

// Builds the { tenantId, jobId } index the audit worker's idempotent write
// looks up (BUG-060) where autoIndex is off. Without it every audit job would
// scan the audit collection.
module.exports = {
  name: "013-audit-job-id-index",
  up: async () => {
    const name = await auditLogModel.collection.createIndex(
      { tenantId: 1, jobId: 1 },
      { unique: true, partialFilterExpression: { jobId: { $type: "string" } }, background: true },
    );
    return { created: name };
  },
};
