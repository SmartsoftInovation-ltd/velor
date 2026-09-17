const Role = require("../models/role.model");
const { runForTenant } = require("./context");

// Roles every new store starts with. `owner` bypasses permission checks inside
// its own store; the others start empty and are configured by the owner.
const ROLE_TEMPLATE = [
  { name: "owner", slug: "owner" },
  { name: "admin", slug: "admin" },
  { name: "manager", slug: "manager" },
  { name: "salesmen", slug: "salesmen" },
];

// Idempotent: existing roles are kept. Returns roles keyed by slug.
const seedTenantRoles = (tenantId, { session } = {}) =>
  runForTenant(tenantId, async () => {
    const existing = await Role.find({ slug: { $in: ROLE_TEMPLATE.map((r) => r.slug) } }).session(session || null).lean();
    const missing = ROLE_TEMPLATE.filter((r) => !existing.some((e) => e.slug === r.slug));
    // insertMany skips the save hook that blocks reserved slugs — only this seeder may create "owner"
    const created = missing.length ? await Role.insertMany(missing.map((r) => ({ ...r, isActive: true, permissions: [] })), { session }) : [];
    return Object.fromEntries([...existing, ...created.map((r) => r.toObject())].map((r) => [r.slug, r]));
  });

module.exports = { ROLE_TEMPLATE, seedTenantRoles };
