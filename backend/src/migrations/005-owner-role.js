const Role = require("../models/role.model");
const User = require("../models/user.model");
const Tenant = require("../models/platform/tenant.model");
const { seedTenantRoles } = require("../tenancy/roleTemplate");

// The single-tenant "superadmin" role becomes the tenant's "owner" role (bypass
// only inside the store). Missing template roles are added; the first user
// holding the owner role is recorded on the tenant.
module.exports = {
  name: "005-owner-role",
  async up({ tenant }) {
    const renamed = await Role.collection.updateOne(
      { tenantId: tenant._id, slug: "superadmin" },
      { $set: { slug: "owner", name: "owner" } },
    );

    const roles = await seedTenantRoles(tenant._id);

    const owner = await User.collection.findOne(
      { tenantId: tenant._id, roles: roles.owner._id },
      { sort: { createdAt: 1, _id: 1 } },
    );
    if (owner && !tenant.ownerUserId) {
      await Tenant.updateOne({ _id: tenant._id }, { $set: { ownerUserId: owner._id } });
    }

    return { renamedSuperadmin: renamed.modifiedCount === 1, ownerUserId: owner?._id || null };
  },
};
