const { createTenantIndexes } = require("./003-create-tenant-indexes");

// Builds the indexes added for the Phase 2 performance fixes (BUG-P2-*) where
// autoIndex is off. createTenantIndexes() builds every index the schemas
// declare; those that already exist are left as they are.
module.exports = {
  name: "014-phase2-indexes",
  up: () => createTenantIndexes(),
};
