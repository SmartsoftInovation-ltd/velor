const mongoose = require("mongoose");
const Tenant = require("../models/platform/tenant.model");
const User = require("../models/user.model");
const settings = require("../settings/settings.service");
const { runForTenant } = require("./context");
const { seedTenantRoles } = require("./roleTemplate");
const { sendOwnerCredentials, loginUrlFor } = require("../service/ownerCredentials.service");

// "pizza-shop" -> "PIZZAS"
const invoicePrefixFor = (slug) => {
  const prefix = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  return prefix.length >= 2 ? prefix : "INV";
};

/**
 * Creates a ready-to-use store in one transaction: tenant, the owner role and the
 * owner account with the password the operator chose. Nothing is left behind if
 * any step fails. After commit the settings defaults are written and the owner is
 * sent their sign-in details (SMS, else email, when the platform has either).
 */
const provisionTenant = async ({ owner, ...tenantFields }, { createdBy = null } = {}) => {
  const { password } = owner;
  const session = await mongoose.startSession();
  let tenant;
  let ownerUser;

  try {
    await session.withTransaction(async () => {
      [tenant] = await Tenant.create([{ ...tenantFields, createdBy, status: "provisioning" }], { session });
      const roles = await seedTenantRoles(tenant._id, { session });

      [ownerUser] = await runForTenant(tenant._id, () =>
        User.create(
          [{
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
            password,
            accountType: "staff",
            roles: [roles.owner._id],
            isActive: true,
          }],
          { session },
        ),
      );

      tenant.ownerUserId = ownerUser._id;
      tenant.status = "active";
      tenant.statusChangedAt = new Date();
      await tenant.save({ session });
    });
  } finally {
    await session.endSession();
  }

  await settings.updateSection(tenant._id, "general", { invoicePrefix: invoicePrefixFor(tenant.slug) });

  const notification = await sendOwnerCredentials({ tenant, owner: ownerUser, password, reason: "created" });

  return {
    tenant,
    owner: { _id: ownerUser._id, name: ownerUser.name, email: ownerUser.email, phone: ownerUser.phone },
    loginUrl: loginUrlFor(tenant.slug),
    notification,
  };
};

module.exports = { provisionTenant, invoicePrefixFor };
