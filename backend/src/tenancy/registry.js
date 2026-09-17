// Models that are intentionally NOT tenant-scoped. Every other model must apply
// tenantPlugin — enforced by tests/integration/tenancyRegistry.test.js.
const GLOBAL_MODELS = [
  "Permission", // module catalog shared by all tenants, managed by the platform
  "Tenant", // control plane
];

module.exports = { GLOBAL_MODELS };
