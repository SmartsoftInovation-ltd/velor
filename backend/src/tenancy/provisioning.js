const crypto = require("crypto");
const mongoose = require("mongoose");
const Tenant = require("../models/platform/tenant.model");
const User = require("../models/user.model");
const settings = require("../settings/settings.service");
const { runForTenant } = require("./context");
const { seedTenantRoles } = require("./roleTemplate");

// "pizza-shop" -> "PIZZAS"
const invoicePrefixFor = (slug) => {
  const prefix = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  return prefix.length >= 2 ? prefix : "INV";
};

const temporaryPassword = () => crypto.randomBytes(12).toString("base64url");

/**
 * Creates a ready-to-use store in one transaction: tenant, default roles and the
 * owner account. Nothing is left behind if any step fails. Settings defaults are
 * written after commit (they are idempotent and have implicit defaults anyway).
 */
const provisionTenant = async ({ owner, ...tenantFields }, { createdBy = null } = {}) => {
  const password = owner.password || temporaryPassword();
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
            roles: [roles.owner._id],
            mustChangePassword: !owner.password,
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

  const appUrl = (process.env.APP_URL || process.env.DASHBOARD_URL || "").replace(/\/+$/, "");
  return {
    tenant,
    owner: {
      _id: ownerUser._id,
      name: ownerUser.name,
      email: ownerUser.email,
      phone: ownerUser.phone,
      ...(owner.password ? {} : { temporaryPassword: password }),
    },
    loginUrl: `${appUrl}/signin?workspace=${tenant.slug}`,
  };
};

module.exports = { provisionTenant, invoicePrefixFor };
